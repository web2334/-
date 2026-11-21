// Иконки PWA, apple-touch и OG-картинка из SVG (цвета по умолчанию; при смене бренда — перезапустить).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const ACCENT = process.env.ICON_ACCENT ?? "#2F6B5A";
const BG = "#F5F2EC";

const mark = (size, pad = 0, radius = 0.28) => {
  const r = size * radius;
  const inner = size - pad * 2;
  const s = inner / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${pad ? 0 : r}" fill="${ACCENT}"/>
  <g transform="translate(${pad} ${pad}) scale(${s})" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round">
    <path d="M4 15c2.5-2 5.5-2 8 0s5.5 2 8 0"/>
    <path d="M4 10c2.5-2 5.5-2 8 0s5.5 2 8 0" opacity="0.6"/>
  </g></svg>`;
};

writeFileSync(OUT + "icon.svg", mark(512, 64));
for (const [name, size, pad] of [["icon-192.png", 192, 24], ["icon-512.png", 512, 64], ["apple-touch-icon.png", 180, 26]]) {
  await sharp(Buffer.from(mark(size, pad, 0))).png().toFile(OUT + name);
}
// maskable: значок в безопасной зоне 80%
await sharp(Buffer.from(mark(512, 120, 0))).png().toFile(OUT + "maskable-512.png");

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BG}"/>
  <circle cx="1000" cy="520" r="360" fill="${ACCENT}" opacity="0.10"/>
  <g transform="translate(90 120)">${mark(120, 14).replace(/<\/?svg[^>]*>/g, "")}</g>
  <text x="90" y="350" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="800" fill="#1d201e">Ворс</text>
  <text x="90" y="430" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#5c625d">Выездная химчистка мягкой мебели</text>
  <text x="90" y="500" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="${ACCENT}">Выберите мебель — цена сразу, мастер перезвонит</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(fileURLToPath(new URL("../public/og.png", import.meta.url)));
console.log("Иконки готовы.");
