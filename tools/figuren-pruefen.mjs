/**
 * Eine Lieferung Spielfiguren messen, bevor sie übernommen wird.
 *
 *   node tools/figuren-pruefen.mjs grafik/figuren.png
 *
 * Gemessen wird, was die Figur im Spiel brauchbar macht – nicht, wie hübsch
 * sie ist:
 *
 *   Freistellbar. Ohne sauberen Alphakanal steht die Figur auf einem
 *   Rechteck. Liegt keiner vor, wird geprüft, ob sich der Hintergrund
 *   rechnerisch entfernen lässt.
 *
 *   Farbe. Die Spielerfarben halten ihren Abstand nur, wenn sie auch
 *   getroffen werden. Gemessen wird gegen PLAYER_PALETTE – beim Bogen in
 *   der Reihenfolge der Palette, bei Einzeldateien nach dem Dateinamen.
 *
 *   Trennung. Wichtiger als der Abstand zur Palette ist der Abstand der
 *   Farben untereinander, auch für Rot- und Grünblinde. Die Grenze steht
 *   in CONTRAST_LIMITS und ist keine Geschmacksfrage.
 *
 *   Gleichmaß. Sieben Figuren, die verschieden groß oder verschieden dick
 *   sind, fallen nebeneinander auf dem Brett sofort auf.
 *
 *   Dicke. Die Breite der Schnittfläche, gemessen als Bildmerkmal: je
 *   Zeile die stärkste Helligkeitskante im Inneren, von rechts her. Sie
 *   ist nicht die Dicke selbst, sondern deren Projektion – eine H/2 dicke
 *   Scheibe zeigt bei frontalem Blick gar keine Seitenwand. Deshalb steht
 *   der Blickwinkel dabei, der zur gemessenen Projektion gehören müsste;
 *   aus einem Bild allein lässt sich beides nicht trennen.
 *
 *   Geeicht an zwei gerechneten Scheiben mit bekannter Tiefe:
 *   26,6 % → 26,7 % gemessen, 12,8 % → 13,1 %.
 *
 * Zwei Verfahren, die vorher hier standen und die nicht taugen – damit sie
 * niemand noch einmal versucht:
 *
 *   Fläche über der eingepassten Vorderfläche. Setzt voraus, dass die
 *   Silhouette zu MEEPLE_PATH passt. Tut sie das nicht, wandert die
 *   Formabweichung in die Tiefe; bei zwei der sieben Figuren fand die
 *   Einpassung überhaupt keine Lage.
 *
 *   Morphologische Öffnung. Mathematisch sauber – die Silhouette einer
 *   Scheibe ist eine Minkowski-Summe mit einer Strecke, und die längste
 *   Strecke, mit der sie sich verlustfrei öffnen lässt, ist die Tiefe.
 *   Nur ist ein Foto kein ideales Prisma: verrundete Schnittkante,
 *   perspektivisch kleinere Rückfläche. Mit enger Toleranz kam an beiden
 *   Lieferungen 0 % heraus, mit weiter an einer gerechneten Scheibe
 *   42,7 % statt 26,6 %.
 *
 * Die Überdeckung mit MEEPLE_PATH steht als **Anmerkung** dabei, nicht als
 * Beanstandung. Sie mischt echte Formabweichung mit der Seitenwand, die
 * ein flacher Umriss nie abdeckt. Wer die Form beurteilen will, nimmt
 * --kontakt und sieht sich den Umriss an; die harte Zahl dazu ist das
 * Verhältnis Breite zu Höhe neben dem des Spielumrisses.
 *
 * Beanstandungen gehen mit Rückgabewert 1 raus.
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
const dateien = argv.filter((a) => !a.startsWith('-')).map((a) => resolve(a));
if (!dateien.length) {
  console.error('Aufruf: node tools/figuren-pruefen.mjs <bild.png> [--kontakt]');
  process.exit(1);
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
                '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const nr = req.url.match(/^\/bild\/(\d+)$/);
  const p = nr ? dateien[+nr[1]] : join(ROOT, decodeURIComponent(req.url.split('?')[0]));
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForTimeout(300);

const ergebnis = await page.evaluate(async ({ anzahl, kontakt, namen }) => {
  const { MEEPLE_PATH } = await import('/js/ui/render.js');
  const { PLAYER_PALETTE } = await import('/js/ui/render/meeple-colors.js');
  const { deltaE, checkPlayerColors, CONTRAST_LIMITS } =
    await import('/js/ui/render/palette.js');

  // Maße des Spielumrisses – gebraucht für den Vergleich der Proportion.
  const mc = document.createElement('canvas');
  mc.width = mc.height = 440;
  const mg = mc.getContext('2d', { willReadFrequently: true });
  mg.setTransform(4, 0, 0, 4, 20, 20);
  mg.fillStyle = '#000';
  mg.fill(MEEPLE_PATH);
  const md = mg.getImageData(0, 0, 440, 440).data;
  let mx0 = 440, mx1 = -1, my0 = 440, my1 = -1;
  for (let y = 0; y < 440; y++) {
    for (let x = 0; x < 440; x++) {
      if (md[((y * 440 + x) << 2) + 3] < 128) continue;
      if (x < mx0) mx0 = x;
      if (x > mx1) mx1 = x;
      if (y < my0) my0 = y;
      if (y > my1) my1 = y;
    }
  }
  const pfadVerhaeltnis = (mx1 - mx0 + 1) / (my1 - my0 + 1);

  /**
   * Die Schnittfläche als Bildmerkmal messen.
   *
   * Die Öffnungsmessung darunter ist mathematisch sauber, aber nur für ein
   * ideales Prisma. Ein Foto ist keines: die Schnittkante ist verrundet,
   * die Rückfläche steht perspektivisch etwas kleiner als die Vorderfläche.
   * Mit enger Toleranz meldete sie deshalb an beiden Lieferungen 0 %, mit
   * weiter Toleranz an einer gerechneten Scheibe 42,7 % statt 26,6 %. Für
   * Fotos taugt sie nicht.
   *
   * Was in einem Foto dagegen wirklich dasteht: die Schnittfläche ist eine
   * eigene Fläche mit eigener Helligkeit – man blickt entlang des
   * Materials, deshalb ist sie satter und meist dunkler als die
   * Vorderfläche. Zwischen beiden liegt eine Kante. Gesucht wird also je
   * Zeile von rechts her die stärkste Helligkeitskante im Inneren; der
   * Abstand von dort zum Rand ist die Breite der Schnittfläche.
   */
  const wandMessen = (px, maske, W, H, x0, y0, bw, bh) => {
    const lum = (x, y) => {
      const i = ((y * W + x) << 2);
      return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
    };
    const breiten = [];
    // Nur der Rumpf. Kopf und Beine sind schmal, dort liegt die Kante zu
    // dicht am Rand, und die Arme haben eigene Rundungen.
    for (let y = Math.round(y0 + bh * 0.34); y < y0 + bh * 0.60; y += 2) {
      let xr = -1;
      for (let x = x0 + bw - 1; x >= x0; x--) if (maske[y * W + x]) { xr = x; break; }
      if (xr < 0) continue;
      const tief = Math.round(bw * 0.45);
      let bestX = -1, bestG = 0;
      // Drei Pixel weit glätten, sonst gewinnt das Rauschen.
      const gl = (x) => (lum(x - 1, y) + lum(x, y) + lum(x + 1, y)) / 3;
      // Erst ab sechs Pixel Abstand suchen und nur, solange das ganze
      // Fenster in der Figur liegt. Sonst gewinnt immer die Außenkante:
      // dort steht der weiße Grund daneben, und kein Übergang im Inneren
      // kommt gegen diesen Sprung an. Genau daran ist der erste Versuch
      // gescheitert – er meldete an einer gerechneten Scheibe mit 26,6 %
      // Sollwert ganze 0,8 %, immer den ersten möglichen Abstand.
      for (let d = 6; d < tief; d++) {
        const x = xr - d;
        if (x - 3 <= x0 || !maske[y * W + x - 3] || !maske[y * W + x + 3]) break;
        const g = Math.abs(gl(x + 3) - gl(x - 3));
        if (g > bestG) { bestG = g; bestX = x; }
      }
      // Ohne deutliche Kante gibt es nichts zu melden.
      if (bestX < 0 || bestG < 8) continue;
      breiten.push(xr - bestX);
    }
    if (breiten.length < 4) return 0;
    breiten.sort((a, b) => a - b);
    return breiten[breiten.length >> 1] / bh;
  };

  const out = [];
  let blatt = null;

  for (let nr = 0; nr < anzahl; nr++) {
    const img = new Image();
    img.src = `/bild/${nr}`;
    await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const at = (x, y) => (y * W + x) << 2;

    // -------------------------------------------------- Alphakanal vorhanden?
    let alphaMin = 255;
    for (let i = 3; i < px.length; i += 4) if (px[i] < alphaMin) alphaMin = px[i];
    const hatAlpha = alphaMin < 250;

    // -------------------------------------------------- Hintergrundmodell
    // Ein Schachbrett zeichnet sich selbst ins Bild, wenn der Alphakanal
    // fehlt. Es ist streng regelmäßig – deshalb wird es aus dem Rand
    // gelernt (Periode und Phase) und danach überall abgezogen. Ein
    // fester Weißwert würde die graue Figur mit verschlucken.
    const randProbe = [];
    for (let x = 0; x < W; x += 3) { randProbe.push(px[at(x, 2)]); }
    // Periode: der kleinste Versatz, bei dem sich die Randzeile wiederholt.
    let periode = 0, bestFehler = Infinity;
    for (let p = 4; p <= 120; p += 1) {
      let s = 0, n = 0;
      for (let x = 0; x + p < W; x += 5) { s += Math.abs(px[at(x, 2)] - px[at(x + p, 2)]); n++; }
      const f = s / n;
      if (f < bestFehler - 0.05) { bestFehler = f; periode = p; }
    }
    // Hintergrundhelligkeit je Schachfeld, aus den Bildrändern gelernt.
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

    // Abweichung vom Hintergrund
    const SCHWELLE = 10;
    const maske = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        if (hatAlpha) { maske[y * W + x] = px[i + 3] > 128 ? 1 : 0; continue; }
        const [br, bg, bb] = grund(x, y);
        const d = Math.max(Math.abs(px[i] - br), Math.abs(px[i + 1] - bg), Math.abs(px[i + 2] - bb));
        maske[y * W + x] = d > SCHWELLE ? 1 : 0;
      }
    }
    // Löcher füllen: vom Bildrand aus durch den Hintergrund fluten, alles
    // Unerreichte gehört zur Figur.
    const aussen = new Uint8Array(W * H);
    const stapel = [];
    for (let x = 0; x < W; x++) { stapel.push(x, 0, x, H - 1); }
    for (let y = 0; y < H; y++) { stapel.push(0, y, W - 1, y); }
    while (stapel.length) {
      const y = stapel.pop(), x = stapel.pop();
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = y * W + x;
      if (aussen[k] || maske[k]) continue;
      aussen[k] = 1;
      stapel.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    for (let k = 0; k < maske.length; k++) if (!aussen[k]) maske[k] = 1;

    // -------------------------------------------------- Figuren trennen
    const spaltenVoll = new Int32Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (maske[y * W + x]) spaltenVoll[x]++;
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

    // -------------------------------------------------- je Figur
    const figuren = [];
    for (let gi = 0; gi < gruppen.length; gi++) {
      const [x0, x1] = gruppen[gi];
      let y0 = H, y1 = -1, flaeche = 0;
      for (let y = 0; y < H; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!maske[y * W + x]) continue;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          flaeche++;
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

      // Farbe: nur der satte Kern, nicht die weichgezeichnete Kante.
      let sr = 0, sg = 0, sb = 0, n = 0;
      const rand = 6;
      for (let y = y0 + rand; y <= y1 - rand; y++) {
        for (let x = x0 + rand; x <= x1 - rand; x++) {
          if (!maske[y * W + x]) continue;
          // Kantennähe verwerfen
          let frei = true;
          for (let dy = -rand; dy <= rand && frei; dy += rand) {
            for (let dx = -rand; dx <= rand && frei; dx += rand) {
              if (!maske[(y + dy) * W + (x + dx)]) frei = false;
            }
          }
          if (!frei) continue;
          const i = at(x, y);
          sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++;
        }
      }
      const rgb = [sr / n, sg / n, sb / n].map(Math.round);
      const hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

      // ------------------------------------ Vorderfläche einpassen
      // Gesucht ist der größte MEEPLE_PATH, der noch (fast) vollständig in
      // der Silhouette liegt. Kleiner Rest erlaubt, sonst entscheidet ein
      // einzelnes Kantenpixel über das Ergebnis.
      const pw = Math.min(420, bw + 40), ph = Math.min(560, bh + 40);
      const pc = document.createElement('canvas');
      pc.width = pw; pc.height = ph;
      const pg = pc.getContext('2d', { willReadFrequently: true });

      const RAND = 20;
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
            const gx = x0 - RAND + x, gy = y0 - RAND + y;
            const treffer = gx >= 0 && gy >= 0 && gx < W && gy < H && maske[gy * W + gx];
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
      // Zwei Einpassungen mit verschiedener Absicht:
      //   enthalten – der größte Umriss, der noch in der Silhouette liegt.
      //     Was darüber hinausragt, ist die Seitenwand der Scheibe.
      //   deckung – die beste Überdeckung überhaupt (IoU). Sie sagt, ob die
      //     Form stimmt, unabhängig davon, wie dick die Scheibe ist.
      let enthalten = null, deckung = null;
      const suche = (sList, dxList, dyList) => {
        for (const s of sList) for (const dx of dxList) for (const dy of dyList) {
          const r = drin(s, dx, dy);
          if (!r.gesamt) continue;
          const iou = r.innen / (flaeche + r.aussenP);
          if (!deckung || iou > deckung.iou) deckung = { s, dx, dy, iou, ...r };
          if (r.aussenP / r.gesamt > 0.02) continue;      // muss drinliegen
          if (!enthalten || r.innen > enthalten.innen) enthalten = { s, dx, dy, ...r };
        }
      };
      suche(liste(s0 * 0.92, s0 * 0.16, s0 * 0.04), liste(RAND, 26, 8), liste(RAND, 26, 8));
      for (const b of [enthalten, deckung]) {
        if (b) suche(liste(b.s, s0 * 0.045, s0 * 0.012), liste(b.dx, 8, 3), liste(b.dy, 8, 3));
      }

      const passung = enthalten ? enthalten.innen / flaeche : 0;   // Anteil der Silhouette
      const wand = wandMessen(px, maske, W, H, x0, y0, bw, bh);

      // ------------------------------------ Form
      // Die Überdeckung mit MEEPLE_PATH ist bewusst **keine** Beanstandung.
      // Sie mischt zwei Ursachen, die dieses Werkzeug nicht trennen kann:
      // eine wirklich andere Silhouette – und die Seitenwand der Scheibe,
      // die ein flacher Umriss niemals abdecken kann. Allein daran verliert
      // eine tadellose Lieferung schon gut ein Achtel.
      //
      // Ich habe versucht, die Seitenwand herauszurechnen: Silhouette um
      // den geschätzten Tiefenvektor erodieren, dann vergleichen. Das war
      // schlechter, nicht besser – die Tiefe wird aus derselben Einpassung
      // geschätzt, die schon voraussetzt, dass die Form stimmt, und bei
      // abweichender Form schrumpft die Einpassung, die geschätzte Tiefe
      // wächst, und die Erodierung frisst die Figur auf. Aus 76 % wurden
      // so 59 %. Der Wert steht deshalb roh da, mit Ansage, und die
      // Entscheidung fällt am Kontaktbogen (--kontakt).
      const iou = deckung ? deckung.iou : 0;
      // Überschuss = Silhouette minus Vorderfläche. Beim Verschieben einer
      // Fläche um eine Strecke wächst sie um Strecke × Höhe – daraus die
      // sichtbare Tiefe der Scheibe.
      const tiefeAnteil = wand;
      const verhaeltnis = bw / bh;

      figuren.push({ x0, x1, y0, y1, bw, bh, flaeche, rgb, hex,
        passung, iou, tiefeAnteil,
        verhaeltnis, pfadVerhaeltnis, gepasst: !!enthalten,
        fit: enthalten && { s: enthalten.s, dx: enthalten.dx - RAND, dy: enthalten.dy - RAND },
        fitIou: deckung && { s: deckung.s, dx: deckung.dx - RAND, dy: deckung.dy - RAND } });
    }

    // -------------------------------------------------- Farbzuordnung
    // Beim Bogen steht die Farbe in der Reihenfolge; bei einer Einzeldatei
    // im Dateinamen (gruen.webp → Grün), wie bei den Karten auch.
    const ausName = PLAYER_PALETTE.find((e) => e.datei === namen[nr]);
    for (let i = 0; i < figuren.length; i++) {
      const f = figuren[i];
      const soll = figuren.length === 1 && ausName ? ausName : PLAYER_PALETTE[i];
      f.soll = soll ? soll.name : '—';
      f.sollHex = soll ? soll.hex : null;
      f.dE = soll ? deltaE(f.hex, soll.hex) : null;
      // Nächstliegende Palettenfarbe – zeigt Verwechslungen an.
      let nah = null;
      for (const e of PLAYER_PALETTE) {
        const d = deltaE(f.hex, e.hex);
        if (!nah || d < nah.d) nah = { name: e.name, d };
      }
      f.naechste = nah;
    }

    if (kontakt) {
      // Kontaktbogen: Ausschnitt, darüber der eingepasste Umriss. Was
      // außerhalb der roten Linie liegt, ist die Seitenwand; was innerhalb
      // fehlt, ist Formabweichung.
      const zh = Math.max(...figuren.map((f) => f.bh)) + 30;
      const zw = Math.max(...figuren.map((f) => f.bw)) + 30;
      const kc = document.createElement('canvas');
      kc.width = zw * figuren.length; kc.height = zh * 2;
      const kg = kc.getContext('2d');
      kg.fillStyle = '#2b2f34';
      kg.fillRect(0, 0, kc.width, kc.height);
      figuren.forEach((f, i) => {
        for (const [reihe, fit, farbe] of [[0, f.fit, '#ff2d2d'], [1, f.fitIou, '#22e0ff']]) {
          const ox = i * zw + 15, oy = reihe * zh + 15;
          kg.drawImage(c, f.x0, f.y0, f.bw, f.bh, ox, oy, f.bw, f.bh);
          if (!fit) continue;
          kg.save();
          kg.translate(ox + fit.dx, oy + fit.dy);
          kg.scale(fit.s, fit.s);
          kg.strokeStyle = farbe;
          kg.lineWidth = 2 / fit.s;
          kg.stroke(MEEPLE_PATH);
          kg.restore();
        }
      });
      blatt = kc.toDataURL('image/png');
    }

    const werte = [...felder.values()].map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
    const spanneGrund = Math.max(...werte.map((v, i) =>
      Math.max(...werte.map((w) => Math.max(...v.map((c, k) => Math.abs(c - w[k])))))));
    const mittelGrund = [0, 1, 2].map((k) =>
      Math.round(werte.reduce((a, v) => a + v[k], 0) / werte.length));
    out.push({ W, H, hatAlpha, alphaMin, periode, figuren,
      gemustert: spanneGrund > 3,
      grundHex: '#' + mittelGrund.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() });
  }

  // ---------------------------------------------- Trennung untereinander
  // Der Abstand zur Spezifikation ist nur die halbe Frage. Die andere:
  // halten die gelieferten Farben *untereinander* noch den Abstand, auch
  // für Rot- und Grünblinde? Danach entscheidet sich, ob eine Lieferung die
  // Palette ersetzen darf oder nachgefärbt werden muss. Gerechnet wird über
  // alle Dateien zusammen – bei Einzeldateien steht sonst jede für sich.
  const geliefert = {};
  out.forEach((m) => m.figuren.forEach((f) => { geliefert[f.soll] = f.hex; }));
  const trennung = Object.keys(geliefert).length >= 2 ? checkPlayerColors(geliefert) : null;
  const zusammen = trennung && {
    grenze: CONTRAST_LIMITS.playerPair,
    schwach: trennung.pairs.filter((p) => !p.passed).sort((a, b) => a.min - b.min)
      .map((p) => ({ a: p.a, b: p.b, min: p.min })),
    dunkel: trennung.backgrounds.filter((b) => !b.passed).sort((a, b) => a.min - b.min)
      .map((b) => ({ color: b.color, background: b.background, min: b.min })),
    schwaechste: trennung.pairs.reduce((a, b) => (a.min < b.min ? a : b)),
  };
  return { out, blatt, zusammen };
}, { anzahl: dateien.length, kontakt,
     namen: dateien.map((d) => basename(d).replace(/\.[^.]+$/, '')) });

