// Service Worker – ein Stand, ganz oder gar nicht.
//
// Jeder Stand hat seinen eigenen Zwischenspeicher. Er wird bei der
// Einrichtung vollständig gefüllt, und erst wenn *jede* Datei da ist, wird
// der Stand benutzt. Danach kommt alles, was zum Spiel gehört, aus genau
// diesem Speicher – nie ein Teil von hier und ein Teil aus dem Netz.
//
// Vorher: „Netz zuerst, Speicher als Rückfall", je Datei einzeln, mit einer
// Frist von drei Sekunden. Das hält das Spiel aktuell, aber es mischt:
// kommt nach einer neuen Fassung eine einzige Datei nicht rechtzeitig, läuft
// die neue main.js gegen die alte render.js. Fehlt dort ein Name, den die
// neue importiert, startet die App nicht mehr – und weil die neuen Dateien
// einzeln in den Speicher geschrieben wurden, auch ohne Netz nicht. Im
// Prüflauf nachgestellt (tools/sw-pruefen.mjs): eine hängende Anfrage
// genügte.
//
// Aktuell bleibt das Spiel trotzdem – nur auf anderem Weg. Beim Öffnen
// fragt der Browser, ob es eine neue sw.js gibt. Wenn ja, wird der neue
// Stand im Hintergrund vollständig geholt, übernimmt, und die Seite lädt
// sich neu, sofern gerade niemand spielt (js/ui/main.js). Wer online
// öffnet, hat den neuen Stand also wenige Sekunden später; wer offline
// öffnet, spielt den alten – vollständig.
//
// STAND wird nicht von Hand gepflegt:
//
//     node tools/sw-stand.mjs
//
// rechnet eine Prüfsumme über alle Dateien der Liste und erhöht die Nummer,
// wenn sie sich geändert hat. tests/sw.test.mjs prüft dasselbe in der CI.
// Ohne das wäre eine vergessene Nummer das Ende aller Aktualisierungen:
// bleibt sw.js Byte für Byte gleich, sieht der Browser nichts Neues, und
// die Geräte blieben für immer auf dem alten Stand.
const STAND = { nr: 31, inhalt: '4908e0d6ab' };
const PRAEFIX = 'carcassonne-';
const CACHE = `${PRAEFIX}v${STAND.nr}-${STAND.inhalt}`;
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

// Der Ordner, in dem das Spiel liegt – auf GitHub Pages nicht die Wurzel.
const BASIS = new URL('./', self.location.href);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Am HTTP-Zwischenspeicher des Browsers vorbei. GitHub Pages erlaubt ihm
    // zehn Minuten; ohne `no-cache` landete in einem neuen Stand, was der
    // Browser noch vom alten herumliegen hatte.
    // Scheitert eine einzige Datei, scheitert die Einrichtung, und der
    // bisherige Stand bleibt unangetastet in Betrieb.
    await cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'no-cache' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Nur die eigenen alten Stände. Unter derselben Adresse können andere
    // Spiele liegen; vorher wurde hier jeder Speicher gelöscht, der nicht
    // der eigene war – auch deren.
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((n) => n.startsWith(PRAEFIX) && n !== CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function beantworten(req, url) {
  const cache = await caches.open(CACHE);
  // Das Spiel selbst – der Ordner oder index.html, mit beliebigem Anhang.
  // Nur das. Vorher galt jede Seitennavigation im Ordner als „die Seite",
  // und wer die Galerie unter debug/ öffnete, überschrieb damit index.html:
  // ohne Netz startete danach die Galerie statt des Spiels.
  const rel = url.href.slice(BASIS.href.length).split(/[?#]/)[0];
  const istSpiel = url.href.startsWith(BASIS.href) && (rel === '' || rel === 'index.html');
  const hit = istSpiel
    ? await cache.match(new URL('./index.html', BASIS).href)
    : await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  // Gehört nicht zum Stand (Galerie, Dokumentation): aus dem Netz, und
  // nichts davon wird aufgehoben.
  try {
    return await fetch(req);
  } catch {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(beantworten(req, url));
});

// Die Seite darf fragen, von welchem Stand sie bedient wird – das steht
// dann in der Fußzeile. Am Gerät ist sonst nicht festzustellen, ob eine
// Korrektur angekommen ist.
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source?.postMessage({ version: `v${STAND.nr}`, cache: CACHE });
});
