import { cookies } from "next/headers";
import { login, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { apiError, guard, json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = await guard(req, "login", 8, 900);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof body.password !== "string" || body.password.length > 200) return apiError(400, "Введите пароль.");
  const res = await login(body.password);
  if (!res.ok) return apiError(401, res.reason);
  (await cookies()).set(SESSION_COOKIE, res.token, sessionCookieOptions());
  return json({ ok: true });
}
