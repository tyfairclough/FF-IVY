"use strict";

/**
 * Local Neon SQL-over-HTTP proxy.
 *
 * The app talks to Postgres exclusively through `@neondatabase/serverless`'s
 * `neon()` HTTP driver. That driver POSTs to `https://<db-host>/sql` using
 * Neon's SQL-over-HTTP protocol. For local development we point `DATABASE_URL`
 * at host `localhost`, so the driver fetches `https://localhost/sql`. This
 * process implements that endpoint and forwards queries to a real local
 * Postgres, letting the unmodified app run fully offline.
 *
 * Protocol reference (derived from @neondatabase/serverless):
 *   Request headers: `Neon-Connection-String`, `Neon-Raw-Text-Output: true`,
 *                    `Neon-Array-Mode: true`, optional batch headers.
 *   Request body (single): { query: string, params: any[] }
 *   Request body (batch):  { queries: [{ query, params }, ...] }
 *   Response (single, 200): { fields:[{name,dataTypeID}], rows:[[text|null,...]],
 *                             command, rowCount }
 *   Response (batch,  200): { results: [ <single-shape>, ... ] }
 *   Response (error, 400):  { message, code, detail, hint, ... }
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { Pool } = require("pg");

const PORT = Number(process.env.NEON_PROXY_PORT || 443);
const CERT_DIR = path.join(__dirname, "certs");

// Return the raw wire text for every type so the Neon driver can apply its own
// pg type parsers based on the dataTypeID we report.
const RAW_TEXT_TYPES = { getTypeParser: () => (value) => value };

const pools = new Map();

function getPool(connectionString) {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString, ssl: false, max: 10 });
    pool.on("error", (err) => {
      console.error("[neon-proxy] idle pg client error:", err.message);
    });
    pools.set(connectionString, pool);
  }
  return pool;
}

function shapeResult(result) {
  return {
    command: result.command,
    rowCount: result.rowCount,
    rows: result.rows,
    fields: (result.fields || []).map((f) => ({
      name: f.name,
      dataTypeID: f.dataTypeID,
      tableID: f.tableID,
      columnID: f.columnID,
      dataTypeSize: f.dataTypeSize,
      dataTypeModifier: f.dataTypeModifier,
      format: f.format,
    })),
    rowAsArray: true,
  };
}

async function runSingle(pool, { query, params }) {
  const result = await pool.query({
    text: query,
    values: params || [],
    rowMode: "array",
    types: RAW_TEXT_TYPES,
  });
  return shapeResult(result);
}

async function runBatch(pool, queries, isolationLevel, readOnly, deferrable) {
  const client = await pool.connect();
  try {
    let begin = "BEGIN";
    if (isolationLevel) begin += ` ISOLATION LEVEL ${isolationLevel}`;
    if (readOnly === "true") begin += " READ ONLY";
    if (deferrable === "true") begin += " DEFERRABLE";
    await client.query(begin);
    const results = [];
    for (const q of queries) {
      const result = await client.query({
        text: q.query,
        values: q.params || [],
        rowMode: "array",
        types: RAW_TEXT_TYPES,
      });
      results.push(shapeResult(result));
    }
    await client.query("COMMIT");
    return results;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function errorBody(err) {
  return {
    message: err.message,
    code: err.code,
    detail: err.detail,
    hint: err.hint,
    position: err.position,
    severity: err.severity,
    where: err.where,
    schema: err.schema,
    table: err.table,
    column: err.column,
    dataType: err.dataType,
    constraint: err.constraint,
  };
}

const server = https.createServer(
  {
    key: fs.readFileSync(path.join(CERT_DIR, "localhost-key.pem")),
    cert: fs.readFileSync(path.join(CERT_DIR, "localhost-cert.pem")),
  },
  (req, res) => {
    if (req.method === "GET" && req.url && req.url.startsWith("/health")) {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method !== "POST") {
      return sendJson(res, 405, { message: "Method not allowed" });
    }

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch (err) {
        return sendJson(res, 400, { message: `Invalid JSON body: ${err.message}` });
      }

      const connectionString = req.headers["neon-connection-string"];
      if (!connectionString) {
        return sendJson(res, 400, { message: "Missing Neon-Connection-String header" });
      }

      try {
        const pool = getPool(connectionString);
        if (Array.isArray(body.queries)) {
          const results = await runBatch(
            pool,
            body.queries,
            req.headers["neon-batch-isolation-level"],
            req.headers["neon-batch-read-only"],
            req.headers["neon-batch-deferrable"],
          );
          return sendJson(res, 200, { results });
        }
        const single = await runSingle(pool, body);
        return sendJson(res, 200, single);
      } catch (err) {
        console.error("[neon-proxy] query error:", err.message);
        return sendJson(res, 400, errorBody(err));
      }
    });
  },
);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[neon-proxy] Neon HTTP proxy listening on https://localhost:${PORT}/sql`);
});

server.on("error", (err) => {
  console.error("[neon-proxy] server error:", err.message);
  process.exit(1);
});
