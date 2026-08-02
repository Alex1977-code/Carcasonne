/**
 * Ackerparzellen auf der Wiese (Layer `fields`, Priorität B).
 *
 * Liegt zwischen `meadow` und `ground`: alles Spätere – Wasser, Straßen,
 * Stadtpflaster – deckt die Parzellen ab, deshalb muss hier nur der
 * Kantenvertrag stimmen und nicht die Überschneidung mit der Stadt.
 *
 * Vertrag (Nachtrag §11.1/§11.2):
 *   - Parzellen enden 0,05 vor dem Kachelrand, ein Wiesenstreifen bleibt stehen
 *   - Sperrzone 0,22 um Straßen-, Fluss- und Stadtkanten, zusätzlich 0,04 zur Straße
 *   - kein Versatz zur Kante hin (§11.3): Parzellen liegen ohnehin innen
 *
 * Gestaltung: Parzellen einer Kachel teilen eine Grundrichtung, wie echte
 * Flurstücke. Sie dürfen aneinandergrenzen und ergeben so ein Patchwork
 * statt verstreuter Rechtecke. Der Rand ist kein harter Strich, sondern ein
 * Feldrain aus Grasbüscheln – dadurch sitzt der Acker in der Wiese, statt
 * darauf zu liegen.
 *
 * Die Zeichenfunktion ist renderer-neutral (normierte Koordinaten 0…1,
 * einfache Zufallsfunktion), damit der laufende Spiel-Renderer dieselbe
 * Grafik zeichnet wie der Prüfstand.
 */
import { EDGE, isBlocked, edgeAnchor } from './contract.js';
import { PALETTE, shade, withAlpha } from './palette.js';
import { registerLayer } from './layers.js';

/** Fruchtfolge: Anbauart und Gewicht in der Verteilung. */
const CROPS = [
  { kind: 'plowed', weight: 3 },
  { kind: 'grain', weight: 3 },
  { kind: 'young', weight: 2 },
  { kind: 'fallow', weight: 2 },
];
const CROP_TOTAL = CROPS.reduce((a, c) => a + c.weight, 0);

function pickCrop(rnd) {
  let r = rnd() * CROP_TOTAL;
  for (const c of CROPS) {
    r -= c.weight;
    if (r <= 0) return c.kind;
  }
  return 'plowed';
}

/** Grundfarbe je Anbauart – bei „young“ liegt Saat auf offener Erde. */
function baseColor(kind) {
  switch (kind) {
    case 'plowed': return PALETTE.fieldPlowed;
    case 'grain': return PALETTE.fieldGrain;
    case 'young': return shade(PALETTE.fieldPlowed, 0.18);
    default: return PALETTE.fieldFallow;
  }
}

/** Abstand eines Punktes zur Strecke a→b. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Zuschlag für den Eckenversatz beim Zeichnen und den Feldrain. */
const SAFETY = 0.03;

/** Die vier Ecken einer gedrehten Parzelle. */
function cornersOf(x, y, w, h, a) {
  const hw = w / 2, hh = h / 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    .map(([dx, dy]) => [x + dx * ca - dy * sa, y + dx * sa + dy * ca]);
}

/**
 * Darf ein Punkt zur Parzelle gehören?
 * Zusätzlich zur Sperrzone: nicht im Korridor einer Straße oder eines
 * Flusses, sonst verschwindet die Parzelle später unter der Fahrbahn.
 */
function pointFits(x, y, sides, avoid) {
  if (isBlocked(x, y, 'field', sides, SAFETY)) return false;
  for (let side = 0; side < 4; side++) {
    const type = sides[side];
    if (type !== 'road' && type !== 'river') continue;
    const a = edgeAnchor(side);
    const width = type === 'river' ? EDGE.RIVER_WIDTH : EDGE.ROAD_WIDTH;
    const clear = width / 2 + SAFETY + EDGE.FIELD_ROAD_MARGIN;
    if (distToSegment(x, y, a.x, a.y, 0.5, 0.5) < clear) return false;
  }
  if (avoid && avoid(x, y, SAFETY)) return false;
  return true;
}

