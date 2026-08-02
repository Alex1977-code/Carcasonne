/**
 * Adapter: Kartendefinitionen des Spiels → Renderer-Schema (tiles.js).
 *
 * Die Engine (js/engine/tiles.js) ist die einzige Quelle der Wahrheit für
 * Motive, Kantentypen und Anzahlen. Der Renderer bekommt daraus eine
 * abgeleitete Sicht – so kann keine zweite Kachelliste auseinanderlaufen.
 *
 * Engine-Schema                     Renderer-Schema
 *   edges 'CRFW' je Kante N,O,S,W  → sides ['city','road','field','river']
 *   Feature { t:'city', e:[…] }    → cityGroups [[…]]
 *   Feature { t:'road', e:[…] }    → roads [[a,b]] bzw. [[a,'c']]
 *   Feature { t:'river', e:[…] }   → rivers  ebenso
 *   Feature { t:'mon' }            → cloister
 *   shield / cath / inn            → shield / cathedral / inn
 *   riverStart / riverEnd          → spring / lake
 *   set 'ec'                       → set 'ic'
 */
import { DEFS } from '../../engine/tiles.js';

/** Kantentyp der Engine → Seitentyp des Renderers. */
const SIDE_TYPE = { C: 'city', R: 'road', F: 'field', W: 'river' };

/** Erweiterungskürzel der Engine → Set-Name des Renderers. */
const SET_NAME = { base: 'base', river: 'river', ec: 'ic' };

/**
 * Kantenliste eines Weg-/Flussfeatures → Segmente des Renderers.
 * Eine Kante = Sackgasse zur Mitte, zwei = Durchfahrt, drei+ = Stern.
 */
function toSegments(edges) {
  if (edges.length === 1) return [[edges[0], 'c']];
  if (edges.length === 2) return [[edges[0], edges[1]]];
  return edges.map((e) => [e, 'c']);
}

/** Ein Engine-Motiv in das Renderer-Schema übersetzen. */
export function adaptTile(def) {
  const set = SET_NAME[def.set];
  if (!set) throw new Error(`Unbekanntes Set "${def.set}" bei Motiv ${def.id}`);

  const sides = [...def.edges].map((ch) => {
    const type = SIDE_TYPE[ch];
    if (!type) throw new Error(`Unbekannter Kantentyp "${ch}" bei Motiv ${def.id}`);
    return type;
  });

  const cityGroups = [];
  const roads = [];
  const rivers = [];
  let shield = false;
  let cloister = false;
  let cathedral = false;
  let inn = false;

  for (const f of def.f) {
    switch (f.t) {
      case 'city':
        cityGroups.push([...f.e]);
        if (f.shield > 0) shield = true;
        if (f.cath) cathedral = true;
        break;
      case 'road':
        roads.push(...toSegments(f.e));
        if (f.inn) inn = true;
        break;
      case 'river':
        rivers.push(...toSegments(f.e));
        break;
      case 'mon':
        cloister = true;
        break;
      default:
        break; // Wiesen trägt der Renderer über die Seitentypen
    }
  }

  return {
    id: `${set}-${def.id}`,
    set,
    count: def.count,
    sides,
    cityGroups,
    roads,
    rivers,
    shield,
    cloister,
    cathedral,
    inn,
    spring: !!def.riverStart,
    lake: !!def.riverEnd,
  };
}

/** Alle Motive des Spiels im Renderer-Schema. */
export function adaptedTiles(defs = DEFS) {
  return Object.values(defs).map(adaptTile);
}

/** Nachschlagen über die Renderer-Id (z. B. 'base-D'). */
export function adaptedTileById(defs = DEFS) {
  return Object.fromEntries(adaptedTiles(defs).map((t) => [t.id, t]));
}

/** Renderer-Id → Engine-Id, für die Rückrichtung beim Zeichnen. */
export function engineIdOf(rendererId) {
  return rendererId.slice(rendererId.indexOf('-') + 1);
}
