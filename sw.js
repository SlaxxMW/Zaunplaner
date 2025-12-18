/* Zaunteam Zaunplaner – Service Worker (PWA Test) */
const CACHE_VERSION = "v1.0.0"; // <- bei Updates hochzählen, z.B. v1.0.1
const CACHE_NAME = `zaunplaner-${CACHE_VERSION}`;

// Cache nur die Kern-Dateien. (Die App läuft offline nach dem 1. Besuch.)
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(CORE_ASSETS);
    } catch (e) {
      // falls app.js über ?v=... geladen wird, kann addAll scheitern.
      // Wir versuchen dann zumindest die Basis-Dateien.
      await cache.addAll(["./", "./index.html"]);
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("zaunplaner-") && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

// Network-first für index.html (damit Updates kommen), Cache-first für Assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur same-origin
  if (url.origin !== self.location.origin) return;

  // HTML: network-first
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match("./index.html")) || (await cache.match("./"));
      }
    })());
    return;
  }

  // Assets: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  })());
});
