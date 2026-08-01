import { NextResponse } from "next/server";
import {
  isGraphPin,
  isStatusPin,
  normalizePin,
  parseNumericValue,
} from "@/lib/microclimate";
import { upsertEnvReading } from "@/lib/queries";

export const runtime = "nodejs";

type WebhookBody = {
  device_id?: string;
  device_name?: string;
  device_pin?: string;
  device_dataStreamName?: string;
  device_dataStreamAlias?: string;
  device_pinValue?: string | number;
  timestamp_iso8601?: string;
  timestamp_unix?: string | number;
  /** Static shared secret — Microclimate often cannot send headers/query auth */
  webhook_secret?: string;
  secret?: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function resolveRecordedAt(body: WebhookBody): Date {
  if (body.timestamp_iso8601) {
    const parsed = new Date(body.timestamp_iso8601);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (body.timestamp_unix !== undefined && body.timestamp_unix !== null) {
    const n = Number(body.timestamp_unix);
    if (Number.isFinite(n)) {
      const ms = n > 1e12 ? n : n * 1000;
      const parsed = new Date(ms);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date();
}

function extractBasicAuthPassword(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Basic\s+(.+)$/i.exec(auth.trim());
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    const colon = decoded.indexOf(":");
    if (colon < 0) return decoded;
    return decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const expected = process.env.MICROCLIMATE_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error: "Webhook secret not configured",
        debugCode: "secret_not_configured",
      },
      { status: 500 },
    );
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const headerNames = [...request.headers.keys()];
  const providedRaw = request.headers.get("x-webhook-secret");
  const providedAlt =
    request.headers.get("X-Webhook-Secret") ??
    request.headers.get("webhook-secret") ??
    null;
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const basicPassword = extractBasicAuthPassword(request);
  const bodySecret =
    typeof body.webhook_secret === "string"
      ? body.webhook_secret
      : typeof body.secret === "string"
        ? body.secret
        : null;
  const hasAuthorization = headerNames.some(
    (n) => n.toLowerCase() === "authorization",
  );

  const authSource = providedRaw
    ? "header"
    : providedAlt
      ? "alt-header"
      : basicPassword
        ? "basic"
        : urlSecret
          ? "query"
          : bodySecret
            ? "body"
            : "none";
  const provided = (
    providedRaw ||
    providedAlt ||
    basicPassword ||
    urlSecret ||
    bodySecret ||
    ""
  ).trim();
  const expectedTrim = expected.trim();
  const matchedTrim =
    provided.length === expectedTrim.length &&
    timingSafeEqual(provided, expectedTrim);

  // #region agent log
  fetch("http://127.0.0.1:7926/ingest/86f94468-743f-4211-ad1e-a630cc67636d", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ca9006",
    },
    body: JSON.stringify({
      sessionId: "ca9006",
      runId: "post-fix",
      hypothesisId: "BodySecret",
      location: "api/microclimate/route.ts:authResult",
      message: "webhook auth compare",
      data: {
        matchedTrim,
        authSource,
        hasBodySecret: Boolean(bodySecret),
        hasAuthorization,
        queryKeys: [...new URL(request.url).searchParams.keys()],
        debugCode: !provided
          ? "missing_secret"
          : matchedTrim
            ? "ok"
            : "secret_mismatch",
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.log(
    "[ff-ivy-debug]",
    JSON.stringify({
      hypothesisId: "BodySecret",
      matchedTrim,
      authSource,
      hasBodySecret: Boolean(bodySecret),
      hasAuthorization,
      queryKeys: [...new URL(request.url).searchParams.keys()],
      debugCode: !provided
        ? "missing_secret"
        : matchedTrim
          ? "ok"
          : "secret_mismatch",
    }),
  );
  // #endregion

  if (!matchedTrim) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        debugCode: !provided ? "missing_secret" : "secret_mismatch",
        queryKeys: [...new URL(request.url).searchParams.keys()],
        hasAuthorization,
        hasBodySecret: Boolean(bodySecret),
        hint: !provided
          ? 'Put "webhook_secret":"YOUR_SECRET" as a plain string inside the Custom JSON body (Microclimate is not sending headers/query auth).'
          : "Secret was sent but did not match. Check the secret value.",
      },
      { status: 401 },
    );
  }

  const pin = normalizePin(String(body.device_pin ?? ""));
  if (!pin) {
    return NextResponse.json({ error: "Missing device_pin" }, { status: 400 });
  }

  if (!isStatusPin(pin)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const valueRaw = String(body.device_pinValue ?? "").trim();
  const streamName =
    String(
      body.device_dataStreamName || body.device_dataStreamAlias || pin,
    ).trim() || pin;
  const valueNum = parseNumericValue(valueRaw);
  const recordedAt = resolveRecordedAt(body);

  await upsertEnvReading({
    pin,
    stream_name: streamName,
    value_raw: valueRaw || "—",
    value_num: valueNum,
    recorded_at: recordedAt,
    device_id: body.device_id ? String(body.device_id) : null,
    device_name: body.device_name ? String(body.device_name) : null,
    writeHistory: isGraphPin(pin) && valueNum !== null,
  });

  return NextResponse.json({ ok: true, authSource });
}
