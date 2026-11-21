"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORY_BY_ID, type PriceKey } from "@/lib/catalog";
import {
  cartStore,
  draftStore,
  freshDraft,
  myOrdersStore,
  removeCartItem,
  restoreCartItem,
  updateCartItem,
  useHydrated,
  useStore,
  type CartItem,
} from "@/lib/client-store";
import { estimate, rub, type Estimate } from "@/lib/pricing";
import { MAX_QTY, TIME_SLOTS, normalizePhone } from "@/lib/order-schema";
import type { PublicSettings } from "@/lib/settings-schema";
import { CategoryIcon, IconArrowLeft, IconMinus, IconPlus, IconTrash } from "./Icons";
import { PhotoUploader } from "./PhotoUploader";
import { plural } from "./CartBar";

type Errors = Record<string, string>;

function todayLocal(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Клиентская проверка — та же логика, что на сервере, для мгновенных подсказок у полей. */
function validate(d: ReturnType<typeof draftStore.get>, items: CartItem[]): Errors {
  const e: Errors = {};
  if (items.length === 0) e.items = "Добавьте хотя бы один предмет";
  if (d.name.trim().length < 2) e.name = "Укажите имя";
  if (!normalizePhone(d.phone)) e.phone = "Телефон в формате +7 900 000-00-00";
  if (d.address.trim().length < 5) e.address = "Укажите адрес: улица, дом, квартира";
  if (d.wishTime && !d.wishDate) e.wishDate = "Для времени выберите дату";
  if (d.wishDate && d.wishDate < todayLocal()) e.wishDate = "Дата уже прошла";
  if (items.some((i) => i.category === "other") && d.photos.length === 0) e.photoIds = "Для «Другое» нужна хотя бы одна фотография";
  if (!d.consent) e.consent = "Нужно согласие на обработку данных";
  return e;
}

const FIELD_ORDER = ["items", "name", "phone", "address", "wishDate", "photoIds", "consent"];

export function Checkout({ settings }: { settings: PublicSettings }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useStore(cartStore);
  const draft = useStore(draftStore);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "danger" | "warn"; text: string; existingToken?: string } | null>(null);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const [undo, setUndo] = useState<{ item: CartItem; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const est = useMemo(() => estimate(items, settings.pricing, draft.outOfCity), [items, settings.pricing, draft.outOfCity]);
  const needsPhoto = items.some((i) => i.category === "other");

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => {
    draftStore.set((d) => ({ ...d, [k]: v }));
  };

  // Ошибки поля показываем после ухода из него или после попытки отправки
  useEffect(() => {
    const all = validate(draft, items);
    setErrors((prev) => {
      const next: Errors = {};
      for (const k of Object.keys(all)) if (touched[k] || prev[k]) next[k] = all[k];
      // серверные ошибки, которые клиент не проверяет, оставляем до правки поля
      return next;
    });
  }, [draft, items, touched]);

  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const remove = (id: string) => {
    const r = removeCartItem(id);
    if (!r) return;
    setUndo(r);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };
  const doUndo = () => {
    if (undo) restoreCartItem(undo.item, undo.index);
    setUndo(null);
  };

  const onBusy = useCallback((b: boolean) => setUploadsBusy(b), []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBanner(null);
    const all = validate(draft, items);
    setTouched(Object.fromEntries(FIELD_ORDER.map((k) => [k, true])));
    setErrors(all);
    if (Object.keys(all).length) {
      const first = FIELD_ORDER.find((k) => all[k]);
      document.getElementById(`f-${first}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      (document.getElementById(`i-${first}`) as HTMLElement | null)?.focus({ preventScroll: true });
      return;
    }
    if (uploadsBusy) {
      setBanner({ kind: "warn", text: "Дождитесь окончания загрузки фото." });
      return;
    }
    setSubmitting(true);
    const body = {
      idempotencyKey: draft.idempotencyKey,
      draftId: draft.draftId,
      items: items.map(({ category, variant, qty, dirty, secondSide, description }) => ({ category, variant, qty, dirty, secondSide, description })),
      name: draft.name,
      phone: draft.phone,
      address: draft.address,
      outOfCity: draft.outOfCity,
      wishDate: draft.wishDate,
      wishTime: draft.wishTime,
      comment: draft.comment,
      photoIds: draft.photos.map((p) => p.id),
      consent: draft.consent,
    };
    let res: Response;
    try {
      res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      setSubmitting(false);
      setBanner({
        kind: "danger",
        text: "Нет связи с сервером. Всё введённое сохранено — нажмите «Отправить» ещё раз. Повторная отправка не создаст дубль.",
      });
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { token?: string; number?: number; error?: string; fields?: Errors; existingToken?: string };
    if (res.ok && data.token) {
      myOrdersStore.set((l) => [{ token: data.token!, number: data.number!, at: new Date().toISOString() }, ...l.filter((o) => o.token !== data.token)].slice(0, 20));
      cartStore.set([]);
      draftStore.set({ ...freshDraft(), name: draft.name, phone: draft.phone, address: draft.address });
      router.push(`/z/${data.token}?new=1`);
      return;
    }
    setSubmitting(false);
    if (data.fields) {
      setErrors((e) => ({ ...e, ...data.fields }));
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(data.fields!).map((k) => [k, true])) }));
    }
    setBanner({
      kind: res.status === 429 ? "warn" : "danger",
      text: data.error ?? `Не удалось отправить заявку (код ${res.status}). Попробуйте ещё раз.`,
      existingToken: data.existingToken,
    });
  };

  if (!hydrated) {
    return (
      <div className="stack" style={{ ["--gap" as string]: "12px" }}>
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", padding: "48px 20px", ["--gap" as string]: "14px" }}>
        <div className="line-ico" style={{ width: 84, height: 84, borderRadius: 26 }}>
          <CategoryIcon id="sofa" size={44} />
        </div>
        <h2 style={{ fontSize: 24 }}>В заявке пока пусто</h2>
        <p className="muted" style={{ maxWidth: 360 }}>
          Выберите диван, кресло, матрас или стулья — цена посчитается сразу. Нестандартный предмет можно добавить через «Другое».
        </p>
        <Link href="/#choose" className="btn btn-primary btn-lg">
          Выбрать мебель
        </Link>
        <UndoToast undo={undo} onUndo={doUndo} />
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? errors[k] : undefined);

  return (
    <form className="checkout-grid" onSubmit={submit} noValidate>
      <div className="stack" style={{ ["--gap" as string]: "16px" }}>
        <section className="card card-pad" aria-labelledby="cart-title" id="f-items">
          <div className="row between" style={{ marginBottom: 4 }}>
            <h2 id="cart-title" style={{ fontSize: 21 }}>
              Состав заявки
            </h2>
            <Link href="/#choose" className="btn btn-ghost btn-sm">
              <IconPlus size={18} /> Добавить
            </Link>
          </div>
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div key={it.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <CartLine item={it} settings={settings} est={est} onRemove={() => remove(it.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        <section className="card card-pad stack" aria-labelledby="contact-title" style={{ ["--gap" as string]: "16px" }}>
          <h2 id="contact-title" style={{ fontSize: 21 }}>
            Контакты и адрес
          </h2>
          <Field id="name" label="Имя" error={err("name")}>
            <input
              id="i-name"
              className="input"
              autoComplete="name"
              value={draft.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              onBlur={blur("name")}
              aria-invalid={!!err("name")}
              aria-describedby={err("name") ? "err-name" : undefined}
            />
          </Field>
          <Field id="phone" label="Телефон" hint="Мастер позвонит, чтобы согласовать цену и время." error={err("phone")}>
            <input
              id="i-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 900 000-00-00"
              value={draft.phone}
              maxLength={30}
              onChange={(e) => set("phone", e.target.value)}
              onBlur={blur("phone")}
              aria-invalid={!!err("phone")}
              aria-describedby={err("phone") ? "err-phone" : "hint-phone"}
            />
          </Field>
          <Field id="address" label="Адрес" hint="Улица, дом, подъезд, этаж, квартира." error={err("address")}>
            <textarea
              id="i-address"
              className="textarea"
              style={{ minHeight: 72 }}
              autoComplete="street-address"
              value={draft.address}
              maxLength={300}
              onChange={(e) => set("address", e.target.value)}
              onBlur={blur("address")}
              aria-invalid={!!err("address")}
              aria-describedby={err("address") ? "err-address" : "hint-address"}
            />
          </Field>
          <label className="toggle">
            <input type="checkbox" checked={draft.outOfCity} onChange={(e) => set("outOfCity", e.target.checked)} />
            <span className="switch" aria-hidden />
            <span className="grow">
              <span className="t-title">Выезд за город</span>
              <br />
              <span className="t-sub">
                {settings.company.area || "За пределами города"} · +{rub(settings.pricing.outOfCityFee)}
              </span>
            </span>
          </label>
        </section>

        <section className="card card-pad stack" aria-labelledby="when-title" style={{ ["--gap" as string]: "16px" }}>
          <div className="stack" style={{ ["--gap" as string]: "4px" }}>
            <h2 id="when-title" style={{ fontSize: 21 }}>
              Когда удобно
            </h2>
            <p className="small muted">Необязательно. Это пожелание — мастер подтвердит запись после разговора.</p>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field id="wishDate" label="Дата" error={err("wishDate")}>
              <input
                id="i-wishDate"
                className="input"
                type="date"
                min={todayLocal()}
                max={todayLocal(90)}
                value={draft.wishDate}
                onChange={(e) => {
                  set("wishDate", e.target.value);
                  if (!e.target.value) set("wishTime", "");
                }}
                onBlur={blur("wishDate")}
                aria-invalid={!!err("wishDate")}
              />
            </Field>
            <Field id="wishTime" label="Время" hint={draft.wishDate ? undefined : "Сначала выберите дату"}>
              <select
                id="i-wishTime"
                className="select"
                value={draft.wishTime}
                disabled={!draft.wishDate}
                onChange={(e) => set("wishTime", e.target.value as typeof draft.wishTime)}
              >
                <option value="">Любое</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="card card-pad stack" aria-labelledby="extra-title" style={{ ["--gap" as string]: "16px" }} id="f-photoIds">
          <h2 id="extra-title" style={{ fontSize: 21 }}>
            Фото и комментарий
          </h2>
          <PhotoUploader photos={draft.photos} draftId={draft.draftId} error={err("photoIds")} required={needsPhoto} onBusyChange={onBusy} />
          <Field id="comment" label="Комментарий" hint="Ткань, особенности пятен, домофон, животные.">
            <textarea id="i-comment" className="textarea" value={draft.comment} maxLength={1000} onChange={(e) => set("comment", e.target.value)} />
          </Field>
        </section>
      </div>

      <aside className="checkout-side">
        <div className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
          <h2 style={{ fontSize: 21 }}>Предварительный расчёт</h2>
          <Summary est={est} />
          <div id="f-consent" className="field" data-invalid={!!err("consent")}>
            <label className="check">
              <input
                id="i-consent"
                type="checkbox"
                checked={draft.consent}
                onChange={(e) => {
                  set("consent", e.target.checked);
                  setTouched((t) => ({ ...t, consent: true }));
                }}
                aria-invalid={!!err("consent")}
              />
              <span>
                Согласен(на) на обработку персональных данных по{" "}
                <Link href="/privacy" target="_blank">
                  политике
                </Link>
              </span>
            </label>
            {err("consent") && (
              <span className="error-text" role="alert">
                {err("consent")}
              </span>
            )}
          </div>
          <AnimatePresence>
            {banner && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`notice notice-${banner.kind}`}
                role="alert"
              >
                {banner.text}
                {banner.existingToken && (
                  <div style={{ marginTop: 8 }}>
                    <Link className="btn btn-sm btn-outline" href={`/z/${banner.existingToken}`}>
                      Открыть отправленную заявку
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? (
              <>
                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: "rgb(255 255 255 / .35)", borderTopColor: "#fff" }} /> Отправляем…
              </>
            ) : (
              "Отправить заявку"
            )}
          </button>
          <p className="tiny faint">Онлайн-оплаты нет. Оплата после работы, итоговую цену мастер назовёт по телефону.</p>
        </div>
      </aside>
      <UndoToast undo={undo} onUndo={doUndo} />
    </form>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field" data-invalid={!!error} id={`f-${id}`}>
      <label htmlFor={`i-${id}`}>{label}</label>
      {children}
      {hint && !error && (
        <span className="hint" id={`hint-${id}`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error-text" id={`err-${id}`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function CartLine({ item, settings, est, onRemove }: { item: CartItem; settings: PublicSettings; est: Estimate; onRemove: () => void }) {
  const cat = CATEGORY_BY_ID[item.category];
  const [open, setOpen] = useState(false);
  const idx = cartStore.get().findIndex((i) => i.id === item.id);
  const line = est.lines[idx];
  const opts: string[] = [];
  if (item.dirty) opts.push(`сильные загрязнения +${settings.pricing.dirtyPct}%`);
  if (item.secondSide) opts.push(`вторая сторона +${settings.pricing.secondSidePct}%`);
  return (
    <div className="line-item">
      <span className="line-ico">
        <CategoryIcon id={item.category} size={26} />
      </span>
      <div className="stack" style={{ ["--gap" as string]: "8px", minWidth: 0 }}>
        <div>
          <div style={{ fontWeight: 700 }}>
            {cat.title}
            {line?.variantLabel ? ` · ${line.variantLabel}` : ""}
          </div>
          {item.description && <div className="small muted" style={{ overflowWrap: "anywhere" }}>{item.description}</div>}
          {opts.length > 0 && <div className="small muted">{opts.join(", ")}</div>}
          {!cat.manual && line?.unitPrice != null && item.qty > 1 && <div className="small faint num">{rub(line.unitPrice)} за шт.</div>}
        </div>
        <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
          <div className="stepper">
            <button type="button" aria-label="Меньше" disabled={item.qty <= 1} onClick={() => updateCartItem(item.id, { qty: item.qty - 1 })}>
              <IconMinus size={18} />
            </button>
            <output aria-label="Количество">{item.qty}</output>
            <button type="button" aria-label="Больше" disabled={item.qty >= MAX_QTY} onClick={() => updateCartItem(item.id, { qty: item.qty + 1 })}>
              <IconPlus size={18} />
            </button>
          </div>
          {!cat.manual && (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Готово" : "Изменить"}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm icon-btn" aria-label={`Удалить: ${cat.title}`} onClick={onRemove}>
            <IconTrash size={18} />
          </button>
        </div>
        {open && !cat.manual && (
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            <div className="segment" role="radiogroup" aria-label="Вариант">
              {cat.variants.map((v) => (
                <button type="button" key={v.id} role="radio" aria-checked={item.variant === v.id} onClick={() => updateCartItem(item.id, { variant: v.id as PriceKey })}>
                  {v.label}
                </button>
              ))}
            </div>
            {cat.allowDirty && (
              <label className="check">
                <input type="checkbox" checked={item.dirty} onChange={(e) => updateCartItem(item.id, { dirty: e.target.checked })} />
                Сильные загрязнения (+{settings.pricing.dirtyPct}%)
              </label>
            )}
            {cat.allowSecondSide && (
              <label className="check">
                <input type="checkbox" checked={item.secondSide} onChange={(e) => updateCartItem(item.id, { secondSide: e.target.checked })} />
                Вторая сторона (+{settings.pricing.secondSidePct}%)
              </label>
            )}
          </div>
        )}
      </div>
      <div className="num" style={{ fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>
        {line?.total != null ? rub(line.total) : <span className="badge">По фото</span>}
      </div>
    </div>
  );
}

export function Summary({ est, finalPrice }: { est: Estimate; finalPrice?: number | null }) {
  const count = est.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <div className="sum-rows num">
      <div>
        <span className="muted">
          {count} {plural(count, "предмет", "предмета", "предметов")}
          {est.manualCount > 0 ? ` (с ценой — ${est.lines.filter((l) => !l.manual).length})` : ""}
        </span>
        <span>{est.hasKnown ? rub(est.knownSubtotal) : "—"}</span>
      </div>
      {est.manualCount > 0 && (
        <div>
          <span className="muted">Оценка по фото</span>
          <span className="badge">
            {est.manualCount} {plural(est.manualCount, "позиция", "позиции", "позиций")}
          </span>
        </div>
      )}
      {est.minTopUp > 0 && (
        <div>
          <span className="muted">До минимального заказа ({rub(est.minOrder)})</span>
          <span>+{rub(est.minTopUp)}</span>
        </div>
      )}
      {est.tripFee > 0 && (
        <div>
          <span className="muted">Выезд за город</span>
          <span>+{rub(est.tripFee)}</span>
        </div>
      )}
      {finalPrice != null ? (
        <div className="sum-total">
          <span>Итог (согласовано)</span>
          <span>{rub(finalPrice)}</span>
        </div>
      ) : est.total != null ? (
        <div className="sum-total">
          <span>Примерно</span>
          <span>{rub(est.total)}</span>
        </div>
      ) : (
        <>
          <div className="sum-total">
            <span>Не меньше</span>
            <span>{rub(est.floor)}</span>
          </div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Итог станет известен после оценки позиций по фото. Минимальный заказ на чистку — {rub(est.minOrder)}.
          </p>
        </>
      )}
    </div>
  );
}

function UndoToast({ undo, onUndo }: { undo: { item: CartItem } | null; onUndo: () => void }) {
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {undo && (
          <motion.div className="toast" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            <span>Удалено: {CATEGORY_BY_ID[undo.item.category].title.toLowerCase()}</span>
            <button type="button" className="btn" onClick={onUndo}>
              Отменить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BackToChoice() {
  return (
    <Link href="/#choose" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}>
      <IconArrowLeft size={18} /> К выбору мебели
    </Link>
  );
}
