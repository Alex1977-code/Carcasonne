/**
 * Einen neuen Bogen messen, bevor er übernommen wird.
 *
 *   node tools/bogen-pruefen.mjs <bild.png> [Motiv1 Motiv2 Motiv3 Motiv4]
 *
 * Beispiel:
 *   node tools/bogen-pruefen.mjs neu/bogen07.png U V W X
 *
 * Prüft für jede der vier Karten:
 *   – welche Kantenfolge sie tatsächlich hat (Stadt/Weg/Fluss/Wiese)
 *   – ob die zum genannten Motiv passt, notfalls gedreht
 *   – an welcher Stelle jeder Kante ein Weg oder Fluss austritt und wie breit
 *
 * Warum überhaupt messen: eine Karte, deren Weg bei 44 % statt 50 % der
 * Kante austritt, sieht in der Vorschau tadellos aus und ergibt auf dem
 * Brett an jeder Naht einen Versatz. Von den 40 Kantenübergängen der
 * ersten Lieferung 07–14 lagen 24 daneben – keiner davon war im Bild
 * aufgefallen.
 *
 * Sollwerte aus den Bögen 01–05 gemessen: Weg 10,3–11 % der Kantenlänge,
 * Fluss 18 %, beide mittig bei 50 %; Stadt über die volle Kante.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, resolve, basename, dirname } from 'node:path';

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

const [bildArg, ...motive] = process.argv.slice(2);
if (!bildArg) {
  console.error('Aufruf: node tools/bogen-pruefen.mjs <bild.png> [Motiv1..4]');
  process.exit(1);
}
const bild = resolve(bildArg);
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Kantenfolgen aus der Engine lesen, ohne sie zu importieren (die Datei ist
// DOM-frei, aber ein Regex spart den Umweg über den Browser).
const quelle = readFileSync(join(ROOT, 'js/engine/tiles.js'), 'utf8');
const DEFS = {};
for (const m of quelle.matchAll(/def\('([A-Z_0-9]+)', (\d+), '(\w+)', '(\w{4})'/g)) {
  DEFS[m[1]] = { anzahl: +m[2], satz: m[3], kanten: m[4] };
}
const dreh = (k, n) => (n ? k.slice(-n) + k.slice(0, -n) : k);

const TYPEN = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
                '.html': 'text/html' };
const server = createServer((req, res) => {
  const p = req.url === '/bogen' ? bild : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
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
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const karten = await page.evaluate(async () => {
  const img = new Image();
  img.src = '/bogen';
  await img.decode();
  const W = img.width;
  const c = document.createElement('canvas');
  c.width = W; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, img.height).data;

  // Der Bogengrund ist ein neutrales Grau; alles andere ist Malerei.
  const grau = (x, y) => {
    const i = (y * W + x) * 4, r = px[i], gg = px[i + 1], bb = px[i + 2];
    return Math.abs(r - gg) < 14 && Math.abs(gg - bb) < 14 && r > 115 && r < 195;
  };
  const cls = (x, y) => {
    const i = (Math.round(y) * W + Math.round(x)) * 4;
    const r = px[i], gg = px[i + 1], bb = px[i + 2];
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
    const sat = mx ? (mx - mn) / mx : 0, v = mx / 255;
    if (bb > r + 25 && bb > gg + 10) return 'F';        // Fluss: blau
    if (v > 0.70 && sat < 0.32) return 'R';             // Weg: hell und blass
    if (gg >= r && gg > bb && sat > 0.25) return 'w';   // Wiese: grün
    if (r > gg && gg > bb && sat > 0.30) return 'C';    // Stadt: gold
    return '?';
  };

  const halb = Math.round(W / 2), out = [];
  for (let q = 0; q < 4; q++) {
    const qx = q % 2, qy = Math.floor(q / 2), x0 = qx * halb, y0 = qy * halb;
    let mnX = 1e9, mxX = -1, mnY = 1e9, mxY = -1;
    for (let y = y0; y < y0 + halb; y += 2) {
      for (let x = x0; x < x0 + halb; x += 2) {
        if (!grau(x, y)) {
          if (x < mnX) mnX = x; if (x > mxX) mxX = x;
          if (y < mnY) mnY = y; if (y > mxY) mxY = y;
        }
      }
    }
    const S = mxX - mnX;
    const kanten = [], uebergaenge = [];
    for (const seite of [0, 1, 2, 3]) {
      const ein = S * 0.03, arr = [];
      for (let k = 0; k <= 400; k++) {
        const u = (k / 400) * S;
        let x, y;
        if (seite === 0) { x = mnX + u; y = mnY + ein; }
        if (seite === 1) { x = mxX - ein; y = mnY + u; }
        if (seite === 2) { x = mnX + u; y = mxY - ein; }
        if (seite === 3) { x = mnX + ein; y = mnY + u; }
        arr.push(cls(x, y));
      }
      const zahl = (k) => arr.filter((a) => a === k).length;
      const mitte = arr.slice(160, 241);
      const zm = (k) => mitte.filter((a) => a === k).length;
      kanten.push(zahl('C') >= 264 ? 'C' : zm('F') >= 25 ? 'W' : zm('R') >= 25 ? 'R' : 'F');
      for (const art of ['R', 'F']) {
        let st = -1;
        for (let k = 0; k <= arr.length; k++) {
          if (k < arr.length && arr[k] === art) { if (st < 0) st = k; }
          else if (st >= 0) {
            const breite = ((k - st) / 400) * 100, m = (((st + k) / 2) / 400) * 100;
            if (breite > 4) uebergaenge.push({ seite: 'NOSW'[seite], art, breite, mitte: m });
            st = -1;
          }
        }
      }
    }
    out.push({ kanten: kanten.join(''), uebergaenge, feld: S });
  }
  return out;
});

await browser.close();
server.close();

const lage = ['oben links', 'oben rechts', 'unten links', 'unten rechts'];
let fehler = 0;
console.log(`\n${basename(bild)}\n`);

karten.forEach((k, q) => {
  const soll = motive[q];
  let kopf = `${lage[q].padEnd(13)} Kanten ${k.kanten}`;
  if (soll) {
    const want = DEFS[soll]?.kanten;
    if (!want) kopf += `   ✗ Motiv ${soll} unbekannt`;
    else {
      const n = [0, 1, 2, 3].find((i) => dreh(k.kanten, i) === want);
      if (n === 0) kopf += `   ✓ ${soll}`;
      else if (n !== undefined) kopf += `   ✓ ${soll}, um ${n} gedreht ("dreh": ${n})`;
      else {
        const kand = Object.keys(DEFS).filter((d) =>
          [0, 1, 2, 3].some((i) => dreh(k.kanten, i) === DEFS[d].kanten));
        kopf += `   ✗ nicht ${soll} (${DEFS[soll].kanten})` +
          (kand.length ? ` – wäre ${kand.join('/')}` : ' – kein gültiges Motiv');
        fehler++;
      }
    }
  }
  console.log(kopf);
  for (const u of k.uebergaenge) {
    const sollB = u.art === 'R' ? 11 : 18;
    const dm = Math.abs(u.mitte - 50), db = sollB - u.breite;
    // In beide Richtungen prüfen. Vorher wurde nur „zu schmal" beanstandet –
    // deshalb sind U, W und X von Bogen 07 durchgerutscht: ihre Wege waren
    // 11,8 bis 13,8 % breit statt 11 %, und im Bild fällt das nicht auf.
    const anm = dm > 3 ? `✗ ${dm.toFixed(1)} % aus der Mitte`
      : db > 2.5 ? `✗ ${db.toFixed(1)} % zu schmal`
      : db < -2.5 ? `✗ ${(-db).toFixed(1)} % zu breit`
      : '✓';
    if (anm !== '✓') fehler++;
    console.log(`   ${u.seite}  ${(u.art === 'R' ? 'Weg' : 'Fluss').padEnd(6)}` +
      ` Mitte ${u.mitte.toFixed(1).padStart(5)} %  Breite ${u.breite.toFixed(1).padStart(4)} %` +
      `  (soll 50 % / ${sollB} %)  ${anm}`);
  }
  if (!k.uebergaenge.length) console.log('   keine Wege oder Flüsse an den Kanten');
});

console.log(fehler
  ? `\n${fehler} Beanstandung${fehler === 1 ? '' : 'en'} – vor dem Übernehmen klären.`
  : '\nAlles im Randvertrag. Übernehmen mit tools/kacheln-schneiden.mjs.');
process.exit(fehler ? 1 : 0);
