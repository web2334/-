import { getSettings } from "@/lib/settings";
import { PricingForm } from "@/components/admin/PricingForm";

export default async function PricingPage() {
  const s = await getSettings();
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <h1 style={{ fontSize: 28 }}>Тарифы</h1>
      <p className="muted">Новые цены действуют для новых заявок. Отправленные заявки хранят прайс на момент отправки.</p>
      <PricingForm initial={s.pricing} />
    </div>
  );
}
