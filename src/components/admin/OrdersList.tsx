"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderListItem } from "@/lib/admin-orders";
import { STATUS_LABEL, formatPhone } from "@/lib/order-schema";
import { rub } from "@/lib/pricing";
import { humanDate, humanDateTime, humanStamp } from "@/lib/format";
import { IconRefresh } from "../Icons";

const FILTERS = [
  ["active", "Активные"],
  ["new", "Новые"],
  ["agreed", "Согласованы"],
  ["done", "Завершены"],
  ["cancelled", "Отменены"],
  ["all", "Все"],
] as const;

export function OrdersList({ initial, initialCounts }: { initial: OrderListItem[]; initialCounts: Record<string, number> }) {
  const [orders, setOrders] = useState(initial);
  const [counts, setCounts] = useState(initialCounts);
  const [status, setStatus] = useState<string>("active");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const first = useRef(true);

  const load = useCallback(async (st: string, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/orders?status=${st}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (r.status === 401) {
        location.href = "/admin/login";
        return;
      }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setOrders(d.orders);
      setCounts(d.counts);
      setUpdatedAt(new Date());
    } catch {
      setError("Не удалось обновить список. Проверьте связь.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setUpdatedAt(new Date());
      return;
    }
    const t = setTimeout(() => load(status, q), 250);
    return () => clearTimeout(t);
  }, [status, q, load]);

  // Тихое обновление раз в минуту
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(status, q), 60_000);
    return () => clearInterval(t);
  }, [status, q, load]);

  const countFor = (k: string) =>
    k === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : k === "active" ? (counts.new ?? 0) + (counts.agreed ?? 0) : counts[k] ?? 0;

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <div className="row between wrap">
        <h1 style={{ fontSize: 28 }}>Заявки</h1>
        <button className="btn btn-outline btn-sm" onClick={() => load(status, q)} disabled={loading}>
          <IconRefresh size={18} /> {loading ? "Обновляем…" : "Обновить"}
        </button>
      </div>
      <input className="input" type="search" placeholder="Поиск: имя, телефон, адрес, номер" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по заявкам" />
      <div className="chips" role="tablist" aria-label="Фильтр по статусу">
        {FILTERS.map(([k, label]) => (
          <button key={k} className="chip" role="tab" aria-selected={status === k} onClick={() => setStatus(k)}>
            {label} <span className="faint num">{countFor(k)}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      )}
      <div className="card" style={{ overflow: "hidden" }}>
        {orders.length === 0 ? (
          <div className="card-pad muted" style={{ textAlign: "center", padding: 40 }}>
            {q ? "Ничего не найдено." : "Заявок пока нет. Они появятся здесь, как только клиент отправит форму."}
          </div>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="order-row">
              <div style={{ minWidth: 0 }}>
                <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
                  <strong>№{o.number}</strong>
                  <span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  {o.manual_count > 0 && <span className="badge">по фото: {o.manual_count}</span>}
                  {o.photo_count > 0 && <span className="badge">фото: {o.photo_count}</span>}
                </div>
                <div style={{ marginTop: 4 }}>
                  {o.name} · <span className="num">{formatPhone(o.phone)}</span>
                </div>
                <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.address}
                  {o.out_of_city ? " · за городом" : ""}
                </div>
                <div className="tiny faint">
                  {o.agreed_at ? `Выезд: ${humanDateTime(o.agreed_at)}` : o.wish_date ? `Пожелание: ${humanDate(o.wish_date)}${o.wish_time ? ", " + o.wish_time : ""}` : "Время: любое"} ·{" "}
                  {humanStamp(o.created_at)}
                </div>
              </div>
              <div style={{ textAlign: "right" }} className="num">
                <strong>{o.final_price != null ? rub(o.final_price) : o.estimate_total != null ? `≈ ${rub(o.estimate_total)}` : `от ${rub(o.estimate_floor)}`}</strong>
                <div className="tiny faint">{o.final_price != null ? "итог" : "расчёт"}</div>
              </div>
            </Link>
          ))
        )}
      </div>
      {updatedAt && <p className="tiny faint">Список обновлён в {updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>}
    </div>
  );
}
