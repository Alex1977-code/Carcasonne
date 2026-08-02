/**
 * Kantenvertrag, Sperrzonen, LOD und Maßeinheiten.
 * Spec §1.2, §1.3, §1.5 – präzisiert durch Nachtrag §11, §12, §13.
 *
 * Alle Koordinaten sind normiert (0…1). Die Kachel wird mit ctx.scale(size, size)
 * gezeichnet, Haarlinien laufen über hairline() in Gerätepixeln.
 */

// Seiten im Uhrzeigersinn, N = 0.
export const N = 0, E = 1, S = 2, W = 3;
export const SIDES = [N, E, S, W];
export const SIDE_NAMES = ['N', 'E', 'S', 'W'];

export const EDGE = {
  ROAD_WIDTH: 0.14,
  RIVER_WIDTH: 0.18,
  /** Radius der Sperrzone um jede Kantenmitte. */
  KEEPOUT: 0.22,
  /** Häuser dürfen an Stadtkanten so dicht heran (Nachtrag §11.1). */
  CITY_BUILDING_MARGIN: 0.02,
  /** Ackerparzellen enden so weit vor dem Kachelrand. */
  FIELD_BORDER_MARGIN: 0.05,
  /** Zusätzlicher Abstand von Ackerparzellen zur Straßenkante. */
  FIELD_ROAD_MARGIN: 0.04,
  ALLEY_WIDTH: 0.05,
};

export const halfWidth = {
  road: EDGE.ROAD_WIDTH / 2,
  river: EDGE.RIVER_WIDTH / 2,
};

/** Mittelpunkt einer Kante in normierten Koordinaten. */
export function edgeAnchor(side) {
  switch (side) {
    case N: return { x: 0.5, y: 0 };
    case E: return { x: 1, y: 0.5 };
    case S: return { x: 0.5, y: 1 };
    case W: return { x: 0, y: 0.5 };
    default: throw new Error(`Unbekannte Seite: ${side}`);
  }
}

/** Nach innen zeigende Normale einer Kante. */
export function edgeNormal(side) {
  switch (side) {
    case N: return { x: 0, y: 1 };
    case E: return { x: -1, y: 0 };
    case S: return { x: 0, y: -1 };
    case W: return { x: 1, y: 0 };
    default: throw new Error(`Unbekannte Seite: ${side}`);
  }
}

/** Punkt auf der Kantenachse, depth nach innen. */
export function edgePoint(side, depth, offset = 0) {
  const a = edgeAnchor(side);
  const n = edgeNormal(side);
  // Tangente = Normale um 90° gedreht
  const t = { x: -n.y, y: n.x };
  return { x: a.x + n.x * depth + t.x * offset, y: a.y + n.y * depth + t.y * offset };
}

/** Kachelrotation: Seite s in einer um rot × 90° gedrehten Kachel. */
export function rotateSide(side, rotation) {
  return (side + rotation) % 4;
}

/** Punkt im Kachelquadrat um rot × 90° drehen. */
export function rotatePoint(p, rotation) {
  const r = ((rotation % 4) + 4) % 4;
  switch (r) {
    case 0: return { x: p.x, y: p.y };
    case 1: return { x: 1 - p.y, y: p.x };
    case 2: return { x: 1 - p.x, y: 1 - p.y };
    case 3: return { x: p.y, y: 1 - p.x };
  }
}

// ------------------------------------------------------------- Sperrzonen

/**
 * Was darf wo stehen? (Nachtrag §11.1)
 * cls: 'building' | 'landmark' | 'prop' | 'field'
 */
const KEEPOUT_RULES = {
  road:  { building: true,  landmark: true, prop: true, field: true },
  river: { building: true,  landmark: true, prop: true, field: true },
  city:  { building: false, landmark: true, prop: true, field: true },
  field: { building: false, landmark: false, prop: false, field: false },
};

/**
 * Liegt (x, y) für ein Objekt der Klasse cls in einer Sperrzone?
 * sides = ['city','road','field','river'] im Uhrzeigersinn ab Norden.
 */
