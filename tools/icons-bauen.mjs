/**
 * Die PNG-Symbole aus icon.svg erzeugen.
 *
 *   node tools/icons-bauen.mjs
 *
 * Ohne das laufen SVG und PNG auseinander: das Manifest verweist auf die
 * PNGs, der Startbildschirm auf das SVG, und wer nur eines von beiden
 * ändert, sieht den Unterschied erst auf dem Telefon.
 *
 * Die Größen sind die, die wirklich abgefragt werden – 180 für iOS,
 * 192 und 512 für das Web-Manifest.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
const GROESSEN = [180, 192, 512];

const svg = readFileSync(join(ROOT, 'icon.svg'));
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
  res.end(svg);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const chromium = await ladeChromium();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

for (const px of GROESSEN) {
  const page = await browser.newPage({ viewport: { width: px, height: px } });
  await page.setContent('<!doctype html><meta charset="utf-8">'
    + '<style>html,body{margin:0;padding:0;background:transparent}'
    + `img{display:block;width:${px}px;height:${px}px}</style>`
    + `<img src="http://127.0.0.1:${PORT}/icon.svg">`);
  await page.waitForTimeout(250);
  const bild = await page.screenshot({ omitBackground: true,
    clip: { x: 0, y: 0, width: px, height: px } });
  const ziel = join(ROOT, 'icons', `icon-${px}.png`);
  writeFileSync(ziel, bild);
  console.log(`${ziel}  ${px}×${px}  ${(bild.length / 1024).toFixed(1)} kB`);
  await page.close();
}

await browser.close();
server.close();
