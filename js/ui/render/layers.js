/**
 * Zeichenreihenfolge und Layer-Registry.
 * Spec §1.6, Substreams nach Nachtrag §10.2.
 *
 * Jeder Layer bekommt einen eigenen Zufallsstrom. Dadurch verändert eine spätere
 * Änderung an „props" nichts an „buildings" – man kann Layer für Layer abnehmen,
 * ohne dass abgenommene Kacheln wieder anders aussehen.
 */

import { rngForTile } from './rng.js';
import { rotateTile } from './tiles.js';
import { LOD } from './contract.js';

export const LAYER_ORDER = [
  'meadow',           // Wiese
  'fields',           // Ackerparzellen
  'ground',           // Bodenkörnung, Farbflecken
  'water',            // Fluss, Quelle, See
  'roads',            // Straßen und Dorfplatz
  'cityPaving',       // Stadtpflaster und Gassen
  'cityWall',         // Stadtmauer
  'buildingShadows',  // Bodenschatten der Gebäude
  'buildings',        // Gebäude
  'landmarks',        // Kloster, Kathedrale, Wirtshaus
  'props',            // Bäume, Blumen, Karren, Zäune
  'coatOfArms',       // Wappen
  'tileEdge',         // Kachelrand-Relief
];

const registry = new Map();

/** minLod: ab welcher Detailstufe der Layer überhaupt läuft. */
export function registerLayer(name, fn, { minLod = LOD.SMALL } = {}) {
  if (!LAYER_ORDER.includes(name)) {
    throw new Error(`Layer "${name}" steht nicht in LAYER_ORDER – Reihenfolge ist Teil des Vertrags.`);
  }
  registry.set(name, { fn, minLod });
}

export function registeredLayers() {
  return LAYER_ORDER.filter((n) => registry.has(n));
}

const LOD_RANK = { small: 0, normal: 1, large: 2 };

/**
 * Eine Kachel zeichnen. Der Transform ist bereits auf normierte Koordinaten
 * gesetzt, der Clip auf das Kachelquadrat liegt an (siehe cache.js).
 *
 * opts.disabledLayers erlaubt den Substream-Test aus Nachtrag §16: einen Layer
 * abschalten darf die übrigen nicht verändern.
 */
export function renderTile(ctx, {
  tile,
  variant = 0,
  rotation = 0,
  lod = LOD.NORMAL,
  disabledLayers = null,
  debug = null,
}) {
  const rotated = rotation ? rotateTile(tile, rotation) : tile;
  const root = rngForTile(tile.id, variant);
  const rank = LOD_RANK[lod] ?? 1;

  const context = { tile: rotated, base: tile, variant, rotation, lod, rank, debug };

  for (const name of LAYER_ORDER) {
    const entry = registry.get(name);
    if (!entry) continue;
    if (disabledLayers && disabledLayers.has(name)) continue;
    if (rank < (LOD_RANK[entry.minLod] ?? 0)) continue;

    ctx.save();
    try {
      entry.fn(ctx, { ...context, rng: root.fork(name) });
    } finally {
      ctx.restore();
    }
  }

  if (debug && debug.overlay) debug.overlay(ctx, context);
}
