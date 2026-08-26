/**
 * Die Vorlage für den Figuren-Prompt zeichnen.
 *
 *   node tools/figur-vorlage.mjs
 *
 * Erzeugt grafik/vorlagen/figur-umriss.png mit drei Feldern:
 * die Scheibe in der Ansicht, die geliefert werden soll; dieselbe Scheibe
 * von der Seite mit dem Maß H/2; und der reine Umriss.
 *
 * Warum ein Bild und nicht nur Worte: aus „halb so dick wie hoch" macht ein
 * Bildmodell 30 % oder 70 %, und aus einer beschriebenen Silhouette macht es
 * irgendeinen Männchenumriss. Dieselbe Lehre wie bei den Kartenbögen – die
 * Bögen 07–14 waren allein aus Text erzeugt und lagen bei 24 von 40
 * Übergängen daneben. Der Umriss hier ist derselbe Pfad wie im Spiel
 * (MEEPLE_PATH in js/ui/render.js), damit die gelieferte Figur an dieselbe
 * Stelle passt wie die gezeichnete.
 *
 * Die erste Fassung dieser Vorlage zeigte nur Umriss und Balken. Die
 * Lieferung danach hatte eine Seitenwand von 12,2 % der Figurenhöhe –
 * gemessen mit tools/figuren-pruefen.mjs. Zu einer H/2 dicken Scheibe
 * gehören bei 30° Drehung 25 %. Der Balken allein hat also nicht getragen:
 * er sagt, wie dick die Scheibe ist, aber nicht, wie viel davon im Bild zu
 * sehen sein muss. Deshalb steht die Scheibe jetzt gedreht da, mit der
 * Seitenwand als bemaßtem Feld – die Zahl, die das Prüfwerkzeug nachher
 * misst, ist im Bild direkt abzugreifen.
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
const page = await browser.newPage({ viewport: { width: 1800, height: 920 } });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForTimeout(400);

const daten = await page.evaluate(async () => {
  const { MEEPLE_PATH } = await import('/js/ui/render.js');
  const W = 1760, H = 880, FIG = 520;          // Figurenhöhe in Pixeln
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);

  // Die Drehung, in der geliefert werden soll. 30° um die Hochachse: eine
  // H/2 dicke Scheibe zeigt dann eine Seitenwand von H/2 · sin 30° = 25 %
  // der Höhe. Dazu eine kleine Neigung nach unten, damit die obere
  // Schnittkante des Kopfes sichtbar wird – daran erkennt man die Scheibe
  // als Körper und nicht als Aufkleber.
  const TIEFE_X = FIG * 0.25;
  const TIEFE_Y = FIG * 0.07;

  g.lineJoin = 'round';
  g.lineCap = 'round';
  const pfeil = (x1, y1, x2, y2) => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (const s of [1, -1]) {
      g.beginPath(); g.moveTo(x2, y2);
      g.lineTo(x2 - Math.cos(a - s * 0.4) * 16, y2 - Math.sin(a - s * 0.4) * 16);
      g.stroke();
      g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 + Math.cos(a - s * 0.4) * 16, y1 + Math.sin(a - s * 0.4) * 16);
      g.stroke();
    }
  };
  const beschriftung = (text, x, y, groesse = 26) => {
    g.fillStyle = '#000000';
    g.font = `600 ${groesse}px system-ui, sans-serif`;
    g.fillText(text, x, y);
  };

  // ---------------------------------------------- Feld 1: so soll sie aussehen
  const ax = 150, ay = 150;
  const s = FIG / 100;
  // Die Seitenwand: der Umriss, viele Male entlang des Tiefenvektors
  // gestempelt. Das ist die Fläche, die beim Schneiden entsteht.
  const SCHRITTE = 90;
  g.fillStyle = '#8d8d8d';
  for (let i = SCHRITTE; i >= 0; i--) {
    g.save();
    g.translate(ax + (TIEFE_X * i) / SCHRITTE, ay + (TIEFE_Y * i) / SCHRITTE);
    g.scale(s, s);
    g.fill(MEEPLE_PATH);
    g.restore();
  }
  // Die Vorderfläche darüber
  g.save();
  g.translate(ax, ay);
  g.scale(s, s);
  g.fillStyle = '#d0d0d0';
  g.fill(MEEPLE_PATH);
  g.strokeStyle = '#000000';
  g.lineWidth = 2 / s;
  g.stroke(MEEPLE_PATH);
  g.restore();

  // Die Seitenwand bemaßen – waagerecht auf Schulterhöhe, wo sie am
  // breitesten ist.
  const my = ay + FIG * 0.62;
  g.strokeStyle = '#c1121f';
  g.fillStyle = '#c1121f';
  g.lineWidth = 3;
  const kante = ax + FIG * 0.925;
  pfeil(kante, my, kante + TIEFE_X, my);
  g.font = '700 25px system-ui, sans-serif';
  g.fillText('25 % von H', kante + 8, my - 18);
  g.font = '500 22px system-ui, sans-serif';
  g.fillText('sichtbare Seitenwand', kante + 8, my + 32);

  // Höhe
  g.strokeStyle = '#000000';
  g.fillStyle = '#000000';
  g.lineWidth = 3;
  pfeil(ax - 46, ay, ax - 46, ay + FIG);
  g.save(); g.translate(ax - 68, ay + FIG / 2); g.rotate(-Math.PI / 2);
  g.textAlign = 'center';
  beschriftung('Höhe H', 0, 0);
  g.restore();
  g.textAlign = 'left';
  beschriftung('So soll die Figur im Bild stehen:', 60, 78, 30);
  g.font = '500 23px system-ui, sans-serif';
  g.fillStyle = '#333333';
  g.fillText('um 30° gedreht, die Schnittfläche rechts sichtbar', 60, 112);

  // ---------------------------------------------- Feld 2: von der Seite
  const bx = 980, by = 230;
  const DICK = FIG / 2;
  g.fillStyle = '#8d8d8d';
  g.fillRect(bx, by, DICK, FIG);
  g.strokeStyle = '#000000';
  g.lineWidth = 2;
  g.strokeRect(bx, by, DICK, FIG);
  g.strokeStyle = '#c1121f';
  g.fillStyle = '#c1121f';
  g.lineWidth = 3;
  pfeil(bx, by - 34, bx + DICK, by - 34);
  g.textAlign = 'center';
  g.font = '700 25px system-ui, sans-serif';
  g.fillText('Dicke = H / 2', bx + DICK / 2, by - 50);
  g.textAlign = 'left';
  g.fillStyle = '#000000';
  beschriftung('Von der Seite:', 980, 78, 30);
  g.font = '500 23px system-ui, sans-serif';
  g.fillStyle = '#333333';
  g.fillText('die Scheibe ist halb so dick', 980, 112);
  g.fillText('wie die Figur hoch ist', 980, 140);

  // ---------------------------------------------- Feld 3: der reine Umriss
  const KLEIN = FIG * 0.42;
  const cx = bx + DICK + 110, cy = by + FIG - KLEIN;
  g.save();
  g.translate(cx, cy);
  g.scale(KLEIN / 100, KLEIN / 100);
  g.fillStyle = '#000000';
  g.fill(MEEPLE_PATH);
  g.restore();
  g.fillStyle = '#333333';
  g.font = '500 22px system-ui, sans-serif';
  g.fillText('Dieser Umriss wird', cx, cy - 46);
  g.fillText('senkrecht durchgeschnitten.', cx, cy - 18);

  return c.toDataURL('image/png');
});

await browser.close();
server.close();

mkdirSync(join(ROOT, 'grafik/vorlagen'), { recursive: true });
const ziel = join(ROOT, 'grafik/vorlagen/figur-umriss.png');
writeFileSync(ziel, Buffer.from(daten.split(',')[1], 'base64'));
console.log(`${ziel} geschrieben`);
