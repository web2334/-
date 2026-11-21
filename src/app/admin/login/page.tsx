import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Вход в кабинет", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await currentSession()) redirect("/admin/orders");
  const s = await getSettings();
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card card-pad stack" style={{ width: "min(400px, 100%)", ["--gap" as string]: "16px" }}>
        <div>
          <p className="eyebrow">{s.company.name}</p>
          <h1 style={{ fontSize: 26, marginTop: 4 }}>Кабинет владельца</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
