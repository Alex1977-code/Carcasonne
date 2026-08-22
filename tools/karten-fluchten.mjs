/**
 * Karten so verschieben, dass ihre Wege und Flüsse genau mittig austreten.
 *
 *   node tools/karten-fluchten.mjs --probe      # nur messen und rechnen
 *   node tools/karten-fluchten.mjs              # verschieben und schreiben
 *   node tools/karten-fluchten.mjs U V W X      # nur diese Motive
 *
 * Gemessen über alle gemalten Karten traten die Wege zwischen 49,0 % und
 * 53,6 % der Kantenlänge aus. Die schlimmste denkbare Naht war damit 4,6 %
 * breit – auf einem Telefon rund zehn Punkte Versatz, und genau das sieht
 * man: die Straßen fluchten nicht.
 *
 * Neu malen muss man dafür nichts. Sitzt ein Weg an der Nordkante bei
 * 51,5 %, dann sitzt er dort um 1,5 % zu weit rechts, und die ganze Karte
 * um denselben Betrag nach links geschoben bringt ihn in die Mitte. Ein
 * waagerechter Versatz richtet die Nord- und die Südkante, ein senkrechter
 * die Ost- und die Westkante; beide sind unabhängig voneinander.
 *
 * Widersprechen sich zwei gegenüberliegende Kanten – Norden zu weit links,
 * Süden zu weit rechts –, kann ein Versatz nicht beide richten. Dann wird
 * der Mittelwert genommen, und der Rest bleibt stehen; das Werkzeug meldet
 * es.
 *
 * Der Streifen, der am Rand frei wird, wird mit der Randzeile gefüllt.
 * Dort läuft der Weg ohnehin senkrecht auf die Kante zu und die Wiese ist
 * gleichförmig, deshalb fällt das nicht auf. Eine Stadt reicht damit
 * weiterhin von Ecke zu Ecke – gerade das wäre bei einem harten Versatz
 * sonst kaputtgegangen.
 *
 * Danach messen: tools/karten-pruefen.mjs
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { extname, join, basename } from 'node:path';

const KANTE = 512;
const GUETE = 0.85;
// Ein Durchgang, kein Nachbessern. Mehrere Runden haben sich aufgeschaukelt:
// nach dem ersten Verschieben fällt die Messung leicht anders aus, die zweite
// Runde legt noch etwas drauf, und am Ende steht die Karte schlechter als
// vorher – bei RV_ROADCURVE ging es so von 0,7 auf 1,7 % daneben. Ein Versatz
// aus einer sauberen Messung reicht, und die Karte wird nur einmal neu
// verlustbehaftet gespeichert.
const RUNDEN = 1;
const SCHWELLE = 0.12;   // kleiner als das wird nicht mehr angefasst (in %)
// Mehr als drei Prozent ist kein Versatz mehr, sondern ein Fehler in der
// Karte oder in der Messung. Beides wird nicht stillschweigend verschoben,
// sondern gemeldet.
const GRENZE = 3.0;

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

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const quelle = readFileSync(join(ROOT, 'js/engine/tiles.js'), 'utf8');
const DEFS = {};
for (const m of quelle.matchAll(/def\('([A-Z_0-9]+)', (\d+), '(\w+)', '(\w{4})'/g)) {
  DEFS[m[1]] = m[4];
}

const argv = process.argv.slice(2);
const nurProbe = argv.includes('--probe');
const gewuenscht = argv.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase());
const alle = readdirSync(join(ROOT, 'grafik/karten'))
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.replace('.webp', ''))
  .filter((m) => DEFS[m] && (!gewuenscht.length || gewuenscht.includes(m)))
  .sort();
if (!alle.length) { console.error('keine passenden Karten gefunden'); process.exit(1); }

const TYPEN = { '.webp': 'image/webp', '.png': 'image/png', '.html': 'text/html',
                '.js': 'text/javascript', '.css': 'text/css' };
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

const ergebnis = await page.evaluate(async ({ motive, DEFS, KANTE, GUETE, RUNDEN, SCHWELLE, GRENZE, nurProbe }) => {
  const out = [];

  /** Kantenübergänge einer Bilddaten-Fläche messen. */
  function messen(px, N, soll) {
    const at = (x, y) => ((Math.round(y) * N + Math.round(x)) << 2);
    const cls = (x, y) => {
      const i = at(x, y), r = px[i], gg = px[i + 1], bb = px[i + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      const sat = mx ? (mx - mn) / mx : 0, v = mx / 255;
      if (bb > r + 25 && bb > gg + 10) return 'F';
      if (v > 0.72 && sat < 0.45) return 'R';
      if (gg >= r && gg > bb && sat > 0.25) return 'w';
      if (r > gg && gg > bb && sat > 0.30) return 'C';
      return '?';
    };
    const ein = N * 0.03, treffer = [];
    for (const seite of [0, 1, 2, 3]) {
      const art = soll[seite] === 'R' ? 'R' : soll[seite] === 'W' ? 'F' : null;
      if (!art) continue;
      const arr = [];
      for (let k = 0; k <= 400; k++) {
        const u = (k / 400) * (N - 1);
        let x, y;
        if (seite === 0) { x = u; y = ein; }
        if (seite === 1) { x = N - 1 - ein; y = u; }
        if (seite === 2) { x = u; y = N - 1 - ein; }
        if (seite === 3) { x = ein; y = u; }
        arr.push(cls(x, y));
      }
      // Läufe sammeln und dicht beieinanderliegende zusammenfassen
      const roh = [];
      let st = -1;
      for (let k = 0; k <= arr.length; k++) {
        if (k < arr.length && arr[k] === art) { if (st < 0) st = k; }
        else if (st >= 0) { roh.push([st, k]); st = -1; }
      }
      const gefasst = [];
      for (const l of roh) {
        const vor = gefasst[gefasst.length - 1];
        if (vor && (l[0] - vor[1]) / 400 * 100 <= 2.0) vor[1] = l[1];
        else gefasst.push([...l]);
      }
      // den breitesten nehmen: das ist der Weg, alles andere ist Beiwerk
      let best = null;
      for (const [a, b] of gefasst) {
        if (!best || (b - a) > (best[1] - best[0])) best = [a, b];
      }
      if (!best || (best[1] - best[0]) / 400 * 100 <= 4) continue;
      const mid = Math.round((best[0] + best[1]) / 2);
      let li = mid, re = mid;
      while (li > 0 && arr[li - 1] !== 'w') li--;
      while (re < 400 && arr[re + 1] !== 'w') re++;
      treffer.push({ seite, art, mitte: (((li + re + 1) / 2) / 400) * 100 });
    }
    return treffer;
  }

  for (const motiv of motive) {
    const img = new Image();
    img.src = `/grafik/karten/${motiv}.webp?fl`;
    await img.decode();
    const N = KANTE;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, N, N);

    const soll = DEFS[motiv];
    const vorher = messen(g.getImageData(0, 0, N, N).data, N, soll);
    if (!vorher.length) { out.push({ motiv, keine: true }); continue; }

    let dxGes = 0, dyGes = 0, streit = null;
    for (let runde = 0; runde < RUNDEN; runde++) {
      const jetzt = messen(g.getImageData(0, 0, N, N).data, N, soll);
      // Nord und Süd hängen am waagerechten Versatz, Ost und West am senkrechten
      // Nur Wege richten, keine Flüsse. Ein Fluss hat breite steinerne Ufer,
      // und welcher Lauf davon als der Fluss erkannt wird, springt zwischen
      // zwei Messungen um mehr als einen Punkt. Ein Versatz daraus macht die
      // Karte schlechter statt besser – bei RV_LAKE ging es so von 0,1 auf
      // 1,6 % daneben. Flüsse werden gemessen und gemeldet, aber nicht
      // angefasst.
      const waag = jetzt.filter((t) => (t.seite === 0 || t.seite === 2) && t.art === 'R');
      const senk = jetzt.filter((t) => (t.seite === 1 || t.seite === 3) && t.art === 'R');
      const mittel = (a) => (a.length ? a.reduce((s, t) => s + (t.mitte - 50), 0) / a.length : 0);
      const spanne = (a) => (a.length < 2 ? 0
        : Math.max(...a.map((t) => t.mitte)) - Math.min(...a.map((t) => t.mitte)));
      if (spanne(waag) > 1.5 || spanne(senk) > 1.5) {
        streit = Math.max(spanne(waag), spanne(senk));
      }
      // Verschoben wird, wenn die Messung belastbar ist. Belastbar heißt:
      // entweder sind sich die beiden gegenüberliegenden Kanten einig – dann
      // stimmt der Betrag, auch wenn er groß ist, wie bei EC_CROSS_CITY mit
      // 3,6 % an Ost und West –, oder es geht ohnehin nur um eine Kleinigkeit.
      // Eine große Abweichung an einer einzelnen Kante ist dagegen eher ein
      // Messfehler als ein Versatz und bleibt stehen.
      const belastbar = (a) => a.length >= 2 ? spanne(a) <= 1.0 : Math.abs(mittel(a)) <= GRENZE;
      let dx = -mittel(waag) / 100 * N;
      let dy = -mittel(senk) / 100 * N;
      if (!belastbar(waag)) dx = 0;
      if (!belastbar(senk)) dy = 0;
      const deckel = 5.0 / 100 * N;
      dx = Math.max(-deckel, Math.min(deckel, dx));
      dy = Math.max(-deckel, Math.min(deckel, dy));
      if (Math.abs(dx) < SCHWELLE / 100 * N && Math.abs(dy) < SCHWELLE / 100 * N) break;
      dxGes += dx; dyGes += dy;

      // Verschieben, dann die frei gewordenen Streifen mit der Randzeile
      // füllen: erst waagerecht über die volle Höhe, dann senkrecht über
      // die volle Breite – so sind auch die Ecken gedeckt.
      const t = document.createElement('canvas');
      t.width = t.height = N;
      const tg = t.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(c, dx, dy);
      const lx = Math.ceil(Math.max(0, dx)), rx = Math.ceil(Math.max(0, -dx));
      if (lx) tg.drawImage(t, lx, 0, 1, N, 0, 0, lx, N);
      if (rx) tg.drawImage(t, N - rx - 1, 0, 1, N, N - rx, 0, rx, N);
      const oy = Math.ceil(Math.max(0, dy)), uy = Math.ceil(Math.max(0, -dy));
      if (oy) tg.drawImage(t, 0, oy, N, 1, 0, 0, N, oy);
      if (uy) tg.drawImage(t, 0, N - uy - 1, N, 1, 0, N - uy, N, uy);
      g.clearRect(0, 0, N, N);
      g.drawImage(t, 0, 0);
    }

    const nachher = messen(g.getImageData(0, 0, N, N).data, N, soll);
    out.push({
      motiv, vorher, nachher, streit,
      dx: dxGes / N * 100, dy: dyGes / N * 100,
      webp: nurProbe ? null : c.toDataURL('image/webp', GUETE),
    });
  }
  return out;
}, { motive: alle, DEFS, KANTE, GUETE, RUNDEN, SCHWELLE, GRENZE, nurProbe });

