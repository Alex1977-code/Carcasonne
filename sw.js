// Service Worker – Offline-Cache mit automatischen Updates.
// Strategie: Seiten (HTML) immer zuerst frisch aus dem Netz laden
// (Offline-Fallback aus dem Cache), alle übrigen Dateien aus dem Cache
// liefern und im Hintergrund aktualisieren („stale-while-revalidate“).
// So bekommen installierte Geräte ohne manuelle Versionspflege immer
// spätestens beim nächsten Öffnen die neueste Version.
const CACHE = 'carcassonne-v12';
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
  // Zeichenmodule: einzeln auflisten, sonst fehlen sie beim ersten
  // Offline-Start – nachgeladen werden sie erst beim zweiten Besuch.
  './js/ui/render/adapt-tiles.js',
  './js/ui/render/ambience.js',
  './js/ui/render/backdrop.js',
  './js/ui/render/base.js',
  './js/ui/render/buildings.js',
  './js/ui/render/cache.js',
  './js/ui/render/contract.js',
  './js/ui/render/fields.js',
  './js/ui/render/landmarks.js',
  './js/ui/render/layers.js',
  './js/ui/render/meeple-colors.js',
  './js/ui/render/paintings.js',
  './js/ui/render/palette.js',
  './js/ui/render/rng.js',
  './js/ui/render/tiles.js',
  // Gemalte Karten. Fehlt eine, faellt das Spiel auf die gezeichnete
  // Darstellung zurueck – deshalb ist die Liste nicht heikel, sie sorgt
  // nur dafuer, dass offline von Anfang an die Malerei zu sehen ist.
  './grafik/karten/A.webp',
  './grafik/karten/B.webp',
  './grafik/karten/C.webp',
  './grafik/karten/D.webp',
  './grafik/karten/E.webp',
  './grafik/karten/EC_CATH.webp',
  './grafik/karten/EC_CITY_3SHIELD.webp',
  './grafik/karten/EC_CITY_DIAG.webp',
  './grafik/karten/EC_CITY_FULL.webp',
  './grafik/karten/EC_CITY_GATE.webp',
  './grafik/karten/EC_CITY_ROADPASS.webp',
  './grafik/karten/EC_CROSS_CITY.webp',
  './grafik/karten/EC_DOUBLE_CURVE.webp',
  './grafik/karten/EC_DOUBLE_CURVE2.webp',
  './grafik/karten/EC_INN_CITYSTRAIGHT.webp',
  './grafik/karten/EC_INN_CURVE.webp',
  './grafik/karten/EC_INN_STRAIGHT.webp',
  './grafik/karten/EC_INN_TJUNC.webp',
  './grafik/karten/EC_MON_ROAD2.webp',
  './grafik/karten/EC_TRIPLE_CITY.webp',
  './grafik/karten/F.webp',
  './grafik/karten/G.webp',
  './grafik/karten/H.webp',
  './grafik/karten/I.webp',
  './grafik/karten/J.webp',
  './grafik/karten/K.webp',
  './grafik/karten/L.webp',
  './grafik/karten/M.webp',
  './grafik/karten/N.webp',
  './grafik/karten/O.webp',
  './grafik/karten/P.webp',
  './grafik/karten/Q.webp',
  './grafik/karten/R.webp',
  './grafik/karten/RV_BRIDGE.webp',
  './grafik/karten/RV_CITY2.webp',
  './grafik/karten/RV_CURVE.webp',
  './grafik/karten/RV_LAKE.webp',
  './grafik/karten/RV_ROADCURVE.webp',
  './grafik/karten/RV_SPRING.webp',
  './grafik/karten/RV_STRAIGHT.webp',
  './grafik/karten/S.webp',
  './grafik/karten/T.webp',
  './grafik/karten/U.webp',
  './grafik/karten/V.webp',
  './grafik/karten/W.webp',
  './grafik/karten/X.webp',
  './js/lib/peerjs.min.js',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