/** Passt die ganze Parzelle – Ecken, Kantenmitten und Mittelpunkt geprüft? */
function parcelFits(corners, x, y, sides, avoid) {
  if (!pointFits(x, y, sides, avoid)) return false;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    if (!pointFits(ax, ay, sides, avoid)) return false;
    if (!pointFits((ax + bx) / 2, (ay + by) / 2, sides, avoid)) return false;
  }
  return true;
}

/** Wie viele Parzellen lohnen sich auf diesem Motiv? */
function parcelBudget(sides) {
  const meadowSides = sides.filter((s) => s === 'field').length;
  if (meadowSides === 0) return 0;      // keine offene Wiese – nichts anzulegen
  if (meadowSides === 1) return 2;
  if (meadowSides === 2) return 3;
  return 4;
}

/**
 * Zeichnet die Ackerparzellen.
 * @param ctx     Canvas im normierten Kachel-Koordinatensystem (0…1)
 * @param sides   ['city'|'road'|'field'|'river'] ab Norden im Uhrzeigersinn
 * @param rnd     Zufallsfunktion → [0,1)
 * @param detail  0 = klein (keine Textur), 1 = normal, 2 = groß
 * @param avoid   optional (x, y, r) → true, wenn dort nichts liegen darf
 *                (der Spiel-Renderer kennt Stadtfläche und Wahrzeichen genau)
 */
export function drawFields(ctx, { sides, rnd, detail = 1, avoid = null }) {
  const budget = parcelBudget(sides);
  if (budget === 0) return;

  // Eine Grundrichtung für die ganze Kachel – Flurstücke laufen parallel.
  const baseAngle = (rnd() - 0.5) * Math.PI;

  const parcels = [];
  for (let i = 0; i < budget; i++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      // Spätere Versuche werden kleiner – so bleibt auch in schmalen
      // Wiesenstreifen noch Platz für ein Flurstück.
      const shrink = attempt < 20 ? 1 : 0.66;
      const w = (0.20 + rnd() * 0.16) * shrink;
      const h = (0.13 + rnd() * 0.10) * shrink;
      const r = Math.hypot(w, h) / 2;
      const x = 0.5 + (rnd() - 0.5) * 0.82;
      const y = 0.5 + (rnd() - 0.5) * 0.82;
      const a = baseAngle + (rnd() - 0.5) * 0.28;
      const corners = cornersOf(x, y, w, h, a);
      if (!parcelFits(corners, x, y, sides, avoid)) continue;
      // Dürfen aneinandergrenzen, aber nicht ineinanderliegen
      if (parcels.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r + r) * 0.78)) continue;
      parcels.push({ x, y, w, h, r, a, kind: pickCrop(rnd) });
      break;
    }
  }

  for (const p of parcels) drawParcel(ctx, p, rnd, detail);
}

function drawParcel(ctx, p, rnd, detail) {
  const { x, y, w, h, a, kind } = p;
  const hw = w / 2, hh = h / 2;
  const color = baseColor(kind);

  // Handgezeichnet: Ecken leicht versetzt
  const j = (s) => (rnd() - 0.5) * s;
  const corners = [
    [-hw + j(w * 0.13), -hh + j(h * 0.16)],
    [hw + j(w * 0.13), -hh + j(h * 0.16)],
    [hw + j(w * 0.13), hh + j(h * 0.16)],
    [-hw + j(w * 0.13), hh + j(h * 0.16)],
  ];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  const path = new Path2D();
  path.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < 4; i++) path.lineTo(corners[i][0], corners[i][1]);
  path.closePath();

  // Grundfläche
  ctx.fillStyle = color;
  ctx.fill(path);

  if (detail > 0) {
    ctx.save();
    ctx.clip(path);
    paintTexture(ctx, kind, hw, hh, rnd, detail);
    ctx.restore();
  }

  // Feldrain: weicher Saum statt harter Kontur
  ctx.lineWidth = 0.012;
  ctx.strokeStyle = withAlpha(shade(color, -0.3), 0.35);
  ctx.stroke(path);

  if (detail > 0) paintHedgerow(ctx, corners, rnd);
  ctx.restore();
}

