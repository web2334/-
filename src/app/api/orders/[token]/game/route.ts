import { randomInt } from "node:crypto";
import { q } from "@/lib/db";
import { addEvent } from "@/lib/orders";
import { apiError, guard, json } from "@/lib/security";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `VORS-${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Выдача бонус-кода за игру. Один код на заявку (UNIQUE order_id).
 * Защиты от накрутки прогресса нет: код применяет владелец вручную после проверки.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const blocked = await guard(req, "game", 20, 3600);
  if (blocked) return blocked;
  const { token } = await ctx.params;
  const settings = await getSettings();
  if (settings.game.mode !== "bonus") return apiError(409, "Бонус за игру сейчас не выдаётся.");

  const body = (await req.json().catch(() => ({}))) as { progress?: number };
  if (typeof body.progress !== "number" || body.progress < 0.9) return apiError(422, "Дочистите пятна до конца.");

  const orders = await q<{ id: string; status: string }>("SELECT id, status FROM orders WHERE token = $1", [token]);
  const order = orders[0];
  if (!order) return apiError(404, "Заявка не найдена.");
  if (order.status === "cancelled") return apiError(409, "Заявка отменена — бонус недоступен.");

  const g = settings.game;
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await q<{ code: string; amount: number; min_order: number; expires_at: string }>(
      `INSERT INTO bonus_codes (code, order_id, amount, min_order, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)
       ON CONFLICT (order_id) DO UPDATE SET order_id = bonus_codes.order_id
       RETURNING code, amount, min_order, expires_at`,
      [makeCode(), order.id, g.bonusAmount, g.bonusMinOrder, String(g.bonusDays)],
    ).catch((e: { code?: string }) => {
      if (e.code === "23505") return null; // совпал сам код — пробуем другой
      throw e;
    });
    if (rows && rows[0]) {
      await addEvent(order.id, "bonus", { code: rows[0].code });
      return json({
        code: rows[0].code,
        amount: rows[0].amount,
        minOrder: rows[0].min_order,
        expiresAt: new Date(rows[0].expires_at).toISOString(),
      });
    }
  }
  return apiError(500, "Не удалось выдать код, попробуйте ещё раз.");
}
