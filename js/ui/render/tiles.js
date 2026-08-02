/**
 * Kachelmotive – Grundspiel (24), Der Fluss (9), Wirtshäuser & Kathedralen (16).
 *
 * WICHTIG: Diese Tabelle ist eine Mapping-Vorlage. Dein Spiel hat die Motive
 * bereits definiert, sonst würde es nicht laufen. Ersetze sie durch einen Adapter
 * auf deine vorhandenen Daten (siehe adaptTiles unten) – der Renderer braucht nur
 * das hier beschriebene Schema.
 *
 * Schema
 *   sides       ['city'|'road'|'field'|'river'] im Uhrzeigersinn ab Norden
 *   cityGroups  Gruppen von Seitenindizes, die zu einer Stadt verbunden sind
 *   roads       Segmente; Endpunkt ist ein Seitenindex 0–3 oder 'c' für die Mitte
 *   rivers      wie roads
 *   shield      Wappen
 *   cloister / cathedral / inn / spring / lake
 */

import { SIDES } from './contract.js';

const F = 'field', C = 'city', R = 'road', V = 'river';

/** Kurzschreibweise, füllt Defaults auf. */
function t(id, set, count, sides, extra = {}) {
  return {
    id, set, count, sides,
    cityGroups: [], roads: [], rivers: [],
    shield: false, cloister: false, cathedral: false,
    inn: false, spring: false, lake: false,
    ...extra,
  };
}

