import "server-only";
import { q, tx } from "./db";
import { estimate, type Estimate } from "./pricing";
import { normalizePhone, type OrderInput, type OrderStatus } from "./order-schema";
import { randomToken, sha256 } from "./security";
import type { Pricing, Settings } from "./settings-schema";

export interface OrderRow {
  id: string;
  number: number;
  token: string;
  status: OrderStatus;
  name: string;
  phone: string;
  address: string;
  out_of_city: boolean;
  wish_date: string | null;
  wish_time: string | null;
  comment: string;
  items: OrderInput["items"];
  pricing_snapshot: Pricing;
  estimate: Estimate;
  final_price: number | null;
  agreed_at: string | null;
  client_message: string;
  owner_note: string;
  created_at: string;
  updated_at: string;
}

export type CreateResult =
  | { ok: true; token: string; number: number; replay: boolean }
  | { ok: false; status: number; error: string; fields?: Record<string, string>; existingToken?: string };

function stableHash(o: unknown) {
  return sha256(JSON.stringify(o));
}

/**
 * Создание заявки. Идемпотентно по idempotencyKey: повтор с тем же ключом и тем же
 * содержимым возвращает уже созданную заявку, а не дубль.
 */
export async function createOrder(input: OrderInput, settings: Settings): Promise<CreateResult> {
  const phone = normalizePhone(input.phone)!;
  const payloadHash = stableHash({ ...input, idempotencyKey: undefined });

  const existing = await q<{ token: string; number: number; payload_hash: string }>(
    "SELECT token, number, payload_hash FROM orders WHERE idempotency_key = $1",
    [input.idempotencyKey],
  );
  if (existing[0]) {
    // Тот же ключ, но другое содержимое: заявка уже создана раньше (ответ мог потеряться).
    // Ключ знает только этот браузер, поэтому возвращаем ссылку на его же заявку.
    if (existing[0].payload_hash !== payloadHash)
      return {
        ok: false,
        status: 409,
        error: "Эта заявка уже была отправлена раньше — изменения после отправки не применились. Откройте её и при необходимости напишите мастеру.",
        existingToken: existing[0].token,
      };
    return { ok: true, token: existing[0].token, number: existing[0].number, replay: true };
  }

  const pricing = settings.pricing;
  const est = estimate(input.items, pricing, input.outOfCity);
  const token = randomToken(24);

  try {
    return await tx(async (c) => {
      // Фото должны принадлежать этому черновику и ещё не быть привязаны к заявке.
      if (input.photoIds.length) {
        const ph = await c.query(
          "SELECT id FROM photos WHERE id = ANY($1::uuid[]) AND draft_id = $2 AND order_id IS NULL FOR UPDATE",
          [input.photoIds, input.draftId],
        );
        if (ph.rowCount !== input.photoIds.length) {
          throw Object.assign(new Error("photos"), { userFacing: true });
        }
      }
      const r = await c.query<{ id: string; number: number }>(
        `INSERT INTO orders (token, idempotency_key, payload_hash, name, phone, address, out_of_city,
           wish_date, wish_time, comment, items, pricing_snapshot, estimate, consent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
         RETURNING id, number`,
        [
          token,
          input.idempotencyKey,
          payloadHash,
          input.name,
          phone,
          input.address,
          input.outOfCity,
          input.wishDate || null,
          input.wishTime || null,
          input.comment,
          JSON.stringify(input.items),
          JSON.stringify(pricing),
          JSON.stringify(est),
        ],
      );
      const order = r.rows[0];
      if (input.photoIds.length) {
        await c.query("UPDATE photos SET order_id = $1 WHERE id = ANY($2::uuid[])", [order.id, input.photoIds]);
      }
      await c.query("INSERT INTO order_events (order_id, kind, data) VALUES ($1, 'created', $2)", [
        order.id,
        JSON.stringify({ total: est.total, floor: est.floor, manual: est.manualCount }),
      ]);
      return { ok: true as const, token, number: order.number, replay: false };
    });
  } catch (e) {
    const err = e as { code?: string; userFacing?: boolean };
    if (err.userFacing)
      return {
        ok: false,
        status: 422,
        error: "Фото не найдены или устарели. Загрузите их ещё раз.",
        fields: { photoIds: "Загрузите фото ещё раз" },
      };
    // Гонка двух одинаковых запросов: второй упирается в UNIQUE и получает результат первого.
    if (err.code === "23505") {
      const again = await q<{ token: string; number: number; payload_hash: string }>(
        "SELECT token, number, payload_hash FROM orders WHERE idempotency_key = $1",
        [input.idempotencyKey],
      );
      if (again[0] && again[0].payload_hash === payloadHash)
        return { ok: true, token: again[0].token, number: again[0].number, replay: true };
    }
    throw e;
  }
}

/** Данные для приватной страницы клиента. Без заметки владельца и без фото. */
export interface PublicOrder {
  number: number;
  status: OrderStatus;
  name: string;
  address: string;
  outOfCity: boolean;
  wishDate: string | null;
  wishTime: string | null;
  comment: string;
  estimate: Estimate;
  finalPrice: number | null;
  agreedAt: string | null;
  clientMessage: string;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
  bonus: { code: string; amount: number; minOrder: number; expiresAt: string } | null;
}

export async function getPublicOrder(token: string): Promise<PublicOrder | null> {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const rows = await q<
    OrderRow & { photo_count: number; code: string | null; amount: number | null; min_order: number | null; expires_at: string | null }
  >(
    `SELECT o.*, (SELECT count(*)::int FROM photos p WHERE p.order_id = o.id) AS photo_count,
            b.code, b.amount, b.min_order, b.expires_at
     FROM orders o LEFT JOIN bonus_codes b ON b.order_id = o.id
     WHERE o.token = $1`,
    [token],
  );
  const o = rows[0];
  if (!o) return null;
  return {
    number: o.number,
    status: o.status,
    name: o.name,
    address: o.address,
    outOfCity: o.out_of_city,
    wishDate: o.wish_date ? toIsoDate(o.wish_date) : null,
    wishTime: o.wish_time,
    comment: o.comment,
    estimate: o.estimate,
    finalPrice: o.final_price,
    agreedAt: o.agreed_at,
    clientMessage: o.client_message,
    photoCount: o.photo_count,
    createdAt: new Date(o.created_at).toISOString(),
    updatedAt: new Date(o.updated_at).toISOString(),
    bonus: o.code
      ? { code: o.code, amount: o.amount!, minOrder: o.min_order!, expiresAt: new Date(o.expires_at!).toISOString() }
      : null,
  };
}

export function toIsoDate(d: string | Date): string {
  if (typeof d === "string") return d.slice(0, 10);
  // pg отдаёт DATE как локальную полночь
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function addEvent(orderId: string, kind: string, data: Record<string, unknown> = {}) {
  await q("INSERT INTO order_events (order_id, kind, data) VALUES ($1, $2, $3)", [orderId, kind, JSON.stringify(data)]);
}
