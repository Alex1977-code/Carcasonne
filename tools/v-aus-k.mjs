/**
 * Motiv V aus Motiv K bauen.
 *
 *   node tools/v-aus-k.mjs [-o grafik/karten/V.webp]
 *
 * K ist CFRR – Stadt im Norden, Wiese im Osten, Weg im Sueden und Westen.
 * V ist FFRR – dieselbe Wegkurve, nur ohne die Stadt.
 *
 * Warum nicht malen lassen: die Kurve auf K haelt den Randvertrag exakt
 * ein (gemessen: Sued 50,0 %, West 51,0 % bei 10,3–11 % Breite). Der
 * Bildgenerator dagegen legt aus einer Textbeschreibung heraus jedes Mal
 * einen eigenen Radius an; von den 40 Kantenuebergaengen der ersten
 * Lieferung lagen 24 daneben. Statt es noch einmal zu versuchen wird hier
 * die bereits richtige Kurve weiterverwendet und nur die Stadt durch
 * Wiese ersetzt. Damit stimmt die Geometrie von V per Konstruktion.
 *
 * Verfahren: die Stadtflaeche wird mit Texturkachelung gefuellt
 * („image quilting"). Saubere Wiesenflicken aus derselben Karte werden
 * ueberlappend gesetzt; fuer jede Position gewinnt der Flicken, der in
 * der Ueberlappung am besten zum schon Gesetzten passt. Die Auswahl unter
 * den besten laeuft ueber einen festen Zufallskeim, das Ergebnis ist also
 * bei jedem Lauf gleich.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';

/**
 * Von Hand ausgesuchte Wiesenflicken (linke obere Ecke, 88×88).
 *
 * Von Hand, weil es automatisch nicht verlaesslich ging: die Baumkronen
 * sind duenne Goldboegen und haben kaum mehr Gold als das Rankenwerk
 * ringsum, ihre Staemme sind so gross wie eine Bluete, und als Kreis
 * gesucht fallen sie durch, weil die Krone unten gerade abschliesst.
 * Drei Anlaeufe (Golddichte, Stammfarbe, Ringsuche) haben jedes Mal
 * halbe Baumkronen im gefuellten Streifen stehen lassen. Ausgesucht
 * wurden diese sechs auf einem Kontaktbogen aller Kandidaten – frei von
 * Weg, Stadtmauer, Acker und Baum.
 */
const FLICKEN = [
  [0, 304], [0, 344],                    // linker Rand, unter der Stadt
  [272, 400], [288, 408], [296, 424], [304, 440],   // rechts neben dem Weg
];
const P = 88;         // Flickengroesse
const UEB = 24;       // Ueberlappung

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

const argv = process.argv.slice(2);
const oi = argv.indexOf('-o');
const ziel = oi >= 0 ? argv[oi + 1] : 'grafik/karten/V.webp';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const TYPEN = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
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

