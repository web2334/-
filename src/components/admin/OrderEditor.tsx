"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { OrderDetail } from "@/lib/admin-orders";
import { STATUS_LABEL, formatPhone, type OrderStatus } from "@/lib/order-schema";
import { PRICE_LABELS, type PriceKey } from "@/lib/catalog";
import { humanDate, humanStamp } from "@/lib/format";
import { rub } from "@/lib/pricing";
import { Summary } from "../Checkout";
import { CategoryIcon, IconArrowLeft, IconCopy, IconPhone, IconTrash } from "../Icons";

const EVENT_LABEL: Record<string, string> = { created: "Заявка создана", updated: "Изменено", bonus: "Выдан бонус-код" };

export function OrderEditor({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [finalPrice, setFinalPrice] = useState(order.final_price != null ? String(order.final_price) : "");
  const [agreedDate, setAgreedDate] = useState(order.agreed_at?.slice(0, 10) ?? order.wish_date ?? "");
  const [agreedTime, setAgreedTime] = useState(order.agreed_at?.slice(11, 16) ?? "");
  const [clientMessage, setClientMessage] = useState(order.client_message);
  const [ownerNote, setOwnerNote] = useState(order.owner_note);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "danger"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);

  const est = order.estimate;
  const suggested = est.total ?? null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const errs: Record<string, string> = {};
    const price = finalPrice.trim() === "" ? null : Number(finalPrice.replace(/\s/g, ""));
    if (price != null && (!Number.isInteger(price) || price < 0)) errs.finalPrice = "Целое число рублей";
    const agreedAt = agreedDate && agreedTime ? `${agreedDate}T${agreedTime}` : null;
    if ((agreedDate && !agreedTime) || (!agreedDate && agreedTime)) errs.agreedAt = "Укажите и дату, и время";
    if (status === "agreed") {
      if (price == null) errs.finalPrice = "Для «Согласована» нужна итоговая цена";
      if (!agreedAt) errs.agreedAt = errs.agreedAt ?? "Для «Согласована» нужно время выезда";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, finalPrice: price, agreedAt, clientMessage, ownerNote }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return (location.href = "/admin/login");
      if (!r.ok) {
        if (d.fields) setErrors(d.fields);
        throw new Error(d.error ?? "Не удалось сохранить");
      }
      setMsg({ kind: "ok", text: "Сохранено. Клиент увидит изменения по своей ссылке." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "danger", text: (err as Error).message === "Failed to fetch" ? "Нет связи — изменения не сохранены." : (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/orders/${order.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "УДАЛИТЬ" }),
      });
      if (!r.ok) throw new Error();
      router.replace("/admin/orders");
      router.refresh();
    } catch {
      setDeleting(false);
      dialog.current?.close();
      setMsg({ kind: "danger", text: "Не удалось удалить заявку." });
    }
  };

  const clientUrl = typeof window !== "undefined" ? `${location.origin}/z/${order.token}` : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const toggleBonus = async () => {
    if (!order.bonus) return;
    await fetch(`/api/admin/bonus/${order.bonus.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redeemed: !order.bonus.redeemed_at }),
    });
    router.refresh();
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <Link href="/admin/orders" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -10 }}>
        <IconArrowLeft size={18} /> Все заявки
      </Link>
      <div className="row between wrap">
        <div>
          <h1 style={{ fontSize: 28 }}>Заявка №{order.number}</h1>
          <p className="small muted">Создана {humanStamp(order.created_at)}</p>
        </div>
        <span className={`badge badge-${order.status}`}>
          <span className="dot" /> {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="grid-2">
        <section className="card card-pad stack" style={{ ["--gap" as string]: "10px" }}>
          <h2 style={{ fontSize: 19 }}>Клиент</h2>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{order.name}</div>
          <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
            <a className="btn btn-primary btn-sm" href={`tel:${order.phone}`}>
              <IconPhone size={18} /> {formatPhone(order.phone)}
            </a>
            <a className="btn btn-outline btn-sm" href={`https://wa.me/${order.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
          <div>
            <div className="small muted">Адрес</div>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {order.address}
              {order.out_of_city && <span className="badge" style={{ marginLeft: 6 }}>за городом</span>}
            </div>
          </div>
          <div>
            <div className="small muted">Пожелание по времени</div>
            <div>{order.wish_date ? `${humanDate(order.wish_date)}${order.wish_time ? ", " + order.wish_time : ""}` : "любое"}</div>
          </div>
          {order.comment && (
            <div>
              <div className="small muted">Комментарий клиента</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{order.comment}</div>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={copyLink} type="button">
            <IconCopy size={16} /> {copied ? "Скопировано" : "Ссылка клиента на заявку"}
          </button>
        </section>

        <section className="card card-pad">
          <h2 style={{ fontSize: 19, marginBottom: 4 }}>Состав и расчёт</h2>
          {est.lines.map((l, i) => (
            <div className="line-item" key={i}>
              <span className="line-ico">
                <CategoryIcon id={l.category} size={24} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {l.title}
                  {l.variantLabel ? ` · ${l.variantLabel}` : ""} × {l.qty}
                </div>
                {l.description && <div className="small" style={{ overflowWrap: "anywhere" }}>{l.description}</div>}
                {(l.dirty || l.secondSide) && (
                  <div className="small muted">{[l.dirty && "сильные загрязнения", l.secondSide && "вторая сторона"].filter(Boolean).join(", ")}</div>
                )}
                {l.unitPrice != null && <div className="tiny faint num">база {rub(l.basePrice!)} → {rub(l.unitPrice)} за шт.</div>}
              </div>
              <div className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {l.total != null ? rub(l.total) : <span className="badge">По фото</span>}
              </div>
            </div>
          ))}
          <Summary est={est} />
          <details style={{ marginTop: 10 }}>
            <summary className="small muted" style={{ cursor: "pointer" }}>
              Прайс на момент заявки
            </summary>
            <div className="price-rows small" style={{ marginTop: 6 }}>
              {(Object.keys(order.pricing_snapshot.prices) as PriceKey[]).map((k) => (
                <div key={k}>
                  <span>{PRICE_LABELS[k]}</span>
                  <span className="num">{rub(order.pricing_snapshot.prices[k])}</span>
                </div>
              ))}
              <div>
                <span>Минимум / загрязнения / вторая сторона / за город</span>
                <span className="num">
                  {rub(order.pricing_snapshot.minOrder)} / {order.pricing_snapshot.dirtyPct}% / {order.pricing_snapshot.secondSidePct}% / {rub(order.pricing_snapshot.outOfCityFee)}
                </span>
              </div>
            </div>
          </details>
        </section>
      </div>

      {order.photos.length > 0 && (
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 19 }}>Фото ({order.photos.length})</h2>
          <div className="photos">
            {order.photos.map((p) => (
              <a key={p.id} className="photo-tile" href={`/api/admin/photos/${p.id}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/photos/${p.id}`} alt="Фото от клиента" loading="lazy" />
              </a>
            ))}
          </div>
          <p className="tiny faint">Фото доступны только в кабинете. Нажмите, чтобы открыть в полном размере.</p>
        </section>
      )}

      <form className="card card-pad stack" onSubmit={save} style={{ ["--gap" as string]: "16px" }} noValidate>
        <h2 style={{ fontSize: 19 }}>Согласование</h2>
        <div className="field">
          <span className="field-label">Статус</span>
          <div className="chips" role="radiogroup" aria-label="Статус">
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
              <button type="button" key={s} className="chip" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field" data-invalid={!!errors.finalPrice}>
            <label htmlFor="fp">Итоговая цена, ₽</label>
            <input id="fp" className="input num" inputMode="numeric" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder={suggested != null ? String(suggested) : "по согласованию"} />
            {errors.finalPrice ? (
              <span className="error-text">{errors.finalPrice}</span>
            ) : (
              suggested != null &&
              !finalPrice && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setFinalPrice(String(suggested))}>
                  Подставить расчёт {rub(suggested)}
                </button>
              )
            )}
          </div>
          <div className="field" data-invalid={!!errors.agreedAt}>
            <span className="field-label">Согласованное время выезда</span>
            <div className="row" style={{ ["--gap" as string]: "8px" }}>
              <input aria-label="Дата выезда" className="input" type="date" value={agreedDate} onChange={(e) => setAgreedDate(e.target.value)} />
              <input aria-label="Время выезда" className="input" type="time" step={900} value={agreedTime} onChange={(e) => setAgreedTime(e.target.value)} style={{ maxWidth: 130 }} />
            </div>
            {errors.agreedAt && <span className="error-text">{errors.agreedAt}</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="cm">Сообщение клиенту</label>
          <textarea id="cm" className="textarea" value={clientMessage} maxLength={1000} onChange={(e) => setClientMessage(e.target.value)} placeholder="Например: возьмём средство для велюра, позвоним за час." />
          <span className="hint">Видно клиенту по его ссылке.</span>
        </div>
        <div className="field">
          <label htmlFor="on">Приватная заметка</label>
          <textarea id="on" className="textarea" value={ownerNote} maxLength={4000} onChange={(e) => setOwnerNote(e.target.value)} />
          <span className="hint">Только для кабинета — клиенту не показывается.</span>
        </div>
        {msg && (
          <div className={`notice notice-${msg.kind}`} role="status">
            {msg.text}
          </div>
        )}
        <div className="row wrap between">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => dialog.current?.showModal()}>
            <IconTrash size={18} /> Удалить заявку
          </button>
        </div>
      </form>

      {order.bonus && (
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 19 }}>Бонус за игру</h2>
          <p>
            Код <strong>{order.bonus.code}</strong>: {rub(order.bonus.amount)} на следующий заказ от {rub(order.bonus.min_order)}, до {humanDate(order.bonus.expires_at.slice(0, 10))}.
          </p>
          <p className="small muted">Применяется вручную к следующему заказу. Текущий заказ не дешевеет.</p>
          <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={toggleBonus}>
            {order.bonus.redeemed_at ? `Погашен ${humanStamp(order.bonus.redeemed_at)} — снять отметку` : "Отметить как погашенный"}
          </button>
        </section>
      )}

      <section className="card card-pad">
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>История</h2>
        <ul className="timeline">
          {order.events.map((ev) => (
            <li key={ev.id}>
              <div style={{ fontWeight: 650 }}>
                {EVENT_LABEL[ev.kind] ?? ev.kind}
                {ev.kind === "updated" && Array.isArray(ev.data.labels) ? `: ${(ev.data.labels as string[]).join(", ").toLowerCase()}` : ""}
              </div>
              {ev.kind === "updated" && ev.data.changes ? <EventChanges changes={ev.data.changes as Record<string, { from: unknown; to: unknown }>} /> : null}
              <div className="tiny faint">{humanStamp(ev.at)}</div>
            </li>
          ))}
        </ul>
      </section>

      <dialog ref={dialog} aria-labelledby="del-title">
        <div className="card-pad stack" style={{ ["--gap" as string]: "14px" }}>
          <h2 id="del-title" style={{ fontSize: 20 }}>
            Удалить заявку №{order.number}?
          </h2>
          <p className="muted">
            Заявка, история{order.photos.length ? ` и ${order.photos.length} фото` : ""} будут удалены без возможности восстановления. Ссылка клиента перестанет работать.
          </p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => dialog.current?.close()} disabled={deleting}>
              Отмена
            </button>
            <button className="btn btn-danger" onClick={remove} disabled={deleting}>
              {deleting ? "Удаляем…" : "Удалить навсегда"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function fmt(k: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (k === "status") return STATUS_LABEL[v as OrderStatus] ?? String(v);
  if (k === "final_price") return rub(Number(v));
  if (k === "agreed_at") return String(v).replace("T", " ");
  return String(v).length > 40 ? String(v).slice(0, 40) + "…" : String(v);
}

function EventChanges({ changes }: { changes: Record<string, { from: unknown; to: unknown }> }) {
  return (
    <div className="small muted">
      {Object.entries(changes)
        .filter(([k]) => k !== "owner_note")
        .map(([k, c]) => (
          <div key={k}>
            {fmt(k, c.from)} → {fmt(k, c.to)}
          </div>
        ))}
    </div>
  );
}
