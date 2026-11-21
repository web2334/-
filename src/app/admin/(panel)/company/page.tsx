import { getSettings } from "@/lib/settings";
import { CompanyForm } from "@/components/admin/CompanyForm";

export default async function CompanyPage() {
  const s = await getSettings();
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <h1 style={{ fontSize: 28 }}>Компания</h1>
      <CompanyForm initial={s.company} />
    </div>
  );
}
