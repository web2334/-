"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, CATEGORY_BY_ID, modelFor, type CategoryId, type PriceKey } from "@/lib/catalog";
import { addToCart, selectionStore, useStore } from "@/lib/client-store";
import { pickLine, CHARACTER_NAMES, type Moment } from "@/lib/phrases";
import { rub, unitPrice } from "@/lib/pricing";
import { MAX_QTY } from "@/lib/order-schema";
import type { PublicSettings } from "@/lib/settings-schema";
import { CategoryIcon, IconCheck, IconMinus, IconPlus } from "./Icons";
import { Stage, useReducedMotion } from "./Stage";
import type { Pulse } from "./three/Stage3D";

export function Configurator({ settings }: { settings: PublicSettings }) {
  const sel = useStore(selectionStore);
  const cat = CATEGORY_BY_ID[sel.category];
  const variant = sel.variant[sel.category];
  const model = modelFor(sel.category, variant);
  const { pricing, characters } = settings;
  const reduced = useReducedMotion();

  const [line, setLine] = useState<{ text: string; id: number; category: CategoryId } | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [added, setAdded] = useState<"added" | "merged" | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const lineId = useRef(0);

  const say = useCallback(
    (moment: Moment, category: CategoryId = sel.category) => {
      if (!characters.phrases || !characters.faces) return;
      const text = pickLine(characters.preset, category, moment);
      if (text) setLine({ text, id: ++lineId.current, category });
    },
    [characters, sel.category],
  );

  // Приветствие при первом показе
  useEffect(() => {
    const t = setTimeout(() => say("hello"), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCategory = (c: CategoryId) => {
    if (c === sel.category) return;
    selectionStore.set((s) => ({ ...s, category: c, qty: 1, dirty: false, secondSide: false }));
    setAdded(null);
    setDescError(null);
    setTimeout(() => say("hello", c), reduced ? 50 : 450);
  };

  const setVariant = (v: PriceKey) => selectionStore.set((s) => ({ ...s, variant: { ...s.variant, [s.category]: v } }));

  const price = useMemo(() => {
    if (cat.manual || !variant) return null;
    return unitPrice(pricing.prices[variant], pricing, cat.allowDirty && sel.dirty, cat.allowSecondSide && sel.secondSide);
  }, [cat, variant, pricing, sel.dirty, sel.secondSide]);

  const labels = useMemo(() => {
    const out = [CHARACTER_NAMES[sel.category] + " · " + cat.title];
    if (!cat.manual && !cat.variantModels) out.push("Одна модель для обоих вариантов");
    if (cat.manual) out.push("Пример предмета");
    return out;
  }, [sel.category, cat]);

  const add = () => {
    if (cat.manual) {
      const d = sel.description.trim();
      if (d.length < 3) {
        setDescError("Опишите предмет: что это и примерный размер");
        return;
      }
    }
    const res = addToCart({
      category: sel.category,
      variant: cat.manual ? null : variant,
      qty: sel.qty,
      dirty: cat.allowDirty && sel.dirty,
      secondSide: cat.allowSecondSide && sel.secondSide,
      description: cat.manual ? sel.description.trim() : undefined,
    });
    setAdded(res);
    setPulse({ kind: "Hop", id: Date.now() });
    say(res === "merged" ? "merged" : "added");
    if (cat.manual) selectionStore.set((s) => ({ ...s, description: "" }));
    selectionStore.set((s) => ({ ...s, qty: 1 }));
    setTimeout(() => setAdded(null), 2600);
  };

  return (
    <section className="config container" id="choose" aria-labelledby="choose-title">
      <div className="config-stage-wrap stack" style={{ ["--gap" as string]: "12px" }}>
        <div className="chips" role="radiogroup" aria-label="Тип мебели">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="chip" role="radio" aria-checked={c.id === sel.category} onClick={() => setCategory(c.id)}>
              <CategoryIcon id={c.id} size={20} />
              {c.title}
            </button>
          ))}
        </div>
        <Stage category={sel.category} model={model} labels={labels} faces={characters.faces} line={line && line.category === sel.category ? line : null} pulse={pulse} />
      </div>

      <div className="panel">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1 id="choose-title" style={{ fontSize: "clamp(26px, 3.6vw, 36px)" }}>
            Чистка {cat.genitive} на дому
          </h1>
          <p className="muted">{cat.manual ? "Опишите предмет — мастер оценит по фото и перезвонит." : "Выберите вариант — цена пересчитается сразу."}</p>
        </div>

        {!cat.manual && (
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            <span className="field-label" id="variant-label">
              {sel.category === "chair" ? "Что чистим" : "Вариант"}
            </span>
            <div className="segment" role="radiogroup" aria-labelledby="variant-label">
              {cat.variants.map((v) => (
                <button key={v.id} role="radio" aria-checked={variant === v.id} onClick={() => setVariant(v.id)}>
                  {v.label}
                  <small>{rub(pricing.prices[v.id])}</small>
                </button>
              ))}
            </div>
            {!cat.variantModels && <p className="tiny faint">3D-модель одна — вариант меняет только тариф.</p>}
          </div>
        )}

        {cat.manual && (
          <div className="field" data-invalid={!!descError}>
            <label htmlFor="other-desc">Что за предмет?</label>
            <textarea
              id="other-desc"
              className="textarea"
              placeholder="Например: пуф 60×60 см, велюр, пятно от кофе"
              value={sel.description}
              maxLength={500}
              onChange={(e) => {
                selectionStore.set((s) => ({ ...s, description: e.target.value }));
                if (descError) setDescError(null);
              }}
              aria-describedby="other-hint other-err"
            />
            <span className="hint" id="other-hint">
              Стоимость — по фото. Фото приложите на шаге оформления (минимум одно).
            </span>
            {descError && (
              <span className="error-text" id="other-err" role="alert">
                {descError}
              </span>
            )}
          </div>
        )}

        {(cat.allowDirty || cat.allowSecondSide) && (
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            {cat.allowDirty && (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={sel.dirty}
                  onChange={(e) => {
                    selectionStore.set((s) => ({ ...s, dirty: e.target.checked }));
                    if (e.target.checked) say("dirty");
                  }}
                />
                <span className="switch" aria-hidden />
                <span className="grow">
                  <span className="t-title">Сильные загрязнения</span>
                  <br />
                  <span className="t-sub">Пятна, запахи, следы животных · +{pricing.dirtyPct}%</span>
                </span>
              </label>
            )}
            {cat.allowSecondSide && (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={sel.secondSide}
                  onChange={(e) => {
                    selectionStore.set((s) => ({ ...s, secondSide: e.target.checked }));
                    if (e.target.checked) say("secondSide");
                  }}
                />
                <span className="switch" aria-hidden />
                <span className="grow">
                  <span className="t-title">Вторая сторона</span>
                  <br />
                  <span className="t-sub">Перевернём и почистим обе · +{pricing.secondSidePct}%</span>
                </span>
              </label>
            )}
          </div>
        )}

        <div className="card card-pad stack" style={{ ["--gap" as string]: "16px" }}>
          <div className="row between">
            <span className="field-label">Количество</span>
            <div className="stepper">
              <button aria-label="Меньше" disabled={sel.qty <= 1} onClick={() => selectionStore.set((s) => ({ ...s, qty: Math.max(1, s.qty - 1) }))}>
                <IconMinus size={18} />
              </button>
              <output aria-live="polite">{sel.qty}</output>
              <button
                aria-label="Больше"
                disabled={sel.qty >= MAX_QTY}
                onClick={() => selectionStore.set((s) => ({ ...s, qty: Math.min(MAX_QTY, s.qty + 1) }))}
              >
                <IconPlus size={18} />
              </button>
            </div>
          </div>
          <div className="price-line">
            <span className="muted">{cat.manual ? "Стоимость" : sel.qty > 1 ? `${sel.qty} × ${price != null ? rub(price) : ""}` : "Примерная цена"}</span>
            <span className="price-big" aria-live="polite">
              {price == null ? "По фото" : rub(price * sel.qty)}
            </span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={add}>
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span key="ok" className="row" style={{ ["--gap" as string]: "8px" }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  <IconCheck size={20} /> {added === "merged" ? "Количество увеличено" : "В заявке"}
                </motion.span>
              ) : (
                <motion.span key="add" className="row" style={{ ["--gap" as string]: "8px" }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  <IconPlus size={20} /> Добавить в заявку
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <p className="tiny faint">
            Цена предварительная: мастер уточнит её после разговора. Минимальный заказ на чистку — {rub(pricing.minOrder)}
            {pricing.outOfCityFee > 0 ? `, выезд за город +${rub(pricing.outOfCityFee)}` : ""}.
          </p>
        </div>
      </div>
    </section>
  );
}
