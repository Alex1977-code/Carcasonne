/**
 * Karten bauen, indem einer vorhandenen die Stadt am Nordrand genommen wird.
 *
 *   node tools/stadt-zu-wiese.mjs          # alle Rezepte
 *   node tools/stadt-zu-wiese.mjs U W      # nur diese
 *
 * Drei Motive des Grundspiels unterscheiden sich von einem bereits
 * gemalten nur dadurch, dass oben statt einer Stadt Wiese liegt:
 *
 *   D  CRFR  →  U  RFRF   gerade Straße quer durch (um 1 gedreht)
 *   L  CRRR  →  W  FRRR   T-Kreuzung
 *   K  CFRR  →  V  FFRR   Straßenkurve
 *
 * Warum nicht malen lassen: der Bildgenerator legt aus einer
 * Textbeschreibung heraus jedes Mal einen eigenen Wegradius und eine
 * eigene Wegbreite an. Die erste Lieferung für U, V, W, X kam mit
 * Wegen von 11,8 bis 13,8 % statt 11 % und einer Wiese mit einem
 * Viertel der Rankendichte der übrigen Bögen – gemessen, nicht
 * geschätzt. Nimmt man dagegen eine bereits vermessene Karte und
 * tauscht nur die Stadt gegen Wiese, stimmen Geometrie und Stil per
 * Konstruktion.
 *
 * Die Stadtfläche wird durch Texturkachelung gefüllt („image
 * quilting"): saubere Wiesenflicken werden überlappend gesetzt, für
 * jede Position gewinnt der Flicken, der in der Überlappung am besten
 * zum schon Gesetzten passt. Fester Zufallskeim, also bei jedem Lauf
 * dasselbe Bild.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';

/**
 * Der Wiesenvorrat. Alle Flicken stammen aus Motiv K (Bogen 03), weil
 * dort die einzigen größeren Flächen liegen, die frei von Weg, Baum,
 * Acker und Stadtmauer sind – auf D und L ist die Wiese fast überall
 * bepflanzt. Vor dem Setzen wird jeder Flicken auf die mittlere
 * Wiesenfarbe der Zielkarte verschoben; K und L stammen ohnehin vom
 * selben Bogen, für D ist die Verschiebung klein.
 *
 * Von Hand ausgesucht auf einem Kontaktbogen aller Kandidaten. Drei
 * automatische Verfahren (Golddichte, Stammfarbe, Ringsuche) haben
 * jedes Mal halbe Baumkronen stehen lassen: eine Krone ist ein dünner
 * Goldbogen mit gerader Grundlinie und hat kaum mehr Gold als das
 * Rankenwerk ringsum.
 */
const WIESE = [
  ['J', 232, 200], ['J', 392, 344], ['J', 352, 376], ['J', 328, 416],
  ['K', 0, 320], ['K', 40, 344], ['K', 0, 360], ['K', 288, 368],
  ['K', 328, 376], ['K', 368, 376], ['K', 408, 376], ['K', 40, 384],
  ['K', 296, 416], ['K', 336, 416], ['K', 376, 416], ['K', 416, 416],
];

const REZEPTE = {
  U: { quelle: 'D', dreh: 1 },
  V: { quelle: 'K', dreh: 0 },
  W: { quelle: 'L', dreh: 0 },
  // X ist die Kreuzung: W plus ein vierter Arm. Der wird nicht gemalt,
  // sondern aus dem Südarm gespiegelt – derselbe Weg, dieselbe Breite,
  // dieselben Rippen. Muss nach W laufen.
  X: { quelle: 'W', armSpiegeln: true, dreh: 0 },
};

const P = 88;      // Flickengröße
const UEB = 24;    // Überlappung
const SAUM = 18;   // Tiefe des Mauerschattens unter der Stadtgrenze

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

