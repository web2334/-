// Применяет db/schema.sql (идемпотентно). Использует DATABASE_URL из окружения или .env.local.
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "1" ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
await client.query(readFileSync("db/schema.sql", "utf8"));
console.log("Схема применена.");
await client.end();
