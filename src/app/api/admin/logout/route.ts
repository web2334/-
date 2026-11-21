import { logout } from "@/lib/auth";
import { apiError, checkOrigin, json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!checkOrigin(req)) return apiError(403, "Запрос отклонён.");
  await logout();
  return json({ ok: true });
}