const gewuenscht = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ziele = gewuenscht.length ? gewuenscht : Object.keys(REZEPTE);
for (const z of ziele) {
  if (!REZEPTE[z]) { console.error(`kein Rezept für ${z}`); process.exit(1); }
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TYPEN = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
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

const stand = process.hrtime.bigint().toString();
for (const ziel of ziele) {
  const rez = REZEPTE[ziel];
  const erg = await page.evaluate(async ({ rez, WIESE, P, UEB, SAUM, stand }) => {
    const lade = async (id) => {
      const img = new Image();
      // Frischestempel: X liest W, das im selben Lauf gerade neu
      // geschrieben wurde – ohne den käme es aus dem Cache.
      img.src = `/grafik/karten/${id}.webp?${stand}`;
      await img.decode();
      const N = img.width;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return { N, g, d: g.getImageData(0, 0, N, N).data };
    };

    const q = await lade(rez.quelle);
    const N = q.N, src = q.d;
    const at = (x, y) => ((y * N + x) << 2);
    const gruenD = (d, i) => {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      return gg >= r && gg > bb && mx && (mx - mn) / mx > 0.25;
    };

    // Sonderfall Kreuzung: kein Stadtabtrag, sondern ein vierter Wegarm.
    // Der Südarm wird an der Wegscheibe gespiegelt und nach oben gesetzt.
    // Dadurch hat der neue Arm dieselbe Breite, dieselbe Goldfassung und
    // dieselben Querrippen wie die drei vorhandenen – gemalt bekäme man
    // das nicht hin.
    if (rez.armSpiegeln) {
      let bx = 0, by = 0, nb = 0;
      for (let y = N * 0.25; y < N * 0.75; y++) {
        for (let x = N * 0.25; x < N * 0.75; x++) {
          const i = at(x | 0, y | 0), r = src[i], gg = src[i + 1], bb = src[i + 2];
          if (bb > r + 50 && bb > gg + 40 && bb > 90) { bx += x; by += y; nb++; }
        }
      }
      if (nb < 100) return { fehler: 'keine Wegscheibe gefunden' };
      const ex = Math.round(bx / nb), ey = Math.round(by / nb), radien = [];
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        let r = 0;
        for (; r < N / 2; r++) {
          const x = Math.round(ex + dx * r * 0.707), y = Math.round(ey + dy * r * 0.707);
          if (x < 0 || y < 0 || x >= N || y >= N || gruenD(src, at(x, y))) break;
        }
        radien.push(r);
      }
      radien.sort((a, b) => a - b);
      const R = radien[1];

      // Der Südarm reicht von der Scheibe bis zur Unterkante, der neue
      // Nordarm von der Scheibe bis zur Oberkante. Beide Strecken sind
      // verschieden lang, weil die Scheibe nicht genau in der Kartenmitte
      // sitzt – deshalb wird längs gestaucht statt gespiegelt. Quer bleibt
      // alles wie es ist, sonst verschöbe sich der Austritt an der Kante.
      const vonY = ey + R, bisY = N - 1, zielOben = 0, zielUnten = ey - R + 3;
      const bild = q.g.getImageData(0, 0, N, N), z = bild.data;
      for (let ty = zielOben; ty <= zielUnten; ty++) {
        const t = (zielUnten - ty) / (zielUnten - zielOben);
        const sy = Math.min(bisY, Math.round(vonY + t * (bisY - vonY)));
        // Breite des Arms in dieser Quellzeile: von der Mitte nach außen,
        // solange keine Wiese kommt. Das schließt die Goldfassung mit ein.
        let li = ex, re = ex;
        while (li > 0 && !gruenD(src, at(li - 1, sy))) li--;
        while (re < N - 1 && !gruenD(src, at(re + 1, sy))) re++;
        if (re - li < 8 || re - li > N * 0.4) continue;
        for (let x = li; x <= re; x++) {
          // an beiden Rändern zwei Punkte weich einblenden
          const rand = Math.min(x - li, re - x);
          const a = rand >= 2 ? 1 : (rand + 1) / 3;
          const si = at(x, sy), di = at(x, ty);
          for (let k = 0; k < 3; k++) z[di + k] = z[di + k] * (1 - a) + src[si + k] * a;
          z[di + 3] = 255;
        }
      }
      const cx = document.createElement('canvas');
      cx.width = cx.height = N;
      cx.getContext('2d').putImageData(bild, 0, 0);
      return { webp: cx.toDataURL('image/webp', 0.85), N, maxG: zielUnten,
               scheibe: `${ex},${ey} r${R}`, versatz: [0, 0, 0] };
    }

    // 1. Stadtgrenze je Spalte: der oberste grüne Lauf von mindestens
    //    acht Punkten. In der Stadt gibt es einzelne grüne Punkte (die
    //    Fensterlaibungen), deshalb der Lauf statt eines Einzelpunkts.
    const grenze = new Int32Array(N).fill(-1);
    for (let x = 0; x < N; x++) {
      let y = 0, lauf = 0;
      for (; y < N; y++) { if (gruenD(src, at(x, y))) { if (++lauf >= 8) break; } else lauf = 0; }
      if (y < N) grenze[x] = y - lauf + 1;
    }

    // 1b. Spalten ohne Grenze. Das sind die, in denen von oben bis unten
    //     nie Wiese liegt – bei L die Torrampe, die von der Stadtmauer
    //     auf die Wegscheibe führt. Dort gilt die Oberkante der Scheibe:
    //     alles darüber ist Stadt und Rampe und muss weg, die Scheibe
    //     selbst bleibt. Die Scheibe findet sich über ihr blaues
    //     Emailauge; ihr Radius ist der Abstand bis zur Wiese, diagonal
    //     gemessen, wo kein Wegarm im Weg liegt.
    const offen = [];
    for (let x = 0; x < N; x++) if (grenze[x] < 0) offen.push(x);
    let scheibe = null;
    if (offen.length) {
      let bx = 0, by = 0, nb = 0;
      for (let y = N * 0.25; y < N * 0.75; y++) {
        for (let x = N * 0.25; x < N * 0.75; x++) {
          const i = at(x | 0, y | 0), r = src[i], gg = src[i + 1], bb = src[i + 2];
          if (bb > r + 50 && bb > gg + 40 && bb > 90) { bx += x; by += y; nb++; }
        }
      }
      if (nb > 100) {
        const ex = Math.round(bx / nb), ey = Math.round(by / nb), radien = [];
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          let r = 0;
          for (; r < N / 2; r++) {
            const x = Math.round(ex + dx * r * 0.707), y = Math.round(ey + dy * r * 0.707);
            if (x < 0 || y < 0 || x >= N || y >= N || gruenD(src, at(x, y))) break;
          }
          radien.push(r);
        }
        radien.sort((a, b) => a - b);
        scheibe = { ex, ey, r: radien[1] };
      }
      for (const x of offen) {
        if (scheibe && Math.abs(x - scheibe.ex) < scheibe.r) {
          const dx = x - scheibe.ex;
          grenze[x] = Math.round(scheibe.ey - Math.sqrt(scheibe.r * scheibe.r - dx * dx));
        } else {
          // sonst aus den nächsten bestimmten Nachbarn geradlinig ergänzen
          let l = x, r = x;
          while (l >= 0 && grenze[l] < 0) l--;
          while (r < N && grenze[r] < 0) r++;
          const a = l >= 0 ? grenze[l] : grenze[r], b = r < N ? grenze[r] : grenze[l];
          grenze[x] = Math.round(a + (b - a) * ((x - l) / Math.max(1, r - l)));
        }
      }
    }
    // Wo die Grenze von der Scheibe kommt, darf nicht zusätzlich drei
    // Punkte tiefer gefüllt werden – sonst frisst die Wiese den Goldrand.
    const vonScheibe = new Uint8Array(N);
    for (const x of offen) if (scheibe && Math.abs(x - scheibe.ex) < scheibe.r) vonScheibe[x] = 1;
    const maxG = Math.max(...grenze);

    // 1c. Deckungsmaß je Punkt aufbauen.
    //
    //  – oberhalb der Grenze: ganz füllen, das ist die Stadt
    //  – darunter der Schattensaum: die Stadtmauer hat auf die Wiese
    //    einen Schatten geworfen, direkt an der Grenze steht der Grünwert
    //    bei 51 statt 78. Bliebe er stehen, zeichnete er die alte
    //    Stadtkante als Bogen nach. Also weiter füllen und ausblenden,
    //    aber nur wo Wiese liegt – Weg, Acker und Wegscheibe bleiben.
    //  – Bäume auf der Grenze: von denen wäre sonst die obere Hälfte weg
    //    und die untere stünde noch da. Deshalb werden zusammenhängende
    //    Nicht-Wiesen-Gebilde, die in die Stadtfläche hineinragen, ganz
    //    mitgenommen – aber nur kleine. Stadt und Weg sind große Gebilde
    //    und bleiben davon unberührt; bei L hängt die Wegscheibe über die
    //    Torrampe mit der Stadt zusammen und darf keinesfalls mitgehen.
    const alpha = new Float32Array(N * N);
    const rand = new Int32Array(N);
    for (let x = 0; x < N; x++) rand[x] = grenze[x] + (vonScheibe[x] ? 0 : 3);
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < Math.min(N, rand[x] + SAUM); y++) {
        if (y < rand[x]) alpha[y * N + x] = 1;
        else if (gruenD(src, at(x, y))) alpha[y * N + x] = 1 - (y - rand[x]) / SAUM;
      }
    }
    const GRENZFLAECHE = 6000;
    const gesehen = new Uint8Array(N * N);
    let mitgenommen = 0;
    for (let y0 = 0; y0 < N; y0++) {
      for (let x0 = 0; x0 < N; x0++) {
        const s0 = y0 * N + x0;
        if (gesehen[s0] || gruenD(src, s0 << 2)) continue;
        const stapel = [s0], teile = [];
        gesehen[s0] = 1;
        let ragtRein = false;
        while (stapel.length) {
          const s = stapel.pop();
          teile.push(s);
          const x = s % N, y = (s / N) | 0;
          if (y < rand[x]) ragtRein = true;
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax, ny = y + ay;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const ns = ny * N + nx;
            if (gesehen[ns] || gruenD(src, ns << 2)) continue;
            gesehen[ns] = 1; stapel.push(ns);
          }
        }
        if (teile.length > GRENZFLAECHE || !ragtRein) continue;
        for (const s of teile) alpha[s] = 1;
        mitgenommen++;
      }
    }
    let tiefste = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (alpha[y * N + x] > 0 && y > tiefste) tiefste = y;

    // 2. Wiesenvorrat laden und auf die Zielkarte einfärben.
    const mittel = (d, n, unten) => {
      let sr = 0, sg = 0, sb = 0, k = 0;
      for (let y = unten; y < n; y += 2) for (let x = 0; x < n; x += 2) {
        const i = ((y * n + x) << 2);
        if (!gruenD(d, i)) continue;
        sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; k++;
      }
      return k ? [sr / k, sg / k, sb / k] : [0, 0, 0];
    };
    const zielFarbe = mittel(src, N, maxG);

    // Nur echte Drehungen, keine Spiegelungen. Zwei gespiegelte Flicken
    // nebeneinander ergeben eine Symmetrieachse mitten im Rankenwerk, und
    // die sieht man sofort – auf der ersten Fassung von U lief sie
    // senkrecht durch die rechte Kartenhälfte.
    const DREHUNGEN = [0, 3, 5, 6];
    const quellen = {}, pool = [];
    let versatz = [0, 0, 0];
    for (const [karte, sx, sy] of WIESE) {
      if (!quellen[karte]) {
        const w = karte === rez.quelle ? q : await lade(karte);
        quellen[karte] = { w, versatz: zielFarbe.map((v, i) => v - mittel(w.d, w.N, 0)[i]) };
      }
      const { w, versatz: vs } = quellen[karte];
      versatz = vs;
      for (const v of DREHUNGEN) {
        const buf = new Uint8ClampedArray(P * P * 4);
        for (let y = 0; y < P; y++) {
          for (let x = 0; x < P; x++) {
            let u = x, t = y;
            if (v & 4) { const h = u; u = t; t = h; }
            if (v & 1) u = P - 1 - u;
            if (v & 2) t = P - 1 - t;
            const si = (((sy + t) * w.N + (sx + u)) << 2), di = (y * P + x) << 2;
            buf[di] = w.d[si] + vs[0];
            buf[di + 1] = w.d[si + 1] + vs[1];
            buf[di + 2] = w.d[si + 2] + vs[2];
            buf[di + 3] = 255;
          }
        }
        pool.push(buf);
      }
    }

    // 3. Quilten.
    const bild = q.g.getImageData(0, 0, N, N), z = bild.data;
    const gesetzt = new Uint8Array(N * N);
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const STEP = P - UEB;
    for (let dy = -UEB; dy < tiefste + UEB; dy += STEP) {
      for (let dx = -UEB; dx < N; dx += STEP) {
        const bewertet = pool.map((buf) => {
          let fehler = 0, n = 0;
          for (let y = 0; y < P; y += 2) {
            const ty = dy + y; if (ty < 0 || ty >= N) continue;
            for (let x = 0; x < P; x += 2) {
              const tx = dx + x; if (tx < 0 || tx >= N) continue;
              if (!gesetzt[ty * N + tx]) continue;
              const si = (y * P + x) << 2, di = at(tx, ty);
              const d0 = z[di] - buf[si], d1 = z[di + 1] - buf[si + 1],
                    d2 = z[di + 2] - buf[si + 2];
              fehler += d0 * d0 + d1 * d1 + d2 * d2; n++;
            }
          }
          return { buf, f: n ? fehler / n : 0 };
        });
        bewertet.sort((a, b) => a.f - b.f);
        const eng = bewertet.slice(0, 5);
        const wahl = eng[Math.floor(rnd() * eng.length)].buf;
        for (let y = 0; y < P; y++) {
          const ty = dy + y; if (ty < 0 || ty >= N) continue;
          for (let x = 0; x < P; x++) {
            const tx = dx + x; if (tx < 0 || tx >= N) continue;
            let a = alpha[ty * N + tx];
            if (a <= 0) continue;
            const si = (y * P + x) << 2, di = at(tx, ty);
            if (gesetzt[ty * N + tx]) {
              a = Math.min(a, x < UEB ? x / UEB : 1, y < UEB ? y / UEB : 1);
            }
            z[di] = z[di] * (1 - a) + wahl[si] * a;
            z[di + 1] = z[di + 1] * (1 - a) + wahl[si + 1] * a;
            z[di + 2] = z[di + 2] * (1 - a) + wahl[si + 2] * a;
            z[di + 3] = 255;
            gesetzt[ty * N + tx] = 1;
          }
        }
      }
    }

    const c2 = document.createElement('canvas');
    c2.width = c2.height = N;
    const g2 = c2.getContext('2d');
    g2.putImageData(bild, 0, 0);

    // 4. Naht an der ehemaligen Stadtgrenze weich machen.
    const c3 = document.createElement('canvas');
    c3.width = c3.height = N;
    const g3 = c3.getContext('2d');
    g3.filter = 'blur(2.5px)';
    g3.drawImage(c2, 0, 0);
    const weich = g3.getImageData(0, 0, N, N).data;
    const fertig = g2.getImageData(0, 0, N, N), f = fertig.data;
    for (let x = 0; x < N; x++) {
      const gy = grenze[x];
      for (let y = Math.max(0, gy - 6); y < Math.min(N, gy + 6); y++) {
        const t = 1 - Math.abs(y - gy) / 6, di = at(x, y);
        for (let k = 0; k < 3; k++) f[di + k] = f[di + k] * (1 - t) + weich[di + k] * t;
      }
    }
    g2.putImageData(fertig, 0, 0);

    // 5. Drehen, damit die Ränder zur Kantenfolge der Definition passen.
    let aus = c2;
    if (rez.dreh) {
      const c4 = document.createElement('canvas');
      c4.width = c4.height = N;
      const g4 = c4.getContext('2d');
      g4.imageSmoothingQuality = 'high';
      g4.translate(N / 2, N / 2);
      g4.rotate(rez.dreh * Math.PI / 2);
      g4.drawImage(c2, -N / 2, -N / 2);
      aus = c4;
    }
    return { webp: aus.toDataURL('image/webp', 0.85), N, maxG,
             scheibe: scheibe ? `${scheibe.ex},${scheibe.ey} r${scheibe.r}` : null,
             versatz: versatz.map((v) => Math.round(v)) };
  }, { rez, WIESE, P, UEB, SAUM, stand });

  const pfad = join(ROOT, `grafik/karten/${ziel}.webp`);
  mkdirSync(dirname(pfad), { recursive: true });
  const buf = Buffer.from(erg.webp.split(',')[1], 'base64');
  writeFileSync(pfad, buf);
  console.log(`${ziel} aus ${rez.quelle}: Stadt bis y=${erg.maxG} ersetzt` +
    (erg.scheibe ? `, Wegscheibe ${erg.scheibe}` : '') +
    `, Farbversatz ${erg.versatz}, ${Math.round(buf.length / 1024)} KB`);
}

await browser.close();
server.close();
