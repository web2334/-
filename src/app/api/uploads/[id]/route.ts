import { q } from "@/lib/db";
import { apiError, guard, json } from "@/lib/security";

export const runtime = "nodejs";

/** Удаление ещё не отправленного фото. Нужен секрет черновика; привязанные к заявке фото не трогаем. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = await guard(req, "upload-del", 60, 3600);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const draftId = new URL(req.url).searchParams.get("draftId") ?? req.headers.get("x-draft-id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[A-Za-z0-9_-]{20,80}$/.test(draftId)) return apiError(400, "Некорректный запрос.");
  await q("DELETE FROM photos WHERE id = $1 AND draft_id = $2 AND order_id IS NULL", [id, draftId]);
  return json({ ok: true });
}
