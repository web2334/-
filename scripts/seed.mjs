// Демо-заявки (вымышленные) через HTTP API запущенного сервера.
// Запуск: SEED_URL=http://localhost:3000 SEED_PASSWORD=... node scripts/seed.mjs
import sharp from "sharp";
import { randomUUID, randomBytes } from "node:crypto";

const BASE = (process.env.SEED_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.SEED_PASSWORD ?? process.env.OWNER_INITIAL_PASSWORD;
const ORIGIN = new URL(BASE).origin;
const H = { Origin: ORIGIN };

async function post(path, body, cookie) {
  const r = await fetch(BASE + path, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json(), headers: r.headers };
}
async function photo(draftId, color) {
  const buf = await sharp({ create: { width: 900, height: 700, channels: 3, background: color } })
    .composite([{ input: Buffer.from(`<svg width="900" height="700"><ellipse cx="420" cy="360" rx="150" ry="95" fill="#6b4a2a" opacity="0.7"/></svg>`) }])
    .jpeg()
    .toBuffer();
  const fd = new FormData();
  fd.append("draftId", draftId);
  fd.append("file", new Blob([buf], { type: "image/jpeg" }), "demo.jpg");
  const r = await fetch(BASE + "/api/uploads", { method: "POST", headers: H, body: fd });
  return (await r.json()).id;
}
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const demos = [
  {
    name: "Ирина (демо)", phone: "+7 900 000-00-11", address: "ул. Садовая, д. 10, кв. 5 (вымышленный адрес)",
    items: [{ category: "sofa", variant: "sofa_corner", qty: 1, dirty: true, secondSide: false }, { category: "armchair", variant: "armchair_standard", qty: 2, dirty: false, secondSide: false }],
    wishDate: day(2), wishTime: "12:00–15:00", comment: "Кот любит угол дивана.", photos: ["#7a8fa0"], patch: null,
  },
  {
    name: "Олег (демо)", phone: "+7 900 000-00-12", address: "пр. Мира, д. 3, кв. 41 (вымышленный адрес)",
    items: [{ category: "mattress", variant: "mattress_double", qty: 1, dirty: false, secondSide: true }, { category: "other", variant: null, qty: 1, dirty: false, secondSide: false, description: "Мягкое изголовье кровати 160 см, велюр" }],
    wishDate: day(4), wishTime: "", comment: "", photos: ["#c9c2b5", "#9a8d7a"],
    patch: { status: "agreed", finalPrice: 6200, agreedAt: `${day(4)}T10:00`, clientMessage: "Изголовье почистим вместе с матрасом.", ownerNote: "Демо: согласовано по телефону." },
  },
  {
    name: "Марина (демо)", phone: "+7 900 000-00-13", address: "СНТ «Рассвет», уч. 12 (вымышленный адрес)", outOfCity: true,
    items: [{ category: "chair", variant: "chair_seatback", qty: 6, dirty: false, secondSide: false }],
    wishDate: "", wishTime: "", comment: "Шесть стульев на кухне.", photos: [],
    patch: { status: "done", finalPrice: 4000, agreedAt: `${day(-3)}T16:30`, clientMessage: "Спасибо!", ownerNote: "" },
  },
];

const results = [];
for (const d of demos) {
  const draftId = randomBytes(18).toString("base64url");
  const photoIds = [];
  for (const c of d.photos) photoIds.push(await photo(draftId, c));
  const r = await post("/api/orders", {
    idempotencyKey: randomUUID(), draftId, items: d.items, name: d.name, phone: d.phone, address: d.address,
    outOfCity: !!d.outOfCity, wishDate: d.wishDate, wishTime: d.wishTime, comment: d.comment, photoIds, consent: true,
  });
  if (r.status >= 300) throw new Error(JSON.stringify(r.data));
  results.push({ ...r.data, patch: d.patch });
  console.log(`  заявка №${r.data.number}: ${BASE}/z/${r.data.token}`);
}
if (PASSWORD) {
  const login = await post("/api/admin/login", { password: PASSWORD });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const list = await fetch(BASE + "/api/admin/orders?status=all&q=" + encodeURIComponent("(демо)"), { headers: { Cookie: cookie } }).then((r) => r.json());
  for (const res of results) {
    if (!res.patch) continue;
    const row = list.orders.find((o) => o.number === res.number);
    await fetch(BASE + `/api/admin/orders/${row.id}`, { method: "PATCH", headers: { ...H, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(res.patch) });
  }
  console.log("Статусы демо-заявок обновлены.");
}
