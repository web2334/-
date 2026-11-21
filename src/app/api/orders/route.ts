import { orderSchema, zodFieldErrors } from "@/lib/order-schema";
import { createOrder } from "@/lib/orders";
import { apiError, guard, json } from "@/lib/security";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = await guard(req, "order", 12, 3600);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Не удалось прочитать заявку.");
  }
  // Любые присланные суммы игнорируются: схема их просто не содержит.
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) return apiError(422, "Проверьте поля формы.", zodFieldErrors(parsed.error));

  const settings = await getSettings();
  const res = await createOrder(parsed.data, settings);
  if (!res.ok) return json({ error: res.error, fields: res.fields, existingToken: res.existingToken }, res.status);
  return json({ token: res.token, number: res.number, replay: res.replay }, res.replay ? 200 : 201);
}