export function isBlocked(x, y, cls, sides, radius = 0) {
  for (const side of SIDES) {
    const type = sides[side] || 'field';
    const rules = KEEPOUT_RULES[type] || KEEPOUT_RULES.field;
    if (!rules[cls]) continue;
    const a = edgeAnchor(side);
    if (Math.hypot(x - a.x, y - a.y) < EDGE.KEEPOUT + radius) return true;
  }

  if (cls === 'field') {
    const m = EDGE.FIELD_BORDER_MARGIN + radius;
    if (x < m || x > 1 - m || y < m || y > 1 - m) return true;
  }

  if (cls === 'building') {
    // Gebäude dürfen nur auf Stadtkanten bis dicht an den Rand.
    const m = EDGE.CITY_BUILDING_MARGIN + radius;
    if (x < m || x > 1 - m || y < m || y > 1 - m) {
      const nearestSide = nearestEdge(x, y);
      if (sides[nearestSide] !== 'city') return true;
    }
  }

  return false;
}

function nearestEdge(x, y) {
  const d = [y, 1 - x, 1 - y, x];
  let best = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i;
  return best;
}

/** Alle Sperrzonen als Kreise – nur für die Debug-Überlagerung. */
export function keepoutCircles(sides, cls = 'prop') {
  return SIDES
    .filter((side) => (KEEPOUT_RULES[sides[side] || 'field'] || {})[cls])
    .map((side) => ({ ...edgeAnchor(side), r: EDGE.KEEPOUT, side }));
}

// ------------------------------------------------------------------ Maße

/** Skalierungsfaktor des aktuellen Transforms. */
export function scaleOf(ctx) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m) return 1;
  return Math.hypot(m.a, m.b) || 1;
}

/**
 * Haarlinie in Gerätepixeln, umgerechnet in die aktuellen Einheiten.
 * Nachtrag §12: Flächen normiert, Linien in Gerätepixeln.
 */
export function hairline(ctx, devicePx = 1) {
  return devicePx / scaleOf(ctx);
}

// ------------------------------------------------------------------- LOD

export const LOD = { SMALL: 'small', NORMAL: 'normal', LARGE: 'large' };

export const LOD_BANDS = [
  { id: LOD.SMALL,  enterAbove: 0,   leaveBelow: 0,   renderSize: 60 },
  { id: LOD.NORMAL, enterAbove: 60,  leaveBelow: 54,  renderSize: 130 },
  { id: LOD.LARGE,  enterAbove: 130, leaveBelow: 117, renderSize: 260 },
];

export const LOD_ORDER = [LOD.SMALL, LOD.NORMAL, LOD.LARGE];

/**
 * Stufe für eine Bildschirmgröße, mit 10 % Hysterese (Nachtrag §13).
 * previous mitgeben, sonst flackert es beim Pinch-Zoom im Grenzbereich.
 */
export function lodFor(pxSize, previous = null) {
  if (previous) {
    const idx = LOD_ORDER.indexOf(previous);
    const band = LOD_BANDS[idx];
    const next = LOD_BANDS[idx + 1];
    if (next && pxSize >= next.enterAbove) return next.id;
    if (idx > 0 && pxSize < band.leaveBelow) return LOD_BANDS[idx - 1].id;
    return previous;
  }
  if (pxSize >= LOD_BANDS[2].enterAbove) return LOD.LARGE;
  if (pxSize >= LOD_BANDS[1].enterAbove) return LOD.NORMAL;
  return LOD.SMALL;
}

export function renderSizeFor(lod) {
  return (LOD_BANDS.find((b) => b.id === lod) || LOD_BANDS[0]).renderSize;
}

export function detailLevel(lod) {
  return LOD_ORDER.indexOf(lod);
}

/** true, wenn ab dieser Stufe gezeichnet werden darf. */
export function atLeast(lod, minimum) {
  return detailLevel(lod) >= detailLevel(minimum);
}
