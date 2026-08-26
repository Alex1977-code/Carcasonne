/**
 * Den gelieferten Figurenbogen freistellen, einfärben und einbauen.
 *
 *   node tools/figuren-einbauen.mjs grafik/figuren.png [--kontakt]
 *
 * Erzeugt grafik/figuren/<Farbe>.webp – eine Datei je Spielerfarbe, in
 * genau dem Kasten, in dem das Spiel auch die gezeichnete Figur hält
 * (120 Einheiten, Umriss bei 10…110). Dadurch steht die fotografierte
 * Figur an derselben Stelle wie die gezeichnete, und der Wechsel zwischen
 * beiden fällt nicht auf.
 *
 * Drei Dinge werden dabei gerechnet, und alle drei aus einem gemessenen
 * Grund:
 *
 *   Freistellen. Die Lieferung hat keinen Alphakanal – das Schachbrett,
 *   das sonst „durchsichtig" bedeutet, ist als Pixel ins Bild gemalt
 *   (Periode 32 px, gemessen). Es ist streng regelmäßig, wird deshalb aus
 *   dem Bildrand gelernt und überall abgezogen. Ein fester Weißwert würde
 *   die graue Figur mit verschlucken.
 *
 *   Ausmatten. Ein Kantenpixel ist eine Mischung aus Figur und
 *   Hintergrund. Wer es unverändert übernimmt, bekommt einen weißen Saum.
 *   Aus Deckung und bekanntem Hintergrund lässt sich die reine Farbe
 *   zurückrechnen.
 *
 *   Umfärben. Gemessen wich Grün mit ΔE 40 und Violett mit ΔE 18 von der
 *   Palette ab, und die gelieferten Farben hielten untereinander den
 *   Abstand nicht mehr: Rot/Grün nur ΔE 16,7 bei einer Grenze von 25,
 *   Grün auf der Wiese nur ΔE 9,2. Das ist kein Geschmacksurteil – die
 *   Grenzen stehen in CONTRAST_LIMITS und gelten auch für Rot- und
 *   Grünblinde. Behalten wird deshalb nur das Relief der Figur, die Farbe
 *   kommt aus PLAYER_PALETTE. Der Mittelwert wird nachgeregelt, bis er
 *   die Palettenfarbe trifft.
 *
 * Danach prüfen: node tools/figuren-pruefen.mjs grafik/figuren/*.webp
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const argv = process.argv.slice(2);
const kontakt = argv.includes('--kontakt');
const quelle = resolve(argv.find((a) => !a.startsWith('-')) || join(ROOT, 'grafik/figuren.png'));
const ZIEL = join(ROOT, 'grafik/figuren');

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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForTimeout(300);

const ergebnis = await page.evaluate(async ({ kontakt }) => {
  const { MEEPLE_PATH } = await import('/js/ui/render.js');
  const { PLAYER_PALETTE } = await import('/js/ui/render/meeple-colors.js');
  const { deltaE } = await import('/js/ui/render/palette.js');

  // Der Kasten, in dem die Datei liegt. Der Umriss des Spiels (0…100) sitzt
  // darin bei PFAD_RAND…PFAD_RAND+100 – dieselbe Verabredung wie bei der
  // gezeichneten Figur, nur mit mehr Luft: die Scheibe ragt nach rechts und
  // unten über die Vorderfläche hinaus, gemessen um gut ein Achtel der Höhe.
  // Mit dem Rand 10 der gezeichneten Figur wurden die Füße abgeschnitten.
  const KASTEN = 140, PFAD_RAND = 20, PX = 336;

  const img = new Image();
  img.src = '/quelle';
  await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const at = (x, y) => (y * W + x) << 2;

  // ---------------------------------------------------- Hintergrundmodell
  let periode = 0, bestFehler = Infinity;
  for (let p = 4; p <= 120; p++) {
    let s = 0, n = 0;
    for (let x = 0; x + p < W; x += 5) { s += Math.abs(px[at(x, 2)] - px[at(x + p, 2)]); n++; }
    if (s / n < bestFehler - 0.05) { bestFehler = s / n; periode = p; }
  }
  const felder = new Map();
  const randZeilen = [];
  for (let y = 0; y < 8; y++) randZeilen.push(y, H - 1 - y);
  for (const y of randZeilen) {
    for (let x = 0; x < W; x++) {
      const k = `${Math.floor(x / periode) % 2},${Math.floor(y / periode) % 2}`;
      const e = felder.get(k) || { r: 0, g: 0, b: 0, n: 0 };
      const i = at(x, y);
      e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2]; e.n++;
      felder.set(k, e);
    }
  }
  const grund = (x, y) => {
    const e = felder.get(`${Math.floor(x / periode) % 2},${Math.floor(y / periode) % 2}`);
    return e ? [e.r / e.n, e.g / e.n, e.b / e.n] : [255, 255, 255];
  };

  // ---------------------------------------------------- Deckung je Pixel
  // Weicher Übergang statt harter Schwelle: unter WEICH_AUS ist es
  // Hintergrund, über WEICH_AN volle Figur, dazwischen anteilig. Ohne das
  // bekommt jede Figur eine Treppe am Rand.
  const WEICH_AUS = 6, WEICH_AN = 26;
  const deckung = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      const [br, bg, bb] = grund(x, y);
      const d = Math.max(Math.abs(px[i] - br), Math.abs(px[i + 1] - bg), Math.abs(px[i + 2] - bb));
      deckung[y * W + x] = Math.max(0, Math.min(1, (d - WEICH_AUS) / (WEICH_AN - WEICH_AUS)));
    }
  }
  // Löcher füllen: vom Bildrand durch den freien Grund fluten. Gesperrt
  // wird erst ab halber Deckung, nicht schon bei einer Spur.
  //
  // Vorher stand hier 0,02, und das war falsch: unter den Figuren liegt ein
  // schwacher Schatten, der diese Schwelle knapp überschreitet. Er bildete
  // eine Sperre quer über das Bild, die Flut kam von unten nicht mehr durch,
  // und alles darüber galt als Loch in der Figur. Die Ausschnitte reichten
  // dadurch bis zur Bildunterkante – gemessen y 242…819 statt 242…564.
  const aussen = new Uint8Array(W * H);
  const stapel = [];
  for (let x = 0; x < W; x++) stapel.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stapel.push(0, y, W - 1, y);
  while (stapel.length) {
    const y = stapel.pop(), x = stapel.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const k = y * W + x;
    if (aussen[k] || deckung[k] > 0.5) continue;
    aussen[k] = 1;
    stapel.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  for (let k = 0; k < deckung.length; k++) if (!aussen[k] && deckung[k] < 1) deckung[k] = 1;

  // ---------------------------------------------------- Figuren trennen
  const spaltenVoll = new Int32Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (deckung[y * W + x] > 0.5) spaltenVoll[x]++;
  }
  const gruppen = [];
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const voll = x < W && spaltenVoll[x] > 2;
    if (voll && start < 0) start = x;
    if (!voll && start >= 0) {
      if (x - start > W / 40) gruppen.push([start, x - 1]);
      start = -1;
    }
  }

  const bericht = [];
  const dateien = [];
  const kontaktTeile = [];

  for (let gi = 0; gi < gruppen.length; gi++) {
    const eintrag = PLAYER_PALETTE[gi];
    if (!eintrag) break;
    const ziel = eintrag.hex;
    const [x0, x1] = gruppen[gi];
    let y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = x0; x <= x1; x++) {
        if (deckung[y * W + x] <= 0.5) continue;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

    // ------------------------------------------ ausmatten und Relief messen
    // Kantenpixel = Figur·a + Grund·(1−a). Nach der Figurfarbe aufgelöst.
    const roh = new Float32Array(bw * bh * 4);
    let ySum = 0, yN = 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const a = deckung[(y0 + y) * W + (x0 + x)];
        const i = at(x0 + x, y0 + y);
        const k = (y * bw + x) * 4;
        if (a <= 0) { roh[k + 3] = 0; continue; }
        const [br, bg, bb] = grund(x0 + x, y0 + y);
        const f = Math.max(a, 0.25);          // unter 25 % wird die Rechnung wild
        roh[k] = Math.max(0, Math.min(255, (px[i] - br * (1 - f)) / f));
        roh[k + 1] = Math.max(0, Math.min(255, (px[i + 1] - bg * (1 - f)) / f));
        roh[k + 2] = Math.max(0, Math.min(255, (px[i + 2] - bb * (1 - f)) / f));
        roh[k + 3] = a;
        if (a > 0.98) {
          ySum += roh[k] * 0.2126 + roh[k + 1] * 0.7152 + roh[k + 2] * 0.0722;
          yN++;
        }
      }
    }
    const yMittel = ySum / yN;

    // Hellster Ausschlag (98. Perzentil), damit ein einzelner Blitz nicht
    // die ganze Kennlinie bestimmt.
    const helle = [];
    for (let k = 0; k < roh.length; k += 4) {
      if (roh[k + 3] > 0.98) {
        helle.push(roh[k] * 0.2126 + roh[k + 1] * 0.7152 + roh[k + 2] * 0.0722);
      }
    }
    helle.sort((a, b) => a - b);
    const yOben = helle[Math.floor(helle.length * 0.98)] || yMittel * 1.5;
    const fMax = Math.max(1.05, yOben / yMittel);

    const zr = parseInt(ziel.slice(1, 3), 16);
    const zg = parseInt(ziel.slice(3, 5), 16);
    const zb = parseInt(ziel.slice(5, 7), 16);

    // Kennlinie: unter dem Mittel abdunkeln, darüber gegen Weiß laufen.
    // Anschließend wird der Mittelwert nachgeregelt, bis er sitzt.
    let gain = [1, 1, 1];
    const bild = new Uint8ClampedArray(bw * bh * 4);
    const malen = () => {
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let k = 0; k < roh.length; k += 4) {
        const a = roh[k + 3];
        if (a <= 0) { bild[k + 3] = 0; continue; }
        const yv = roh[k] * 0.2126 + roh[k + 1] * 0.7152 + roh[k + 2] * 0.0722;
        const f = yv / yMittel;
        let r, gg, b;
        if (f <= 1) { r = zr * f; gg = zg * f; b = zb * f; }
        else {
          const t = Math.min(1, (f - 1) / (fMax - 1)) * 0.85;
          r = zr + (255 - zr) * t; gg = zg + (255 - zg) * t; b = zb + (255 - zb) * t;
        }
        r *= gain[0]; gg *= gain[1]; b *= gain[2];
        bild[k] = r; bild[k + 1] = gg; bild[k + 2] = b;
        bild[k + 3] = Math.round(a * 255);
        if (a > 0.98) { sr += bild[k]; sg += bild[k + 1]; sb += bild[k + 2]; n++; }
      }
      return [sr / n, sg / n, sb / n];
    };
    let mittel = malen();
    for (let runde = 0; runde < 4; runde++) {
      gain = [gain[0] * (zr / Math.max(1, mittel[0])),
              gain[1] * (zg / Math.max(1, mittel[1])),
              gain[2] * (zb / Math.max(1, mittel[2]))];
      mittel = malen();
    }
    const hex = '#' + mittel.map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('').toUpperCase();

    // ------------------------------------------ Vorderfläche einpassen
    const pw = bw + 40, ph = bh + 40, RAND = 20;
    const pc = document.createElement('canvas');
    pc.width = pw; pc.height = ph;
    const pg = pc.getContext('2d', { willReadFrequently: true });
    let flaeche = 0;
    for (let k = 0; k < roh.length; k += 4) if (roh[k + 3] > 0.5) flaeche++;

    const drin = (skala, dx, dy) => {
      pg.clearRect(0, 0, pw, ph);
      pg.save();
      pg.translate(dx, dy);
      pg.scale(skala, skala);
      pg.fillStyle = '#000';
      pg.fill(MEEPLE_PATH);
      pg.restore();
      const d = pg.getImageData(0, 0, pw, ph).data;
      let innen = 0, aussenP = 0;
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          if (d[((y * pw + x) << 2) + 3] < 200) continue;
          const cx = x - RAND, cy = y - RAND;
          const treffer = cx >= 0 && cy >= 0 && cx < bw && cy < bh
            && roh[(cy * bw + cx) * 4 + 3] > 0.5;
          if (treffer) innen++; else aussenP++;
        }
      }
      return { innen, aussenP, gesamt: innen + aussenP };
    };
    const s0 = bh / 100;
    const liste = (m, spanne, schritt) => {
      const a = [];
      for (let v = m - spanne; v <= m + spanne + 1e-9; v += schritt) a.push(v);
      return a;
    };
    let best = null;
    const suche = (sL, dxL, dyL) => {
      for (const s of sL) for (const dx of dxL) for (const dy of dyL) {
        const r = drin(s, dx, dy);
        if (!r.gesamt || r.aussenP / r.gesamt > 0.02) continue;
        if (!best || r.innen > best.innen) best = { s, dx, dy, ...r };
      }
    };
    suche(liste(s0 * 0.92, s0 * 0.16, s0 * 0.04), liste(RAND, 26, 8), liste(RAND, 26, 8));
    if (best) suche(liste(best.s, s0 * 0.045, s0 * 0.012), liste(best.dx, 8, 3), liste(best.dy, 8, 3));
    if (!best) best = { s: s0, dx: RAND, dy: RAND, innen: flaeche };

    // ------------------------------------------ in den Spielkasten setzen
    // Der Pfadursprung liegt im Ausschnitt bei (dx−RAND, dy−RAND); im
    // Kasten soll er bei (PFAD_RAND, PFAD_RAND) liegen.
    const roh2 = document.createElement('canvas');
    roh2.width = bw; roh2.height = bh;
    roh2.getContext('2d').putImageData(new ImageData(bild, bw, bh), 0, 0);

    const kasten = document.createElement('canvas');
    kasten.width = kasten.height = PX;
    const kg = kasten.getContext('2d');
    const m = PX / KASTEN;
    kg.setTransform(m, 0, 0, m, 0, 0);
    kg.imageSmoothingQuality = 'high';
    const skala = 1 / best.s;
    const ox = PFAD_RAND - (best.dx - RAND) * skala;
    const oy = PFAD_RAND - (best.dy - RAND) * skala;
    kg.translate(ox, oy);
    kg.drawImage(roh2, 0, 0, bw, bh, 0, 0, bw * skala, bh * skala);
    // Stößt die Figur an? Ein abgeschnittener Fuß fällt in der Vorschau
    // kaum auf und im Spiel sofort.
    const raus = [
      -Math.min(0, ox), -Math.min(0, oy),
      Math.max(0, ox + bw * skala - KASTEN), Math.max(0, oy + bh * skala - KASTEN),
    ];
    const anstoss = Math.max(...raus);

    dateien.push({ name: eintrag.name, datei: eintrag.datei,
      datenUrl: kasten.toDataURL('image/webp', 0.94) });
    bericht.push({ name: eintrag.name, ziel, hex, dE: deltaE(hex, ziel),
      x0, x1, y0, y1, bw, bh, skala: best.s, deckt: best.innen / flaeche, anstoss,
      hoehe: bh * skala, breite: bw * skala });
    if (kontakt) kontaktTeile.push(kasten.toDataURL('image/png'));
  }

  let blatt = null;
  if (kontakt) {
    const kc = document.createElement('canvas');
    kc.width = PX * kontaktTeile.length; kc.height = PX;
    const kg = kc.getContext('2d');
    kg.fillStyle = '#6b8e4e';
    kg.fillRect(0, 0, kc.width, kc.height);
    // Der Umriss des Spiels als dünne Linie darüber – so ist zu sehen, ob
    // die Figur im Kasten sitzt.
    for (let i = 0; i < kontaktTeile.length; i++) {
      const im = new Image();
      im.src = kontaktTeile[i];
      await im.decode();
      kg.drawImage(im, i * PX, 0);
      kg.save();
      const m = PX / KASTEN;
      kg.setTransform(m, 0, 0, m, i * PX, 0);
      kg.translate(PFAD_RAND, PFAD_RAND);
      kg.strokeStyle = 'rgba(255,255,255,0.55)';
      kg.lineWidth = 0.7;
      kg.stroke(MEEPLE_PATH);
      kg.restore();
    }
    blatt = kc.toDataURL('image/png');
  }

  return { periode, bericht, dateien, blatt, KASTEN, PFAD_RAND, PX };
}, { kontakt });

await browser.close();
server.close();

mkdirSync(ZIEL, { recursive: true });
console.log(`${basename(quelle)}   Schachbrett Periode ${ergebnis.periode} px`);
let gesamt = 0;
for (const d of ergebnis.dateien) {
  const puffer = Buffer.from(d.datenUrl.split(',')[1], 'base64');
  writeFileSync(join(ZIEL, `${d.datei}.webp`), puffer);
  gesamt += puffer.length;
}
for (const b of ergebnis.bericht) {
  console.log(`   ${b.name.padEnd(9)} ${b.hex}  soll ${b.ziel}  ΔE ${b.dE.toFixed(2).padStart(5)}`
    + `   ${b.dE <= 2 ? '✓' : '✗ Farbe sitzt nicht'}`);
  console.log(`             Ausschnitt ${b.bw}×${b.bh} px   Maßstab ${b.skala.toFixed(2)}`
    + `   Figur ${b.breite.toFixed(0)}×${b.hoehe.toFixed(0)}`
    + `   ${b.anstoss > 0 ? `✗ stößt um ${b.anstoss.toFixed(1)} an` : '✓ im Kasten'}`);
}
console.log(`   ${ergebnis.dateien.length} Dateien nach grafik/figuren/`
  + `  zusammen ${(gesamt / 1024).toFixed(0)} kB`);

if (ergebnis.blatt) {
  mkdirSync(join(ROOT, 'grafik/vorlagen'), { recursive: true });
  const p = join(ROOT, 'grafik/vorlagen/figuren-eingebaut.png');
  writeFileSync(p, Buffer.from(ergebnis.blatt.split(',')[1], 'base64'));
  console.log(`   ${p.replace(ROOT + '/', '')} geschrieben`);
}

console.log(`   Kasten ${ergebnis.KASTEN}, Umriss bei ${ergebnis.PFAD_RAND}`
  + `…${ergebnis.PFAD_RAND + 100}, Datei ${ergebnis.PX} px`
  + '   – dieselben Werte stehen in js/ui/render.js (FOTO_KASTEN, FOTO_RAND).');

const schlecht = ergebnis.bericht.filter((b) => b.dE > 2 || b.anstoss > 0).length;
process.exit(schlecht ? 1 : 0);
