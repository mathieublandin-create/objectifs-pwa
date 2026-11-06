// Service worker PWA (ADR-02) : pré-cache de la coquille, cache versionné par version d'app,
// cache-first pour la coquille, mise en cache à l'exécution des assets hachés (Vite).
// La version {{APP_VERSION}} est injectée au build (inject-version.js, depuis package.json).
const VERSION = "objectifs-{{APP_VERSION}}";
const COQUILLE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // Invalidation : seuls les caches de la version courante subsistent
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((rep) => rep || fetch(e.request).then((r) => {
      if (r.ok) { const clone = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, clone)); }
      return r;
    }))
  );
});
