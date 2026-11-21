// Сквозная проверка по HTTP против запущенного сервера.
// Запуск: E2E_URL=http://localhost:3000 E2E_PASSWORD=... node scripts/e2e.mjs
// Все данные вымышленные; созданные заявки удаляются в конце, прайс восстанавливается.
import sharp from "sharp";
import { randomUUID, randomBytes } from "node:crypto";

const BASE = (process.env.E2E_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.OWNER_INITIAL_PASSWORD;
if (!PASSWORD) {
  console.error("Нужен E2E_PASSWORD (пароль владельца).");
  process.exit(2);
}
const ORIGIN = new URL(BASE).origin;
let passed = 0;
let failed = 0;
const created = [];

function ok(cond, name, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : "");
  }
}

async function req(path, { method = "GET", body, cookie, origin = true, form } = {}) {
  const headers = {};
  if (origin) headers.Origin = ORIGIN;
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await r.json() : ct.startsWith("image/") ? await r.arrayBuffer() : await r.text();
  return { status: r.status, data, headers: r.headers };
}

const draftId = randomBytes(18).toString("base64url");
async function upload(buf, name = "photo.jpg", type = "image/jpeg", opts = {}) {
  const fd = new FormData();
  fd.append("draftId", opts.draftId ?? draftId);
  fd.append("file", new Blob([buf], { type }), name);
  return req("/api/uploads", { method: "POST", form: fd, origin: opts.origin ?? true });
}

const baseOrder = (over = {}) => ({
  idempotencyKey: randomUUID(),
  draftId,
  items: [{ category: "sofa", variant: "sofa_3", qty: 1, dirty: true, secondSide: false }],
  name: "Проверка Вымышленная",
  phone: "+7 900 000-00-02",
  address: "ул. Тестовая, д. 7, кв. 1",
  outOfCity: false,
  wishDate: "",
  wishTime: "",
  comment: "автотест",
  photoIds: [],
  consent: true,
  ...over,
});

console.log(`E2E против ${BASE}`);

// Для повторных локальных прогонов: сбрасываем счётчики лимитов (только если задан E2E_DATABASE_URL).
if (process.env.E2E_DATABASE_URL) {
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await c.connect();
  await c.query("DELETE FROM rate_limits");
  await c.end();
  console.log("(счётчики лимитов сброшены)");
}

// --- Публичные страницы и SEO ---
console.log("\nСтраницы");
{
  const home = await req("/");
  ok(home.status === 200 && home.data.includes("Чистка"), "главная отдаёт серверный HTML");
  const robots = await req("/robots.txt");
  ok(robots.status === 200 && robots.data.includes("Disallow: /admin"), "robots.txt закрывает /admin");
  const sm = await req("/sitemap.xml");
  ok(sm.status === 200 && sm.data.includes("<urlset"), "sitemap.xml");
  const mf = await req("/manifest.webmanifest");
  ok(mf.status === 200 && mf.data.display === "standalone", "manifest standalone");
  const adm = await req("/admin/orders");
  ok(adm.status === 307 || adm.status === 302 || (adm.status === 200 && String(adm.data).includes("Кабинет владельца")), "кабинет без входа → вход", adm.status);
}

// --- Фото ---
console.log("\nФото");
const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#8899aa" } }).jpeg().toBuffer();
const png = await sharp({ create: { width: 640, height: 480, channels: 4, background: "#aa7766" } }).png().toBuffer();
let photoA, photoB;
{
  const a = await upload(jpeg);
  ok(a.status === 201 && a.data.id, "JPEG загружается", a);
  photoA = a.data.id;
  const b = await upload(png, "p.png", "image/png");
  ok(b.status === 201 && b.data.width <= 1600, "PNG загружается и ужимается", b.data);
  photoB = b.data.id;
  const fake = await upload(Buffer.from("это не картинка, а текст"), "fake.jpg", "image/jpeg");
  ok(fake.status === 422, "поддельный JPEG отклоняется по содержимому", fake);
  const tiny = await upload(await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).jpeg().toBuffer());
  ok(tiny.status === 422, "слишком маленькое фото отклоняется");
  const noOrigin = await upload(jpeg, "x.jpg", "image/jpeg", { origin: false });
  ok(noOrigin.status === 403, "без Origin — 403");
  const foreign = await req(`/api/admin/photos/${photoA}`);
  ok(foreign.status === 401, "фото недоступно без входа владельца");
}

