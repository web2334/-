// Каталог услуг: категории, варианты и привязка к 3D-моделям.
// Цены здесь НЕ хранятся — они в настройках компании (таблица settings).

export type CategoryId = "sofa" | "armchair" | "mattress" | "chair" | "other";

export type PriceKey =
  | "sofa_2"
  | "sofa_3"
  | "sofa_corner"
  | "armchair_standard"
  | "armchair_recliner"
  | "mattress_single"
  | "mattress_double"
  | "chair_seat"
  | "chair_seatback";

export interface Variant {
  id: PriceKey;
  label: string;
  hint: string;
  /** файл в /public/models */
  model: ModelId;
}

export type ModelId =
  | "sofa2"
  | "sofa3"
  | "sofaCorner"
  | "armchair"
  | "recliner"
  | "mattressSingle"
  | "mattressDouble"
  | "chair"
  | "pouf";

export interface Category {
  id: CategoryId;
  title: string;
  /** родительный падеж для фраз «Чистка …» */
  genitive: string;
  short: string;
  variants: Variant[];
  /** true — у вариантов разные 3D-модели; false — модель одна, меняется только тариф */
  variantModels: boolean;
  allowDirty: boolean;
  allowSecondSide: boolean;
  manual: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: "sofa",
    title: "Диван",
    genitive: "дивана",
    short: "Прямые и угловые",
    variantModels: true,
    allowDirty: true,
    allowSecondSide: false,
    manual: false,
    variants: [
      { id: "sofa_2", label: "2 места", hint: "Компактный, до 160 см", model: "sofa2" },
      { id: "sofa_3", label: "3 места", hint: "Прямой, до 230 см", model: "sofa3" },
      { id: "sofa_corner", label: "Угловой", hint: "С оттоманкой или модулем", model: "sofaCorner" },
    ],
  },
  {
    id: "armchair",
    title: "Кресло",
    genitive: "кресла",
    short: "Обычное и реклайнер",
    variantModels: true,
    allowDirty: true,
    allowSecondSide: false,
    manual: false,
    variants: [
      { id: "armchair_standard", label: "Обычное", hint: "Мягкое кресло с подлокотниками", model: "armchair" },
      { id: "armchair_recliner", label: "Реклайнер", hint: "С откидной подножкой", model: "recliner" },
    ],
  },
  {
    id: "mattress",
    title: "Матрас",
    genitive: "матраса",
    short: "Одна или две стороны",
    variantModels: true,
    allowDirty: true,
    allowSecondSide: true,
    manual: false,
    variants: [
      { id: "mattress_single", label: "Односпальный", hint: "До 120 см в ширину", model: "mattressSingle" },
      { id: "mattress_double", label: "Двуспальный", hint: "От 140 см в ширину", model: "mattressDouble" },
    ],
  },
  {
    id: "chair",
    title: "Стул",
    genitive: "стула",
    short: "Сиденье или со спинкой",
    variantModels: false,
    allowDirty: true,
    allowSecondSide: false,
    manual: false,
    variants: [
      { id: "chair_seat", label: "Сиденье", hint: "Только мягкое сиденье", model: "chair" },
      { id: "chair_seatback", label: "Сиденье и спинка", hint: "Мягкое сиденье и спинка", model: "chair" },
    ],
  },
  {
    id: "other",
    title: "Другое",
    genitive: "предмета",
    short: "Пуф, банкетка, изголовье…",
    variantModels: false,
    allowDirty: false,
    allowSecondSide: false,
    manual: true,
    variants: [],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export const ALL_MODELS: ModelId[] = [
  "sofa2",
  "sofa3",
  "sofaCorner",
  "armchair",
  "recliner",
  "mattressSingle",
  "mattressDouble",
  "chair",
  "pouf",
];

export function modelFor(category: CategoryId, variant: PriceKey | null): ModelId {
  if (category === "other") return "pouf";
  const cat = CATEGORY_BY_ID[category];
  return cat.variants.find((v) => v.id === variant)?.model ?? cat.variants[0].model;
}

export function variantLabel(category: CategoryId, variant: PriceKey | null): string {
  const cat = CATEGORY_BY_ID[category];
  if (!variant) return "";
  return cat.variants.find((v) => v.id === variant)?.label ?? "";
}

export const PRICE_LABELS: Record<PriceKey, string> = {
  sofa_2: "Диван · 2 места",
  sofa_3: "Диван · 3 места",
  sofa_corner: "Диван · угловой",
  armchair_standard: "Кресло · обычное",
  armchair_recliner: "Кресло · реклайнер",
  mattress_single: "Матрас · односпальный (1 сторона)",
  mattress_double: "Матрас · двуспальный (1 сторона)",
  chair_seat: "Стул · сиденье",
  chair_seatback: "Стул · сиденье и спинка",
};