await browser.close();
server.close();

/**
 * Liegt noch das gelieferte Original vor? Dann wird nicht das fertige
 * 512er Bild verschoben, sondern der Ausschnitt daraus versetzt neu
 * genommen. Ein Verschieben lässt am Rand einen Streifen frei, der mit der
 * Randzeile gefüllt werden muss – bei EC_CROSS_CITY waren das 18 Punkte,
 * und die stehen als senkrechte Schlieren im Bild. Aus dem Original
 * geschnitten gibt es diesen Streifen gar nicht erst.
 */
// Nicht jede Datei in grafik/ ist auch die Quelle der Karte. V und W werden
// von tools/stadt-zu-wiese.mjs aus K und L gebaut, weil die gelieferten
// Bilder verzogen sind – die liegen aber weiterhin als V_strassenkurve.png
// und W_kreuzung.png im Verzeichnis. Würden sie als Quelle genommen, bekäme
// keine der beiden je ihren Versatz: er landete in der Datei und niemand
// wendete ihn an.
const GEBAUT = ['V', 'W'];

function quellbild(motiv) {
  if (GEBAUT.includes(motiv)) return null;
  const treffer = readdirSync(join(ROOT, 'grafik'))
    .filter((f) => f.endsWith('.png') && !f.startsWith('bogen'))
    .find((f) => f.replace(/\.png$/, '').toUpperCase().split('_').some((_, i, t) =>
      t.slice(0, i + 1).join('_') === motiv));
  return treffer ? join('grafik', treffer) : null;
}

