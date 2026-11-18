// Service Worker: macht die Seite installierbar und startet sie auch ohne Netz
// (die Daten kommen dann aus dem lokalen Zwischenspeicher der Seite).
const CACHE = "wochenplan-v2"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

// Nur eigene Dateien (Seite, Skript, Schrift, Symbole): erst Netz, sonst Zwischenspeicher.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" }))
  )
})
