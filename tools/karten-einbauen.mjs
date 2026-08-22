/**
 * Gelieferte Einzelkarten ins Spiel übernehmen.
 *
 *   node tools/karten-einbauen.mjs grafik/U_strasse-gerade.png
 *   node tools/karten-einbauen.mjs grafik/*.png
 *   node tools/karten-einbauen.mjs --probe grafik/*.png     (nur messen)
 *
 * Das Gegenstück zu tools/kacheln-schneiden.mjs: dort werden vier Karten
 * aus einem Bogen geschnitten, hier liegt je Karte eine Datei vor. Das
 * Motiv kommt aus dem Dateinamen, wie in tools/karten-pruefen.mjs.
 *
 * Zwei Dinge passieren dabei:
 *
 * 1. Der Rand wird abgeschnitten. Die gelieferten Bilder haben einen
 *    schmalen neutralgrauen Saum und teils abgerundete Ecken – Reste des
 *    Bogenstegs. Bliebe der stehen, säße auf dem Brett um jede Karte ein
 *    graues Kästchen. Gesucht wird von jeder Kante her die erste Zeile,
 *    die überwiegend bemalt ist; danach wird noch ein halbes Prozent
 *    zugegeben, damit auch weiche Übergänge weg sind.
 *
 * 2. Verkleinern auf 512 Punkte und als WebP mit Güte 0,85 ablegen –
 *    dieselben Werte wie beim Schneiden der Bögen, damit alle Karten im
 *    Spiel gleich scharf sind.
 *
 * Vorher messen: tools/karten-pruefen.mjs. Danach noch einmal messen, denn
 * das Abschneiden verschiebt die Maße geringfügig.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, resolve, basename, dirname } from 'node:path';

const KANTE = 512;
const GUETE = 0.85;
const ZUGABE = 0.005;   // zusätzlich abschneiden, gegen weiche Übergänge

async function ladeChromium() {
  for (const pfad of ['playwright-core', 'playwright']) {
    try { return (await import(pfad)).chromium; } catch { /* weiter */ }
  }
  const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
  for (const p of [`${g}/playwright-core/index.js`, `${g}/playwright/index.js`,
                   `${g}/playwright/node_modules/playwright-core/index.js`]) {
    try {
      const m = await import(pathToFileURL(p).href);
      if (m.chromium) return m.chromium;
      if (m.default?.chromium) return m.default.chromium;
    } catch { /* weiter */ }
  }
  throw new Error('playwright nicht gefunden – npm i -g playwright');
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const quelle = readFileSync(join(ROOT, 'js/engine/tiles.js'), 'utf8');
const DEFS = {};
for (const m of quelle.matchAll(/def\('([A-Z_0-9]+)', (\d+), '(\w+)', '(\w{4})'/g)) {
  DEFS[m[1]] = m[4];
}

function motivAus(datei) {
  const teile = basename(datei).replace(/\.[^.]+$/, '').split('_');
  for (let n = teile.length; n >= 1; n--) {
    const k = teile.slice(0, n).join('_').toUpperCase();
    if (DEFS[k]) return k;
  }
  return null;
}

const argv = process.argv.slice(2);
const nurProbe = argv.includes('--probe');
const dateien = argv.filter((a) => !a.startsWith('--')).map((a) => resolve(a));
if (!dateien.length) {
  console.error('Aufruf: node tools/karten-einbauen.mjs [--probe] <bild.png> ...');
  process.exit(1);
}
// Versatz aus tools/karten-fluchten.mjs, falls gerechnet. Damit wird der
// Ausschnitt gleich an der richtigen Stelle genommen, statt die fertige
// Karte hinterher zu verschieben – hinterher bliebe am Rand ein Streifen
// frei, der mit der Randzeile gefüllt werden müsste und als Schliere zu
// sehen wäre.
let VERSATZ = {};
const versatzDatei = join(ROOT, 'grafik/versatz.json');
if (existsSync(versatzDatei)) {
  try { VERSATZ = JSON.parse(readFileSync(versatzDatei, 'utf8')); }
  catch { console.error('grafik/versatz.json ist unlesbar – wird übergangen'); }
}

const auftrag = dateien.map((d) => ({ datei: d, motiv: motivAus(d),
  versatz: VERSATZ[motivAus(d)] || null }));
const ohne = auftrag.filter((a) => !a.motiv);
if (ohne.length) {
  console.error('kein Motiv im Dateinamen:', ohne.map((a) => basename(a.datei)).join(' '));
  process.exit(1);
}

const TYPEN = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
                '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const nr = req.url.match(/^\/karte\/(\d+)$/);
  const p = nr ? auftrag[+nr[1]].datei : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  let inhalt;
  try { inhalt = readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPEN[extname(p)] || 'application/octet-stream' });
  res.end(inhalt);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const chromium = await ladeChromium();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const ergebnis = await page.evaluate(async ({ anzahl, KANTE, GUETE, ZUGABE, nurProbe, versaetze }) => {
  const out = [];
  for (let nr = 0; nr < anzahl; nr++) {
    const img = new Image();
    img.src = `/karte/${nr}`;
    await img.decode();
    const N = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, N, N);
    const px = g.getImageData(0, 0, N, N).data;
    const at = (x, y) => ((y * N + x) << 2);

    // Neutral heißt: kaum Farbe. Der Steg der Bögen ist ein mittleres Grau,
    // die abgerundeten Ecken zeigen dasselbe. Bemalt ist alles mit Farbe –
    // Grün, Gold, Blau, Elfenbein.
    const neutral = (i) => {
      const r = px[i], gg = px[i + 1], bb = px[i + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      return mx && (mx - mn) / mx < 0.18;
    };
    const anteilNeutral = (feste, achse) => {
      let n = 0, k = 0;
      for (let u = Math.floor(N * 0.1); u < N * 0.9; u += 3) {
        n++;
        if (neutral(achse === 'y' ? at(u, feste) : at(feste, u))) k++;
      }
      return k / n;
    };
    const suche = (von, richtung, achse) => {
      let t = von;
      for (let s = 0; s < N * 0.08; s++) {
        if (anteilNeutral(t, achse) < 0.5) break;
        t += richtung;
      }
      return Math.abs(t - von);
    };
    const oben = suche(0, 1, 'y');
    const unten = suche(N - 1, -1, 'y');
    const links = suche(0, 1, 'x');
    const rechts = suche(N - 1, -1, 'x');

    // Abgerundete Ecken erwischt die zeilenweise Suche nicht: sie tastet
    // nur die mittleren achtzig Prozent jeder Kante ab, und dort ist alles
    // bemalt. Übrig bleibt dann ein graues Dreieck in jeder Kartenecke,
    // auf dem Brett gut sichtbar. Deshalb zusätzlich diagonal von jeder
    // Ecke nach innen tasten. Bei einer Rundung mit Radius r reicht die
    // graue Fläche auf der Diagonalen bis etwa 0,29·r – so weit muss auch
    // abgeschnitten werden.
    // Der Steg ist ein mittleres Grau. Die Schwelle für „farblos" von 0,18
    // reicht dafür nicht – gemessen liegt er bei 0,19. Also eigens auf Grau
    // prüfen: wenig Farbe UND mittlere Helligkeit. Elfenbein ist zu hell,
    // Wiesengrün zu bunt, beide fallen damit heraus.
    const grau = (i) => {
      const r = px[i], gg = px[i + 1], bb = px[i + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      return mx && (mx - mn) / mx < 0.28 && mx / 255 > 0.30 && mx / 255 < 0.78;
    };
    // Je Ecke einzeln messen. Vorher galt der größte Wert für alle vier
    // Seiten – bei einer Karte mit einer einzigen grauen Ecke wurde dadurch
    // ringsum abgeschnitten, und bei EC_CROSS_CITY fraß das die Stadt am
    // Nordrand weg.
    const eck = [];
    for (const [sx, sy] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) {
      const rx = sx ? -1 : 1, ry = sy ? -1 : 1;
      let t = 0;
      while (t < N * 0.08 && grau(at(sx + rx * t, sy + ry * t))) t++;
      eck.push(Math.min(t, N * 0.04));
    }
    const [eTL, eTR, eBL, eBR] = eck;
    const ecke = Math.max(...eck);
    // Ringsum gleich viel abschneiden, sonst verrutscht die Kartenmitte
    // und mit ihr jeder Weg- und Flussaustritt.
    // Der Eckenschnitt wird gedeckelt. Die Grauprüfung greift sonst auch
    // bei dunklem Gold – auf einer Stadtkarte liegt das an der Ecke, und
    // dann würde ein Zehntel der Karte abgeschnitten. Vier Prozent nehmen
    // Rundungen bis rund hundertvierzig Punkte Radius weg; was darüber
    // liegt, ist keine Rundung mehr, sondern eine verzogene Karte, und die
    // gehört neu gemalt statt beschnitten. Zwei Prozent waren zu knapp: bei
    // EC_CROSS_CITY blieb das ganze Eckquadrat grau.
    const eckAnteil = Math.min(ecke, N * 0.04);
    const schnitt = Math.round(Math.max(oben, unten, links, rechts, eckAnteil) + N * ZUGABE);

    // Der Versatz zählt in Prozent der fertigen Kante. Das Fenster wandert
    // gegenläufig: soll der Inhalt nach rechts, muss weiter links geschnitten
    // werden.
    //
    // Damit es wandern kann, braucht es Spiel. Der abgeschnittene Rand ist oft
    // nur fünf Punkte breit, ein Versatz von sieben passt da nicht hinein –
    // dann bliebe die Karte halb gerichtet stehen. Also wird bei Bedarf so
    // viel tiefer geschnitten, wie der Versatz verlangt. Das kostet ein
    // Prozent Bildfläche und ist einer schief sitzenden Straße allemal
    // vorzuziehen.
    // Der erlaubte Kasten: je Seite so viel abziehen, wie die Randzeilen und
    // die beiden angrenzenden Ecken verlangen, plus die Zugabe.
    const zug = N * ZUGABE;
    const li = Math.round(Math.max(links, eTL, eBL) + zug);
    const re = Math.round(Math.max(rechts, eTR, eBR) + zug);
    const ob = Math.round(Math.max(oben, eTL, eTR) + zug);
    const un = Math.round(Math.max(unten, eBL, eBR) + zug);
    // Erst den Mittelpunkt festlegen, dann die Größe. Andersherum – erst das
    // größte Quadrat, dann verschieben – liegt das Fenster schon am Rand des
    // Kastens an und kann sich nicht mehr bewegen; der Versatz wäre dahin.
    // Der Mittelpunkt wandert gegenläufig zum Inhalt: soll der Weg nach oben,
    // muss weiter unten geschnitten werden.
    const v = versaetze[nr] || { dx: 0, dy: 0 };
    const mx2 = N / 2 - (v.dx || 0) / 100 * N;
    const my2 = N / 2 - (v.dy || 0) / 100 * N;
    const halb = Math.floor(Math.min(mx2 - li, N - re - mx2, my2 - ob, N - un - my2));
    const feld = 2 * halb;
    const x0 = Math.round(mx2 - halb);
    const y0 = Math.round(my2 - halb);
    const vx = Math.round(mx2 - N / 2);
    const vy = Math.round(my2 - N / 2);
    const spiel = Math.round((N - feld) / 2);

    const c2 = document.createElement('canvas');
    c2.width = c2.height = KANTE;
    const g2 = c2.getContext('2d');
    g2.imageSmoothingQuality = 'high';
    g2.drawImage(c, x0, y0, feld, feld, 0, 0, KANTE, KANTE);
    out.push({
      N, schnitt: spiel, roh: [oben, rechts, unten, links], ecke, vx, vy,
      knapp: feld < N * 0.80,
      webp: nurProbe ? null : c2.toDataURL('image/webp', GUETE),
    });
  }
  return out;
}, { anzahl: auftrag.length, KANTE, GUETE, ZUGABE, nurProbe,
     versaetze: auftrag.map((a) => a.versatz) });

await browser.close();
server.close();

for (let i = 0; i < auftrag.length; i++) {
  const a = auftrag[i], e = ergebnis[i];
  const proz = (e.schnitt / e.N * 100).toFixed(1);
  if (nurProbe) {
    console.log(`${a.motiv.padEnd(20)} ${e.N}px  Rand N/O/S/W ${e.roh.join('/')}  Ecke ${e.ecke}` +
      `  →  ${e.schnitt} px abschneiden (${proz} %)`);
    continue;
  }
  const pfad = join(ROOT, `grafik/karten/${a.motiv}.webp`);
  mkdirSync(dirname(pfad), { recursive: true });
  const buf = Buffer.from(e.webp.split(',')[1], 'base64');
  writeFileSync(pfad, buf);
  const vt = (e.vx || e.vy) ? `, Versatz ${e.vx}/${e.vy} px` : '';
  console.log(`${a.motiv.padEnd(20)} ${e.N}px → ${KANTE}px, ${proz} % Rand ab${vt}, ` +
    `${Math.round(buf.length / 1024)} KB` + (e.knapp ? '   ⚠ Rand reicht nicht ganz' : ''));
}
