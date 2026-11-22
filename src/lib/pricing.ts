// Единая формула расчёта. Один и тот же код считает предварительную цену в браузере
// и окончательную на сервере. Сервер сумме из браузера НЕ доверяет.
//
// Порядок применения (для каждой позиции):
//   1. База = цена варианта из прайса.
//   2. Проценты СКЛАДЫВАЮТСЯ и применяются к базе (не каскадом):
//      цена_за_шт = база × (100 + загрязнения% + вторая_сторона%) / 100
//   3. Цена за штуку округляется до 10 ₽ по математическим правилам (…5 — вверх).
//   4. Сумма позиции = цена_за_шт × количество.
// По заказу:
//   5. Известная сумма = сумма позиций с ценой из прайса.
//   6. Минимальный заказ относится только к чистке: чистка = max(известная, минимум).
//      Если в заказе есть позиции «По фото», итог неизвестен: показываем
//      «не меньше max(известная, минимум)» и отдельно число позиций с ручной оценкой.
//   7. Выезд за город — фиксированная доплата сверху, после минимума.

import { CATEGORY_BY_ID, type CategoryId, type PriceKey, variantLabel } from "./catalog";
import type { Pricing } from "./settings-schema";

export interface CartItemInput {
  category: CategoryId;
  variant: PriceKey | null;
  qty: number;
  dirty: boolean;
  secondSide: boolean;
  description?: string;
}

export interface EstimateLine {
  key: string;
  category: CategoryId;
  variant: PriceKey | null;
  title: string;
  variantLabel: string;
  qty: number;
  dirty: boolean;
  secondSide: boolean;
  description?: string;
  manual: boolean;
  basePrice: number | null;
  unitPrice: number | null;
  total: number | null;
}

export interface Estimate {
  lines: EstimateLine[];
  knownSubtotal: number;
  manualCount: number;
  minOrder: number;
  /** доплата до минимума; применяется только когда нет позиций «По фото» */
  minTopUp: number;
  tripFee: number;
  /** итог, если он полностью известен; null — есть позиции с ручной оценкой */
  total: number | null;
  /** нижняя граница итога (известно точно, что итог не меньше) */
  floor: number;
  hasKnown: boolean;
}

export const ROUND_TO = 10;

export function roundMoney(v: number): number {
  return Math.round(v / ROUND_TO) * ROUND_TO;
}

export function unitPrice(base: number, pricing: Pricing, dirty: boolean, secondSide: boolean): number {
  const pct = 100 + (dirty ? pricing.dirtyPct : 0) + (secondSide ? pricing.secondSidePct : 0);
  // целочисленная арифметика, чтобы не ловить 0.1+0.2
  return roundMoney((base * pct) / 100);
}

/** Ключ объединения одинаковых позиций. «Другое» никогда не объединяется. */
export function itemKey(i: Pick<CartItemInput, "category" | "variant" | "dirty" | "secondSide">, uniq?: string): string {
  if (i.category === "other") return `other:${uniq ?? Math.random().toString(36).slice(2)}`;
  return [i.category, i.variant, i.dirty ? "d" : "", i.secondSide ? "s" : ""].join(":");
}

export function estimate(items: CartItemInput[], pricing: Pricing, outOfCity: boolean): Estimate {
  const lines: EstimateLine[] = items.map((it, idx) => {
    const cat = CATEGORY_BY_ID[it.category];
    if (cat.manual || !it.variant) {
      return {
        key: `other:${idx}`,
        category: it.category,
        variant: null,
        title: cat.title,
        variantLabel: "",
        qty: it.qty,
        dirty: false,
        secondSide: false,
        description: it.description,
        manual: true,
        basePrice: null,
        unitPrice: null,
        total: null,
      };
    }
    const base = pricing.prices[it.variant];
    const dirty = cat.allowDirty && it.dirty;
    const secondSide = cat.allowSecondSide && it.secondSide;
    const unit = unitPrice(base, pricing, dirty, secondSide);
    return {
      key: itemKey(it),
      category: it.category,
      variant: it.variant,
      title: cat.title,
      variantLabel: variantLabel(it.category, it.variant),
      qty: it.qty,
      dirty,
      secondSide,
      manual: false,
      basePrice: base,
      unitPrice: unit,
      total: unit * it.qty,
    };
  });

  const knownSubtotal = lines.reduce((s, l) => s + (l.total ?? 0), 0);
  const manualCount = lines.filter((l) => l.manual).length;
  const hasKnown = lines.some((l) => !l.manual);
  const tripFee = outOfCity ? pricing.outOfCityFee : 0;
  const cleaningFloor = lines.length === 0 ? 0 : Math.max(knownSubtotal, pricing.minOrder);
  const minTopUp = manualCount === 0 && lines.length > 0 ? Math.max(0, pricing.minOrder - knownSubtotal) : 0;
  const total = lines.length === 0 ? 0 : manualCount === 0 ? knownSubtotal + minTopUp + tripFee : null;

  return {
    lines,
    knownSubtotal,
    manualCount,
    minOrder: pricing.minOrder,
    minTopUp,
    tripFee,
    total,
    floor: lines.length === 0 ? 0 : cleaningFloor + tripFee,
    hasKnown,
  };
}

const nf = new Intl.NumberFormat("ru-RU");
export function rub(v: number): string {
  return `${nf.format(v)} ₽`;
}
