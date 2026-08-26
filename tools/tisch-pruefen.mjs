/**
 * Eine Tischplatten-Textur messen, bevor sie übernommen wird.
 *
 *   node tools/tisch-pruefen.mjs grafik/tischplatte.png
 *
 * Zwei Bedingungen, und beide sind hart:
 *
 *   Nahtlos. Das Spiel kachelt die Textur. Jede Naht wiederholt sich über
 *   den ganzen Bildschirm, und ein Raster aus Nähten sieht man sofort –
 *   auch dann, wenn das einzelne Bild tadellos aussieht.
 *
 *   Ohne eingebackenes Licht. Kerzenschein und Wachsglanz legt das Spiel
 *   selbst darüber, und die bleiben bildschirmfest, während die Maserung
 *   mitwandert. Ein Glanzlicht im Bild würde beim Schieben über den Tisch
 *   rutschen – und es wiederholt sich mit jeder Kachel.
 *
 * Gemessen wird die Naht nicht absolut, sondern **gegen die Textur selbst**:
 * benachbarte Spalten eines Holzbildes unterscheiden sich immer ein wenig.
 * Verglichen wird deshalb der Sprung an der Naht mit dem mittleren Sprung
 * zwischen zwei benachbarten Spalten im Bildinneren. Verhältnis 1 heißt: die
 * Naht ist nicht von einer beliebigen anderen Stelle zu unterscheiden.
 *
 * Beanstandungen gehen mit Rückgabewert 1 raus.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, resolve, basename } from 'node:path';

async function ladeChromium() {
  for (const p of ['playwright-core', 'playwright']) {
    try { return (await import(p)).chromium; } catch { /* weiter */ }
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
const dateien = process.argv.slice(2).filter((a) => !a.startsWith('-')).map((a) => resolve(a));
if (!dateien.length) {
  console.error('Aufruf: node tools/tisch-pruefen.mjs <bild.png> …');
  process.exit(1);
}

const server = createServer((req, res) => {
  const nr = req.url.match(/^\/bild\/(\d+)$/);
  const p = nr ? dateien[+nr[1]] : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  let inhalt;
  try { inhalt = readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': { '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript',
    '.css': 'text/css' }[extname(p)] || 'application/octet-stream' });
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

const messung = await page.evaluate(async (anzahl) => {
  const out = [];
  for (let nr = 0; nr < anzahl; nr++) {
    const img = new Image();
    img.src = `/bild/${nr}`;
    await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const lum = (x, y) => {
      const i = ((y * W + x) << 2);
      return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
    };

    // Sprung zwischen zwei Spalten, gemittelt über die Höhe.
    const spalten = (a, b) => {
      let s = 0;
      for (let y = 0; y < H; y++) s += Math.abs(lum(a, y) - lum(b, y));
      return s / H;
    };
    const zeilen = (a, b) => {
      let s = 0;
      for (let x = 0; x < W; x++) s += Math.abs(lum(x, a) - lum(x, b));
      return s / W;
    };

    // Grundrauschen: der mittlere Sprung zwischen Nachbarspalten im Inneren.
    let grundS = 0, nS = 0;
    for (let x = 4; x < W - 5; x += 7) { grundS += spalten(x, x + 1); nS++; }
    let grundZ = 0, nZ = 0;
    for (let y = 4; y < H - 5; y += 7) { grundZ += zeilen(y, y + 1); nZ++; }
    grundS /= nS; grundZ /= nZ;

    const nahtS = spalten(W - 1, 0);      // rechte Kante trifft linke
    const nahtZ = zeilen(H - 1, 0);       // untere Kante trifft obere

    // Eingebackenes Licht: Helligkeit über ein grobes Raster.
    const N = 6;
    const felder = [];
    for (let fy = 0; fy < N; fy++) {
      for (let fx = 0; fx < N; fx++) {
        let s = 0, n = 0;
        for (let y = Math.floor(fy * H / N); y < (fy + 1) * H / N; y += 3) {
          for (let x = Math.floor(fx * W / N); x < (fx + 1) * W / N; x += 3) { s += lum(x, y); n++; }
        }
        felder.push(s / n);
      }
    }
    const hellMin = Math.min(...felder), hellMax = Math.max(...felder);
    const hellMittel = felder.reduce((a, b) => a + b, 0) / felder.length;

    // Farbe der Fläche
    let sr = 0, sg = 0, sb = 0, n2 = 0;
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const i = ((y * W + x) << 2);
        sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n2++;
      }
    }
    out.push({ W, H, grundS, grundZ, nahtS, nahtZ,
      hellMin, hellMax, hellMittel,
      rgb: [sr / n2, sg / n2, sb / n2].map(Math.round) });
  }
  return out;
}, dateien.length);

await browser.close();
server.close();

let fehler = 0;
for (let i = 0; i < dateien.length; i++) {
  const m = messung[i];
  const vS = m.nahtS / m.grundS, vZ = m.nahtZ / m.grundZ;
  const gefaelle = (m.hellMax - m.hellMin) / m.hellMittel;
  console.log(`${basename(dateien[i])}   ${m.W}×${m.H}   Farbe ${m.rgb}`);
  const zeile = (name, naht, grund, v) => {
    // Bis zum Doppelten des Grundrauschens ist die Naht nicht zu finden.
    const ok = v <= 2.0;
    if (!ok) fehler++;
    console.log(`   Naht ${name.padEnd(10)} Sprung ${naht.toFixed(2).padStart(6)}`
      + `  gegen ${grund.toFixed(2).padStart(6)} im Inneren`
      + `  = ${v.toFixed(1)}-fach   ${ok ? '✓' : '✗ sichtbare Naht'}`);
  };
  zeile('links/rechts', m.nahtS, m.grundS, vS);
  zeile('oben/unten', m.nahtZ, m.grundZ, vZ);
  // Über 12 % Gefälle sieht man das Licht im Bild wandern, sobald gekachelt
  // wird – dann steht in jeder Kachel dieselbe helle Ecke.
  const ok = gefaelle <= 0.12;
  if (!ok) fehler++;
  console.log(`   Helligkeit  ${m.hellMin.toFixed(0)} bis ${m.hellMax.toFixed(0)}`
    + `  = ${(gefaelle * 100).toFixed(0)} % Gefälle   `
    + (ok ? '✓' : '✗ Licht steckt im Bild'));
}

console.log(fehler
  ? `\n${fehler} Beanstandung${fehler === 1 ? '' : 'en'} – vor dem Übernehmen klären.`
  : '\nNahtlos und ohne eingebackenes Licht.');
process.exit(fehler ? 1 : 0);
