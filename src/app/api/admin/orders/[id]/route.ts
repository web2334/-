import { ownerGuard } from "@/lib/admin-api";
import { deleteOrder, getOrderDetail, orderPatchSchema, updateOrder } from "@/lib/admin-orders";
import { zodFieldErrors } from "@/lib/order-schema";
import { apiError, json } from "@/lib/security";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const o = await getOrderDetail((await ctx.params).id);
  if (!o) return apiError(404, "Заявка не найдена.");
  return json(o);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const parsed = orderPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "Проверьте поля.", zodFieldErrors(parsed.error));
  const o = await updateOrder((await ctx.params).id, parsed.data);
  if (!o) return apiError(404, "Заявка не найдена.");
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await ownerGuard(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "УДАЛИТЬ") return apiError(400, "Подтвердите удаление.");
  const ok = await deleteOrder((await ctx.params).id);
  if (!ok) return apiError(404, "Заявка не найдена.");
  return json({ ok: true });
}
