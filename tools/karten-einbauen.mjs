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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const auftrag = dateien.map((d) => ({ datei: d, motiv: motivAus(d) }));
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

const ergebnis = await page.evaluate(async ({ anzahl, KANTE, GUETE, ZUGABE, nurProbe }) => {
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
    let ecke = 0;
    for (const [sx, sy] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) {
      const rx = sx ? -1 : 1, ry = sy ? -1 : 1;
      let t = 0;
      while (t < N * 0.08 && grau(at(sx + rx * t, sy + ry * t))) t++;
      if (t > ecke) ecke = t;
    }
    // Ringsum gleich viel abschneiden, sonst verrutscht die Kartenmitte
    // und mit ihr jeder Weg- und Flussaustritt.
    // Der Eckenschnitt wird gedeckelt. Die Grauprüfung greift sonst auch
    // bei dunklem Gold – auf einer Stadtkarte liegt das an der Ecke, und
    // dann würde ein Zehntel der Karte abgeschnitten. Zwei Prozent nehmen
    // Rundungen bis rund siebzig Punkte Radius weg; was darüber liegt, ist
    // keine Rundung mehr, sondern eine verzogene Karte, und die gehört neu
    // gemalt statt beschnitten.
    const eckAnteil = Math.min(ecke, N * 0.02);
    const schnitt = Math.round(Math.max(oben, unten, links, rechts, eckAnteil) + N * ZUGABE);

    const c2 = document.createElement('canvas');
    c2.width = c2.height = KANTE;
    const g2 = c2.getContext('2d');
    g2.imageSmoothingQuality = 'high';
    g2.drawImage(c, schnitt, schnitt, N - 2 * schnitt, N - 2 * schnitt, 0, 0, KANTE, KANTE);
    out.push({
      N, schnitt, roh: [oben, rechts, unten, links], ecke,
      webp: nurProbe ? null : c2.toDataURL('image/webp', GUETE),
    });
  }
  return out;
}, { anzahl: auftrag.length, KANTE, GUETE, ZUGABE, nurProbe });

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
  console.log(`${a.motiv.padEnd(20)} ${e.N}px → ${KANTE}px, ${proz} % Rand ab, ` +
    `${Math.round(buf.length / 1024)} KB`);
}