/** Grasbüschel entlang der Parzellenkante – bricht die gerade Silhouette. */
function paintHedgerow(ctx, corners, rnd) {
  ctx.lineWidth = 0.006;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.round(len / 0.035));
    for (let s = 0; s < steps; s++) {
      if (rnd() < 0.35) continue;
      const t = (s + 0.5 + (rnd() - 0.5) * 0.6) / steps;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      // Normale nach außen
      const nx = (by - ay) / len, ny = -(bx - ax) / len;
      const out = 0.012 + rnd() * 0.010;
      ctx.strokeStyle = withAlpha(rnd() > 0.5 ? PALETTE.meadowDark : PALETTE.meadowLight, 0.75);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + nx * out * (rnd() > 0.5 ? 1 : -1), py + ny * out);
      ctx.stroke();
    }
  }
}

function paintTexture(ctx, kind, hw, hh, rnd, detail) {
  if (kind === 'plowed') {
    // Pflugfurchen längs, mit leichter Welle
    const step = detail > 1 ? 0.018 : 0.026;
    ctx.lineWidth = 0.007;
    for (let fy = -hh; fy <= hh; fy += step) {
      ctx.strokeStyle = withAlpha(shade(PALETTE.fieldPlowed, -0.32), 0.55);
      ctx.beginPath();
      ctx.moveTo(-hw, fy);
      ctx.quadraticCurveTo(0, fy + (rnd() - 0.5) * 0.012, hw, fy);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(shade(PALETTE.fieldPlowed, 0.22), 0.4);
      ctx.beginPath();
      ctx.moveTo(-hw, fy + step * 0.42);
      ctx.quadraticCurveTo(0, fy + step * 0.42 + (rnd() - 0.5) * 0.01, hw, fy + step * 0.42);
      ctx.stroke();
    }
  } else if (kind === 'grain') {
    // Getreide: kurze Halme in Reihen, heller Schimmer
    const step = detail > 1 ? 0.021 : 0.030;
    ctx.lineWidth = 0.005;
    for (let fy = -hh + 0.008; fy <= hh; fy += step) {
      for (let fx = -hw + 0.010; fx <= hw; fx += 0.024) {
        ctx.strokeStyle = withAlpha(shade(PALETTE.fieldGrain, rnd() > 0.5 ? 0.34 : -0.24), 0.7);
        ctx.beginPath();
        ctx.moveTo(fx, fy + 0.011);
        ctx.lineTo(fx + (rnd() - 0.5) * 0.009, fy - 0.009);
        ctx.stroke();
      }
    }
  } else if (kind === 'young') {
    // Junge Saat: grüne Reihen auf offener Erde
    const step = detail > 1 ? 0.026 : 0.036;
    ctx.lineWidth = 0.009;
    ctx.lineCap = 'round';
    for (let fy = -hh + 0.012; fy <= hh; fy += step) {
      ctx.strokeStyle = withAlpha(PALETTE.meadowDark, 0.85);
      ctx.setLineDash([0.020, 0.012]);
      ctx.lineDashOffset = rnd() * 0.03;
      ctx.beginPath();
      ctx.moveTo(-hw, fy);
      ctx.lineTo(hw, fy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    // Brache: vereinzelte Büschel und Steine
    const n = detail > 1 ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const fx = (rnd() - 0.5) * hw * 2;
      const fy = (rnd() - 0.5) * hh * 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 0.004 + rnd() * 0.006, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(rnd() > 0.55 ? PALETTE.meadowDark : shade(PALETTE.fieldFallow, -0.28), 0.5);
      ctx.fill();
    }
  }
}

// ------------------------------------------------- Anschluss an den Prüfstand

registerLayer('fields', (ctx, { tile, rng, rank }) => {
  drawFields(ctx, {
    sides: tile.sides,
    rnd: () => rng.next(),
    detail: rank,
  });
});
