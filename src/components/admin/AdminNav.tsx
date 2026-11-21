"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "../ThemeToggle";

const LINKS = [
  ["/admin/orders", "Заявки"],
  ["/admin/pricing", "Тарифы"],
  ["/admin/company", "Компания"],
  ["/admin/game", "Игра"],
  ["/admin/characters", "Персонажи"],
  ["/admin/access", "Доступ"],
] as const;

export function AdminNav({ company }: { company: string }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Разделы кабинета">
      <div className="logo" style={{ fontSize: 18, padding: "0 8px", marginRight: 8, flex: "0 0 auto" }}>
        {company}
      </div>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
      <div className="grow" />
      <div className="row" style={{ flex: "0 0 auto", ["--gap" as string]: "4px" }}>
        <Link href="/" target="_blank" style={{ fontSize: 14 }}>
          Сайт ↗
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
