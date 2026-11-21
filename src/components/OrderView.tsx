"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { PublicOrder } from "@/lib/orders";
import type { PublicSettings } from "@/lib/settings-schema";
import { STATUS_LABEL } from "@/lib/order-schema";
import { contactLinks } from "@/lib/contacts";
import { humanDate, humanDateTime, humanStamp } from "@/lib/format";
import { rub } from "@/lib/pricing";
import { CategoryIcon, IconCheck, IconCopy, IconRefresh } from "./Icons";
import { Summary } from "./Checkout";

const CleanGame = dynamic(() => import("./game/CleanGame"), { ssr: false, loading: () => <div className="skeleton" style={{ height: 360 }} /> });

const STATUS_TEXT: Record<PublicOrder["status"], string> = {
  new: "Заявка получена. Мастер позвонит, чтобы уточнить детали, цену и время выезда.",
  agreed: "Договорились! Ниже итоговая цена и время выезда.",
  done: "Работа выполнена. Спасибо, что выбрали нас!",
  cancelled: "Заявка отменена. Если это ошибка — свяжитесь с нами.",
};

export function OrderView({ token, initial, settings, isNew }: { token: string; initial: PublicOrder; settings: PublicSettings; isNew: boolean }) {
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const contacts = contactLinks(settings.company);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      if (r.ok) {
        setOrder(await r.json());
        setOffline(false);
      }
    } catch {
      setOffline(true);
    } finally {
      setRefreshing(false);
    }
  };

  // Изменения владельца появляются по той же ссылке: тихо обновляем раз в 30 секунд, пока вкладка открыта.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 30_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Убираем ?new=1 из адреса, чтобы скопированная ссылка была чистой
  useEffect(() => {
    if (isNew) history.replaceState(null, "", `/z/${token}`);
  }, [isNew, token]);

  const url = typeof window !== "undefined" ? `${location.origin}/z/${token}` : `/z/${token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const gameOn = settings.game.mode !== "off" && order.status !== "cancelled";
  const firstCategory = order.estimate.lines[0]?.category ?? "sofa";

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      {isNew && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="notice notice-ok row" style={{ ["--gap" as string]: "10px" }} role="status">
          <IconCheck size={22} />
          <span>
            <strong>Заявка №{order.number} сохранена.</strong> Мастер свяжется с вами. Сохраните ссылку на эту страницу — здесь появятся цена и время.
          </span>
        </motion.div>
      )}

      <div className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Заявка №{order.number}</p>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)", marginTop: 4 }}>{STATUS_LABEL[order.status]}</h1>
          </div>
          <span className={`badge badge-${order.status}`}>
            <span className="dot" /> {STATUS_LABEL[order.status]}
          </span>
        </div>
        <p className="muted">{STATUS_TEXT[order.status]}</p>

        {order.status === "agreed" || order.finalPrice != null || order.agreedAt ? (
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="notice" style={{ background: "var(--accent-soft)" }}>
              <div className="small muted">Итоговая цена</div>
              <div className="price-big">{order.finalPrice != null ? rub(order.finalPrice) : "уточняется"}</div>
            </div>
            <div className="notice" style={{ background: "var(--accent-soft)" }}>
              <div className="small muted">Время выезда</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{order.agreedAt ? humanDateTime(order.agreedAt) : "уточняется"}</div>
            </div>
          </div>
        ) : null}

        {order.clientMessage && (
          <div className="notice">
            <div className="small muted" style={{ marginBottom: 2 }}>
              Сообщение мастера
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{order.clientMessage}</div>
          </div>
        )}

        <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
          <button className="btn btn-outline btn-sm" onClick={copy}>
            {copied ? <IconCheck size={18} /> : <IconCopy size={18} />} {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
            <IconRefresh size={18} /> {refreshing ? "Обновляем…" : "Обновить"}
          </button>
          <span className="tiny faint">Обновлено: {humanStamp(order.updatedAt)}</span>
        </div>
        {offline && <p className="small error-text">Нет связи — показаны последние сохранённые данные.</p>}
        <p className="tiny faint">Ссылка личная: по ней видно вашу заявку. Не публикуйте её.</p>
      </div>

      <div className="card card-pad">
        <h2 style={{ fontSize: 21, marginBottom: 6 }}>Состав</h2>
        {order.estimate.lines.map((l, i) => (
          <div className="line-item" key={i}>
            <span className="line-ico">
              <CategoryIcon id={l.category} size={26} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {l.title}
                {l.variantLabel ? ` · ${l.variantLabel}` : ""} {l.qty > 1 ? `× ${l.qty}` : ""}
              </div>
              {l.description && <div className="small muted" style={{ overflowWrap: "anywhere" }}>{l.description}</div>}
              {(l.dirty || l.secondSide) && (
                <div className="small muted">{[l.dirty && "сильные загрязнения", l.secondSide && "вторая сторона"].filter(Boolean).join(", ")}</div>
              )}
            </div>
            <div className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              {l.total != null ? rub(l.total) : <span className="badge">По фото</span>}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <p className="small muted" style={{ marginBottom: 4 }}>
            Предварительный расчёт на момент отправки:
          </p>
          <Summary est={order.estimate} />
        </div>
      </div>

      <div className="card card-pad stack" style={{ ["--gap" as string]: "8px" }}>
        <h2 style={{ fontSize: 21 }}>Детали</h2>
        <Row k="Имя" v={order.name} />
        <Row k="Адрес" v={order.address + (order.outOfCity ? " · за городом" : "")} />
        <Row k="Пожелание по времени" v={order.wishDate ? `${humanDate(order.wishDate)}${order.wishTime ? `, ${order.wishTime}` : ""}` : "любое"} />
        <Row k="Фото" v={order.photoCount ? `${order.photoCount} шт. — видны только мастеру` : "нет"} />
        {order.comment && <Row k="Комментарий" v={order.comment} />}
        <Row k="Отправлена" v={humanStamp(order.createdAt)} />
      </div>

      {contacts.length > 0 && (
        <div className="card card-pad stack">
          <h2 style={{ fontSize: 21 }}>Связаться</h2>
          <div className="row wrap">
            {contacts.map((c) => (
              <a key={c.kind} href={c.href} className="btn btn-outline" target={c.kind === "telegram" || c.kind === "whatsapp" ? "_blank" : undefined} rel="noopener noreferrer">
                {c.label}: {c.value}
              </a>
            ))}
          </div>
        </div>
      )}

      {gameOn && <CleanGame token={token} category={firstCategory} game={settings.game} existingBonus={order.bonus} onBonus={(b) => setOrder((o) => ({ ...o, bonus: b }))} />}

      <Link href="/" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>
        На главную
      </Link>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row between" style={{ alignItems: "flex-start", borderBottom: "1px dashed var(--line)", paddingBottom: 8 }}>
      <span className="muted small" style={{ flex: "0 0 40%" }}>
        {k}
      </span>
      <span style={{ textAlign: "right", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{v}</span>
    </div>
  );
}