const kurz = (a) => a.map((t) => `${'NOSW'[t.seite]}${t.mitte.toFixed(1)}`).join(' ');

// Der Versatz muss sich aufsummieren. tools/karten-einbauen.mjs schneidet
// immer aus dem unversehrten Original, also braucht es dort den Gesamtwert –
// steht in der Datei nur der Rest der letzten Messung, wird die vorige
// Korrektur beim nächsten Zuschneiden wieder aufgegeben. Genau das ist
// passiert: EC_CROSS_CITY sprang von 50 auf 53 % zurück.
let versatz = {};
if (existsSync(join(ROOT, 'grafik/versatz.json'))) {
  try {
    const alt = JSON.parse(readFileSync(join(ROOT, 'grafik/versatz.json'), 'utf8'));
    for (const [k, v] of Object.entries(alt)) if (k !== '_') versatz[k] = v;
  } catch { /* unlesbar: neu anfangen */ }
}
let geaendert = 0, schlimmstVor = 0, schlimmstNach = 0;
for (const e of ergebnis) {
  if (e.keine) continue;
  for (const t of e.vorher) if (t.art === 'R') schlimmstVor = Math.max(schlimmstVor, Math.abs(t.mitte - 50));
  for (const t of e.nachher) if (t.art === 'R') schlimmstNach = Math.max(schlimmstNach, Math.abs(t.mitte - 50));
  const bewegt = Math.abs(e.dx) > 0.05 || Math.abs(e.dy) > 0.05;
  if (!bewegt) continue;
  geaendert++;
  const quelle2 = quellbild(e.motiv);
  if (quelle2) {
    const vor = versatz[e.motiv] || { dx: 0, dy: 0 };
    versatz[e.motiv] = { dx: +(vor.dx + e.dx).toFixed(3), dy: +(vor.dy + e.dy).toFixed(3), quelle: quelle2 };
  }
  console.log(`${e.motiv.padEnd(20)} ${e.dx >= 0 ? '+' : ''}${e.dx.toFixed(2)} % / ` +
    `${e.dy >= 0 ? '+' : ''}${e.dy.toFixed(2)} %   ${kurz(e.vorher)}  →  ${kurz(e.nachher)}` +
    (e.streit ? `   ⚠ gegenüberliegende Kanten uneins um ${e.streit.toFixed(1)} %` : ''));
  // Nur die Karten ohne Original hier verschieben. Die übrigen holt sich
  // tools/karten-einbauen.mjs aus grafik/versatz.json und schneidet sie
  // versetzt neu zu – ohne Füllstreifen.
  if (!nurProbe && !quelle2) {
    const buf = Buffer.from(e.webp.split(',')[1], 'base64');
    writeFileSync(join(ROOT, `grafik/karten/${e.motiv}.webp`), buf);
  }
}
const mitQuelle = Object.keys(versatz).length;
writeFileSync(join(ROOT, 'grafik/versatz.json'),
  JSON.stringify({ _: [
    'Wie weit eine Karte verschoben werden muss, damit ihre Wege genau',
    'mittig austreten – in Prozent der Kantenlänge, positiv nach rechts',
    'beziehungsweise nach unten. Gerechnet von tools/karten-fluchten.mjs,',
    'angewendet von tools/karten-einbauen.mjs beim Zuschneiden.',
  ], ...versatz }, null, 2) + '\n');
console.log(`\n${geaendert} von ${ergebnis.length} Karten ${nurProbe ? 'wären zu verschieben' : 'behandelt'}.`);
console.log(`davon ${mitQuelle} mit vorliegendem Original → grafik/versatz.json,` +
  ` danach: node tools/karten-einbauen.mjs grafik/*.png`);
console.log(`Größte Abweichung eines Weges von der Mitte: ${schlimmstVor.toFixed(1)} % → ${schlimmstNach.toFixed(1)} %`);
console.log(`Schlimmste denkbare Naht: ${(2 * schlimmstVor).toFixed(1)} % → ${(2 * schlimmstNach).toFixed(1)} %`);
