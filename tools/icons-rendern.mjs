/**
 * icon.svg in die PNG-Größen rastern, die Handys tatsächlich brauchen.
 *
 *   node tools/icons-rendern.mjs
 *
 * Warum überhaupt PNG, wenn ein SVG da ist: iOS wertet für
 * apple-touch-icon **kein** SVG aus. Wer nur ein SVG anbietet, bekommt auf
 * dem iPhone-Startbildschirm kein Symbol, sondern einen Schnappschuss der
 * Seite. Android nimmt SVG im Manifest zwar an, aber nicht jede
 * Launcher-Version zuverlässig – deshalb liegen beide Formate bereit.
 *
 * Gerastert wird im Browser, damit Verläufe, Muster und Rundungen exakt so
 * aussehen wie im SVG. Keine Bildbibliothek, keine node_modules.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

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

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'icons');

// 180 für iOS, 192 und 512 fürs Manifest. 512 dient zugleich als
// maskable – der Meeple liegt im mittleren 80-%-Kreis, das Grün ist
// randvoll, damit die runde Maske nirgends ins Leere greift.
const GROESSEN = [180, 192, 512];

const chromium = await ladeChromium();
const TYPEN = { '.svg': 'image/svg+xml', '.html': 'text/html' };
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
for (const n of GROESSEN) {
  const data = await page.evaluate(async ({ n, port }) => {
    const img = new Image();
    img.src = `http://127.0.0.1:${port}/icon.svg`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, n, n);
    return c.toDataURL('image/png');
  }, { n, port: PORT });
  const buf = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(join(OUT, `icon-${n}.png`), buf);
  console.log(`icons/icon-${n}.png  ${Math.round(buf.length / 1024)} KB`);
}

await browser.close();
server.close();
console.log('\nEingetragen sind die Dateien in index.html, manifest.webmanifest und sw.js.');
