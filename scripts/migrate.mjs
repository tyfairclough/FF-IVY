import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);
const migration = readFileSync(new URL("../db/migrations/001_init.sql", import.meta.url), "utf8");

// Split on semicolons that end statements; keep it simple for our migration file.
const statements = migration
  .split(";")
  .map((part) => part.trim())
  .filter((part) => part.length > 0 && !part.startsWith("--"));

for (const statement of statements) {
  await sql.query(statement);
  console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "), "…");
}

console.log("Migration complete");
