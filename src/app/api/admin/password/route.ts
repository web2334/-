import { cookies } from "next/headers";
import { changePassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { ownerGuard } from "@/lib/admin-api";
import { apiError, json, rateLimit, clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  if (!(await rateLimit(`pw:${clientIp(req)}`, 10, 900))) return apiError(429, "Слишком много попыток.");
  const body = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
  if (typeof body.current !== "string" || typeof body.next !== "string") return apiError(400, "Заполните оба поля.");
  if (body.next.length < 10 || body.next.length > 200)
    return apiError(422, "Новый пароль — от 10 символов.", { next: "Минимум 10 символов" });
  const res = await changePassword(body.current, body.next);
  if (!res.ok) return apiError(422, res.reason, { current: res.reason });
  (await cookies()).set(SESSION_COOKIE, res.token, sessionCookieOptions());
  return json({ ok: true });
}
