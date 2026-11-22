import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { q } from "./db";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}

export function json(data: unknown, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === "number" ? { status: init } : init ?? {};
  return NextResponse.json(data, {
    ...base,
    headers: { "Cache-Control": "private, no-store", ...(base.headers ?? {}) },
  });
}

export function apiError(status: number, message: string, fields?: Record<string, string>) {
  return json({ error: message, fields }, status);
}

/**
 * Проверка Origin для изменяющих запросов. Принимаем только свой адрес:
 * APP_URL (если задан) или origin самого запроса (Host + протокол).
 */
export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Браузеры всегда шлют Origin для POST/PATCH/DELETE через fetch. Без него — отклоняем.
    return false;
  }
  const allowed = new Set<string>();
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  return allowed.has(origin);
}

/**
 * Ограничение частоты запросов в PostgreSQL (работает и в serverless, где нет общей памяти).
 * Фиксированное окно. Возвращает true, если запрос разрешён.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);
  const rows = await q<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowStart],
  );
  if (Math.random() < 0.02) {
    q("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'").catch(() => {});
  }
  return rows[0].count <= limit;
}

export async function guard(req: Request, bucket: string, limit: number, windowSec: number) {
  if (!checkOrigin(req)) return apiError(403, "Запрос отклонён: неизвестный источник.");
  const ok = await rateLimit(`${bucket}:${clientIp(req)}`, limit, windowSec);
  if (!ok) return apiError(429, "Слишком много запросов. Попробуйте чуть позже.");
  return null;
}
