import Link from "next/link";
import type { Company } from "@/lib/settings-schema";
import { contactLinks } from "@/lib/contacts";
import { IconLogo, IconPhone, IconChat } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ company, minimal = false }: { company: Company; minimal?: boolean }) {
  const contacts = contactLinks(company);
  const primary = contacts[0];
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="logo" aria-label={`${company.name} — на главную`}>
          <span className="logo-mark">
            <IconLogo />
          </span>
          {company.name}
        </Link>
        {!minimal && (
          <nav className="nav-links" aria-label="Разделы">
            <a href="/#choose">Выбор</a>
            <a href="/#prices">Цены</a>
            <a href="/#how">Как работаем</a>
            <a href="/#contacts">Контакты</a>
          </nav>
        )}
        <div className="grow" />
        <ThemeToggle />
        {primary && (
          <a className="btn btn-outline btn-sm" href={primary.href} target={primary.kind === "phone" || primary.kind === "email" ? undefined : "_blank"} rel="noopener noreferrer">
            {primary.kind === "phone" ? <IconPhone size={18} /> : <IconChat size={18} />}
            <span>{primary.kind === "phone" ? "Позвонить" : primary.label}</span>
          </a>
        )}
      </div>
    </header>
  );
}
