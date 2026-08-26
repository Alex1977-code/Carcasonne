/**
 * Die gelieferte Tischplatte kachelfähig machen und einbauen.
 *
 *   node tools/tisch-einbauen.mjs grafik/tischplatte.png
 *
 * Erzeugt grafik/tischplatte.webp.
 *
 * Warum überhaupt gerechnet wird: `tisch-pruefen.mjs` hat an der Naht
 * oben/unten einen Sprung vom 2,5-fachen des Grundrauschens gemessen. Das
 * Spiel kachelt die Fläche über den ganzen Bildschirm – aus einer Naht
 * wird dann ein Linienraster, und das sieht man sofort. Links/rechts war
 * die Naht mit dem 1,0-fachen nicht zu finden; dort wird nichts angefasst,
 * denn jede Überblendung kostet Schärfe.
 *
 * Das Verfahren ist die übliche Überblendung: die Kachel wird um das Band
 * gekürzt, und die abgeschnittenen Zeilen werden über die ersten Zeilen
 * geblendet. Die neue Naht liegt dann zwischen zwei Zeilen, die im
 * Original benachbart waren – dort gibt es nichts zu sehen.
 *
 * Nach dem Schreiben wird erneut gemessen; das Ergebnis steht in der
 * Ausgabe. Nicht nach Augenschein entscheiden.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, resolve, basename, dirname } from 'node:path';

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
const argv = process.argv.slice(2);
const quelle = resolve(argv.find((a) => !a.startsWith('-')) || join(ROOT, 'grafik/tischplatte.png'));
const ZIEL = join(ROOT, 'grafik/tischplatte.webp');
const KANTE = 1024;           // Kantenlänge der fertigen Kachel
const BAND = 0.09;            // Anteil der Seite, über den geblendet wird
const GRENZE = 1.5;           // ab diesem Vielfachen des Grundrauschens wird geheilt

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
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const ergebnis = await page.evaluate(async ({ KANTE, BAND, GRENZE }) => {
  const img = new Image();
  img.src = '/quelle';
  await img.decode();

  const leinwand = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  /** Naht gegen das Grundrauschen der Textur, wie in tisch-pruefen.mjs. */
  const messen = (cv) => {
    const W = cv.width, H = cv.height;
    const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const lum = (x, y) => {
      const i = (y * W + x) << 2;
      return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
    };
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
    let gS = 0, nS = 0;
    for (let x = 4; x < W - 5; x += 7) { gS += spalten(x, x + 1); nS++; }
    let gZ = 0, nZ = 0;
    for (let y = 4; y < H - 5; y += 7) { gZ += zeilen(y, y + 1); nZ++; }
    return { vS: spalten(W - 1, 0) / (gS / nS), vZ: zeilen(H - 1, 0) / (gZ / nZ) };
  };

  // Original in voller Größe
  const roh = leinwand(img.width, img.height);
  roh.getContext('2d').drawImage(img, 0, 0);
  const vorher = messen(roh);

  // Überblendung nur in der Richtung, die es nötig hat.
  const heilen = (cv, senkrecht) => {
    const W = cv.width, H = cv.height;
    const b = Math.round((senkrecht ? H : W) * BAND);
    const nW = senkrecht ? W : W - b;
    const nH = senkrecht ? H - b : H;
    const ziel = leinwand(nW, nH);
    const zg = ziel.getContext('2d');
    // Der Rumpf bleibt, wie er ist.
    zg.drawImage(cv, 0, 0);
    // Über das erste Band die abgeschnittenen Zeilen legen, mit einem
    // Verlauf von voll nach durchsichtig.
    const streifen = leinwand(senkrecht ? W : b, senkrecht ? b : H);
    const sg = streifen.getContext('2d');
    if (senkrecht) sg.drawImage(cv, 0, nH, W, b, 0, 0, W, b);
    else sg.drawImage(cv, nW, 0, b, H, 0, 0, b, H);
    // Verlauf als Maske
    sg.globalCompositeOperation = 'destination-in';
    const gr = senkrecht ? sg.createLinearGradient(0, 0, 0, b) : sg.createLinearGradient(0, 0, b, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, streifen.width, streifen.height);
    zg.drawImage(streifen, 0, 0);
    return ziel;
  };

  let cv = roh;
  const geheilt = [];
  if (vorher.vZ > GRENZE) { cv = heilen(cv, true); geheilt.push('oben/unten'); }
  if (vorher.vS > GRENZE) { cv = heilen(cv, false); geheilt.push('links/rechts'); }

  // Auf die Zielgröße bringen – quadratisch, damit die Kachelrechnung im
  // Spiel mit einer einzigen Schrittweite auskommt.
  const fertig = leinwand(KANTE, KANTE);
  fertig.getContext('2d').drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, KANTE, KANTE);
  const nachher = messen(fertig);

  return {
    quelle: { w: img.width, h: img.height },
    vorher, nachher, geheilt,
    datenUrl: fertig.toDataURL('image/webp', 0.92),
  };
}, { KANTE, BAND, GRENZE });

await browser.close();
server.close();

mkdirSync(dirname(ZIEL), { recursive: true });
const puffer = Buffer.from(ergebnis.datenUrl.split(',')[1], 'base64');
writeFileSync(ZIEL, puffer);

const z = (v) => v.toFixed(1) + '-fach';
console.log(`${basename(quelle)}  ${ergebnis.quelle.w}×${ergebnis.quelle.h}`);
console.log(`   Naht vorher   links/rechts ${z(ergebnis.vorher.vS)}   oben/unten ${z(ergebnis.vorher.vZ)}`);
console.log(`   geheilt       ${ergebnis.geheilt.join(', ') || 'nichts nötig'}`);
console.log(`   Naht nachher  links/rechts ${z(ergebnis.nachher.vS)}   oben/unten ${z(ergebnis.nachher.vZ)}`);
console.log(`   geschrieben   ${ZIEL.replace(ROOT + '/', '')}  ${KANTE}×${KANTE}`
  + `  ${(puffer.length / 1024).toFixed(0)} kB`);

const schlecht = ergebnis.nachher.vS > 2.0 || ergebnis.nachher.vZ > 2.0;
if (schlecht) console.log('\nDie Naht ist noch da – so nicht übernehmen.');
process.exit(schlecht ? 1 : 0);
