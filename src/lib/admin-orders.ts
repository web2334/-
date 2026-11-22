import "server-only";
import { z } from "zod";
import { q, tx } from "./db";
import type { OrderRow } from "./orders";
import type { OrderStatus } from "./order-schema";

export interface OrderListItem {
  id: string;
  number: number;
  status: OrderStatus;
  name: string;
  phone: string;
  address: string;
  out_of_city: boolean;
  wish_date: string | null;
  wish_time: string | null;
  final_price: number | null;
  agreed_at: string | null;
  estimate_total: number | null;
  estimate_floor: number;
  manual_count: number;
  item_count: number;
  photo_count: number;
  created_at: string;
}

export interface ListFilter {
  q?: string;
  status?: OrderStatus | "all" | "active";
  limit?: number;
}

export async function listOrders(f: ListFilter): Promise<OrderListItem[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (f.status && f.status !== "all") {
    if (f.status === "active") where.push(`o.status IN ('new','agreed')`);
    else {
      params.push(f.status);
      where.push(`o.status = $${params.length}`);
    }
  }
  const term = f.q?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    params.push(`%${term.toLowerCase()}%`);
    const p = params.length;
    // lower() с обеих сторон: регистр сворачивается одинаково по правилам БД (нужна UTF-8 база)
    const conds = [`lower(o.name) LIKE lower($${p})`, `lower(o.address) LIKE lower($${p})`, `lower(o.comment) LIKE lower($${p})`];
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      conds.push(`regexp_replace(o.phone, '\\D', '', 'g') LIKE $${params.length}`);
      conds.push(`o.number::text LIKE $${params.length}`);
    }
    where.push(`(${conds.join(" OR ")})`);
  }
  params.push(Math.min(f.limit ?? 200, 500));
  return q<OrderListItem>(
    `SELECT o.id, o.number, o.status, o.name, o.phone, o.address, o.out_of_city, o.wish_date, o.wish_time,
            o.final_price, o.agreed_at, (o.estimate->>'total')::int AS estimate_total,
            (o.estimate->>'floor')::int AS estimate_floor, (o.estimate->>'manualCount')::int AS manual_count,
            jsonb_array_length(o.items) AS item_count,
            (SELECT count(*)::int FROM photos p WHERE p.order_id = o.id) AS photo_count, o.created_at
     FROM orders o ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY (o.status = 'new') DESC, o.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
}

export async function orderCounts(): Promise<Record<string, number>> {
  const rows = await q<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM orders GROUP BY status");
  const out: Record<string, number> = { new: 0, agreed: 0, done: 0, cancelled: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export interface OrderDetail extends OrderRow {
  photos: { id: string; width: number; height: number; size: number }[];
  events: { id: number; at: string; kind: string; data: Record<string, unknown> }[];
  bonus: { code: string; amount: number; min_order: number; expires_at: string; redeemed_at: string | null } | null;
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const rows = await q<OrderRow>("SELECT * FROM orders WHERE id = $1", [id]);
  if (!rows[0]) return null;
  const [photos, events, bonus] = await Promise.all([
    q<OrderDetail["photos"][number]>("SELECT id, width, height, size FROM photos WHERE order_id = $1 ORDER BY created_at", [id]),
    q<OrderDetail["events"][number]>("SELECT id, at, kind, data FROM order_events WHERE order_id = $1 ORDER BY at DESC, id DESC", [id]),
    q<NonNullable<OrderDetail["bonus"]>>("SELECT code, amount, min_order, expires_at, redeemed_at FROM bonus_codes WHERE order_id = $1", [id]),
  ]);
  return { ...rows[0], photos, events, bonus: bonus[0] ?? null };
}

export const orderPatchSchema = z
  .object({
    status: z.enum(["new", "agreed", "done", "cancelled"]),
    finalPrice: z.number().int().min(0).max(10_000_000).nullable(),
    agreedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Укажите дату и время")
      .nullable(),
    clientMessage: z.string().trim().max(1000),
    ownerNote: z.string().trim().max(4000),
  })
  .superRefine((p, ctx) => {
    if (p.status === "agreed") {
      if (p.finalPrice == null) ctx.addIssue({ code: "custom", path: ["finalPrice"], message: "Для «Согласована» нужна итоговая цена" });
      if (!p.agreedAt) ctx.addIssue({ code: "custom", path: ["agreedAt"], message: "Для «Согласована» нужно время выезда" });
    }
  });
export type OrderPatch = z.infer<typeof orderPatchSchema>;

const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  final_price: "Итоговая цена",
  agreed_at: "Время выезда",
  client_message: "Сообщение клиенту",
  owner_note: "Заметка",
};

export async function updateOrder(id: string, p: OrderPatch): Promise<OrderRow | null> {
  return tx(async (c) => {
    const cur = await c.query<OrderRow>("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id]);
    const o = cur.rows[0];
    if (!o) return null;
    const next = {
      status: p.status,
      final_price: p.finalPrice,
      agreed_at: p.agreedAt,
      client_message: p.clientMessage,
      owner_note: p.ownerNote,
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(next)) {
      const before = (o as unknown as Record<string, unknown>)[k] ?? null;
      if ((before ?? null) !== (v ?? null) && !(before === "" && v === "")) {
        // заметку не пишем в историю целиком — только факт изменения
        changes[k] = k === "owner_note" ? { from: "…", to: "…" } : { from: before, to: v };
      }
    }
    if (Object.keys(changes).length === 0) return o;
    const r = await c.query<OrderRow>(
      `UPDATE orders SET status=$2, final_price=$3, agreed_at=$4, client_message=$5, owner_note=$6, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, next.status, next.final_price, next.agreed_at, next.client_message, next.owner_note],
    );
    await c.query("INSERT INTO order_events (order_id, kind, data) VALUES ($1, 'updated', $2)", [
      id,
      JSON.stringify({ changes, labels: Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k) }),
    ]);
    return r.rows[0];
  });
}

export async function deleteOrder(id: string): Promise<boolean> {
  const r = await q("DELETE FROM orders WHERE id = $1 RETURNING id", [id]);
  return r.length > 0;
}
