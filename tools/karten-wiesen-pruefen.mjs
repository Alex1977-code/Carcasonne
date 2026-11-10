/**
 * Gemalte Karten gegen die Motivdaten: hängen die Wiesen im Bild so
 * zusammen, wie die Regeln es sehen – und steht jeder Setzpunkt auf dem
 * Gebiet, zu dem er gehört?
 *
 *   node tools/karten-wiesen-pruefen.mjs            # alle gemalten Karten
 *   node tools/karten-wiesen-pruefen.mjs G H        # einzelne
 *   node tools/karten-wiesen-pruefen.mjs -v A B     # jeden Setzpunkt zeigen
 *
 * Warum es dieses Werkzeug gibt: `karten-pruefen.mjs` vergleicht die
 * **Kantenfolge** einer Karte mit ihrem Motiv, notfalls gedreht. G (eine
 * Stadt von Nord nach Süd) und H (zwei getrennte Stadtkappen) haben
 * dieselbe Kantenfolge, nur um neunzig Grad versetzt. Die beiden Bilder
 * waren vertauscht, und die Kantenprüfung meldete beide als richtig.
 *
 * Im Spiel hieß das: H, dreimal im Stapel, zeigte ein durchgehendes
 * Stadtband, während die Regeln zwei Kappen sahen. Wer eine Kappe schloss,
 * bekam Punkte, und die gemalte Stadt lief sichtbar weiter. Gemeldet wurde
 * das zweimal – „Punkte, obwohl die Stadt offen ist" –, und beide Male habe
 * ich es nicht gefunden, weil ich in den Regeln gesucht habe und nicht im
 * Bild.
 *
 * Was eine Kantenprüfung nicht sehen kann, ist das **Innere** der Karte.
 * Deshalb hier:
 *
 *   Wiesen. Grün wird geflutet; zwei Halbkanten gehören im Bild zur selben
 *   Wiese, wenn zwischen ihnen ein grüner Weg liegt. Verglichen wird mit
 *   `field.h` aus den Motivdaten. Eine Stadt, die im Bild durchgeht, in
 *   den Daten aber nicht (oder umgekehrt), fällt hier auf, weil sie die
 *   Wiesen anders teilt.
 *
 *   Setzpunkte. Unter dem Punkt einer Straße muss Fahrbahn liegen, unter
 *   dem einer Wiese Grün, unter dem einer Stadt Gold. Auf O und P stand
 *   der Wegelagerer zu 0 % auf der Straße und der Bauer zu 63 %.
 *
 * Bekannte Abweichungen stehen unten mit Begründung. Alles andere geht
 * mit Rückgabewert 1 raus.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
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

// Im Bild anders als in den Daten, und das ist hingenommen – mit Grund.
const BEKANNT = {
  O: 'Der Streifen zwischen Stadtmauer und Straße ist im Bild in der Mitte abgeschnürt; nach den Regeln ist er eine Wiese.',
  P: 'Wie O.',
  EC_MON_ROAD2: 'Die Klostermauer ist ein Goldband von sieben Pixeln. Die Weitung, die Ornamentranken überbrückt, überbrückt auch sie, und der begrünte Klosterhof verbindet dann beide Seiten. Nach den Regeln trennen Kloster und die beiden Wegenden die Wiese in zwei.',
};

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const nur = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ausfuehrlich = process.argv.includes('-v');
const WEITE = Number((process.argv.find((a) => a.startsWith('--weite=')) || '').split('=')[1]) || 6;

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);

const bericht = await page.evaluate(async ({ nur, WEITE }) => {
  const { DEFS } = await import('/js/engine/tiles.js');
  const { GEMALT } = await import('/js/ui/render/paintings.js');
  const N = 200;
  // Messpunkte der acht Halbkanten: ein Viertel bzw. drei Viertel entlang
  // der Kante, 4 % nach innen. Reihenfolge wie in tiles.js.
  const T = 0.04;
  const HP = [[0.25, T], [0.75, T], [1 - T, 0.25], [1 - T, 0.75],
              [0.75, 1 - T], [0.25, 1 - T], [T, 0.75], [T, 0.25]];
  const aus = [];

  for (const id of GEMALT) {
    if (nur.length && !nur.includes(id)) continue;
    const img = new Image();
    img.src = `/grafik/karten/${id}.webp`;
    try { await img.decode(); } catch { aus.push({ id, fehlt: true }); continue; }
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, N, N);
    const px = g.getImageData(0, 0, N, N).data;

    const gruen = new Uint8Array(N * N);
    const art = new Uint8Array(N * N);       // 0 Gold/Stadt, 1 Wiese, 2 Weg, 3 Wasser
    for (let i = 0; i < N * N; i++) {
      const r = px[4 * i], gg = px[4 * i + 1], b = px[4 * i + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const sat = mx ? (mx - mn) / mx : 0;
      const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      if (gg > r * 1.12 && gg > b * 1.12) { gruen[i] = 1; art[i] = 1; }
      else if (b > r * 1.15 && b > gg * 0.95) art[i] = 3;
      else if (lum > 150 && sat < 0.38) art[i] = 2;
    }
    // Ornamentlinien überbrücken: Grün um R Pixel aufweiten. Ein Weg ist
    // rund 20 px breit und bleibt eine Trennung, eine Goldranke von 3 px
    // nicht.
    const R = WEITE;
    const weit = gruen.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (gruen[y * N + x]) continue;
      let treffer = 0;
      for (let dy = -R; dy <= R && !treffer; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && gruen[ny * N + nx]) { treffer = 1; break; }
      }
      weit[y * N + x] = treffer;
    }
    // Zusammenhang
    const lab = new Int32Array(N * N).fill(-1);
    let nl = 0;
    for (let s = 0; s < N * N; s++) {
      if (!weit[s] || lab[s] >= 0) continue;
      const st = [s]; lab[s] = nl;
      while (st.length) {
        const p = st.pop(), x = p % N, y = (p / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const q = ny * N + nx;
          if (weit[q] && lab[q] < 0) { lab[q] = nl; st.push(q); }
        }
      }
      nl++;
    }
    const an = (h) => {
      const cx = Math.round(HP[h][0] * (N - 1)), cy = Math.round(HP[h][1] * (N - 1));
      const z = new Map();
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const l = lab[y * N + x];
        if (l >= 0) z.set(l, (z.get(l) || 0) + 1);
      }
      let best = -1, bn = 0;
      for (const [l, n] of z) if (n > bn) { bn = n; best = l; }
      return best;
    };

    const d = DEFS[id];
    const wieseVon = new Array(8).fill(-1);
    d.f.forEach((f, fi) => { if (f.t === 'field') for (const h of f.h) wieseVon[h] = fi; });
    const teil = wieseVon.map((f, h) => (f >= 0 ? an(h) : -2));
    const wiesen = new Set();
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
      if (wieseVon[a] < 0 || wieseVon[b] < 0) continue;
      if (teil[a] < 0 || teil[b] < 0) {
        wiesen.add(`Halbkante ${teil[a] < 0 ? a : b}: kein Grün am Messpunkt`);
        continue;
      }
      const daten = wieseVon[a] === wieseVon[b], bild = teil[a] === teil[b];
      if (daten !== bild) {
        wiesen.add(`Halbkanten ${a}/${b}: Daten ${daten ? 'eine Wiese' : 'getrennt'}, Bild ${bild ? 'verbunden' : 'getrennt'}`);
      }
    }

    // Setzpunkte: was liegt unter dem Punkt?
    const punkte = [];
    const SOLL = { field: 1, road: 2, city: 0 };
    d.f.forEach((f, fi) => {
      if (!f.spot || !(f.t in SOLL)) return;
      const cx = Math.round(f.spot[0] * (N - 1)), cy = Math.round(f.spot[1] * (N - 1));
      const z = [0, 0, 0, 0]; let n = 0;
      const RR = 9;
      for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
        if (dx * dx + dy * dy > RR * RR) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        z[art[y * N + x]]++; n++;
      }
      const anteil = z[SOLL[f.t]] / n;
      // Fremdes Gebiet: für die Straße Wiese, für die Wiese Fahrbahn oder
      // Wasser. Gold zählt nicht als fremd – Ornament, Bäume und Häuser
      // sind überall Gold.
      const fremd = f.t === 'road' ? z[1] / n : f.t === 'field' ? (z[2] + z[3]) / n : (z[1] + z[2]) / n;
      // Für eine Wiese gleich den besten Platz suchen: innerhalb derselben
      // zusammenhängenden Wiese der Punkt mit dem meisten Grün unter sich,
      // bei Gleichstand der nächste zum jetzigen. Ein Vorschlag, kein
      // Urteil – ob dort schon ein anderer Setzpunkt steht, sieht er nicht.
      let vorschlag = null;
      if (f.t === 'field') {
        const z2 = new Map();
        for (const h of f.h) { const l = an(h); if (l >= 0) z2.set(l, (z2.get(l) || 0) + 1); }
        let eigen = -1, en = 0;
        for (const [l, k] of z2) if (k > en) { en = k; eigen = l; }
        let best = -1;
        for (let gy = 0.1; gy <= 0.901; gy += 0.02) for (let gx = 0.1; gx <= 0.901; gx += 0.02) {
          const px0 = Math.round(gx * (N - 1)), py0 = Math.round(gy * (N - 1));
          if (lab[py0 * N + px0] !== eigen) continue;
          let gr = 0, m = 0;
          for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
            if (dx * dx + dy * dy > RR * RR) continue;
            const x = px0 + dx, y = py0 + dy;
            if (x < 0 || y < 0 || x >= N || y >= N) continue;
            if (art[y * N + x] === 1) gr++;
            m++;
          }
          const wert = gr / m - 0.15 * Math.hypot(gx - f.spot[0], gy - f.spot[1]);
          if (wert > best) { best = wert; vorschlag = { spot: [+gx.toFixed(2), +gy.toFixed(2)], anteil: gr / m }; }
        }
      }
      punkte.push({ fi, t: f.t, spot: f.spot, anteil, fremd, vorschlag });
    });

    aus.push({ id, kanten: d.edges, wiesen: [...wiesen], punkte });
  }
  return aus;
}, { nur, WEITE });

await browser.close();
server.close();

const NAME = { field: 'Wiese', road: 'Straße', city: 'Stadt' };
let fehler = 0, bekannt = 0, karten = 0;
for (const k of bericht) {
  karten++;
  if (k.fehlt) { fehler++; console.log(`${k.id}   ✗ Bild fehlt`); continue; }
  const zeilen = [];
  if (k.wiesen.length) {
    if (BEKANNT[k.id]) { bekannt++; zeilen.push(`   ~ Wiesen weichen ab (bekannt): ${BEKANNT[k.id]}`); }
    else { fehler++; for (const w of k.wiesen.slice(0, 6)) zeilen.push(`   ✗ ${w}`); }
  }
  for (const p of k.punkte) {
    // Beanstandet wird nur der klare Fall: der Punkt steht überwiegend auf
    // fremdem Gebiet. Ein Punkt auf einem gemalten Kornfeld oder Baum hat
    // wenig Grün unter sich und steht trotzdem richtig.
    if (p.fremd > 0.4) {
      fehler++;
      zeilen.push(`   ✗ Setzpunkt ${NAME[p.t]} (Segment ${p.fi}) bei [${p.spot}]`
        + ` steht zu ${(p.fremd * 100).toFixed(0)} % auf fremdem Gebiet`
        + (p.vorschlag ? ` – besser [${p.vorschlag.spot}], dort ${(p.vorschlag.anteil * 100).toFixed(0)} % Grün` : ''));
    } else if (ausfuehrlich) {
      zeilen.push(`   · ${NAME[p.t]} (Segment ${p.fi}) bei [${p.spot}]: ${(p.anteil * 100).toFixed(0)} % eigenes,`
        + ` ${(p.fremd * 100).toFixed(0)} % fremdes Gebiet`
        + (p.vorschlag && p.vorschlag.anteil > p.anteil + 0.15
          ? ` – mehr Grün bei [${p.vorschlag.spot}] (${(p.vorschlag.anteil * 100).toFixed(0)} %)` : ''));
    }
  }
  if (zeilen.length) { console.log(`${k.id}  (${k.kanten})`); for (const z of zeilen) console.log(z); }
}
console.log(`\n${karten} gemalte Karten geprüft, ${fehler} Beanstandung${fehler === 1 ? '' : 'en'}`
  + (bekannt ? `, ${bekannt} bekannte Abweichung${bekannt === 1 ? '' : 'en'}` : '') + '.');
process.exit(fehler ? 1 : 0);