// --- Заявки ---
console.log("\nЗаявки");
let token, number;
const mixedKey = randomUUID();
{
  const noPhoto = await req("/api/orders", {
    method: "POST",
    body: baseOrder({ items: [{ category: "other", variant: null, qty: 1, dirty: false, secondSide: false, description: "Пуф круглый" }] }),
  });
  ok(noPhoto.status === 422 && noPhoto.data.fields?.photoIds, "«Другое» без фото → ошибка у поля фото", noPhoto.data);

  const timeNoDate = await req("/api/orders", { method: "POST", body: baseOrder({ wishTime: "12:00–15:00" }) });
  ok(timeNoDate.status === 422 && timeNoDate.data.fields?.wishDate, "время без даты → ошибка у даты", timeNoDate.data);

  const badPhone = await req("/api/orders", { method: "POST", body: baseOrder({ phone: "123" }) });
  ok(badPhone.status === 422 && badPhone.data.fields?.phone, "неверный телефон → ошибка у поля");

  const noConsent = await req("/api/orders", { method: "POST", body: baseOrder({ consent: false }) });
  ok(noConsent.status === 422 && noConsent.data.fields?.consent, "без согласия — нельзя");

  const body = baseOrder({
    idempotencyKey: mixedKey,
    items: [
      { category: "chair", variant: "chair_seat", qty: 2, dirty: false, secondSide: false },
      { category: "other", variant: null, qty: 1, dirty: false, secondSide: false, description: "Банкетка 120 см, рогожка" },
    ],
    photoIds: [photoA, photoB],
    wishDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    wishTime: "15:00–18:00",
    total: 1, // попытка подсунуть сумму — должна игнорироваться
    estimate: { total: 1 },
  });
  const first = await req("/api/orders", { method: "POST", body });
  ok(first.status === 201 && first.data.token?.length >= 30, "заявка создаётся после записи в БД", first.data);
  token = first.data.token;
  number = first.data.number;
  created.push(token);

  const replay = await req("/api/orders", { method: "POST", body });
  ok(replay.status === 200 && replay.data.token === token && replay.data.replay === true, "повтор с тем же ключом не создаёт дубль");

  const changed = await req("/api/orders", { method: "POST", body: { ...body, comment: "другое" } });
  ok(changed.status === 409 && changed.data.existingToken === token, "тот же ключ, другое содержимое → 409 со ссылкой на заявку");

  const pub = await req(`/api/orders/${token}`);
  ok(pub.status === 200, "клиент открывает заявку по токену");
  ok(pub.data.estimate.total === null && pub.data.estimate.manualCount === 1, "смешанный заказ: итог неизвестен, 1 позиция по фото", pub.data.estimate);
  ok(pub.data.estimate.knownSubtotal === 700 && pub.data.estimate.floor === 2500, "известная сумма 700 ₽, нижняя граница = минимум 2500 ₽", pub.data.estimate);
  ok(pub.data.estimate.lines[1].total === null, "неизвестная цена не показана как 0");
  ok(!("owner_note" in pub.data) && !("ownerNote" in pub.data) && !("phone" in pub.data) && !JSON.stringify(pub.data).includes(photoA), "публичный API без заметки, телефона и id фото");
  ok(pub.data.photoCount === 2, "видно только количество фото");

  const guess = await req(`/api/orders/${number}`);
  ok(guess.status === 404, "по номеру заявку не открыть");
  const zGuess = await req(`/z/${number}`);
  ok(zGuess.status === 404, "страница /z/<номер> → 404");
  const zPage = await req(`/z/${token}`);
  ok(zPage.status === 200 && (zPage.headers.get("cache-control") ?? "").includes("no-store"), "приватная страница не кешируется");

  const reuse = await req("/api/orders", { method: "POST", body: baseOrder({ photoIds: [photoA] }) });
  ok(reuse.status === 422, "фото другой заявки повторно не прикрепить");
}

