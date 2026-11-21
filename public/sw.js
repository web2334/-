// Service worker «Ворс». Кеширует только публичную статику и офлайн-экран.
// Приватные страницы (/z, /admin, /checkout) и любые /api НИКОГДА не кешируются.
const VERSION = "vors-v1";
const STATIC = `${VERSION}-static`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const PRIVATE = [/^\/api\//, /^\/admin/, /^\/z\//, /^\/checkout/, /^\/my/];

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE.some((r) => r.test(url.pathname))) {
    // Только сеть; при офлайне — офлайн-экран для навигации.
    if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  // Неизменяемая статика сборки, модели и иконки — cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/models/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  // Публичные страницы — только сеть, офлайн-экран при отсутствии связи
  if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
