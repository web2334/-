import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicOrder } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { toPublic } from "@/lib/settings-schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OrderView } from "@/components/OrderView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ваша заявка", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const [order, s] = await Promise.all([getPublicOrder(token), getSettings()]);
  if (!order) notFound();
  return (
    <>
      <SiteHeader company={s.company} minimal />
      <main className="container" style={{ paddingTop: 20, paddingBottom: 56, maxWidth: 820 }}>
        <OrderView token={token} initial={order} settings={toPublic(s)} isNew={sp.new === "1"} />
      </main>
      <SiteFooter company={s.company} />
    </>
  );
}
