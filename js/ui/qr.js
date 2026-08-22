/**
 * QR-Code erzeugen – ohne Bibliothek, ohne Bauschritt.
 *
 * Das Spiel hat keine Abhängigkeiten und keinen Bauschritt; eine
 * QR-Bibliothek nachzuziehen hieße, beides aufzugeben. Der Umfang, den es
 * hier braucht, ist überschaubar: Byte-Modus, Fehlerkorrektur M, Versionen
 * 1 bis 10. Das reicht für 213 Zeichen – die Beitritts-Adresse ist rund 60
 * Zeichen lang.
 *
 * Gelesen wird der Code von der normalen Kamera-App des Telefons, nicht vom
 * Spiel. Deshalb steht hier nur der Erzeuger und kein Leser: wer beitritt,
 * hält die Kamera darauf und tippt auf die Adresse, die aufpoppt.
 *
 * Einen Encoder ungeprüft zu schreiben wäre fahrlässig: ein falsches Bit
 * fällt am Bildschirm nicht auf, sondern erst, wenn jemand mit dem Telefon
 * davorsteht und nichts passiert. Geprüft wurde deshalb zweistufig:
 *
 *   Einmalig beim Schreiben gegen eine unabhängige Umsetzung, Modul für
 *   Modul – 305 Zeichenketten von 1 bis 200 Zeichen über die Versionen 1
 *   bis 10, ASCII und UTF-8, jede in allen acht Masken. Dabei kamen zwei
 *   Fehler heraus: die Füllbytes wechselten nicht zwischen EC und 11, und
 *   das Formatwort lag vertauscht – waagerecht statt senkrecht.
 *
 *   Laufend in tests/qr.test.mjs. Dort steht keine Fremdumsetzung, sondern
 *   die an jenem Tag geprüften Matrizen als Festwert, dazu Prüfungen des
 *   Aufbaus. Der Test hält also den geprüften Stand fest, nicht die Norm:
 *   schlägt er an, gehört die Änderung neu gegen eine Referenz gestellt.
 */

// ---------- Tabellen ----------
// Alles für Fehlerkorrektur M. Die Zahlen stammen aus ISO/IEC 18004,
// Tabelle 9 (Datenwörter je Block) und Tabelle 13 (Ausrichtungsmuster).

/** Gesamtzahl der Codewörter (Daten + Fehlerkorrektur) je Version. */
const CODEWOERTER = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

/** Fehlerkorrektur-Codewörter je Block. */
const EC_JE_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

/** Blockaufteilung: [Anzahl₁, Datenwörter₁, Anzahl₂, Datenwörter₂]. */
const BLOECKE = [
  null,
  [1, 16, 0, 0], [1, 28, 0, 0], [1, 44, 0, 0], [2, 32, 0, 0], [2, 43, 0, 0],
  [4, 27, 0, 0], [4, 31, 0, 0], [2, 38, 2, 39], [3, 36, 2, 37], [4, 43, 1, 44],
];

/** Mittelpunkte der Ausrichtungsmuster je Version. */
const AUSRICHTUNG = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** Die zwei Bits der Fehlerkorrekturstufe im Formatwort. L=01 M=00 Q=11 H=10 */
const STUFE_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// ---------- Rechnen im Galoisfeld GF(256) ----------
// Primitivpolynom 0x11D, wie in der Norm.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generatorpolynom für n Fehlerkorrektur-Codewörter. */
function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** Die n Fehlerkorrektur-Codewörter zu einem Datenblock. */
function fehlerkorrektur(daten, n) {
  const g = generator(n);
  const rest = new Array(n).fill(0);
  for (const d of daten) {
    const faktor = d ^ rest[0];
    rest.shift();
    rest.push(0);
    if (faktor !== 0) {
      for (let i = 0; i < n; i++) rest[i] ^= mul(g[i + 1], faktor);
    }
  }
  return rest;
}

// ---------- Format- und Versionswort ----------
/** BCH-Rest von `wert` unter dem Generator `gen`, `pruef` Prüfbits. */
function bch(wert, gen, pruef) {
  const genBits = 32 - Math.clz32(gen);
  let rest = wert << pruef;
  while (32 - Math.clz32(rest) >= genBits) {
    rest ^= gen << (32 - Math.clz32(rest) - genBits);
  }
  return rest;
}

