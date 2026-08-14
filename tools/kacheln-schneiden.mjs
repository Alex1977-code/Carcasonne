/**
 * Bögen in einzelne Kartenbilder zerlegen.
 *
 *   node tools/kacheln-schneiden.mjs
 *
 * Liest grafik/bogen-belegung.json, schneidet jeden Bogen in seine vier
 * Karten und legt sie als grafik/karten/<Motiv>.webp ab. Das Spiel lädt
 * nur diese Einzelbilder; die Bögen selbst werden nie ausgeliefert.
 *
 * Warum ein Browser und keine Bildbibliothek: Zuschnitt, Drehung, saubere
 * Skalierung und WebP-Kodierung kann Canvas von Haus aus, und Chromium
 * liegt für die Tests ohnehin bereit. Damit braucht das Projekt keine
 * einzige Laufzeit-Abhängigkeit.
 *
 * Die Kanten sind der heikle Teil: die Bögen liegen auf grauem Grund und
 * die Karten haben abgerundete Ecken. Deshalb wird pro Quadrant erst die
 * wirklich bemalte Fläche gesucht und dann ein Stück innerhalb davon
 * geschnitten – sonst stehen graue Zwickel in den Ecken.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// playwright muss nicht im Projekt liegen; eine globale Installation tut
// es auch. Damit braucht das Repo weiterhin keine node_modules.
async function ladeChromium() {
  for (const pfad of ['playwright-core', 'playwright']) {
    try { return (await import(pfad)).chromium; } catch { /* weiter */ }
  }
  const global_ = execSync('npm root -g', { encoding: 'utf8' }).trim();
  for (const p of [`${global_}/playwright-core/index.js`, `${global_}/playwright/index.js`,
                   `${global_}/playwright/node_modules/playwright-core/index.js`]) {
    try {
      const m = await import(pathToFileURL(p).href);
      if (m.chromium) return m.chromium;
      if (m.default?.chromium) return m.default.chromium;
    } catch { /* weiter */ }
  }
  throw new Error('playwright nicht gefunden – npm i -g playwright');
}
const chromium = await ladeChromium();
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'grafik', 'karten');
const KANTE = 512;          // Zielgröße; mehr braucht selbst die große Stufe nicht
const QUALITAET = 0.85;
const ECKEN_ABZUG = 0.018;  // Anteil, der ringsum wegfällt (Rundungen)

const belegung = JSON.parse(readFileSync(join(ROOT, 'grafik', 'bogen-belegung.json'), 'utf8'));

// Winziger Dateiserver – Chromium darf keine file:// Bilder in ein Canvas
// zeichnen, ohne es zu vergiften.
const TYPEN = { '.png': 'image/png', '.html': 'text/html', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  try {
    res.writeHead(200, { 'Content-Type': TYPEN[extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

mkdirSync(OUT, { recursive: true });
let gesamt = 0;
const geschrieben = [];

for (const [datei, karten] of Object.entries(belegung)) {
  if (datei.startsWith('_')) continue;
  const bilder = await page.evaluate(async ({ datei, karten, KANTE, QUALITAET, ECKEN_ABZUG }) => {
    const img = new Image();
    img.src = '/grafik/' + datei;
    await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    // Der Bogengrund ist ein neutrales Grau; alles andere ist Malerei.
    const grau = (x, y) => {
      const i = (y * W + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2];
      return Math.abs(r - gg) < 14 && Math.abs(gg - bb) < 14 && r > 115 && r < 195;
    };
    const halb = Math.round(W / 2);
    const out = [];
    for (let q = 0; q < 4; q++) {
      const eintrag = karten[q];
      if (!eintrag) continue;
      const qx = q % 2, qy = Math.floor(q / 2);
      const x0 = qx * halb, y0 = qy * halb;
      let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
      for (let y = y0; y < y0 + halb; y += 2) {
        for (let x = x0; x < x0 + halb; x += 2) {
          if (!grau(x, y)) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      const abzug = Math.round((maxX - minX) * ECKEN_ABZUG);
      const sx = minX + abzug, sy = minY + abzug;
      const sw = (maxX - minX) - 2 * abzug, sh = (maxY - minY) - 2 * abzug;

      const t = document.createElement('canvas');
      t.width = t.height = KANTE;
      const tg = t.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      // Die Grunddrehung wandert ins Bild, damit im Spiel keine
      // Sonderbehandlung je Motiv nötig ist.
      tg.translate(KANTE / 2, KANTE / 2);
      tg.rotate((eintrag.dreh || 0) * Math.PI / 2);
      tg.translate(-KANTE / 2, -KANTE / 2);
      tg.drawImage(img, sx, sy, sw, sh, 0, 0, KANTE, KANTE);

      out.push({ id: eintrag.id, box: [sx, sy, sw, sh], dreh: eintrag.dreh || 0,
        data: t.toDataURL('image/webp', QUALITAET) });
    }
    return out;
  }, { datei, karten, KANTE, QUALITAET, ECKEN_ABZUG });

  for (const b of bilder) {
    const buf = Buffer.from(b.data.split(',')[1], 'base64');
    writeFileSync(join(OUT, `${b.id}.webp`), buf);
    gesamt += buf.length;
    geschrieben.push(b.id);
    console.log(`${b.id.padEnd(3)} aus ${datei}  Ausschnitt ${b.box.join(',')}  Drehung ${b.dreh}  ${Math.round(buf.length / 1024)} KB`);
  }
}

await browser.close();
server.close();

// Aufräumen: Bilder zu Motiven, die es nicht mehr gibt, verwirren nur.
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.webp') && !geschrieben.includes(f.replace('.webp', ''))) {
    console.log(`übrig geblieben (nicht in der Belegung): ${f}`);
  }
}
console.log(`\n${geschrieben.length} Karten, zusammen ${(gesamt / 1024 / 1024).toFixed(2)} MB`);
console.log(`Motive: ${geschrieben.sort().join(' ')}`);
