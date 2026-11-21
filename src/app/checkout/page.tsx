import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { toPublic } from "@/lib/settings-schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackToChoice, Checkout } from "@/components/Checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оформление заявки", robots: { index: false } };

export default async function CheckoutPage() {
  const s = await getSettings();
  return (
    <>
      <SiteHeader company={s.company} minimal />
      <main className="container" style={{ paddingTop: 16, paddingBottom: 48 }}>
        <BackToChoice />
        <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: "8px 0 18px" }}>Оформление заявки</h1>
        <Checkout settings={toPublic(s)} />
      </main>
      <SiteFooter company={s.company} />
    </>
  );
}
