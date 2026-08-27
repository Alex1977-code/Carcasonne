// Service Worker – Offline-Cache mit automatischen Updates.
//
// Strategie: alles zuerst aus dem Netz, mit dem Cache als Rückfall. Wer
// online ist, bekommt damit beim Öffnen den aktuellen Stand; wer offline
// ist, spielt aus dem Cache weiter.
//
// Vorher stand hier „stale-while-revalidate": erst aus dem Cache
// ausliefern, dann im Hintergrund erneuern. Das hat eine unangenehme
// Folge, die auch aufgetreten ist – nach einer Änderung zeigt das Gerät
// beim nächsten Öffnen noch die alte Fassung, und erst beim übernächsten
// die neue. Auf einem Telefon, das man einmal am Tag aufmacht, heißt das:
// die Korrektur kommt einen Tag zu spät, und man sucht den Fehler an der
// falschen Stelle.
//
// Das Spiel ist klein genug, dass sich das Netz-zuerst leisten lässt. Die
// Wartezeit ist gedeckelt: kommt binnen drei Sekunden nichts, gilt der
// Cache. Bei schlechtem Empfang startet das Spiel dadurch genauso schnell
// wie vorher.
const CACHE = 'carcassonne-v23';
const FRIST = 3000;   // so lange wird höchstens auf das Netz gewartet
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
  './js/ui/render/figures.js',
  './js/ui/render/glass.js',
  './js/ui/render/landmarks.js',
  './js/ui/render/layers.js',
  './js/ui/render/meeple-colors.js',
  './js/ui/render/paintings.js',
  './js/ui/render/palette.js',
  './js/ui/render/rng.js',
  './js/ui/render/tiles.js',
  './js/ui/spot-layout.js',
  './js/ui/qr.js',
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
  // Fotografierte Spielfiguren und Tischplatte. Fehlt eine Datei, faellt
  // das Spiel auf den gezeichneten Stein bzw. die gerechnete Holzkachel
  // zurueck – deshalb ist die Liste nicht heikel.
  './grafik/figuren/rot.webp',
  './grafik/figuren/blau.webp',
  './grafik/figuren/gelb.webp',
  './grafik/figuren/gruen.webp',
  './grafik/figuren/schwarz.webp',
  './grafik/figuren/violett.webp',
  './grafik/figuren/grau.webp',
  './grafik/tischplatte.webp',
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

/** Netz mit Frist. Läuft sie ab, wird abgebrochen und der Cache genommen. */
function ausDemNetz(req) {
  const steuer = new AbortController();
  const uhr = setTimeout(() => steuer.abort(), FRIST);
  return fetch(req, { signal: steuer.signal }).finally(() => clearTimeout(uhr));
}

async function beantworten(req, istSeite) {
  const cache = await caches.open(CACHE);
  try {
    const res = await ausDemNetz(req);
    if (res && res.ok) {
      cache.put(istSeite ? './index.html' : req, res.clone());
      return res;
    }
    // 404 und Ähnliches nicht in den Cache schreiben, aber weiterreichen,
    // wenn nichts Besseres da ist.
    const ersatz = await cache.match(req);
    return ersatz || res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (istSeite) {
      const seite = await cache.match('./index.html');
      if (seite) return seite;
    }
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const istSeite = req.mode === 'navigate' || req.url.endsWith('/index.html');
  e.respondWith(beantworten(req, istSeite));
});

// Die Seite darf fragen, welcher Stand gerade ausgeliefert wird. Ohne das
// steht in der Fußzeile eine fest verdrahtete Zahl, die sich nie ändert –
// und dann lässt sich am Gerät nicht feststellen, ob eine Korrektur
// überhaupt angekommen ist.
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source?.postMessage({ version: CACHE });
});
