/* Service worker: dopo la prima visita il gioco si apre anche senza internet. Cambia il numero di CACHE a ogni aggiornamento. */
const CACHE = "isola-v2";
const ASSETS = ["./", "index.html", "isola.js", "vendor/three/three.module.js", "vendor/three/three.core.js", "vendor/three/addons/utils/BufferGeometryUtils.js"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => { const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(r, { ignoreSearch: true }); const net = fetch(r).then(x => { if (x && x.ok) c.put(r, x.clone()); return x; }).catch(() => null); return hit || (await net) || new Response("", { status: 504 }); })); });
