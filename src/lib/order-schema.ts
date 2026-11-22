import { z } from "zod";
import { CATEGORY_BY_ID } from "./catalog";

export const TIME_SLOTS = ["09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–21:00"] as const;
export const MAX_PHOTOS = 3;
export const MAX_ITEMS = 30;
export const MAX_QTY = 20;

export const STATUS_LABEL = {
  new: "Новая",
  agreed: "Согласована",
  done: "Завершена",
  cancelled: "Отменена",
} as const;
export type OrderStatus = keyof typeof STATUS_LABEL;

/** Нормализация телефона: +7XXXXXXXXXX для российских, иначе +цифры. null — некорректный. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits[0] === "9") return `+7${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhone(p: string): string {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : p;
}

export const itemSchema = z
  .object({
    category: z.enum(["sofa", "armchair", "mattress", "chair", "other"]),
    variant: z
      .enum([
        "sofa_2",
        "sofa_3",
        "sofa_corner",
        "armchair_standard",
        "armchair_recliner",
        "mattress_single",
        "mattress_double",
        "chair_seat",
        "chair_seatback",
      ])
      .nullable(),
    qty: z.number().int().min(1).max(MAX_QTY),
    dirty: z.boolean(),
    secondSide: z.boolean(),
    description: z.string().trim().max(500).optional(),
  })
  .superRefine((it, ctx) => {
    const cat = CATEGORY_BY_ID[it.category];
    if (cat.manual) {
      if (!it.description || it.description.length < 3)
        ctx.addIssue({ code: "custom", message: "Опишите предмет: что это и примерный размер", path: ["description"] });
      return;
    }
    if (!it.variant || !cat.variants.some((v) => v.id === it.variant))
      ctx.addIssue({ code: "custom", message: "Неизвестный вариант", path: ["variant"] });
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

export const orderSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    draftId: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/),
    items: z.array(itemSchema).min(1, "Добавьте хотя бы один предмет").max(MAX_ITEMS),
    name: z.string().trim().min(2, "Укажите имя").max(80, "Слишком длинное имя"),
    phone: z.string().trim().max(30),
    address: z.string().trim().min(5, "Укажите адрес: улица, дом, квартира").max(300),
    outOfCity: z.boolean(),
    wishDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Некорректная дата"),
    wishTime: z.union([z.enum(TIME_SLOTS), z.literal("")]),
    comment: z.string().trim().max(1000, "Комментарий до 1000 символов"),
    photoIds: z.array(z.string().uuid()).max(MAX_PHOTOS, `Не больше ${MAX_PHOTOS} фото`),
    consent: z.literal(true, { message: "Нужно согласие на обработку данных" }),
  })
  .superRefine((o, ctx) => {
    if (!normalizePhone(o.phone)) ctx.addIssue({ code: "custom", message: "Телефон в формате +7 900 000-00-00", path: ["phone"] });
    if (o.wishTime && !o.wishDate)
      ctx.addIssue({ code: "custom", message: "Для времени выберите дату", path: ["wishDate"] });
    if (o.wishDate) {
      const d = new Date(o.wishDate + "T00:00:00Z");
      const min = new Date(todayIso() + "T00:00:00Z");
      min.setUTCDate(min.getUTCDate() - 1); // запас на часовые пояса
      const max = new Date(min);
      max.setUTCDate(max.getUTCDate() + 120);
      if (Number.isNaN(d.getTime()) || d < min || d > max)
        ctx.addIssue({ code: "custom", message: "Выберите дату в ближайшие 3 месяца", path: ["wishDate"] });
    }
    if (o.items.some((i) => i.category === "other") && o.photoIds.length === 0)
      ctx.addIssue({ code: "custom", message: "Для «Другое» нужна хотя бы одна фотография", path: ["photoIds"] });
  });

export type OrderInput = z.infer<typeof orderSchema>;

export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
