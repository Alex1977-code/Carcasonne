/**
 * Wie verschieden sehen die Wege der einzelnen Karten aus?
 *
 *   node tools/wege-vergleichen.mjs
 *   node tools/wege-vergleichen.mjs grafik/karten/*.webp
 *
 * Der Randvertrag sorgt dafür, dass ein Weg an der richtigen Stelle in der
 * richtigen Breite austritt. Er sagt nichts darüber, wie er *aussieht* – und
 * daran ist am Brett zu sehen, dass die Karten aus verschiedenen Lieferungen
 * stammen. Gemeldet wurde es so: „wege sehen unterschiedlich aus".
 *
 * Gemessen wird je Weg-Kante quer über den Weg, dicht am Rand:
 *
 *   Lauf     der längste **ununterbrochene** helle Streifen
 *   Fassung  das Gold daneben, je Seite bis zur Wiese
 *   Anteil   der Lauf im Verhältnis zum ganzen Band
 *   Farbe    Ton und Sättigung des Laufs – Elfenbein oder warmes Creme
 *
 * Das ist ausdrücklich **nicht** dasselbe wie der „Kern" in
 * tools/karten-pruefen.mjs. Der überbrückt beim Messen Lücken bis 2 %, weil
 * Goldornament im Weg ihn sonst in Bruchstücke zerlegt und die Karte zu
 * Unrecht als zu schmal gälte. Für den Randvertrag ist das richtig: an der
 * Naht zählt, wo der Weg anfängt und aufhört, nicht was darin gemalt ist.
 *
 * Fürs Aussehen zählt genau das Gegenteil. Ein Weg, dessen heller Streifen
 * durchläuft, und einer, der von dichtem Goldgitter zerlegt ist, halten
 * beide den Vertrag und sehen nebeneinander nach zwei Spielen aus. Deshalb
 * misst dieses Werkzeug ohne Überbrückung – die Zahl fällt kleiner aus als
 * bei karten-pruefen, und der Unterschied *ist* die Ornamentdichte.
 *
 * **Nur dicht am Rand.** Gemessen wird auf 2 bis 5 % Tiefe und der Median
 * genommen. Weiter innen geht es nicht: die Messung läuft senkrecht zur
 * Kante, und ein gekrümmter Weg verlässt diese Senkrechte nach wenigen
 * Prozent. Ein erster Entwurf maß bis 22 % Tiefe und meldete für Motiv P
 * einen Schwund von −768 % – da war der Streifen längst danebengelaufen.
 * Was ein Weg in der Kartenmitte tut, ist so nicht zu bestimmen; dafür ist
 * der Kontaktbogen da.
 *
 * Beanstandet wird hier nichts – das tut tools/karten-pruefen.mjs. Dieses
 * Werkzeug stellt nur nebeneinander, was sonst nur im Nebeneinander auffällt.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
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
const quelle = readFileSync(join(ROOT, 'js/engine/tiles.js'), 'utf8');
const DEFS = {};
for (const m of quelle.matchAll(/def\('([A-Z_0-9]+)', (\d+), '(\w+)', '(\w{4})'/g)) {
  DEFS[m[1]] = { kanten: m[4] };
}

const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const dateien = argv.length ? argv.map((a) => resolve(a))
  : readdirSync(join(ROOT, 'grafik/karten'))
    .filter((f) => f.endsWith('.webp')).sort()
    .map((f) => join(ROOT, 'grafik/karten', f));

const auftrag = dateien.map((d) => {
  const id = basename(d).replace(/\.[^.]+$/, '').toUpperCase();
  return { datei: d, id, kanten: DEFS[id] ? DEFS[id].kanten : null };
}).filter((a) => a.kanten && a.kanten.includes('R'));

if (!auftrag.length) {
  console.error('Keine Karte mit einer Weg-Kante gefunden.');
  process.exit(1);
}

const TYPEN = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
                '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const nr = req.url.match(/^\/karte\/(\d+)$/);
  const p = nr ? auftrag[+nr[1]].datei : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
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

const messung = await page.evaluate(async (auftrag) => {
  const median = (a) => {
    const b = [...a].sort((x, y) => x - y);
    return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
  };
  const out = [];
  for (let nr = 0; nr < auftrag.length; nr++) {
    const img = new Image();
    img.src = `/karte/${nr}`;
    await img.decode();
    const N = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, N, N);
    const px = g.getImageData(0, 0, N, N).data;
    const at = (x, y) => ((Math.round(y) * N + Math.round(x)) << 2);

    const wege = [];
    for (let seite = 0; seite < 4; seite++) {
      if (auftrag[nr].kanten[seite] !== 'R') continue;
      const kerne = [], fassungen = [], farben = [];
      for (const tf of [0.020, 0.030, 0.040, 0.050]) {
        const tiefe = N * tf, linie = [], roh = [];
        for (let q = -160; q <= 160; q++) {
          const laengs = (0.5 + q / 400) * (N - 1);
          let x, y;
          if (seite === 0) { x = laengs; y = tiefe; }
          if (seite === 1) { x = N - 1 - tiefe; y = laengs; }
          if (seite === 2) { x = laengs; y = N - 1 - tiefe; }
          if (seite === 3) { x = tiefe; y = laengs; }
          const i = at(x, y);
          const r = px[i], gg = px[i + 1], bb = px[i + 2];
          const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
          const sat = mx ? (mx - mn) / mx : 0;
          roh.push([r, gg, bb]);
          linie.push(gg >= r && gg > bb && sat > 0.25 ? 'w'
            : (mx / 255 > 0.70 && sat < 0.45 ? 'R' : 'g'));
        }
        const mitte = 160;
        if (linie[mitte] !== 'R') continue;
        let kl = mitte, kr = mitte;
        while (kl > 0 && linie[kl - 1] === 'R') kl--;
        while (kr < linie.length - 1 && linie[kr + 1] === 'R') kr++;
        let bl = kl, br = kr;
        while (bl > 0 && linie[bl - 1] !== 'w') bl--;
        while (br < linie.length - 1 && linie[br + 1] !== 'w') br++;
        kerne.push((kr - kl + 1) / 400 * 100);
        fassungen.push(((kl - bl) + (br - kr)) / 2 / 400 * 100);
        let sr = 0, sg = 0, sb = 0;
        for (let i = kl; i <= kr; i++) { sr += roh[i][0]; sg += roh[i][1]; sb += roh[i][2]; }
        const n = kr - kl + 1;
        farben.push([sr / n, sg / n, sb / n]);
      }
      if (!kerne.length) continue;
      const f = [0, 1, 2].map((i) => median(farben.map((v) => v[i])));
      const mx = Math.max(...f), mn = Math.min(...f);
      wege.push({ seite: 'NOSW'[seite], kern: median(kerne), fassung: median(fassungen),
        rgb: f.map(Math.round), satt: mx ? (mx - mn) / mx : 0 });
    }
    out.push({ id: auftrag[nr].id, wege });
  }
  return out;
}, auftrag.map((a) => ({ id: a.id, kanten: a.kanten })));

await browser.close();
server.close();

const karten = messung.filter((k) => k.wege.length).map((k) => {
  const m = (f) => k.wege.reduce((a, w) => a + f(w), 0) / k.wege.length;
  return { id: k.id, kanten: k.wege.length,
    lauf: m((w) => w.kern), fassung: m((w) => w.fassung),
    anteil: m((w) => w.kern / (w.kern + 2 * w.fassung)),
    satt: m((w) => w.satt), rgb: [0, 1, 2].map((i) => Math.round(m((w) => w.rgb[i]))) };
});

console.log('Karte                 Kanten   Lauf  Fassung   Anteil   Farbe           Saettigung');
console.log('                               in % der Kantenlaenge');
for (const k of [...karten].sort((a, b) => b.anteil - a.anteil)) {
  console.log(`${k.id.padEnd(21)} ${String(k.kanten).padStart(4)}   `
    + `${k.lauf.toFixed(1).padStart(5)}  ${k.fassung.toFixed(1).padStart(5)}    `
    + `${(k.anteil * 100).toFixed(0).padStart(3)} %   ${String(k.rgb).padEnd(15)}`
    + ` ${(k.satt * 100).toFixed(0).padStart(4)} %`);
}

const spanne = (feld, faktor = 1) => {
  const s = [...karten].sort((a, b) => a[feld] - b[feld]);
  const lo = s[0], hi = s[s.length - 1];
  console.log(`  ${feld.padEnd(9)} ${(lo[feld] * faktor).toFixed(1)} % (${lo.id})`
    + ` bis ${(hi[feld] * faktor).toFixed(1)} % (${hi.id})`);
};
console.log('\nSpanne ueber alle Karten:');
spanne('lauf');
spanne('fassung');
spanne('anteil', 100);
spanne('satt', 100);

// Gruppieren nach Ornamentdichte. Die Spanne ist das Ergebnis, nicht eine
// Grenze: laeuft der Anteil stufenlos durch, gibt es keine zwei Lieferungen,
// sondern gar keine Vorgabe.
const s2 = [...karten].sort((a, b) => b.anteil - a.anteil);
console.log(`\nDer helle Lauf macht zwischen ${(s2[0].anteil * 100).toFixed(0)} % `
  + `(${s2[0].id}) und ${(s2[s2.length - 1].anteil * 100).toFixed(0)} % `
  + `(${s2[s2.length - 1].id}) des Bandes aus.`);
console.log('Der Randvertrag sagt dazu nichts – er regelt Lage und Bandbreite.');
console.log('\nDie am staerksten ornamentierten Wege (Lauf unter 40 % des Bandes):');
for (const k of s2.filter((k2) => k2.anteil < 0.40)) {
  console.log(`    ${k.id.padEnd(21)} ${(k.anteil * 100).toFixed(0).padStart(3)} %`
    + `   Lauf ${k.lauf.toFixed(1)} %, Fassung ${k.fassung.toFixed(1)} % je Seite`);
}
console.log('\nDie hellsten und die waermsten Wege:');
const s3 = [...karten].sort((a, b) => a.satt - b.satt);
console.log(`    Elfenbein: ${s3.slice(0, 4).map((k) => `${k.id} ${(k.satt * 100).toFixed(0)} %`).join(', ')}`);
console.log(`    Creme:     ${s3.slice(-4).reverse().map((k) => `${k.id} ${(k.satt * 100).toFixed(0)} %`).join(', ')}`);
