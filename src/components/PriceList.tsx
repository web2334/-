"use client";
import { CATEGORIES, type CategoryId, type PriceKey } from "@/lib/catalog";
import { selectionStore } from "@/lib/client-store";
import { rub, unitPrice } from "@/lib/pricing";
import type { Pricing } from "@/lib/settings-schema";
import { CategoryIcon, IconArrowRight } from "./Icons";

export function PriceList({ pricing }: { pricing: Pricing }) {
  const choose = (category: CategoryId, variant?: PriceKey) => {
    selectionStore.set((s) => ({
      ...s,
      category,
      qty: 1,
      dirty: false,
      secondSide: false,
      variant: variant ? { ...s.variant, [category]: variant } : s.variant,
    }));
    document.getElementById("choose")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="price-list">
      {CATEGORIES.map((c) => (
        <article key={c.id} className="card price-card">
          <div className="row">
            <span className="line-ico">
              <CategoryIcon id={c.id} size={26} />
            </span>
            <div className="grow">
              <h3 style={{ fontSize: 19 }}>{c.title}</h3>
              <p className="small muted">{c.short}</p>
            </div>
          </div>
          <div className="price-rows">
            {c.manual ? (
              <div>
                <span>Пуф, банкетка, изголовье и др.</span>
                <strong>по фото</strong>
              </div>
            ) : (
              c.variants.map((v) => (
                <div key={v.id}>
                  <span>{v.label}</span>
                  <strong className="num">{rub(pricing.prices[v.id])}</strong>
                </div>
              ))
            )}
            {c.allowSecondSide && (
              <div>
                <span className="muted">Вторая сторона</span>
                <span className="muted num">+{pricing.secondSidePct}%</span>
              </div>
            )}
            {c.id === "chair" && (
              <div>
                <span className="muted">6 стульев со спинкой</span>
                <span className="muted num">{rub(unitPrice(pricing.prices.chair_seatback, pricing, false, false) * 6)}</span>
              </div>
            )}
          </div>
          <button className="btn btn-outline btn-block" onClick={() => choose(c.id)}>
            Выбрать {c.title.toLowerCase()} <IconArrowRight size={18} />
          </button>
        </article>
      ))}
      <article className="card price-card" style={{ background: "var(--surface-2)" }}>
        <h3 style={{ fontSize: 19 }}>Как считается цена</h3>
        <div className="price-rows">
          <div>
            <span>Сильные загрязнения</span>
            <strong className="num">+{pricing.dirtyPct}%</strong>
          </div>
          <div>
            <span>Минимальный заказ на чистку</span>
            <strong className="num">{rub(pricing.minOrder)}</strong>
          </div>
          <div>
            <span>Выезд за город</span>
            <strong className="num">+{rub(pricing.outOfCityFee)}</strong>
          </div>
        </div>
        <p className="small muted">Надбавки считаются от базовой цены и складываются, цена за штуку округляется до 10 ₽. Выезд за город добавляется после минимума.</p>
      </article>
    </div>
  );
}
