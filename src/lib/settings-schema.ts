import { z } from "zod";

const money = z.coerce.number().int().min(0).max(1_000_000);
const pct = z.coerce.number().int().min(0).max(300);
const text = (max: number) => z.string().trim().max(max);

export const pricingSchema = z.object({
  prices: z.object({
    sofa_2: money,
    sofa_3: money,
    sofa_corner: money,
    armchair_standard: money,
    armchair_recliner: money,
    mattress_single: money,
    mattress_double: money,
    chair_seat: money,
    chair_seatback: money,
  }),
  /** минимальная сумма чистки, ₽ (выезд за город сверху) */
  minOrder: money,
  /** надбавка за сильные загрязнения, % от базовой цены */
  dirtyPct: pct,
  /** вторая сторона матраса, % от базовой цены */
  secondSidePct: pct,
  /** фиксированная доплата за выезд за город, ₽ */
  outOfCityFee: money,
});

const optionalUrlish = text(200);

export const companySchema = z.object({
  name: text(60).min(1),
  tagline: text(140),
  city: text(80),
  area: text(300),
  phone: text(40).refine((v) => v === "" || /^\+?[0-9 ()-]{10,20}$/.test(v), "Телефон в формате +7 900 000-00-00"),
  telegram: optionalUrlish.refine((v) => v === "" || /^@?[A-Za-z0-9_]{4,32}$/.test(v), "Ник в Telegram без ссылки, например @vors_clean"),
  whatsapp: text(20).refine((v) => v === "" || /^\+?[0-9]{10,15}$/.test(v), "Номер WhatsApp только цифрами"),
  email: text(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Некорректный e-mail"),
  hours: text(80),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB"),
  legalName: text(200),
});

export const gameSchema = z.object({
  mode: z.enum(["off", "play", "bonus"]),
  bonusAmount: money,
  bonusDays: z.coerce.number().int().min(1).max(730),
  bonusMinOrder: money,
});

export const charactersSchema = z.object({
  preset: z.enum(["calm", "cheerful", "business"]),
  faces: z.boolean(),
  phrases: z.boolean(),
});

export const settingsSchema = z.object({
  company: companySchema,
  pricing: pricingSchema,
  game: gameSchema,
  characters: charactersSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type Company = z.infer<typeof companySchema>;
export type GameSettings = z.infer<typeof gameSchema>;
export type CharacterSettings = z.infer<typeof charactersSchema>;

// Демо-значения. Контакты пустые намеренно: сайт не показывает выдуманный номер как настоящий.
export const DEFAULT_SETTINGS: Settings = {
  company: {
    name: "Ворс",
    tagline: "Выездная химчистка мягкой мебели. Приезжаем со своим оборудованием.",
    city: "",
    area: "В пределах города — без доплаты. За город — фиксированная доплата.",
    phone: "",
    telegram: "",
    whatsapp: "",
    email: "",
    hours: "Ежедневно 9:00–21:00",
    accent: "#2F6B5A",
    legalName: "",
  },
  pricing: {
    prices: {
      sofa_2: 3200,
      sofa_3: 4200,
      sofa_corner: 5200,
      armchair_standard: 1600,
      armchair_recliner: 2200,
      mattress_single: 2200,
      mattress_double: 3000,
      chair_seat: 350,
      chair_seatback: 550,
    },
    minOrder: 2500,
    dirtyPct: 30,
    secondSidePct: 60,
    outOfCityFee: 700,
  },
  game: { mode: "bonus", bonusAmount: 500, bonusDays: 90, bonusMinOrder: 3000 },
  characters: { preset: "calm", faces: true, phrases: true },
};

/** Подмножество настроек, которое можно отдавать в браузер. */
export type PublicSettings = Pick<Settings, "company" | "pricing" | "characters"> & {
  game: Pick<GameSettings, "mode" | "bonusAmount" | "bonusDays" | "bonusMinOrder">;
};

export function toPublic(s: Settings): PublicSettings {
  return { company: s.company, pricing: s.pricing, characters: s.characters, game: s.game };
}
