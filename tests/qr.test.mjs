// QR-Prüfung: node tests/qr.test.mjs
//
// Ein QR-Encoder lässt sich nicht ansehen. Ein falsches Bit sieht aus wie
// ein richtiges, und auffallen würde es erst, wenn jemand mit dem Telefon
// davorsteht und nichts passiert.
//
// Deshalb wurde js/ui/qr.js beim Schreiben Modul für Modul gegen eine
// unabhängige Umsetzung gestellt (qrcode-generator, nur zur Prüfung
// installiert, nicht im Spiel): 305 Zeichenketten von 1 bis 200 Zeichen
// über die Versionen 1 bis 10, ASCII und UTF-8, jede in allen acht Masken.
// Alle 305 stimmten vollständig überein.
//
// Zwei Dinge weichen bewusst ab, und beide sind keine Fehler:
//
//   Die Maskenwahl. Die Referenz zählt Regel 1 als Nachbarschaft statt als
//   Lauflänge und benutzt für Regel 3 die kurze Musterform. Welche der
//   acht Masken genommen wird, steht im Formatwort; jede ergibt einen
//   lesbaren Code. In etwa zwei Dritteln der Fälle wählt die Norm-Bewertung
//   hier eine andere als die Referenz.
//
//   Die Kodierung von Umlauten. Der Byte-Modus der Referenz ist
//   voreingestellt nicht UTF-8; für den Vergleich wurde sie umgestellt.
//
// Was hier steht, sind die an jenem Tag geprüften Matrizen als Festwert.
// Der Test hält also nicht die Norm fest, sondern den geprüften Stand –
// er schlägt an, wenn sich am Encoder etwas ändert, und dann gehört die
// Änderung neu gegen eine Referenz gestellt.
import { qrFeld } from '../js/ui/qr.js';

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FEHLT:', msg); }
}

const GEPRUEFT = [
  { text: 'A',
    size: 21, maske: 3,
    b64: '/pP8F9Buirt1tdunLsEtB/qv4BsAtzpayvIztBtoJ8nkkgBZJ/plEFg2um+N15+uqsEESl/oSAA=' },
  { text: 'Carcassonne',
    size: 21, maske: 2,
    b64: '/kv8EFBuuLt1FduorsFZB/qv4BgAvnPjpP1X05yZOfaotABnU/hIUFSfupMN1HUuqpEEuM/vsQA=' },
  { text: 'https://alex1977-code.github.io/Carcasonne/#raum=ABCDE',
    size: 33, maske: 3,
    b64: '/sS3v8FCMtBukEaLt1RQRdunYErsEKPVB/qqqv4BULQAtzr2pZbwH9tTuppXao73Bp/2Ej3BQqYQq1mf0tGZES7sk9ss6kTepPaUgvOe3qaScS/pAkFtASttFP4DHt7bLWEbunPA+QB1+sY/oqZqUF/i8fuglN+11kHghuqIPNEEb4ex/v/lagA=' },
  { text: 'Grüße aus Carcassonne – Straßen, Städte, Wiesen',
    size: 33, maske: 2,
    b64: '/kr9P8E44xBuqI/rt1gmFduqP9LsFpJlB/qqqv4BwVwAvi7CvnYP/RmYkdOgIQGvnL7iOQQgoSnrLN8+IlRQmigvNoli2TTsHtE0lesTZ77CsSXgcu/E4fz4sr5gol1Kidyen7DK+QBpvsZ/i5Lq0FJu8ZurmC+l1OnuLuvft+EELswU/s86cQA=' },
  { text: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    size: 45, maske: 2,
    b64: '/ghXVkv8Eggv5pBuuuoqdLt1gvQGNduovf1jrsFsJH5BB/qqqqqv4B0BFTwAvgVPg1PgAP16sOjQwAF/K+3I4EFTxcwn3iA1BJwb56sOjq08d/K+wLY2FTxc217iA1BOqbp6sOjckgd/K+3pZGFTxcf8/vg1/NxZ5GsMTWrQq/LqyxTfFT0c/9G/g0/JiO/SsEDW6wHfLUywjUtT789uCYg0rJBu7SsEDCyBnfLU1xlEtT78XuA4g0rLB+LSsEDCyPnfLUzxm0tT78m+Y/g0/IBwrGsET/hM6/Kq0FoTFT0curJPg1/N1IkGsJTuosKfLg0E8T5T2s/qpVg0fQA=' },
  { text: 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
    size: 57, maske: 1,
    b64: '/psoqqqvP8EHwbd3dpBuvgTRMRHLt0xluoqqpdukMg/qqpLsFKwLE3dxB/qqqqqqqv4AG6nHd3UAoxg2PqqqEuQSjpqqqqnHnh4sREQkoYNKWnd3V6UpuxmqqqKWYQjPqqqqnOhj/WREQkpAc6f3d3V4ctoyaqqqKWoQQJqqqqnAji8sREQkpasSW/d3V6flpODKqqKWrUZZuqqqnA1DUtxEQkvYwdW0d3V6PtouCiqqKWoUWZpqqqnz9SE/hEQ+tR9eXHd3UaCsTOaqqrqXxTCbGqqsX/9oEvxEQ+s66+nfd3fa4kDO5KqrQSCTChqqqikyt6CixEQKl5Y+Rfd3fYwkDefKqrQaCAhJ6qqinxr4S8xEQKsBYXn/d3fazniCZKqrQSaAqZqqqinToZiixEQKqB4fncd3faT1DaZ6qrQSaopZqqqinpogKjxEQKvy6cnbd3faA1B6fqqr+QBkJZGqqsX/pmOqxERqsE0clHd3UaulZ5vqqq+V0npP2qqt0up0NSxEQq8E0sOrd3ao/vT4MKqrEIA=' },
];

