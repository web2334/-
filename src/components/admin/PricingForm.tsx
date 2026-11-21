"use client";
import { useState } from "react";
import { PRICE_LABELS, type PriceKey } from "@/lib/catalog";
import type { Pricing } from "@/lib/settings-schema";
import { estimate, rub } from "@/lib/pricing";
import { NumField, SaveBar } from "./Fields";
import { useSave } from "./useSave";

export function PricingForm({ initial }: { initial: Pricing }) {
  const [p, setP] = useState(initial);
  const { save, saving, errors, msg } = useSave<Pricing>("pricing");
  const example = estimate(
    [
      { category: "mattress", variant: "mattress_double", qty: 1, dirty: true, secondSide: true },
      { category: "chair", variant: "chair_seat", qty: 2, dirty: false, secondSide: false },
    ],
    p,
    true,
  );
  return (
    <form className="stack" style={{ ["--gap" as string]: "16px" }} onSubmit={(e) => { e.preventDefault(); save(p); }}>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>Базовые цены за единицу</h2>
        <div className="grid-2" style={{ gap: 12 }}>
          {(Object.keys(p.prices) as PriceKey[]).map((k) => (
            <NumField key={k} id={k} label={PRICE_LABELS[k]} suffix="₽" value={p.prices[k]} error={errors[`prices.${k}`]} onChange={(v) => setP({ ...p, prices: { ...p.prices, [k]: v } })} />
          ))}
        </div>
      </section>
      <section className="card card-pad stack" style={{ ["--gap" as string]: "14px" }}>
        <h2 style={{ fontSize: 19 }}>Надбавки и минимум</h2>
        <div className="grid-2" style={{ gap: 12 }}>
          <NumField id="min" label="Минимальный заказ на чистку" suffix="₽" value={p.minOrder} error={errors.minOrder} hint="Выезд за город добавляется сверху." onChange={(v) => setP({ ...p, minOrder: v })} />
          <NumField id="trip" label="Выезд за город" suffix="₽" value={p.outOfCityFee} error={errors.outOfCityFee} hint="Фиксированная доплата." onChange={(v) => setP({ ...p, outOfCityFee: v })} />
          <NumField id="dirty" label="Сильные загрязнения" suffix="%" value={p.dirtyPct} error={errors.dirtyPct} onChange={(v) => setP({ ...p, dirtyPct: v })} />
          <NumField id="side" label="Вторая сторона матраса" suffix="%" value={p.secondSidePct} error={errors.secondSidePct} onChange={(v) => setP({ ...p, secondSidePct: v })} />
        </div>
        <div className="notice small">
          <strong>Как считается:</strong> проценты складываются и берутся от базовой цены, цена за штуку округляется до 10 ₽, затем умножается на количество.
          Минимум применяется к сумме чистки, выезд за город — сверху.
          <div style={{ marginTop: 8 }} className="num">
            Пример: двуспальный матрас с загрязнениями и второй стороной ({rub(example.lines[0].unitPrice!)}) + 2 стула ({rub(example.lines[1].total!)}) + за город ={" "}
            <strong>{rub(example.total!)}</strong>
          </div>
        </div>
      </section>
      <SaveBar saving={saving} msg={msg} />
    </form>
  );
}
