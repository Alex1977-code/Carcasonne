// Service Worker – Offline-Cache mit automatischen Updates.
// Strategie: Seiten (HTML) immer zuerst frisch aus dem Netz laden
// (Offline-Fallback aus dem Cache), alle übrigen Dateien aus dem Cache
// liefern und im Hintergrund aktualisieren („stale-while-revalidate“).
// So bekommen installierte Geräte ohne manuelle Versionspflege immer
// spätestens beim nächsten Öffnen die neueste Version.
const CACHE = 'carcassonne-v4';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/engine/tiles.js',
  './js/engine/game.js',
  './js/engine/ai.js',
  './js/ui/render.js',
  './js/ui/sound.js',
  './js/ui/net.js',
  './js/ui/main.js',
  './js/lib/peerjs.min.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // Navigation/HTML: Netz zuerst, Cache als Offline-Fallback
  if (req.mode === 'navigate' || req.url.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // Übrige Dateien: sofort aus dem Cache, parallel im Hintergrund erneuern
  e.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