// --- Кабинет ---
console.log("\nКабинет");
let cookie;
{
  const noAuth = await req("/api/admin/orders");
  ok(noAuth.status === 401, "API заявок без входа → 401");
  const bad = await req("/api/admin/login", { method: "POST", body: { password: "неверный-пароль" } });
  ok(bad.status === 401, "неверный пароль → 401");
  const login = await req("/api/admin/login", { method: "POST", body: { password: PASSWORD } });
  ok(login.status === 200, "вход владельца");
  cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  ok(/HttpOnly/i.test(login.headers.get("set-cookie") ?? ""), "cookie сеанса HttpOnly");

  const list = await req(`/api/admin/orders?status=all&q=${encodeURIComponent("Вымышленная")}`, { cookie });
  const row = list.data.orders?.find((o) => o.number === number);
  ok(row && row.photo_count === 2 && row.manual_count === 1, "заявка в списке с поиском", list.data.orders?.length);
  const byPhone = await req(`/api/admin/orders?status=all&q=0000002`, { cookie });
  ok(byPhone.data.orders?.some((o) => o.number === number), "поиск по телефону");

  const detail = await req(`/api/admin/orders/${row.id}`, { cookie });
  ok(detail.status === 200 && detail.data.photos.length === 2 && detail.data.pricing_snapshot.minOrder > 0, "карточка: фото и прайс на момент отправки");
  const ph = await req(`/api/admin/photos/${photoA}`, { cookie });
  ok(ph.status === 200 && ph.headers.get("content-type") === "image/webp", "владелец видит фото (WebP)");

  const noOriginPatch = await req(`/api/admin/orders/${row.id}`, { method: "PATCH", cookie, origin: false, body: {} });
  ok(noOriginPatch.status === 403, "изменение без Origin → 403");

  const agreedBad = await req(`/api/admin/orders/${row.id}`, {
    method: "PATCH",
    cookie,
    body: { status: "agreed", finalPrice: null, agreedAt: null, clientMessage: "", ownerNote: "" },
  });
  ok(agreedBad.status === 422 && agreedBad.data.fields?.finalPrice && agreedBad.data.fields?.agreedAt, "«Согласована» требует цену и время");

  const agreed = await req(`/api/admin/orders/${row.id}`, {
    method: "PATCH",
    cookie,
    body: { status: "agreed", finalPrice: 3900, agreedAt: "2026-11-27T14:30", clientMessage: "Позвоним за час до приезда.", ownerNote: "Секретная заметка владельца" },
  });
  ok(agreed.status === 200, "владелец согласовал цену и время");

  const pub = await req(`/api/orders/${token}`);
  ok(pub.data.status === "agreed" && pub.data.finalPrice === 3900 && pub.data.agreedAt === "2026-11-27T14:30", "клиент видит обновление по той же ссылке", pub.data);
  ok(pub.data.clientMessage === "Позвоним за час до приезда." && !JSON.stringify(pub.data).includes("Секретная"), "сообщение клиенту видно, приватная заметка — нет");

  const hist = await req(`/api/admin/orders/${row.id}`, { cookie });
  ok(hist.data.events.length >= 2, "история изменений пишется");

  // Снимок прайса: смена цен не меняет старую заявку
  const s0 = await req("/api/admin/settings/pricing", { method: "PUT", cookie, body: null });
  ok(s0.status === 422, "пустые тарифы не сохраняются");
  const before = hist.data.pricing_snapshot;
  const raised = { ...before, prices: { ...before.prices, chair_seat: before.prices.chair_seat + 100 } };
  const put = await req("/api/admin/settings/pricing", { method: "PUT", cookie, body: raised });
  ok(put.status === 200, "тарифы сохраняются");
  const old = await req(`/api/orders/${token}`);
  ok(old.data.estimate.knownSubtotal === 700, "старая заявка сохраняет прежний расчёт");
  const fresh = await req("/api/orders", { method: "POST", body: baseOrder({ items: [{ category: "chair", variant: "chair_seat", qty: 2, dirty: false, secondSide: false }] }) });
  created.push(fresh.data.token);
  const freshPub = await req(`/api/orders/${fresh.data.token}`);
  ok(freshPub.data.estimate.knownSubtotal === (before.prices.chair_seat + 100) * 2, "новая заявка считается по новому прайсу");
  ok(freshPub.data.estimate.minTopUp > 0 && freshPub.data.estimate.total === before.minOrder, "минимум применяется к малому заказу", freshPub.data.estimate);
  await req("/api/admin/settings/pricing", { method: "PUT", cookie, body: before });

  // Выезд за город сверху минимума
  const trip = await req("/api/orders", { method: "POST", body: baseOrder({ outOfCity: true, items: [{ category: "chair", variant: "chair_seat", qty: 1, dirty: false, secondSide: false }] }) });
  created.push(trip.data.token);
  const tripPub = await req(`/api/orders/${trip.data.token}`);
  ok(tripPub.data.estimate.total === before.minOrder + before.outOfCityFee, "выезд за город добавляется после минимума", tripPub.data.estimate);

  // Игра
  const game = await req("/api/admin/settings/game", { method: "PUT", cookie, body: { mode: "bonus", bonusAmount: 500, bonusDays: 90, bonusMinOrder: 3000 } });
  ok(game.status === 200, "режим игры «бонус»");
  const g1 = await req(`/api/orders/${token}/game`, { method: "POST", body: { progress: 1 } });
  const g2 = await req(`/api/orders/${token}/game`, { method: "POST", body: { progress: 1 } });
  ok(g1.status === 200 && g1.data.code && g2.data.code === g1.data.code, "один бонус-код на заявку", [g1.data, g2.data]);
  const gLow = await req(`/api/orders/${fresh.data.token}/game`, { method: "POST", body: { progress: 0.2 } });
  ok(gLow.status === 422, "недочищено — код не выдаётся");

  // Смена пароля закрывает прежние сеансы
  const login2 = await req("/api/admin/login", { method: "POST", body: { password: PASSWORD } });
  const cookie2 = (login2.headers.get("set-cookie") ?? "").split(";")[0];
  const tmp = `временный-${randomBytes(4).toString("hex")}-пароль`;
  const ch = await req("/api/admin/password", { method: "POST", cookie, body: { current: PASSWORD, next: tmp } });
  ok(ch.status === 200, "смена пароля");
  const newCookie = (ch.headers.get("set-cookie") ?? "").split(";")[0];
  const old2 = await req("/api/admin/orders", { cookie: cookie2 });
  ok(old2.status === 401, "прежний сеанс закрыт после смены пароля");
  const back = await req("/api/admin/password", { method: "POST", cookie: newCookie, body: { current: tmp, next: PASSWORD } });
  ok(back.status === 200, "пароль возвращён");
  cookie = (back.headers.get("set-cookie") ?? "").split(";")[0];

  // Удаление с подтверждением
  const noConfirm = await req(`/api/admin/orders/${row.id}`, { method: "DELETE", cookie, body: {} });
  ok(noConfirm.status === 400, "удаление без подтверждения отклоняется");
}

