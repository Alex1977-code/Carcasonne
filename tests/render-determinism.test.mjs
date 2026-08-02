// Regel 1 des Grafik-Prompts (nicht verhandelbar):
// node tests/render-determinism.test.mjs
//
// Jede Dekoration kommt aus einem seedbaren PRNG, geseedet mit
// hash(tileTypeId + tileInstanceId). Sonst sehen die Karten bei den
// Mitspielern anders aus als beim Host.
import { readFileSync, readdirSync } from 'node:fs';
import { hashString, mulberry32, variantOf, tileSeed, VARIANT_COUNT, Rng, rngForTile } from '../js/ui/render/rng.js';

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${b}, war ${a})`); }

// ---------- 1. Kein Math.random im Renderpfad ----------
{
  // Kommentare ausblenden – sie dürfen die Regel benennen, ohne sie zu brechen
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const files = ['js/ui/render.js',
    ...readdirSync('js/ui/render').filter((f) => f.endsWith('.js')).map((f) => 'js/ui/render/' + f)];
  for (const file of files) {
    const code = stripComments(readFileSync(file, 'utf8'));
    ok(!/Math\.random\s*\(/.test(code), `${file}: kein Math.random im Renderpfad`);
    ok(!/Date\.now\s*\(/.test(code), `${file}: keine Uhrzeit als Zufallsquelle`);
    ok(!/new Date\s*\(\s*\)/.test(code), `${file}: kein Datum als Zufallsquelle`);
  }
  ok(files.length >= 8, `Renderdateien gefunden (${files.length})`);

  // Der Scanner muss auch anschlagen, sonst prüft er nichts
  ok(/Math\.random\s*\(/.test(stripComments('const x = Math.random();')),
    'Scanner erkennt echten Aufruf');
  ok(!/Math\.random\s*\(/.test(stripComments('// Math.random() ist verboten')),
    'Scanner ignoriert Kommentare');
}

// ---------- 2. Hash und PRNG sind über Sitzungen stabil ----------
{
  // Feste Erwartungswerte: ändern sie sich, ändert sich das Bild bei allen.
  eq(hashString(''), 2166136261, 'FNV-1a Startwert');
  eq(hashString('base-D'), hashString('base-D'), 'gleicher Text, gleicher Hash');
  ok(hashString('base-D') !== hashString('base-E'), 'verschiedene Motive, verschiedene Hashes');

  const a = mulberry32(12345), b = mulberry32(12345);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  eq(seqA.join(','), seqB.join(','), 'mulberry32 reproduziert die Folge');
  ok(seqA.every((v) => v >= 0 && v < 1), 'Werte liegen in [0,1)');
  const c = mulberry32(12346);
  ok(c() !== seqA[0], 'anderer Seed, andere Folge');
}

// ---------- 3. Variante hängt an der Instanz, nicht an der Reihenfolge ----------
{
  for (const key of ['0,0', '1,0', '0,1', '-3,7', '12,-5']) {
    const v = variantOf(key);
    ok(Number.isInteger(v) && v >= 0 && v < VARIANT_COUNT, `${key}: Variante in [0,${VARIANT_COUNT})`);
    eq(variantOf(key), v, `${key}: Variante ist reproduzierbar`);
  }
  // Nachbarfelder bekommen möglichst nicht dieselbe Variante
  const grid = [];
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) grid.push(variantOf(`${x},${y}`));
  const counts = new Array(VARIANT_COUNT).fill(0);
  for (const v of grid) counts[v]++;
  ok(counts.every((n) => n > grid.length / VARIANT_COUNT * 0.5),
    `Varianten einigermaßen gleich verteilt: ${counts.join('/')}`);

  // Verschiedene Varianten müssen verschiedene Seeds ergeben
  const seeds = new Set();
  for (let v = 0; v < VARIANT_COUNT; v++) seeds.add(tileSeed('base-D', v));
  eq(seeds.size, VARIANT_COUNT, 'jede Variante hat einen eigenen Seed');
  eq(tileSeed('base-D', 2), tileSeed('base-D', 2), 'Seed ist reproduzierbar');
  ok(tileSeed('base-D', 2) !== tileSeed('base-E', 2), 'Motiv geht in den Seed ein');
}

// ---------- 4. Layer-Substreams: unabhängig und reproduzierbar ----------
{
  const root1 = rngForTile('base-D', 3);
  const root2 = rngForTile('base-D', 3);
  const meadow1 = root1.fork('meadow');
  const meadow2 = root2.fork('meadow');
  const seq1 = Array.from({ length: 6 }, () => meadow1.next());
  const seq2 = Array.from({ length: 6 }, () => meadow2.next());
  eq(seq1.join(','), seq2.join(','), 'derselbe Layer liefert dieselbe Folge');

  // Ein Layer darf die Ziehungen der anderen nicht verschieben
  const rootA = rngForTile('base-D', 3);
  const fieldsA = rootA.fork('fields');
  const seqFieldsA = Array.from({ length: 6 }, () => fieldsA.next());

  const rootB = rngForTile('base-D', 3);
  const meadowB = rootB.fork('meadow');
  Array.from({ length: 25 }, () => meadowB.next());   // Layer davor zieht mehr
  const fieldsB = rootB.fork('fields');
  const seqFieldsB = Array.from({ length: 6 }, () => fieldsB.next());
  eq(seqFieldsA.join(','), seqFieldsB.join(','),
    'Substream bleibt unabhängig von den Ziehungen anderer Layer');

  const other = rngForTile('base-D', 3).fork('roads');
  ok(other.next() !== seq1[0], 'verschiedene Layer, verschiedene Folgen');
}

// ---------- 5. Rng-Hilfsfunktionen bleiben im Rahmen ----------
{
  const r = new Rng(tileSeed('base-V', 1), 'test');
  for (let i = 0; i < 200; i++) {
    const v = r.range(0.2, 0.8);
    ok(v >= 0.2 && v < 0.8, 'range bleibt im Intervall');
    const n = r.int(0, 5);
    ok(Number.isInteger(n) && n >= 0 && n < 5, 'int bleibt im Intervall');
  }
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
