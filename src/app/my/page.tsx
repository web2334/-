import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MyOrders } from "@/components/MyOrders";

export const metadata: Metadata = { title: "Мои заявки", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyPage() {
  const s = await getSettings();
  return (
    <>
      <SiteHeader company={s.company} minimal />
      <main className="container section" style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Мои заявки</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Ссылки на заявки, отправленные из этого браузера. На другом устройстве откройте ссылку, которую сохранили после отправки.
        </p>
        <MyOrders />
      </main>
      <SiteFooter company={s.company} />
    </>
  );
}
