import "server-only";
import { Pool, types, type PoolClient } from "pg";

// DATE отдаём строкой YYYY-MM-DD, без сдвига часовых поясов.
types.setTypeParser(1082, (v: string) => v);
import { readFileSync } from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __vorsPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __vorsSchema: Promise<void> | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан. См. .env.example");
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    ssl: process.env.DATABASE_SSL === "1" ? { rejectUnauthorized: false } : undefined,
  });
}

export function pool(): Pool {
  if (!globalThis.__vorsPool) globalThis.__vorsPool = createPool();
  return globalThis.__vorsPool;
}

/** Схема применяется один раз на процесс (идемпотентный SQL). */
export function ensureSchema(): Promise<void> {
  if (!globalThis.__vorsSchema) {
    globalThis.__vorsSchema = (async () => {
      const sql = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
      const c = await pool().connect();
      try {
        // Транзакционная блокировка: совместима с пулерами в режиме транзакций (Neon, PgBouncer, Supabase).
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(727001)");
        await c.query(sql);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    })().catch((e) => {
      globalThis.__vorsSchema = undefined;
      throw e;
    });
  }
  return globalThis.__vorsSchema;
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const r = await pool().query(text, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const res = await fn(c);
    await c.query("COMMIT");
    return res;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
