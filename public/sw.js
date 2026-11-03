// Service worker du socle M0 : pré-cache de la coquille, cache versionné par version d'app (ADR-02),
// cache-first pour la coquille. Version : {{APP_VERSION}} (injectée au build, TM9/TM10).
const VERSION = "objectifs-{{APP_VERSION}}";
const COQUILLE = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "domain/exportImport.js",
  "domain/persistence.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // Invalidation : seuls les caches de la version courante subsistent (réserves architecte r1)
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((rep) => rep || fetch(e.request)));
});
