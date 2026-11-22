import type { Company } from "./settings-schema";

export interface ContactLink {
  kind: "phone" | "telegram" | "whatsapp" | "email";
  label: string;
  href: string;
  value: string;
}

/** Только реально заполненные каналы. Пустые поля не превращаются в «заглушку». */
export function contactLinks(c: Company): ContactLink[] {
  const out: ContactLink[] = [];
  if (c.phone) out.push({ kind: "phone", label: "Позвонить", href: `tel:${c.phone.replace(/[^\d+]/g, "")}`, value: c.phone });
  if (c.telegram) {
    const nick = c.telegram.replace(/^@/, "");
    out.push({ kind: "telegram", label: "Telegram", href: `https://t.me/${nick}`, value: `@${nick}` });
  }
  if (c.whatsapp) out.push({ kind: "whatsapp", label: "WhatsApp", href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, value: c.whatsapp });
  if (c.email) out.push({ kind: "email", label: "Почта", href: `mailto:${c.email}`, value: c.email });
  return out;
}