/** 15 Bit Formatwort aus Fehlerkorrekturstufe und Maske. */
function formatWort(stufe, maske) {
  const roh = (STUFE_BITS[stufe] << 3) | maske;
  return ((roh << 10) | bch(roh, 0x537, 10)) ^ 0x5412;
}

/** 18 Bit Versionswort, erst ab Version 7 nötig. */
function versionWort(version) {
  return (version << 12) | bch(version, 0x1f25, 12);
}

// ---------- Daten in Bits ----------
function datenBits(text, version) {
  const bytes = new TextEncoder().encode(text);
  const [a1, d1, a2, d2] = BLOECKE[version];
  const datenWoerter = a1 * d1 + a2 * d2;
  const laengenBits = version <= 9 ? 8 : 16;

  const bits = [];
  const schieb = (wert, n) => { for (let i = n - 1; i >= 0; i--) bits.push((wert >> i) & 1); };
  schieb(0b0100, 4);                 // Byte-Modus
  schieb(bytes.length, laengenBits);
  for (const b of bytes) schieb(b, 8);

  // Abschluss: bis zu vier Nullen, dann auf ganze Bytes auffüllen.
  const platz = datenWoerter * 8;
  if (bits.length > platz) return null;
  for (let i = 0; i < 4 && bits.length < platz; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const woerter = [];
  for (let i = 0; i < bits.length; i += 8) {
    woerter.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  // Füllbytes im Wechsel, wie in der Norm: EC 11 EC 11 …
  const FUELL = [0xec, 0x11];
  for (let f = 0; woerter.length < datenWoerter; f ^= 1) woerter.push(FUELL[f]);
  return woerter;
}

/** Datenwörter und Fehlerkorrektur verschränken – die Norm mischt blockweise. */
function verschraenken(woerter, version) {
  const [a1, d1, a2, d2] = BLOECKE[version];
  const ecN = EC_JE_BLOCK[version];
  const bloecke = [], ecBloecke = [];
  let pos = 0;
  for (let i = 0; i < a1 + a2; i++) {
    const laenge = i < a1 ? d1 : d2;
    const block = woerter.slice(pos, pos + laenge);
    pos += laenge;
    bloecke.push(block);
    ecBloecke.push(fehlerkorrektur(block, ecN));
  }
  const aus = [];
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) {
    for (const b of bloecke) if (i < b.length) aus.push(b[i]);
  }
  for (let i = 0; i < ecN; i++) {
    for (const b of ecBloecke) aus.push(b[i]);
  }
  return aus;
}

// ---------- Muster setzen ----------
const MASKEN = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function grundmuster(version) {
  const n = version * 4 + 17;
  const feld = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
  const setz = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) feld[r][c] = v; };

  // Suchmuster mit Trennsteg
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rand = r === -1 || r === 7 || c === -1 || c === 7;
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const kern = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setz(r0 + r, c0 + c, rand ? 0 : (ring || kern) ? 1 : 0);
      }
    }
  }
  // Taktmuster
  for (let i = 8; i < n - 8; i++) {
    feld[6][i] = i % 2 === 0 ? 1 : 0;
    feld[i][6] = i % 2 === 0 ? 1 : 0;
  }
  // Ausrichtungsmuster – nicht dort, wo ein Suchmuster steht
  const mitten = AUSRICHTUNG[version];
  for (const r0 of mitten) {
    for (const c0 of mitten) {
      if ((r0 <= 8 && c0 <= 8) || (r0 <= 8 && c0 >= n - 9) || (r0 >= n - 9 && c0 <= 8)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const aussen = Math.max(Math.abs(r), Math.abs(c));
          setz(r0 + r, c0 + c, aussen === 1 ? 0 : 1);
        }
      }
    }
  }
  // Immer gesetztes Bit über dem linken unteren Suchmuster
  feld[n - 8][8] = 1;
  // Plätze für das Formatwort freihalten
  for (let i = 0; i < 9; i++) {
    if (feld[8][i] === -1) feld[8][i] = 0;
    if (feld[i][8] === -1) feld[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (feld[8][n - 1 - i] === -1) feld[8][n - 1 - i] = 0;
    if (feld[n - 1 - i][8] === -1) feld[n - 1 - i][8] = 0;
  }
  // Plätze für das Versionswort
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        feld[n - 11 + j][i] = 0;
        feld[i][n - 11 + j] = 0;
      }
    }
  }
  return feld;
}