export const TILES = [
  // ----------------------------------------------------------- Grundspiel
  t('base-A', 'base', 2, [F, F, R, F], { cloister: true, roads: [[2, 'c']] }),
  t('base-B', 'base', 4, [F, F, F, F], { cloister: true }),
  t('base-C', 'base', 1, [C, C, C, C], { cityGroups: [[0, 1, 2, 3]], shield: true }),
  t('base-D', 'base', 4, [C, R, F, R], { cityGroups: [[0]], roads: [[1, 3]] }),
  t('base-E', 'base', 5, [C, F, F, F], { cityGroups: [[0]] }),
  t('base-F', 'base', 2, [F, C, F, C], { cityGroups: [[1, 3]], shield: true }),
  t('base-G', 'base', 1, [F, C, F, C], { cityGroups: [[1, 3]] }),
  t('base-H', 'base', 3, [F, C, F, C], { cityGroups: [[1], [3]] }),
  t('base-I', 'base', 2, [F, C, C, F], { cityGroups: [[1], [2]] }),
  t('base-J', 'base', 3, [C, R, R, F], { cityGroups: [[0]], roads: [[1, 2]] }),
  t('base-K', 'base', 3, [C, F, R, R], { cityGroups: [[0]], roads: [[2, 3]] }),
  t('base-L', 'base', 3, [C, R, R, R], { cityGroups: [[0]], roads: [[1, 'c'], [2, 'c'], [3, 'c']] }),
  t('base-M', 'base', 2, [C, F, F, C], { cityGroups: [[0, 3]], shield: true }),
  t('base-N', 'base', 3, [C, F, F, C], { cityGroups: [[0, 3]] }),
  t('base-O', 'base', 2, [C, R, R, C], { cityGroups: [[0, 3]], roads: [[1, 2]], shield: true }),
  t('base-P', 'base', 3, [C, R, R, C], { cityGroups: [[0, 3]], roads: [[1, 2]] }),
  t('base-Q', 'base', 1, [C, C, F, C], { cityGroups: [[0, 1, 3]], shield: true }),
  t('base-R', 'base', 3, [C, C, F, C], { cityGroups: [[0, 1, 3]] }),
  t('base-S', 'base', 2, [C, C, R, C], { cityGroups: [[0, 1, 3]], roads: [[2, 'c']], shield: true }),
  t('base-T', 'base', 1, [C, C, R, C], { cityGroups: [[0, 1, 3]], roads: [[2, 'c']] }),
  t('base-U', 'base', 8, [R, F, R, F], { roads: [[0, 2]] }),
  t('base-V', 'base', 9, [F, F, R, R], { roads: [[2, 3]] }),
  t('base-W', 'base', 4, [F, R, R, R], { roads: [[1, 'c'], [2, 'c'], [3, 'c']] }),
  t('base-X', 'base', 1, [R, R, R, R], { roads: [[0, 'c'], [1, 'c'], [2, 'c'], [3, 'c']] }),

  // ------------------------------------------------------------ Der Fluss
  t('river-quelle', 'river', 1, [F, F, V, F], { rivers: [[2, 'c']], spring: true }),
  t('river-see', 'river', 1, [V, F, F, F], { rivers: [[0, 'c']], lake: true }),
  t('river-gerade', 'river', 2, [V, F, V, F], { rivers: [[0, 2]] }),
  t('river-kurve', 'river', 3, [F, F, V, V], { rivers: [[2, 3]] }),
  t('river-bruecke', 'river', 1, [V, R, V, R], { rivers: [[0, 2]], roads: [[1, 3]] }),
  t('river-stadt-kurve', 'river', 1, [C, V, V, F], { cityGroups: [[0]], rivers: [[1, 2]] }),
  t('river-kloster', 'river', 1, [F, V, V, R], { cloister: true, rivers: [[1, 2]], roads: [[3, 'c']] }),
  t('river-stadt-gerade', 'river', 1, [V, C, V, C], { cityGroups: [[1], [3]], rivers: [[0, 2]] }),
  t('river-strassenende', 'river', 1, [F, R, V, V], { rivers: [[2, 3]], roads: [[1, 'c']] }),

  // ------------------------------------------- Wirtshäuser & Kathedralen
  t('ic-kathedrale-gross', 'ic', 1, [C, C, C, C], { cityGroups: [[0, 1, 2, 3]], cathedral: true }),
  t('ic-kathedrale-drei', 'ic', 1, [C, C, F, C], { cityGroups: [[0, 1, 3]], cathedral: true }),

  t('ic-wirtshaus-gerade', 'ic', 1, [R, F, R, F], { roads: [[0, 2]], inn: true }),
  t('ic-wirtshaus-kurve', 'ic', 1, [F, F, R, R], { roads: [[2, 3]], inn: true }),
  t('ic-wirtshaus-gabel', 'ic', 1, [F, R, R, R], { roads: [[1, 'c'], [2, 'c'], [3, 'c']], inn: true }),
  t('ic-wirtshaus-stadt', 'ic', 1, [C, R, F, R], { cityGroups: [[0]], roads: [[1, 3]], inn: true }),
  t('ic-wirtshaus-stadtkurve', 'ic', 1, [C, R, R, C], { cityGroups: [[0, 3]], roads: [[1, 2]], inn: true }),
  t('ic-wirtshaus-stadtsued', 'ic', 1, [R, F, C, F], { cityGroups: [[2]], roads: [[0, 'c']], inn: true }),

  t('ic-stadt-ecke-strasse', 'ic', 1, [C, C, R, R], { cityGroups: [[0, 1]], roads: [[2, 3]] }),
  t('ic-stadt-drei-strasse', 'ic', 1, [C, C, C, R], { cityGroups: [[0, 1, 2]], roads: [[3, 'c']], shield: true }),
  t('ic-stadt-getrennt-strasse', 'ic', 1, [C, R, C, R], { cityGroups: [[0], [2]], roads: [[1, 3]] }),
  t('ic-stadt-drei-wappen', 'ic', 1, [C, C, F, C], { cityGroups: [[0, 1, 3]], shield: true }),
  t('ic-stadt-gabel', 'ic', 2, [C, R, R, R], { cityGroups: [[0]], roads: [[1, 'c'], [2, 'c'], [3, 'c']] }),
  t('ic-stadt-ecke-wappen', 'ic', 1, [C, R, R, C], { cityGroups: [[0, 3]], roads: [[1, 2]], shield: true }),
  t('ic-stadt-kreuzung', 'ic', 1, [C, R, R, R], { cityGroups: [[0]], roads: [[1, 'c'], [2, 'c'], [3, 'c']], shield: true }),
  t('ic-stadt-durchgang', 'ic', 2, [C, F, C, F], { cityGroups: [[0, 2]] }),
];

export const TILE_BY_ID = Object.fromEntries(TILES.map((x) => [x.id, x]));

