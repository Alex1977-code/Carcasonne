// Schema-Prüfung der Kacheldaten: node tests/tiles-schema.test.mjs
// Prüft den Adapter Engine → Renderer und lässt validateTiles() darüber laufen.
import { DEFS } from '../js/engine/tiles.js';
import { adaptedTiles, adaptTile, engineIdOf } from '../js/ui/render/adapt-tiles.js';
import { validateTiles, rotateTile, SETS } from '../js/ui/render/tiles.js';

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${b}, war ${a})`); }

const tiles = adaptedTiles();

// ---------- 1. validateTiles über die echten Spieldaten ----------
{
  const res = validateTiles(tiles);
  for (const p of res.problems) console.error('  Schema:', p);
  ok(res.ok, `validateTiles ohne Befund (${res.problems.length} Probleme)`);
  for (const [set, exp] of Object.entries(SETS)) {
    const got = res.counts[set] || { types: 0, tiles: 0 };
    eq(got.types, exp.expectedTypes, `${exp.label}: Motivzahl`);
    eq(got.tiles, exp.expectedTiles, `${exp.label}: Kartenzahl`);
  }
  eq(tiles.length, 49, 'insgesamt 49 Motive');
}

// ---------- 2. Adapter bildet jede Kante verlustfrei ab ----------
{
  const TYPE = { C: 'city', R: 'road', F: 'field', W: 'river' };
  for (const def of Object.values(DEFS)) {
    const t = adaptTile(def);
    eq(t.sides.length, 4, `${def.id}: 4 Seiten`);
    for (let s = 0; s < 4; s++) {
      eq(t.sides[s], TYPE[def.edges[s]], `${def.id}: Seite ${s}`);
    }
    // Jede Stadt-/Weg-/Flusskante der Engine taucht im Renderer-Schema auf
    const cityEdges = new Set(t.cityGroups.flat());
    const roadEdges = new Set(t.roads.flat().filter((p) => p !== 'c'));
    const riverEdges = new Set(t.rivers.flat().filter((p) => p !== 'c'));
    for (let s = 0; s < 4; s++) {
      if (def.edges[s] === 'C') ok(cityEdges.has(s), `${def.id}: Stadtkante ${s} übernommen`);
      if (def.edges[s] === 'R') ok(roadEdges.has(s), `${def.id}: Straßenkante ${s} übernommen`);
      if (def.edges[s] === 'W') ok(riverEdges.has(s), `${def.id}: Flusskante ${s} übernommen`);
    }
    // Flags
    eq(t.cloister, def.f.some((f) => f.t === 'mon'), `${def.id}: Kloster-Flag`);
    eq(t.cathedral, def.f.some((f) => f.t === 'city' && f.cath), `${def.id}: Kathedralen-Flag`);
    eq(t.inn, def.f.some((f) => f.t === 'road' && f.inn), `${def.id}: Wirtshaus-Flag`);
    eq(t.shield, def.f.some((f) => f.t === 'city' && f.shield > 0), `${def.id}: Wappen-Flag`);
    eq(t.count, def.count, `${def.id}: Anzahl`);
    eq(engineIdOf(t.id), def.id, `${def.id}: Id-Rückweg`);
  }
}

// ---------- 3. Gedrehte Motive bleiben schemakonform ----------
{
  for (const rot of [1, 2, 3]) {
    const rotated = tiles.map((t) => rotateTile(t, rot));
    const res = validateTiles(rotated);
    for (const p of res.problems) console.error(`  Rotation ${rot}:`, p);
    ok(res.ok, `validateTiles nach Rotation ${rot}`);
  }
  // Vier Drehungen führen zum Ausgangsmotiv zurück
  for (const t of tiles) {
    let r = t;
    for (let i = 0; i < 4; i++) r = rotateTile(r, 1);
    eq(r.sides.join(','), t.sides.join(','), `${t.id}: 4×90° = Ausgangslage`);
  }
}

// ---------- 4. Segmente: Sackgassen enden in der Mitte ----------
{
  for (const t of tiles) {
    for (const seg of [...t.roads, ...t.rivers]) {
      ok(seg.length === 2, `${t.id}: Segment hat zwei Endpunkte`);
      ok(seg.some((p) => p !== 'c'), `${t.id}: Segment hat mindestens eine Kante`);
      for (const p of seg) {
        ok(p === 'c' || (Number.isInteger(p) && p >= 0 && p <= 3),
          `${t.id}: Endpunkt ${p} ist Kante 0–3 oder 'c'`);
      }
    }
  }
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
