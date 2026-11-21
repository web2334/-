import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { ServiceWorker } from "@/components/ServiceWorker";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const name = s.company.name;
  const city = s.company.city ? ` в ${s.company.city}` : "";
  const title = `${name} — выездная химчистка мягкой мебели${city}`;
  const description = `Чистка диванов, кресел, матрасов и стульев на дому${city}. Выберите мебель, посмотрите примерную стоимость и отправьте заявку — мастер перезвонит и согласует цену и время.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${name}` },
    description,
    applicationName: name,
    manifest: "/manifest.webmanifest",
    alternates: { canonical: "/" },
    openGraph: { type: "website", locale: "ru_RU", title, description, siteName: name, images: [{ url: "/og.png", width: 1200, height: 630 }] },
    icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#121413" },
  ],
};

// Тема ставится до отрисовки, чтобы не было вспышки.
const themeScript = `try{var t=localStorage.getItem("vors.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="ru" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style>{`:root{--accent:${s.company.accent}}`}</style>
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