/** Wo darf gezeichnet werden? Alles, was das Grundmuster nicht belegt. */
function freiFeld(version) {
  const n = version * 4 + 17;
  const frei = Array.from({ length: n }, () => new Uint8Array(n).fill(1));
  const grund = grundmuster(version);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (grund[r][c] !== -1) frei[r][c] = 0;
  }
  return frei;
}

/** Bewertung nach den vier Regeln der Norm – kleiner ist besser. */
function strafe(feld) {
  const n = feld.length;
  let s = 0;
  // 1: Ketten gleicher Farbe ab fünf
  for (let r = 0; r < n; r++) {
    for (const waagerecht of [true, false]) {
      let lauf = 1;
      for (let i = 1; i < n; i++) {
        const a = waagerecht ? feld[r][i] : feld[i][r];
        const b = waagerecht ? feld[r][i - 1] : feld[i - 1][r];
        if (a === b) { lauf++; } else { if (lauf >= 5) s += lauf - 2; lauf = 1; }
      }
      if (lauf >= 5) s += lauf - 2;
    }
  }
  // 2: gleichfarbige 2×2-Blöcke
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = feld[r][c];
      if (v === feld[r][c + 1] && v === feld[r + 1][c] && v === feld[r + 1][c + 1]) s += 3;
    }
  }
  // 3: das Muster 1:1:3:1:1 mit vier hellen Modulen daneben
  //
  // Die Norm verlangt die lange Form mit den vier hellen Modulen. Die
  // Referenz, gegen die dieser Encoder geprüft wurde, nimmt die kurze aus
  // sieben Modulen und zählt auch Regel 1 anders – als Nachbarschaft statt
  // als Lauflänge. Deshalb wählt sie in etwa einem Drittel der Fälle eine
  // andere Maske als hier. Das ist kein Widerspruch: welche der acht
  // Masken genommen wird, steht im Formatwort, und jede ergibt einen
  // lesbaren Code. Die Bewertung entscheidet nur, welcher am besten liest.
  const MUSTER = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const UMGEKEHRT = [...MUSTER].reverse();
  const passt = (hol, i, m) => m.every((v, k) => hol(i + k) === v);
  for (let r = 0; r < n; r++) {
    for (const waagerecht of [true, false]) {
      const hol = (i) => (i < 0 || i >= n ? -1 : (waagerecht ? feld[r][i] : feld[i][r]));
      for (let i = 0; i <= n - 11; i++) {
        if (passt(hol, i, MUSTER) || passt(hol, i, UMGEKEHRT)) s += 40;
      }
    }
  }
  // 4: Abweichung vom halb-halb-Verhältnis
  let dunkel = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dunkel += feld[r][c];
  const anteil = (dunkel * 100) / (n * n);
  s += Math.floor(Math.abs(anteil - 50) / 5) * 10;
  return s;
}

/**
 * QR-Code als Feld aus 0 und 1.
 *
 * @param {string} text Inhalt, wird als UTF-8 im Byte-Modus kodiert.
 * @param {'L'|'M'|'Q'|'H'} [stufe] Fehlerkorrekturstufe; hier nur M geprüft.
 * @param {number} [maskeFest] Maske 0–7 erzwingen; −1 wählt die beste. Nur
 *   für die Prüfung – im Spiel entscheidet die Bewertung.
 * @returns {{size:number, feld:Int8Array[], maske:number}} 1 = dunkles Modul.
 */
