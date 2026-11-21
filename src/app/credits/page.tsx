import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Модели и лицензии", alternates: { canonical: "/credits" } };
export const dynamic = "force-dynamic";

const LIBS = [
  ["Next.js, React", "MIT"],
  ["three.js", "MIT"],
  ["React Three Fiber, Drei", "MIT"],
  ["Motion", "MIT"],
  ["glTF Transform, meshoptimizer", "MIT"],
  ["sharp (libvips)", "Apache-2.0 / LGPL-3.0 (динамическая связь)"],
  ["node-postgres (pg)", "MIT"],
  ["Zod", "MIT"],
  ["Шрифт Manrope", "SIL Open Font License 1.1"],
];

export default async function Credits() {
  const s = await getSettings();
  return (
    <>
      <SiteHeader company={s.company} minimal />
      <main className="container section prose">
        <h1 style={{ fontSize: 34, marginBottom: 12 }}>Модели и лицензии</h1>
        <h2>3D-модели</h2>
        <p>
          Все 3D-персонажи (диваны, кресла, матрасы, стул, пуф) созданы специально для этого проекта процедурно — скриптом scripts/build-models.mjs на three.js — и
          передаются владельцу вместе с исходниками. Сторонних моделей и текстур нет. Нормал-карта ткани также сгенерирована скриптом.
        </p>
        <h2>Библиотеки</h2>
        <ul>
          {LIBS.map(([n, l]) => (
            <li key={n}>
              {n} — {l}
            </li>
          ))}
        </ul>
        <p>Полные тексты лицензий — в папке node_modules соответствующих пакетов и в файле LICENSES.md репозитория.</p>
      </main>
      <SiteFooter company={s.company} />
    </>
  );
}
