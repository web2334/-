import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  const s = await getSettings();
  return (
    <div className="admin">
      <AdminNav company={s.company.name} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
