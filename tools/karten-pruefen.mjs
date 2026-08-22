/**
 * Einzelne Kartenbilder messen, bevor sie übernommen werden.
 *
 *   node tools/karten-pruefen.mjs grafik/U_strasse-gerade.png
 *   node tools/karten-pruefen.mjs grafik/*.png
 *   node tools/karten-pruefen.mjs bild.png EC_CATH        (Motiv erzwingen)
 *
 * Das Gegenstück zu tools/bogen-pruefen.mjs: dort ein Bogen mit vier
 * Karten im 2×2-Raster, hier ein Bild je Karte. Das Motiv wird aus dem
 * Dateinamen gelesen – „U_strasse-gerade.png" ergibt U, „EC_CATH.png"
 * ergibt EC_CATH.
 *
 * Gemessen wird je Kante:
 *   – ob dort Stadt, Weg, Fluss oder Wiese liegt, und ob das zur
 *     Kantenfolge des Motivs passt (notfalls gedreht)
 *   – bei Weg und Fluss die Lage der Mitte und zwei Breiten: der helle
 *     Kern und das ganze Band einschließlich Goldfassung. Beide zählen –
 *     stimmt nur der Kern, springt an der Naht die Fassung; stimmt nur
 *     das Band, springt der Kern.
 *
 * Sollwerte, aus den Bögen 01–05 gemessen:
 *   Weg    Mitte 50 %, Kern 10,3–11 %, Band 15–16 %
 *   Fluss  Mitte 50 %, Kern 18–19 %
 *   Stadt  volle Kante
 *
 * Dazu drei Stilzahlen je Karte, damit die Bögen zueinander passen:
 * mittleres Wiesengrün, Rankendichte und Wiesenanteil. Die Bögen 01–05
 * liegen bei Grün 33–46/66–86/16–33 und Rankendichte 38–76 %.
 *
 * Beanstandungen gehen mit Rückgabewert 1 raus.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, resolve, basename } from 'node:path';

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
  DEFS[m[1]] = { anzahl: +m[2], satz: m[3], kanten: m[4] };
}
const dreh = (k, n) => (n ? k.slice(-n) + k.slice(0, -n) : k);

/** Motiv aus dem Dateinamen: erst der ganze Name, dann immer kürzere Präfixe. */
function motivAus(datei) {
  const roh = basename(datei).replace(/\.[^.]+$/, '');
  const teile = roh.split('_');
  for (let n = teile.length; n >= 1; n--) {
    const kandidat = teile.slice(0, n).join('_').toUpperCase();
    if (DEFS[kandidat]) return kandidat;
  }
  return null;
}

