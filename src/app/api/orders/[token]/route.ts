import { getPublicOrder } from "@/lib/orders";
import { apiError, clientIp, json, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/** Публичные данные заявки по приватному токену. Без фото и без заметки владельца. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await rateLimit(`order-view:${clientIp(req)}`, 240, 3600))) return apiError(429, "Слишком много запросов.");
  const { token } = await ctx.params;
  const order = await getPublicOrder(token);
  if (!order) return apiError(404, "Заявка не найдена.");
  return json(order);
}
