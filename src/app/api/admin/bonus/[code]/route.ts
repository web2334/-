import { ownerGuard } from "@/lib/admin-api";
import { q } from "@/lib/db";
import { apiError, json } from "@/lib/security";

export const runtime = "nodejs";

/** Ручная отметка «бонус погашен» / снять отметку. */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { redeemed?: unknown };
  if (typeof body.redeemed !== "boolean") return apiError(400, "Некорректный запрос.");
  const rows = await q("UPDATE bonus_codes SET redeemed_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE code = $1 RETURNING code", [
    code,
    body.redeemed,
  ]);
  if (!rows[0]) return apiError(404, "Код не найден.");
  return json({ ok: true });
}