await browser.close();
server.close();

const { out: messung, blatt } = ergebnis;
if (blatt) {
  mkdirSync(join(ROOT, 'grafik/vorlagen'), { recursive: true });
  const ziel = join(ROOT, 'grafik/vorlagen/figuren-kontakt.png');
  writeFileSync(ziel, Buffer.from(blatt.split(',')[1], 'base64'));
  console.log(`${ziel} geschrieben`);
}

let fehler = 0;
for (let i = 0; i < dateien.length; i++) {
  const m = messung[i];
  console.log(`\n${basename(dateien[i])}   ${m.W}×${m.H}   ${m.figuren.length} Figuren`);
  if (!m.hatAlpha) {
    fehler++;
    // Ein einfarbiger Grund ist leicht zu entfernen, ein gemaltes
    // Schachbrett braucht das gelernte Muster. Unterschieden wird daran,
    // ob sich die vier gelernten Felder überhaupt unterscheiden – bei
    // einfarbigem Grund findet die Periodensuche irgendeinen Wert, und der
    // sagt dann nichts.
    console.log(`   Alphakanal  fehlt – ${m.gemustert
      ? `Hintergrund ist ins Bild gemalt (Schachbrett, Periode ${m.periode} px)`
      : `Grund ist einfarbig ${m.grundHex}`}   ✗ muss freigestellt werden`);
  } else {
    console.log(`   Alphakanal  vorhanden (min ${m.alphaMin})   ✓`);
  }

  for (const f of m.figuren) {
    const nameFeld = `${f.soll}`.padEnd(9);
    console.log(`   ${nameFeld} ${String(f.bw).padStart(4)}×${String(f.bh).padStart(4)} px`
      + `   ${f.hex}  soll ${f.sollHex}  ΔE ${f.dE.toFixed(1).padStart(5)}`
      + `   ${f.dE <= 12 ? '✓' : `✗ ΔE zu groß (nächste: ${f.naechste.name})`}`);
    if (f.dE > 12) fehler++;
    const t = (f.tiefeAnteil * 100).toFixed(1);
    const iou = (f.iou * 100).toFixed(0);
    console.log(`             Seitenwand ${t.padStart(5)} % der Höhe`
      + `   Breite/Höhe ${f.verhaeltnis.toFixed(2)}`
      + ` gegen ${f.pfadVerhaeltnis.toFixed(2)} beim Spielumriss`);
    console.log(`             Form ${iou.padStart(3)} % Überdeckung mit MEEPLE_PATH`
      + (f.gepasst ? `   Vorderfläche ${(f.passung * 100).toFixed(0)} %`
                   : '   Vorderfläche liess sich nicht einpassen')
      + `   ${f.iou >= 0.85 ? '' : '– Umriss ansehen'}`);
  }

  // Gleichmaß: alle sieben sollten gleich groß sein und gleich dick.
  // Bei einer Einzeldatei gibt es nichts zu vergleichen.
  const hs = m.figuren.map((f) => f.bh);
  const ts = m.figuren.map((f) => f.tiefeAnteil);
  const tMittel = ts.reduce((a, b) => a + b, 0) / ts.length;
  if (m.figuren.length > 1) {
    const spanne = (a) =>
      (Math.max(...a) - Math.min(...a)) / (a.reduce((x, y) => x + y, 0) / a.length);
    const hSp = spanne(hs), tSp = spanne(ts);
    console.log(`   Gleichmaß   Höhe ${Math.min(...hs)}–${Math.max(...hs)} px`
      + ` = ${(hSp * 100).toFixed(0)} % Spanne   ${hSp <= 0.06 ? '✓' : '✗ unterschiedlich groß'}`);
    if (hSp > 0.06) fehler++;
    console.log(`               Seitenwand ${(Math.min(...ts) * 100).toFixed(1)}`
      + `–${(Math.max(...ts) * 100).toFixed(1)} %`
      + ` = ${(tSp * 100).toFixed(0)} % Spanne   ${tSp <= 0.30 ? '✓' : '✗ unterschiedlich dick'}`);
    if (tSp > 0.30) fehler++;
  }

  // Aus der Projektion auf die Scheibendicke schließen.
  const winkel = Math.asin(Math.min(1, tMittel / 0.5)) * 180 / Math.PI;
  console.log(`   Dicke       sichtbare Seitenwand ${(tMittel * 100).toFixed(1)} % der Höhe.`);
  console.log(`               Eine H/2 dicke Scheibe zeigt so viel bei ${winkel.toFixed(0)}° Drehung`
    + ` – bei 30° wären es 25 %.`);
}

// Trennung der gelieferten Farben untereinander – über alle Dateien.
const t = ergebnis.zusammen;
if (t) {
  console.log(`\nTrennung  schwächstes Paar ${t.schwaechste.a}/${t.schwaechste.b}`
    + ` ΔE ${t.schwaechste.min.toFixed(1)} (Grenze ${t.grenze})`
    + `   ${t.schwach.length || t.dunkel.length ? '✗' : '✓'}`);
  for (const p of t.schwach) {
    fehler++;
    console.log(`          ✗ ${p.a}/${p.b} nur ΔE ${p.min.toFixed(1)}`);
  }
  for (const b of t.dunkel) {
    fehler++;
    console.log(`          ✗ ${b.color} auf ${b.background} nur ΔE ${b.min.toFixed(1)}`);
  }
}

console.log(fehler
  ? `\n${fehler} Beanstandung${fehler === 1 ? '' : 'en'} – vor dem Übernehmen klären.`
  : '\nOhne Beanstandung.');
process.exit(fehler ? 1 : 0);