// ---------- 1. Die geprüften Matrizen, Modul für Modul ----------
for (const e of GEPRUEFT) {
  const q = qrFeld(e.text);
  const kurz = e.text.length > 24 ? e.text.slice(0, 21) + '…' : e.text;
  ok(q.size === e.size, `${kurz}: Größe ${q.size}, erwartet ${e.size}`);
  ok(q.maske === e.maske, `${kurz}: Maske ${q.maske}, erwartet ${e.maske}`);
  if (q.size !== e.size) continue;
  const roh = Buffer.from(e.b64, 'base64');
  let anders = 0, ersteR = -1, ersteC = -1;
  for (let r = 0; r < q.size; r++) {
    for (let c = 0; c < q.size; c++) {
      const i = r * q.size + c;
      const soll = (roh[i >> 3] >> (7 - (i & 7))) & 1;
      if (soll !== q.feld[r][c]) {
        if (!anders) { ersteR = r; ersteC = c; }
        anders++;
      }
    }
  }
  ok(anders === 0, `${kurz}: ${anders} Module weichen ab, erstes bei ${ersteR}/${ersteC}`);
}
console.log(`  ${GEPRUEFT.length} geprüfte Matrizen nachgerechnet`);

// ---------- 2. Aufbau: was in jedem QR-Code gleich ist ----------
{
  let n = 0;
  for (const text of ['A', 'Carcassonne', 'x'.repeat(60), 'y'.repeat(150)]) {
    const q = qrFeld(text);
    n++;
    ok((q.size - 17) % 4 === 0 && q.size >= 21 && q.size <= 57,
      `Größe ${q.size} ist eine gültige Versionsgröße`);
    // Suchmuster in drei Ecken: 7×7, außen dunkel, dann hell, dann 3×3 dunkel
    for (const [r0, c0] of [[0, 0], [0, q.size - 7], [q.size - 7, 0]]) {
      let gut = true;
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = r === 0 || r === 6 || c === 0 || c === 6;
          const kern = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (q.feld[r0 + r][c0 + c] !== (ring || kern ? 1 : 0)) gut = false;
        }
      }
      ok(gut, `Suchmuster bei ${r0}/${c0} vollständig`);
    }
    // Taktmuster: abwechselnd, beginnend dunkel
    let takt = true;
    for (let i = 8; i < q.size - 8; i++) {
      if (q.feld[6][i] !== (i % 2 === 0 ? 1 : 0)) takt = false;
      if (q.feld[i][6] !== (i % 2 === 0 ? 1 : 0)) takt = false;
    }
    ok(takt, 'Taktmuster durchgehend');
    // Das immer dunkle Modul
    ok(q.feld[q.size - 8][8] === 1, 'dunkles Modul gesetzt');
  }
  console.log(`  ${n} Codes auf Suchmuster, Taktmuster und dunkles Modul geprüft`);
}

// ---------- 3. Die Version wächst mit der Länge, und nur dann ----------
{
  let letzte = 0, spruenge = 0, verkehrt = 0;
  for (let len = 1; len <= 200; len++) {
    const q = qrFeld('a'.repeat(len));
    const v = (q.size - 17) / 4;
    if (v < letzte) verkehrt++;
    if (v > letzte) spruenge++;
    letzte = v;
  }
  ok(verkehrt === 0, 'die Version wird nie kleiner, wenn der Text länger wird');
  ok(letzte === 10, `200 Zeichen ergeben Version ${letzte}, erwartet 10`);
  console.log(`  1 bis 200 Zeichen: ${spruenge} Versionswechsel, keiner rückwärts`);
}

// ---------- 4. Zu lang wird abgelehnt, nicht abgeschnitten ----------
{
  let geworfen = false;
  try { qrFeld('z'.repeat(300)); } catch { geworfen = true; }
  ok(geworfen, '300 Zeichen passen in keine Version bis 10 und werden abgelehnt');
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