const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!argv.length) {
  console.error('Aufruf: node tools/karten-pruefen.mjs <bild.png> [Motiv] ...');
  process.exit(1);
}
// Paare bilden: Datei, dahinter wahlweise ein erzwungenes Motiv.
const auftrag = [];
for (let i = 0; i < argv.length; i++) {
  if (DEFS[argv[i].toUpperCase()] && auftrag.length) {
    auftrag[auftrag.length - 1].motiv = argv[i].toUpperCase();
    continue;
  }
  auftrag.push({ datei: resolve(argv[i]), motiv: motivAus(argv[i]) });
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

const messung = await page.evaluate(async (anzahl) => {
  const out = [];
  for (let nr = 0; nr < anzahl; nr++) {
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

    const cls = (x, y) => {
      const i = at(x, y);
      const r = px[i], gg = px[i + 1], bb = px[i + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      const sat = mx ? (mx - mn) / mx : 0, v = mx / 255;
      if (bb > r + 25 && bb > gg + 10) return 'F';        // Fluss: blau
      // Weg: hell und nicht satt. Die Schwelle liegt bei 0,45 und nicht
      // bei 0,32 wie in bogen-pruefen.mjs: auf den Bögen 01–05 ist der Weg
      // fast weißes Elfenbein (Sättigung 0,15), auf neueren Lieferungen
      // eher warmes Creme (0,28 bis 0,41). Mit 0,32 kippt so ein Weg
      // stellenweise nach Stadt, und dann meldet das Werkzeug „kein Weg an
      // der Kante", obwohl er dort tadellos sitzt. Stadtgold liegt deutlich
      // darüber, bei 0,55 und mehr.
      if (v > 0.72 && sat < 0.45) return 'R';
      if (gg >= r && gg > bb && sat > 0.25) return 'w';   // Wiese: grün
      if (r > gg && gg > bb && sat > 0.30) return 'C';    // Stadt: gold
      return '?';
    };

    // Auf mehreren Tiefen abtasten und den Mittelwert nehmen.
    //
    // Eine einzelne Tiefe reicht nicht. Auf sechs Karten – L, O, P, W,
    // RV_CITY2, EC_INN_STRAIGHT – liegt bei 3 % ein dunkler Schattenstreifen;
    // dort kippt der Weg stellenweise nach Stadt, und das Werkzeug meldete
    // eine falsche Kantenfolge, obwohl der Weg bei 1 % und bei 5 % tadellos
    // sitzt. Über sieben Tiefen gemessen stimmen 45 von 46 Kantenfolgen; die
    // sechs Fehlmeldungen sind weg.
    const TIEFEN = [0.010, 0.015, 0.020, 0.025, 0.030, 0.035, 0.040];
    const median = (a) => {
      const b = [...a].sort((x, y) => x - y);
      return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
    };
    const kanten = [], uebergaenge = [];
    for (const seite of [0, 1, 2, 3]) {
      const proTiefe = TIEFEN.map((t) => {
        const ein = N * t, arr = [];
        for (let k = 0; k <= 400; k++) {
          const u = (k / 400) * (N - 1);
          let x, y;
          if (seite === 0) { x = u; y = ein; }
          if (seite === 1) { x = N - 1 - ein; y = u; }
          if (seite === 2) { x = u; y = N - 1 - ein; }
          if (seite === 3) { x = ein; y = u; }
          arr.push(cls(x, y));
        }
        return arr;
      });
      // Kantenart je Tiefe bestimmen, dann die häufigste nehmen.
      const stimmen = proTiefe.map((arr) => {
        const zahl = (k) => arr.filter((a) => a === k).length;
        const mitte = arr.slice(160, 241);
        const zm = (k) => mitte.filter((a) => a === k).length;
        return zahl('C') >= 264 ? 'C' : zm('F') >= 25 ? 'W' : zm('R') >= 25 ? 'R' : 'F';
      });
      // Für die Kantenart zählen die flachen Tiefen. Was an der Kante liegt,
      // entscheidet sich an der Kante – weiter innen fängt das Innenleben des
      // Bauteils an. Bei RV_CITY2 ist die Westkante bis 2 % durchgehend
      // Stadtmauer und zerfällt dahinter in weiße Häuser; über alle sieben
      // Tiefen gemittelt käme dort Wiese heraus, und die Karte wäre zu
      // Unrecht beanstandet.
      const zaehler = {};
      stimmen.slice(0, 3).forEach((v) => { zaehler[v] = (zaehler[v] || 0) + 1; });
      kanten.push(Object.keys(zaehler).sort((a, b) => zaehler[b] - zaehler[a])[0]);
      const arr = proTiefe[3];   // mittlere Tiefe, um die Läufe zu finden

      // Nur das messen, was an dieser Kante laut Kantenfolge liegt. Sonst
      // meldet das Werkzeug die steinernen Ufer eines Flusses als Weg und
      // das Stadtgold ebenfalls – beides sind keine Wege, und beides würde
      // als Beanstandung durchgehen.
      const erwartet = kanten[seite] === 'R' ? ['R'] : kanten[seite] === 'W' ? ['F'] : [];
      for (const art of erwartet) {
        // Läufe sammeln und dicht beieinanderliegende zusammenfassen. Der
        // helle Kern eines Weges ist auf neueren Karten von Goldornament
        // durchsetzt und zerfällt dadurch in Bruchstücke; jedes einzeln
        // gemeldet, ergäbe das drei zu schmale Wege statt eines richtigen,
        // und die Lage der Mitte wäre die eines Bruchstücks.
        const laeufe = [];
        let st = -1;
        for (let k = 0; k <= arr.length; k++) {
          if (k < arr.length && arr[k] === art) { if (st < 0) st = k; }
          else if (st >= 0) { laeufe.push([st, k]); st = -1; }
        }
        // Beim Fluss dürfen die Bruchstücke weiter auseinanderliegen: die
        // silbernen Wellenlinien zerschneiden das Blau in Streifen, die
        // breiter sind als die zwei Prozent, die für einen Weg reichen.
        const LUECKE = art === 'F' ? 7.0 : 2.0;
        const gefasst = [];
        for (const l of laeufe) {
          const vor = gefasst[gefasst.length - 1];
          if (vor && (l[0] - vor[1]) / 400 * 100 <= LUECKE) vor[1] = l[1];
          else gefasst.push([...l]);
        }
        // Der Lauf, der die Kantenmitte enthält, ist der gesuchte. Ohne
        // diese Vorgabe nimmt die Messung den breitesten – und auf
        // RV_CITY2 sind das die blauen Ziegeldächer der Stadt, die der
        // Klassifikator für Wasser hält. Gemeldet wurde dann ein Fluss bei
        // 15,5 % der Kante, den es dort gar nicht gibt.
        const mittig = gefasst.filter((l) => l[0] <= 200 && l[1] >= 200);
        const kandidaten = mittig.length ? mittig : gefasst;
        for (const [a, b] of kandidaten) {
          const kern = ((b - a) / 400) * 100;
          if (kern <= 4) continue;
          // Das ganze Band: von der Kernmitte nach außen, solange keine
          // Wiese kommt. Das schließt die Goldfassung mit ein.
          const mid = Math.round((a + b) / 2);
          let li = a, re = b - 1;
          while (li > 0 && arr[li - 1] !== 'w') li--;
          while (re < 400 && arr[re + 1] !== 'w') re++;
          const band = ((re - li + 1) / 400) * 100;
          // Für die Lage zählt beim Weg das Band, nicht der Kern: das Band ist
          // die Grenze gegen die Wiese, und die muss an der Naht
          // zusammenpassen. Beim Fluss zählt das Wasser (siehe unten).
          const m = art === 'F'
            ? (((a + b) / 2) / 400) * 100
            : (((li + re + 1) / 2) / 400) * 100;
          if (uebergaenge.some((u) => u.seite === 'NOSW'[seite] && u.art === art &&
              Math.abs(u.mitte - m) < 1)) continue;
          // Lage und Breiten über alle Tiefen mitteln: ein einzelner
          // Schattenstreifen verschiebt die Messung sonst um mehr als das,
          // was der Randvertrag zulässt.
          const mAlle = [], kAlle = [], bAlle = [];
          const spalt = Math.round((LUECKE / 100) * 400);
          for (const arr2 of proTiefe) {
            // Vom Mittelpunkt nach außen, und dabei dieselben Lücken
            // überbrücken wie oben. Ohne das wird der Fluss viel zu schmal
            // gemessen: die silbernen Wellenlinien schneiden das Blau in
            // Streifen, und ein Lauf, der stur an der ersten Linie endet,
            // ergibt 5 % statt 18 %. Gemeldet wurde dann „Fluss zu schmal"
            // für einen Fluss, der die richtige Breite hat.
            const weiter = (von, richtung) => {
              let k = von;
              for (;;) {
                let p = k + richtung, lug = 0;
                while (p >= 0 && p <= 400 && arr2[p] !== art && lug < spalt) { p += richtung; lug++; }
                if (p < 0 || p > 400 || arr2[p] !== art) return k;
                k = p;
              }
            };
            // Der Mittelpunkt der mittleren Tiefe muss auf dieser Tiefe nicht
            // getroffen sein – bei angeschnittenem Ornament weicht er ein
            // paar Punkte ab. Innerhalb einer Lückenbreite gilt er noch.
            let anker = -1;
            for (let d = 0; d <= spalt && anker < 0; d++) {
              if (arr2[mid + d] === art) anker = mid + d;
              else if (arr2[mid - d] === art) anker = mid - d;
            }
            if (anker < 0) continue;
            const lo = weiter(anker, -1), ro = weiter(anker, +1);
            let lb = lo, rb = ro;
            while (lb > 0 && arr2[lb - 1] !== 'w') lb--;
            while (rb < 400 && arr2[rb + 1] !== 'w') rb++;
            kAlle.push(((ro - lo + 1) / 400) * 100);
            bAlle.push(((rb - lb + 1) / 400) * 100);
            // Wo die Mitte sitzt, entscheidet beim Weg das Band – es ist die
            // Grenze gegen die Wiese, und die muss an der Naht zusammenpassen.
            // Beim Fluss zählt das Wasser: seine steinernen Ufer sind
            // unterschiedlich breit und lassen die Bandmitte um mehrere
            // Prozent wandern, ohne dass die Karte deshalb schlechter passt.
            mAlle.push(art === 'F'
              ? (((lo + ro + 1) / 2) / 400) * 100
              : (((lb + rb + 1) / 2) / 400) * 100);
          }
          uebergaenge.push({ seite: 'NOSW'[seite], art,
            kern: kAlle.length ? median(kAlle) : kern,
            band: bAlle.length ? median(bAlle) : band,
            mitte: mAlle.length ? median(mAlle) : m });
        }
      }
    }

    // Stilzahlen über die Wiesenfläche
    let nW = 0, sr = 0, sg = 0, sb = 0, nGold = 0, nBoden = 0;
    for (let y = 2; y < N - 2; y += 2) {
      for (let x = 2; x < N - 2; x += 2) {
        const i = at(x, y), r = px[i], gg = px[i + 1], bb = px[i + 2];
        const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
        const sat = mx ? (mx - mn) / mx : 0;
        const gruen = gg >= r && gg > bb && sat > 0.25;
        const gold = r > 140 && gg > 95 && bb < 140 && r > bb + 45;
        if (gruen) { nW++; sr += r; sg += gg; sb += bb; }
        if (gruen || gold) { nBoden++; if (gold) nGold++; }
      }
    }
    out.push({
      N, kanten: kanten.join(''), uebergaenge,
      wiese: nW / ((N / 2) * (N / 2)),
      rgb: nW ? [sr / nW, sg / nW, sb / nW].map(Math.round) : [0, 0, 0],
      ranken: nBoden ? nGold / nBoden : 0,
    });
  }
  return out;
}, auftrag.length);

await browser.close();
server.close();

let fehler = 0, warnung = 0;
for (let i = 0; i < auftrag.length; i++) {
  const a = auftrag[i], k = messung[i];
  let kopf = `${basename(a.datei).padEnd(28)} ${String(k.N).padStart(4)}px  Kanten ${k.kanten}`;
  if (!a.motiv) {
    kopf += '   ✗ kein Motiv im Dateinamen erkannt';
    fehler++;
  } else {
    const want = DEFS[a.motiv].kanten;
    const n = [0, 1, 2, 3].find((d) => dreh(k.kanten, d) === want);
    if (n === 0) kopf += `   ✓ ${a.motiv}`;
    else if (n !== undefined) kopf += `   ✓ ${a.motiv}, um ${n} gedreht ("dreh": ${n})`;
    else {
      const kand = Object.keys(DEFS).filter((d) =>
        [0, 1, 2, 3].some((x) => dreh(k.kanten, x) === DEFS[d].kanten));
      kopf += `   ✗ nicht ${a.motiv} (soll ${want})` +
        (kand.length ? ` – wäre ${kand.join('/')}` : ' – kein gültiges Motiv');
      fehler++;
    }
  }
  console.log(kopf);

  for (const u of k.uebergaenge) {
    const istWeg = u.art === 'R';
    const dm = Math.abs(u.mitte - 50);
    // Hart ist, was die Karte unbrauchbar macht: die Lage der Grenze gegen
    // die Wiese und ihre Breite. Daran hängt, ob zwei Karten an der Naht
    // zusammenpassen. Ein schmaler heller Kern ist dagegen Geschmackssache –
    // er wird gemeldet, aber nicht beanstandet.
    const anmerkungen = [], hinweise = [];
    if (dm > 1.5) anmerkungen.push(`${dm.toFixed(1)} % aus der Mitte`);
    if (istWeg) {
      if (u.band < 13 || u.band > 18.5) {
        anmerkungen.push(`Band ${u.band < 13 ? 'zu schmal' : 'zu breit'} (soll 15–16 %)`);
      }
      if (u.kern < 8) hinweise.push(`heller Kern nur ${u.kern.toFixed(1)} %, sonst 10,5–11 %`);
    } else if (u.kern < 15 || u.kern > 21) {
      anmerkungen.push(`Fluss ${u.kern < 15 ? 'zu schmal' : 'zu breit'} (soll 18–19 %)`);
    }
    if (anmerkungen.length) fehler++;
    else if (hinweise.length) warnung++;
    console.log(`   ${u.seite}  ${(istWeg ? 'Weg' : 'Fluss').padEnd(6)}` +
      ` Mitte ${u.mitte.toFixed(1).padStart(5)} %  Kern ${u.kern.toFixed(1).padStart(5)} %` +
      `  Band ${u.band.toFixed(1).padStart(5)} %   ` +
      (anmerkungen.length ? `✗ ${anmerkungen.join(', ')}`
        : hinweise.length ? `⚠ ${hinweise.join(', ')}` : '✓'));
  }
  if (!k.uebergaenge.length) console.log('   keine Wege oder Flüsse an den Kanten');

  // Stil nur melden, wenn die Karte überhaupt nennenswert Wiese hat.
  if (k.wiese > 0.12) {
    const [r, g2, b] = k.rgb;
    const schief = r < 28 || r > 52 || g2 < 62 || g2 > 90 || b < 12 || b > 38;
    const duenn = k.ranken < 0.30;
    if (schief || duenn) warnung++;
    console.log(`   Stil  Wiese ${(k.wiese * 100).toFixed(0).padStart(3)} %` +
      `  Grün ${String(k.rgb).padEnd(14)} Ranken ${(k.ranken * 100).toFixed(0).padStart(3)} %` +
      `   ${schief ? '⚠ Grün weicht ab' : duenn ? '⚠ Ranken dünn' : '✓'}`);
  }
}

console.log(fehler
  ? `\n${fehler} Beanstandung${fehler === 1 ? '' : 'en'}` +
    (warnung ? ` und ${warnung} Stilwarnung${warnung === 1 ? '' : 'en'}` : '') +
    ' – vor dem Übernehmen klären.'
  : warnung
    ? `\nRandvertrag eingehalten, aber ${warnung} Stilwarnung${warnung === 1 ? '' : 'en'}.`
    : '\nAlles im Randvertrag und im Stil.');
process.exit(fehler ? 1 : 0);