// --- Лимит запросов ---
console.log("\nЛимиты");
{
  let limited = false;
  for (let i = 0; i < 16 && !limited; i++) {
    const r = await req("/api/orders", { method: "POST", body: { bad: true } });
    if (r.status === 429) limited = true;
  }
  ok(limited, "частые отправки заявок упираются в лимит (429)");
}

// --- Уборка ---
console.log("\nУборка");
{
  const list = await req(`/api/admin/orders?status=all&q=${encodeURIComponent("Вымышленная")}`, { cookie });
  for (const o of list.data.orders ?? []) {
    const d = await req(`/api/admin/orders/${o.id}`, { method: "DELETE", cookie, body: { confirm: "УДАЛИТЬ" } });
    if (d.status !== 200) ok(false, `удаление №${o.number}`, d);
  }
  const gone = await req(`/api/orders/${token}`);
  ok(gone.status === 404, "после удаления ссылка клиента не работает");
  const photoGone = await req(`/api/admin/photos/${photoA}`, { cookie });
  ok(photoGone.status === 404, "фото удалены вместе с заявкой");
  await req("/api/admin/logout", { method: "POST", cookie });
}

console.log(`\nИтог: ${passed} пройдено, ${failed} с ошибками`);
process.exit(failed ? 1 : 0);
