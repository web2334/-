import Link from "next/link";
import type { Company } from "@/lib/settings-schema";

export function SiteFooter({ company }: { company: Company }) {
  return (
    <footer className="site-footer">
      <div className="container stack" style={{ ["--gap" as string]: "10px" }}>
        <div className="row wrap" style={{ ["--gap" as string]: "18px" }}>
          <strong style={{ color: "var(--text)" }}>{company.name}</strong>
          <Link href="/privacy">Политика обработки данных</Link>
          <Link href="/credits">Модели и лицензии</Link>
          <Link href="/my">Мои заявки</Link>
        </div>
        {company.legalName && <p>{company.legalName}</p>}
        <p className="tiny faint">Цены на сайте предварительные и не являются публичной офертой. Итоговую стоимость мастер согласует по телефону.</p>
      </div>
    </footer>
  );
}
