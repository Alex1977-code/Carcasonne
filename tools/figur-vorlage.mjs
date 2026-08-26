/**
 * Die Vorlage für den Figuren-Prompt zeichnen.
 *
 *   node tools/figur-vorlage.mjs
 *
 * Erzeugt grafik/vorlagen/figur-umriss.png: die Silhouette der Spielfigur,
 * daneben ein Balken, der die Dicke der Scheibe zeigt.
 *
 * Warum ein Bild und nicht nur Worte: aus „halb so dick wie hoch" macht ein
 * Bildmodell 30 % oder 70 %, und aus einer beschriebenen Silhouette macht es
 * irgendeinen Männchenumriss. Dieselbe Lehre wie bei den Kartenbögen – die
 * Bögen 07–14 waren allein aus Text erzeugt und lagen bei 24 von 40
 * Übergängen daneben. Der Umriss hier ist derselbe Pfad wie im Spiel
 * (MEEPLE_PATH in js/ui/render.js), damit die gelieferte Figur an dieselbe
 * Stelle passt wie die gezeichnete.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

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
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
                '.webmanifest': 'application/manifest+json' };
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
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForTimeout(400);

const daten = await page.evaluate(async () => {
  const { MEEPLE_PATH } = await import('/js/ui/render.js');
  const W = 1200, H = 760, FIG = 560;          // Figurenhöhe in Pixeln
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);

  // Die Silhouette, schwarz und randscharf
  g.save();
  g.translate(150, 100);
  g.scale(FIG / 100, FIG / 100);
  g.fillStyle = '#000000';
  g.fill(MEEPLE_PATH);
  g.restore();

  // Maßangaben
  g.strokeStyle = '#000000';
  g.fillStyle = '#000000';
  g.lineWidth = 3;
  g.font = '600 26px system-ui, sans-serif';
  const pfeil = (x1, y1, x2, y2) => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (const s of [1, -1]) {
      g.beginPath(); g.moveTo(x2, y2);
      g.lineTo(x2 - Math.cos(a - s * 0.4) * 18, y2 - Math.sin(a - s * 0.4) * 18);
      g.stroke();
      g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 + Math.cos(a - s * 0.4) * 18, y1 + Math.sin(a - s * 0.4) * 18);
      g.stroke();
    }
  };
  // Höhe der Figur
  pfeil(110, 100, 110, 100 + FIG);
  g.save(); g.translate(86, 100 + FIG / 2); g.rotate(-Math.PI / 2);
  g.textAlign = 'center'; g.fillText('Höhe H', 0, 0); g.restore();

  // Die Scheibe daneben, hochkant, halb so dick wie die Figur hoch ist
  const DICK = FIG / 2;
  const bx = 760, by = 100;
  g.fillStyle = '#000000';
  g.fillRect(bx, by, DICK, FIG);
  g.fillStyle = '#000000';
  pfeil(bx, by - 30, bx + DICK, by - 30);
  g.textAlign = 'center';
  g.fillText('Dicke = H / 2', bx + DICK / 2, by - 46);
  g.textAlign = 'left';
  g.font = '500 22px system-ui, sans-serif';
  g.fillText('Aus dieser Scheibe wird die Silhouette links', bx - 40, by + FIG + 52);
  g.fillText('senkrecht durchgeschnitten.', bx - 40, by + FIG + 82);

  return c.toDataURL('image/png');
});

await browser.close();
server.close();

mkdirSync(join(ROOT, 'grafik/vorlagen'), { recursive: true });
const ziel = join(ROOT, 'grafik/vorlagen/figur-umriss.png');
writeFileSync(ziel, Buffer.from(daten.split(',')[1], 'base64'));
console.log(`${ziel} geschrieben`);
