import "server-only";
import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q } from "./db";
import { randomToken, sha256 } from "./security";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = "vors_owner";
const SESSION_DAYS = 14;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, PARAMS);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, "base64");
  const test = await scrypt(pw, Buffer.from(saltB64, "base64"), key.length, PARAMS);
  return timingSafeEqual(key, test);
}

/** Учётная запись владельца. При первом запуске пароль берётся из OWNER_INITIAL_PASSWORD. */
async function getAccount(): Promise<{ password_hash: string; password_version: number } | null> {
  const rows = await q<{ password_hash: string; password_version: number }>(
    "SELECT password_hash, password_version FROM owner_account WHERE id = 1",
  );
  if (rows[0]) return rows[0];
  const initial = process.env.OWNER_INITIAL_PASSWORD;
  if (!initial || initial.length < 10) return null;
  const hash = await hashPassword(initial);
  await q("INSERT INTO owner_account (id, password_hash) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [hash]);
  const again = await q<{ password_hash: string; password_version: number }>(
    "SELECT password_hash, password_version FROM owner_account WHERE id = 1",
  );
  return again[0] ?? null;
}

export async function login(password: string): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const acc = await getAccount();
  if (!acc) return { ok: false, reason: "Пароль владельца не настроен: задайте OWNER_INITIAL_PASSWORD (минимум 10 символов)." };
  if (!(await verifyPassword(password, acc.password_hash))) return { ok: false, reason: "Неверный пароль." };
  const token = randomToken(32);
  await q(
    `INSERT INTO sessions (id, password_version, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [sha256(token), acc.password_version, String(SESSION_DAYS)],
  );
  q("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
  return { ok: true, token };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && !(process.env.APP_URL ?? "").startsWith("http://"),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}

/** Проверка сеанса. Сеансы со старой версией пароля недействительны. */
export async function currentSession(): Promise<{ id: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const rows = await q<{ id: string }>(
    `SELECT s.id FROM sessions s JOIN owner_account a ON a.id = 1
     WHERE s.id = $1 AND s.expires_at > now() AND s.password_version = a.password_version`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export async function requireOwnerPage() {
  const s = await currentSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q("DELETE FROM sessions WHERE id = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Смена пароля закрывает все прежние сеансы (через password_version) и выдаёт новый. */
export async function changePassword(current: string, next: string): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const acc = await getAccount();
  if (!acc || !(await verifyPassword(current, acc.password_hash))) return { ok: false, reason: "Текущий пароль указан неверно." };
  const hash = await hashPassword(next);
  const rows = await q<{ password_version: number }>(
    `UPDATE owner_account SET password_hash = $1, password_version = password_version + 1, updated_at = now()
     WHERE id = 1 RETURNING password_version`,
    [hash],
  );
  await q("DELETE FROM sessions");
  const token = randomToken(32);
  await q(`INSERT INTO sessions (id, password_version, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    sha256(token),
    rows[0].password_version,
  ]);
  return { ok: true, token };
}