const out = await page.evaluate(async ({ FLICKEN, P, UEB }) => {
  const img = new Image();
  img.src = '/grafik/karten/K.webp';
  await img.decode();
  const N = img.width;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, N, N).data;
  const at = (x, y) => ((y * N + x) << 2);

  const gruen = (i) => {
    const r = src[i], gg = src[i + 1], bb = src[i + 2];
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
    return gg >= r && gg > bb && mx && (mx - mn) / mx > 0.25;
  };

  // Stadtgrenze je Spalte: der oberste gruene Lauf von mindestens acht
  // Punkten. Einzelne gruene Punkte gibt es auch in der Stadt (die
  // Fensterlaibungen), deshalb der Lauf.
  const grenze = new Int32Array(N);
  for (let x = 0; x < N; x++) {
    let y = 0, lauf = 0;
    for (; y < N; y++) { if (gruen(at(x, y))) { if (++lauf >= 8) break; } else lauf = 0; }
    grenze[x] = Math.min(N - 1, Math.max(0, y - lauf + 1));
  }
  const maxG = Math.max(...grenze);

  // Aus jedem Flicken acht Varianten: vier Drehungen mal gespiegelt.
  // Das Rankenwerk hat keine Vorzugsrichtung, die Drehungen fallen also
  // nicht auf – sie verhindern aber, dass sich derselbe Bluetenbusch im
  // Raster wiederholt.
  const pool = [];
  for (const [sx, sy] of FLICKEN) {
    for (let v = 0; v < 8; v++) {
      const buf = new Uint8ClampedArray(P * P * 4);
      for (let y = 0; y < P; y++) {
        for (let x = 0; x < P; x++) {
          let u = x, w = y;
          if (v & 4) { const t = u; u = w; w = t; }   // an der Diagonale
          if (v & 1) u = P - 1 - u;
          if (v & 2) w = P - 1 - w;
          const si = at(sx + u, sy + w), di = (y * P + x) << 2;
          buf[di] = src[si]; buf[di + 1] = src[si + 1];
          buf[di + 2] = src[si + 2]; buf[di + 3] = 255;
        }
      }
      pool.push(buf);
    }
  }

  const ziel = g.getImageData(0, 0, N, N), z = ziel.data;
  const gesetzt = new Uint8Array(N * N);

  // Fester Keim – kein Math.random, damit zwei Laeufe dasselbe Bild geben.
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const STEP = P - UEB;
  for (let dy = -UEB; dy < maxG + UEB; dy += STEP) {
    for (let dx = -UEB; dx < N; dx += STEP) {
      const bewertet = pool.map((buf) => {
        let fehler = 0, n = 0;
        for (let y = 0; y < P; y += 2) {
          const ty = dy + y; if (ty < 0 || ty >= N) continue;
          for (let x = 0; x < P; x += 2) {
            const tx = dx + x; if (tx < 0 || tx >= N) continue;
            if (!gesetzt[ty * N + tx]) continue;
            const si = (y * P + x) << 2, di = at(tx, ty);
            const d0 = z[di] - buf[si], d1 = z[di + 1] - buf[si + 1],
                  d2 = z[di + 2] - buf[si + 2];
            fehler += d0 * d0 + d1 * d1 + d2 * d2; n++;
          }
        }
        return { buf, f: n ? fehler / n : 0 };
      });
      bewertet.sort((a, b) => a.f - b.f);
      const eng = bewertet.slice(0, 5);
      const wahl = eng[Math.floor(rnd() * eng.length)].buf;

      for (let y = 0; y < P; y++) {
        const ty = dy + y; if (ty < 0 || ty >= N) continue;
        for (let x = 0; x < P; x++) {
          const tx = dx + x; if (tx < 0 || tx >= N) continue;
          if (ty >= grenze[tx] + 3) continue;    // die Wiese darunter bleibt
          const si = (y * P + x) << 2, di = at(tx, ty);
          let a = 1;
          if (gesetzt[ty * N + tx]) {
            a = Math.min(x < UEB ? x / UEB : 1, y < UEB ? y / UEB : 1);
          }
          z[di] = z[di] * (1 - a) + wahl[si] * a;
          z[di + 1] = z[di + 1] * (1 - a) + wahl[si + 1] * a;
          z[di + 2] = z[di + 2] * (1 - a) + wahl[si + 2] * a;
          z[di + 3] = 255;
          gesetzt[ty * N + tx] = 1;
        }
      }
    }
  }

  const c2 = document.createElement('canvas');
  c2.width = c2.height = N;
  const g2 = c2.getContext('2d');
  g2.putImageData(ziel, 0, 0);

  // Naht an der ehemaligen Stadtgrenze ueber sechs Punkte weich machen.
  const c3 = document.createElement('canvas');
  c3.width = c3.height = N;
  const g3 = c3.getContext('2d');
  g3.filter = 'blur(2.5px)';
  g3.drawImage(c2, 0, 0);
  const weich = g3.getImageData(0, 0, N, N).data;
  const fertig = g2.getImageData(0, 0, N, N), f = fertig.data;
  for (let x = 0; x < N; x++) {
    const gy = grenze[x];
    for (let y = Math.max(0, gy - 6); y < Math.min(N, gy + 6); y++) {
      const t = 1 - Math.abs(y - gy) / 6, di = at(x, y);
      for (let k = 0; k < 3; k++) f[di + k] = f[di + k] * (1 - t) + weich[di + k] * t;
    }
  }
  g2.putImageData(fertig, 0, 0);

  return { webp: c2.toDataURL('image/webp', 0.85), N, maxG, pool: pool.length };
}, { FLICKEN, P, UEB });

await browser.close();
server.close();

mkdirSync(dirname(ziel) || '.', { recursive: true });
const buf = Buffer.from(out.webp.split(',')[1], 'base64');
writeFileSync(ziel, buf);
console.log(`${ziel}  ${out.N}×${out.N}, ${Math.round(buf.length / 1024)} KB`);
console.log(`Stadt bis y=${out.maxG} ersetzt, ${out.pool} Quellvarianten aus ${FLICKEN.length} Flicken`);
