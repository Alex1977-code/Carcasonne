/**
 * Aus einer Figurenlieferung eine Materialprobe schneiden.
 *
 *   node tools/material-probe.mjs grafik/figuren_v2.png
 *
 * Erzeugt grafik/vorlagen/material-probe.png: Ausschnitte aus Rumpf und
 * Schnittfläche, ohne dass eine ganze Figur darauf zu sehen wäre.
 *
 * Warum nicht einfach die Lieferung selbst als Referenz anhängen: genau das
 * ist schiefgegangen. Der Prompt hatte zwei Bilder – eine Vorlage für die
 * Geometrie und die vorige Lieferung „nur für das Material". Die neue
 * Lieferung übernahm die Geometrie trotzdem von der Lieferung: die
 * Schnittfläche kam mit 9,6 % der Höhe zurück statt der verlangten 25 %,
 * also noch schmaler als die 11,1 % der Vorlieferung.
 *
 * Dieselbe Lehre steckt schon in den Kartenbögen: dort ist die
 * Materialreferenz `grafik/vorlagen/referenzplatte.png` eine Platte, keine
 * fertige Karte. Ein Bild, auf dem kein vollständiges Objekt zu sehen ist,
 * kann auch keine Form vorgeben.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const quelle = resolve(process.argv[2] || join(ROOT, 'grafik/figuren.png'));
const ZIEL = join(ROOT, 'grafik/vorlagen/material-probe.png');

const server = createServer((req, res) => {
  const p = req.url === '/quelle' ? quelle : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  let inhalt;
  try { inhalt = readFileSync(p); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': { '.png': 'image/png', '.webp': 'image/webp',
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml' }[extname(p)] || 'application/octet-stream' });
  res.end(inhalt);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const chromium = await ladeChromium();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const daten = await page.evaluate(async () => {
  const img = new Image();
  img.src = '/quelle';
  await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const at = (x, y) => (y * W + x) << 2;

  // Grund aus der Bildecke; die Lieferungen stehen auf hellem Feld.
  const gr = px[at(2, 2)], gg = px[at(2, 2) + 1], gb = px[at(2, 2) + 2];
  const drin = (x, y) => {
    const i = at(x, y);
    return Math.max(Math.abs(px[i] - gr), Math.abs(px[i + 1] - gg),
      Math.abs(px[i + 2] - gb)) > 16;
  };

  const spalten = new Int32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (drin(x, y)) spalten[x]++;
  const gruppen = [];
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const voll = x < W && spalten[x] > 2;
    if (voll && start < 0) start = x;
    if (!voll && start >= 0) {
      if (x - start > W / 40) gruppen.push([start, x - 1]);
      start = -1;
    }
  }

  // Rot, Gelb und Grau: eine satte, eine helle und die farblose Figur –
  // zusammen zeigen sie, was das Material mit Licht macht.
  const AUSWAHL = [0, 2, 6];
  const teile = [];
  for (const gi of AUSWAHL) {
    if (!gruppen[gi]) continue;
    const [x0, x1] = gruppen[gi];
    let y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!drin(x, y)) continue;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // Rumpf samt Schnittfläche, ohne Kopf, Arme und Beine – so bleibt vom
    // Umriss nichts übrig, was als Form dienen könnte.
    teile.push({
      sx: Math.round(x0 + bw * 0.40), sy: Math.round(y0 + bh * 0.36),
      sw: Math.round(bw * 0.58), sh: Math.round(bh * 0.20),
    });
  }

  const M = 3;                        // Vergrößerung
  const LUFT = 18;
  const bh = Math.max(...teile.map((t) => t.sh)) * M;
  const breite = teile.reduce((a, t) => a + t.sw * M + LUFT, LUFT);
  const kc = document.createElement('canvas');
  kc.width = breite; kc.height = bh + LUFT * 2;
  const kg = kc.getContext('2d');
  kg.fillStyle = '#ffffff';
  kg.fillRect(0, 0, kc.width, kc.height);
  kg.imageSmoothingQuality = 'high';
  let x = LUFT;
  for (const t of teile) {
    kg.drawImage(c, t.sx, t.sy, t.sw, t.sh, x, LUFT, t.sw * M, t.sh * M);
    x += t.sw * M + LUFT;
  }
  return kc.toDataURL('image/png');
});

await browser.close();
server.close();

mkdirSync(join(ROOT, 'grafik/vorlagen'), { recursive: true });
writeFileSync(ZIEL, Buffer.from(daten.split(',')[1], 'base64'));
console.log(`${ZIEL.replace(ROOT + '/', '')} aus ${basename(quelle)} geschrieben`);