export const SETS = {
  base: { label: 'Grundspiel', expectedTypes: 24, expectedTiles: 72 },
  river: { label: 'Der Fluss', expectedTypes: 9, expectedTiles: 12 },
  ic: { label: 'Wirtshäuser & Kathedralen', expectedTypes: 16, expectedTiles: 18 },
};

/**
 * Adapter auf vorhandene Spieldaten.
 * mapFn bekommt einen deiner Kacheldatensätze und gibt das obige Schema zurück.
 */
export function adaptTiles(sourceTiles, mapFn) {
  return sourceTiles.map(mapFn);
}

/**
 * Schema-Prüfung. Läuft in der Galerie und sollte in den Testlauf.
 * Fängt genau die Fehler, die später als „Straße endet im Nichts" auffallen.
 */
export function validateTiles(tiles = TILES) {
  const problems = [];

  for (const tile of tiles) {
    const seen = { city: new Set(), road: new Set(), river: new Set() };

    for (const group of tile.cityGroups) {
      for (const s of group) {
        if (tile.sides[s] !== 'city') problems.push(`${tile.id}: Stadtgruppe nennt Seite ${s}, die keine Stadt ist`);
        if (seen.city.has(s)) problems.push(`${tile.id}: Seite ${s} in zwei Stadtgruppen`);
        seen.city.add(s);
      }
    }
    for (const seg of tile.roads) {
      for (const p of seg) {
        if (p === 'c') continue;
        if (tile.sides[p] !== 'road') problems.push(`${tile.id}: Straße endet an Seite ${p}, die keine Straße ist`);
        seen.road.add(p);
      }
    }
    for (const seg of tile.rivers) {
      for (const p of seg) {
        if (p === 'c') continue;
        if (tile.sides[p] !== 'river') problems.push(`${tile.id}: Fluss endet an Seite ${p}, die kein Fluss ist`);
        seen.river.add(p);
      }
    }

    for (const s of SIDES) {
      const type = tile.sides[s];
      if (type === 'city' && !seen.city.has(s)) problems.push(`${tile.id}: Stadtkante ${s} ohne Stadtgruppe`);
      if (type === 'road' && !seen.road.has(s)) problems.push(`${tile.id}: Straßenkante ${s} ohne Straßensegment`);
      if (type === 'river' && !seen.river.has(s)) problems.push(`${tile.id}: Flusskante ${s} ohne Flusssegment`);
    }

    if (tile.cathedral && tile.cityGroups.length === 0) problems.push(`${tile.id}: Kathedrale ohne Stadt`);
    if (tile.inn && tile.roads.length === 0) problems.push(`${tile.id}: Wirtshaus ohne Straße`);
  }

  const counts = {};
  for (const tile of tiles) {
    counts[tile.set] = counts[tile.set] || { types: 0, tiles: 0 };
    counts[tile.set].types++;
    counts[tile.set].tiles += tile.count;
  }
  for (const [set, expected] of Object.entries(SETS)) {
    const got = counts[set] || { types: 0, tiles: 0 };
    if (got.types !== expected.expectedTypes)
      problems.push(`${expected.label}: ${got.types} Motive statt ${expected.expectedTypes}`);
    if (got.tiles !== expected.expectedTiles)
      problems.push(`${expected.label}: ${got.tiles} Karten statt ${expected.expectedTiles}`);
  }

  return { problems, counts, ok: problems.length === 0 };
}

/** Gedrehte Kopie eines Motivs – der Renderer dreht die Geometrie, nie das Bitmap. */
export function rotateTile(tile, rotation) {
  const r = ((rotation % 4) + 4) % 4;
  if (r === 0) return tile;
  const rs = (s) => (s === 'c' ? 'c' : (s + r) % 4);
  return {
    ...tile,
    rotation: r,
    sides: [0, 1, 2, 3].map((s) => tile.sides[(s - r + 4) % 4]),
    cityGroups: tile.cityGroups.map((g) => g.map(rs)),
    roads: tile.roads.map((seg) => seg.map(rs)),
    rivers: tile.rivers.map((seg) => seg.map(rs)),
  };
}