export function qrFeld(text, stufe = 'M', maskeFest = -1) {
  if (stufe !== 'M') throw new Error('nur Stufe M ist umgesetzt');
  const bytes = new TextEncoder().encode(text).length;
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const [a1, d1, a2, d2] = BLOECKE[v];
    const platz = a1 * d1 + a2 * d2;
    const kopf = 4 + (v <= 9 ? 8 : 16);
    if (bytes * 8 + kopf <= platz * 8) { version = v; break; }
  }
  if (!version) throw new Error(`zu lang für Version 10: ${bytes} Bytes`);

  const woerter = verschraenken(datenBits(text, version), version);
  const n = version * 4 + 17;
  const frei = freiFeld(version);

  // Daten im Zickzack von unten rechts nach oben, Spalte 6 überspringen.
  const roh = Array.from({ length: n }, () => new Int8Array(n).fill(0));
  let bit = 0;
  const holBit = () => {
    if (bit >= woerter.length * 8) return 0;   // Restmodule bleiben hell
    const w = woerter[bit >> 3], b = (w >> (7 - (bit & 7))) & 1;
    bit++;
    return b;
  };
  let hoch = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) {
      const r = hoch ? n - 1 - i : i;
      for (const cc of [c, c - 1]) {
        if (frei[r][cc]) roh[r][cc] = holBit();
      }
    }
    hoch = !hoch;
  }

  // Maske wählen: die mit der kleinsten Strafe.
  const grund = grundmuster(version);
  let beste = null, besteStrafe = Infinity, besteMaske = 0;
  for (let m = 0; m < 8; m++) {
    if (maskeFest >= 0 && m !== maskeFest) continue;
    const feld = Array.from({ length: n }, (_, r) => new Int8Array(n));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        feld[r][c] = frei[r][c]
          ? (roh[r][c] ^ (MASKEN[m](r, c) ? 1 : 0))
          : grund[r][c];
      }
    }
    setzeFormat(feld, version, stufe, m);
    const s = strafe(feld);
    if (s < besteStrafe) { besteStrafe = s; beste = feld; besteMaske = m; }
  }
  return { size: n, feld: beste, maske: besteMaske };
}

function setzeFormat(feld, version, stufe, maske) {
  const n = feld.length;
  const wort = formatWort(stufe, maske);
  // Zwei Kopien, und beide laufen anders herum. Die senkrechte steht in
  // Spalte 8 und springt bei Bit 6 über die Taktzeile; die waagerechte
  // steht in Zeile 8 und läuft von rechts nach links. Im ersten Entwurf
  // hatte ich beide vertauscht – zwölf falsche Module, und kein Leser
  // erkennt den Code mehr.
  for (let i = 0; i < 15; i++) {
    const b = (wort >> i) & 1;
    // senkrecht: Zeilen 0–5, dann 7 und 8, dann unten links
    if (i < 6) feld[i][8] = b;
    else if (i < 8) feld[i + 1][8] = b;
    else feld[n - 15 + i][8] = b;
    // waagerecht: von rechts nach links, dann Spalte 7, dann 5–0
    if (i < 8) feld[8][n - 1 - i] = b;
    else if (i === 8) feld[8][7] = b;
    else feld[8][14 - i] = b;
  }
  feld[n - 8][8] = 1;
  if (version >= 7) {
    const vw = versionWort(version);
    for (let i = 0; i < 18; i++) {
      const b = (vw >> i) & 1;
      const r = Math.floor(i / 3), c = i % 3;
      feld[n - 11 + c][r] = b;
      feld[r][n - 11 + c] = b;
    }
  }
}

/**
 * Den Code auf ein Canvas malen.
 *
 * @param {HTMLCanvasElement} canvas Ziel; wird auf die passende Größe gesetzt.
 * @param {string} text Inhalt.
 * @param {object} [opt] `dunkel`, `hell`, `rand` (in Modulen, Norm: 4).
 */
export function qrZeichnen(canvas, text, opt = {}) {
  const { dunkel = '#2c2419', hell = '#f4ead6', rand = 4, modul = 0 } = opt;
  const { size, feld } = qrFeld(text);
  const gesamt = size + rand * 2;
  // Ganzzahlige Modulgröße: ein krummer Wert lässt einzelne Module um ein
  // Pixel breiter werden, und daran verschluckt sich mancher Leser.
  const m = modul || Math.max(1, Math.floor((canvas.width || 240) / gesamt));
  canvas.width = canvas.height = gesamt * m;
  const g = canvas.getContext('2d');
  g.fillStyle = hell;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = dunkel;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (feld[r][c]) g.fillRect((c + rand) * m, (r + rand) * m, m, m);
    }
  }
  return { size, modul: m };
}
