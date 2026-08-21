/**
 * Vorlagenbogen für den Bildgenerator bauen.
 *
 *   node tools/vorlagenbogen.mjs U V W X  [-o grafik/vorlagen/bogen07.png]
 *
 * Erzeugt ein 2048×2048-Bild mit vier Karten im 2×2-Raster und grauem Steg
 * dazwischen — gezeichnet vom Spiel selbst.
 *
 * Wozu: die Bögen 01 bis 06 sind so entstanden, dass dem Generator ein
 * Bild mitgegeben wurde, das Inhalt und Geometrie vorgibt („Image 1 — the
 * sheet. This defines the content and the geometry"), während der Text nur
 * das Material beschrieb. Genau daran lag es, dass dort die Wege in der
 * Kantenmitte sitzen und bei den rein textbeschriebenen Bögen 07 bis 14
 * nicht: aus Worten wie „mittig" macht ein Bildmodell 36 % oder 58 %, aus
 * einem Bild nicht.
 *
 * Die gezeichnete Darstellung des Spiels ist für diesen Zweck ideal, weil
 * sie den Randvertrag nicht nur einhält, sondern ist: Wege liegen dort per
 * Konstruktion mittig und 14 % breit, Flüsse mittig und 18 %, Städte über
 * die volle Kante.
 *
 * Einschränkung: für Motive, die bereits gemalt vorliegen, liefert
 * tileArt die Malerei statt der Zeichnung. Als Vorlage taugt das nicht –
 * gebraucht wird sie ohnehin nur für die noch fehlenden Motive.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';

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
const ziel = oi >= 0 ? argv[oi + 1] : 'vorlagenbogen.png';
const motive = (oi >= 0 ? argv.slice(0, oi) : argv).filter(Boolean);
if (motive.length < 1 || motive.length > 4) {
  console.error('Aufruf: node tools/vorlagenbogen.mjs <bis zu 4 Motive> [-o datei.png]');
  process.exit(1);
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const KANTE = 2048;
const STEG = 34;                    // grauer Schnittrand, wie auf Bogen 01–06
const GRAU = 'rgb(154,152,148)';    // aus den vorhandenen Bögen gemessen

const TYPEN = { '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.html': 'text/html', '.json': 'application/json',
                '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  // Erst lesen, dann den Kopf schreiben: andersherum sind die Kopfzeilen
  // schon raus, wenn das Lesen fehlschlaegt, und der 404 wirft.
  let inhalt;
  try { inhalt = readFileSync(p); }
  catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPEN[extname(p)] || 'application/octet-stream' });
  res.end(inhalt);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const chromium = await ladeChromium();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const data = await page.evaluate(async ({ motive, KANTE, STEG, GRAU }) => {
  const { tileArt } = await import('/js/ui/render.js');
  const { LOD } = await import('/js/ui/render/contract.js');
  // Kurz warten: der Kachelspeicher rendert die große Stufe erst auf Anfrage.
  await new Promise((r) => setTimeout(r, 400));

  const feld = Math.floor((KANTE - 3 * STEG) / 2);
  const c = document.createElement('canvas');
  c.width = c.height = KANTE;
  const g = c.getContext('2d');
  g.fillStyle = GRAU;
  g.fillRect(0, 0, KANTE, KANTE);
  g.imageSmoothingQuality = 'high';

  const fehlend = [];
  motive.forEach((id, q) => {
    const art = tileArt(id, 0, LOD.LARGE);
    if (!art) { fehlend.push(id); return; }
    const x = STEG + (q % 2) * (feld + STEG);
    const y = STEG + Math.floor(q / 2) * (feld + STEG);
    g.drawImage(art, x, y, feld, feld);
  });
  return { png: c.toDataURL('image/png'), feld, fehlend };
}, { motive, KANTE, STEG, GRAU });

await browser.close();
server.close();

if (data.fehlend.length) {
  console.error('nicht gezeichnet (unbekanntes Motiv?):', data.fehlend.join(' '));
}
if (fehler.length) console.error('Seitenfehler:', fehler.slice(0, 3));

mkdirSync(dirname(ziel) || '.', { recursive: true });
const buf = Buffer.from(data.png.split(',')[1], 'base64');
writeFileSync(ziel, buf);
console.log(`${ziel}  ${KANTE}×${KANTE}, Kartenfeld ${data.feld} px, Steg ${STEG} px`);
console.log(`Motive: ${motive.join('  ')}   (${Math.round(buf.length / 1024)} KB)`);
