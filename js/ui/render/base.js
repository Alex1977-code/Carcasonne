/**
 * Schritt 1: Grundflächen und Silhouetten.
 *
 * Das ist bewusst der Detailgrad von LOD `small` aus Spec §1.5 – genau das, was
 * für den Kantenvertrag und die Abnahme der Struktur nötig ist. Die Priorität-B-,
 * A- und C-Layer (Felder, Gebäudekatalog, Wahrzeichen) hängen sich später an
 * denselben Registrierungspunkten ein und ersetzen die Platzhalter.
 */

import { registerLayer } from './layers.js';
import { PALETTE, LIGHT, withAlpha, shade, jitterColor } from './palette.js';
import {
  N, E, S, W, SIDES, EDGE, edgeAnchor, edgeNormal, hairline,
} from './contract.js';

const CENTER = { x: 0.5, y: 0.5 };

function pointFor(endpoint) {
  return endpoint === 'c' ? CENTER : edgeAnchor(endpoint);
}

/** Segmentpfad: zwei Punkte gerade, drei Punkte als Quadratische mit p1 als Kontrollpunkt. */
function pathThrough(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) ctx.lineTo(points[1].x, points[1].y);
  else ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y);
}

/** Denselben Pfad als Polylinie abtasten – Grundlage für versetzte Kopien. */
function samplePath(points, n = 28) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    if (points.length === 2) {
      out.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      });
    } else {
      out.push({
        x: u * u * points[0].x + 2 * u * t * points[1].x + t * t * points[2].x,
        y: u * u * points[0].y + 2 * u * t * points[1].y + t * t * points[2].y,
      });
    }
  }
  return out;
}

/**
 * 1 in der Kachelmitte, 0 am Kachelrand.
 *
 * Warum das nötig ist: ein Schlagschatten mit festem Versatz wandert an der
 * Kachelkante über die Naht. Der Nachbar versetzt seinen Schatten in dieselbe
 * Richtung, also fehlt er auf der einen Seite und liegt auf der anderen doppelt –
 * an durchgehenden Straßen entsteht ein sichtbarer Versatz. Der Versatz wird
 * deshalb zur Kante hin ausgeblendet; die Lichtrichtung bleibt trotzdem eindeutig,
 * weil sie in der Kachelmitte voll wirkt.
 */
function edgeTaper(p, dist = 0.2) {
  const d = Math.min(p.x, 1 - p.x, p.y, 1 - p.y);
  return Math.max(0, Math.min(1, d / dist));
}

function offsetSamples(pts, dx, dy) {
  return pts.map((p) => {
    const k = edgeTaper(p);
    return { x: p.x + dx * k, y: p.y + dy * k };
  });
}

function strokePolyline(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

/** Punktfolge eines Straßen-/Flusssegments, immer über die Kachelmitte. */
function segmentPoints(seg, rng, wobble = 0.03) {
  const ends = seg.map(pointFor);
  if (seg.includes('c') || seg.length !== 2) return ends;

  const [a, b] = seg;
  const straight = (a + 2) % 4 === b;
  const mid = {
    x: rng.jitter(0.5, straight ? wobble : wobble * 0.5),
    y: rng.jitter(0.5, straight ? wobble : wobble * 0.5),
  };
  if (!straight) {
    // Kurve: Kontrollpunkt in Richtung der gemeinsamen Ecke ziehen
    const na = edgeNormal(a), nb = edgeNormal(b);
    mid.x = 0.5 + (na.x + nb.x) * 0.06;
    mid.y = 0.5 + (na.y + nb.y) * 0.06;
  }
  return [ends[0], mid, ends[1]];
}

// ------------------------------------------------------------------- Wiese

registerLayer('meadow', (ctx, { rng, rank }) => {
  ctx.fillStyle = PALETTE.meadow;
  ctx.fillRect(0, 0, 1, 1);

  // Große weiche Farbflecken. Deckkraft nach Spec §4 auf zwei Drittel.
  const patches = rank === 0 ? 3 : 6;
  for (let i = 0; i < patches; i++) {
    const x = rng.range(0.05, 0.95);
    const y = rng.range(0.05, 0.95);
    const r = rng.range(0.10, 0.24);
    const light = rng.bool();
    ctx.fillStyle = withAlpha(light ? PALETTE.meadowLight : PALETTE.meadowDark, 0.13);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * rng.range(0.6, 1.0), rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
});

// -------------------------------------------------------------------- Wasser

registerLayer('water', (ctx, { tile, rng, rank }) => {
  if (!tile.rivers.length && !tile.lake && !tile.spring) return;

  const w = EDGE.RIVER_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const seg of tile.rivers) {
    const pts = segmentPoints(seg, rng, 0.02);

    ctx.strokeStyle = PALETTE.waterDeep;
    ctx.lineWidth = w;
    pathThrough(ctx, pts);
    ctx.stroke();

    ctx.strokeStyle = PALETTE.waterMid;
    ctx.lineWidth = w * 0.78;
    pathThrough(ctx, pts);
    ctx.stroke();

    if (rank >= 1) {
      // Glanzband nur auf der lichtzugewandten Uferseite (Spec §7/6)
      ctx.strokeStyle = withAlpha(PALETTE.waterLight, 0.55);
      ctx.lineWidth = w * 0.18;
      strokePolyline(ctx, offsetSamples(samplePath(pts), LIGHT.dx * w * 0.22, LIGHT.dy * w * 0.22));
    }
  }

  if (tile.lake) {
    const r = 0.26;
    const g = ctx.createRadialGradient(0.5, 0.5, r * 0.15, 0.5, 0.5, r);
    g.addColorStop(0, PALETTE.waterDeep);
    g.addColorStop(1, PALETTE.waterMid);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0.5, 0.5, r, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tile.spring) {
    ctx.fillStyle = PALETTE.waterMid;
    ctx.beginPath();
    ctx.ellipse(0.5, 0.5, 0.13, 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wallStone;
    ctx.lineWidth = 0.035;
    ctx.stroke();
  }
});

// ------------------------------------------------------------------ Straßen

registerLayer('roads', (ctx, { tile, rng, rank }) => {
  if (!tile.roads.length) return;

  const w = EDGE.ROAD_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawn = tile.roads.map((seg) => segmentPoints(seg, rng, 0.025));

  // Bodenschatten nach unten-rechts, zur Kachelkante hin ausgeblendet
  ctx.strokeStyle = withAlpha(PALETTE.roadShadow, 0.35);
  ctx.lineWidth = w * 1.02;
  for (const pts of drawn) {
    strokePolyline(ctx, offsetSamples(samplePath(pts), -LIGHT.dx * w * 0.14, -LIGHT.dy * w * 0.14));
  }

  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = w;
  for (const pts of drawn) { pathThrough(ctx, pts); ctx.stroke(); }

  ctx.strokeStyle = PALETTE.roadSurface;
  ctx.lineWidth = w * 0.74;
  for (const pts of drawn) { pathThrough(ctx, pts); ctx.stroke(); }

  // Spurrillen ab LOD normal, leicht wellig (Spec §7/4)
  if (rank >= 1) {
    ctx.strokeStyle = withAlpha(PALETTE.roadEdge, 0.45);
    ctx.lineWidth = hairline(ctx, 1);
    for (const pts of drawn) {
      // Rillen enden vor der Kante: ihre Wellenphase kann der Nachbar nicht treffen,
      // an der Naht entstünde sonst ein Versatz.
      const line = samplePath(pts, 32).filter((p) => edgeTaper(p, 0.17) >= 1);
      if (line.length < 3) continue;
      for (const off of [-1, 1]) {
        const rut = line.map((p, i) => {
          const nx = i < line.length - 1 ? line[i + 1].x - p.x : p.x - line[i - 1].x;
          const ny = i < line.length - 1 ? line[i + 1].y - p.y : p.y - line[i - 1].y;
          const len = Math.hypot(nx, ny) || 1;
          const wob = Math.sin(i * 0.9 + off * 1.7) * w * 0.05;
          const d = off * w * 0.2 + wob;
          return { x: p.x - (ny / len) * d, y: p.y + (nx / len) * d };
        });
        strokePolyline(ctx, rut);
      }
    }
  }

  // Kreuzung / Dorfplatz
  const junction = tile.roads.length > 1 && tile.roads.every((s) => s.includes('c'));
  if (junction) {
    ctx.fillStyle = PALETTE.roadSurface;
    ctx.beginPath();
    ctx.ellipse(0.5, 0.5, w * 0.85, w * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
});

// ------------------------------------------------------------ Stadtpflaster

/** Umriss einer Stadtgruppe. Überlappende Teilpfade ergeben mit nonzero die Vereinigung. */
export function cityPath(ctx, group, rng) {
  const depth = { 1: 0.40, 2: 0.56, 3: 0.66, 4: 1.0 }[group.length] || 0.45;
  ctx.beginPath();

  if (group.length === 4) {
    ctx.rect(0, 0, 1, 1);
    return depth;
  }

  for (const side of group) {
    const n = edgeNormal(side);
    const t = { x: -n.y, y: n.x };
    const a = edgeAnchor(side);
    const d = rng.jitterPct(depth, 0.08);
    const p = (u, v) => ({ x: a.x + t.x * u + n.x * v, y: a.y + t.y * u + n.y * v });

    const c0 = p(-0.5, 0), c1 = p(0.5, 0);
    const b0 = p(0.42, d), b1 = p(-0.42, d);
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.bezierCurveTo(b0.x, b0.y, b1.x, b1.y, c0.x, c0.y);
  }

  // Verbundene Städte: Mitte auffüllen, damit die Teile verschmelzen
  if (group.length >= 2) {
    const pts = group.map((s) => {
      const n = edgeNormal(s), a = edgeAnchor(s);
      return { x: a.x + n.x * depth * 0.55, y: a.y + n.y * depth * 0.55 };
    });
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(0.5, 0.5);
    ctx.closePath();
  }
  return depth;
}

registerLayer('cityPaving', (ctx, { tile, rng, rank }) => {
  if (!tile.cityGroups.length) return;

  for (const group of tile.cityGroups) {
    const sub = rng.fork(`city${group.join('')}`);
    cityPath(ctx, group, sub);

    ctx.save();
    ctx.clip();
    ctx.fillStyle = PALETTE.pavingLight;
    ctx.fillRect(0, 0, 1, 1);

    // Pflasterandeutung, 8 % Kontrast (Spec §7/9)
    if (rank >= 1) {
      const cells = rank >= 2 ? 26 : 16;
      for (let i = 0; i < cells * 2; i++) {
        const x = sub.range(0, 1), y = sub.range(0, 1);
        const w = sub.range(0.02, 0.045), h = sub.range(0.016, 0.03);
        ctx.fillStyle = withAlpha(sub.bool() ? PALETTE.pavingDark : '#FFFFFF', 0.08);
        ctx.fillRect(x, y, w, h);
      }
    }
    ctx.restore();
  }
});

// ------------------------------------------------------------- Stadtmauer

registerLayer('cityWall', (ctx, { tile, rng, rank }) => {
  if (!tile.cityGroups.length) return;
  const wallW = 0.055;

  for (const group of tile.cityGroups) {
    const sub = rng.fork(`city${group.join('')}`); // gleicher Strom wie das Pflaster
    cityPath(ctx, group, sub);

    ctx.lineJoin = 'round';
    ctx.strokeStyle = PALETTE.wallShadow;
    ctx.lineWidth = wallW * 1.25;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.wallStone;
    ctx.lineWidth = wallW;
    ctx.stroke();

    // Zinnen ab LOD normal
    if (rank >= 1) {
      ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.7);
      ctx.lineWidth = hairline(ctx, 1);
      ctx.setLineDash([wallW * 0.5, wallW * 0.5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Wo zwei Städte aneinanderstoßen, darf keine Mauer stehen:
    // das Mauerstück auf der Kachelkante wieder mit Pflaster überdecken.
    ctx.fillStyle = PALETTE.pavingLight;
    for (const side of group) {
      const n = edgeNormal(side);
      const band = wallW * 0.85;
      if (side === N) ctx.fillRect(0, 0, 1, band);
      if (side === S) ctx.fillRect(0, 1 - band, 1, band);
      if (side === W) ctx.fillRect(0, 0, band, 1);
      if (side === E) ctx.fillRect(1 - band, 0, band, 1);
      void n;
    }
  }
});

// ------------------------------- Wahrzeichen (Platzhalter bis Priorität C)

registerLayer('landmarks', (ctx, { tile, rng }) => {
  const shadow = (x, y, w, h) => {
    ctx.fillStyle = withAlpha(LIGHT.groundShadowColor, LIGHT.groundShadowAlpha);
    ctx.beginPath();
    ctx.ellipse(x - LIGHT.dx * 0.02, y - LIGHT.dy * 0.02 + h * 0.45, w * 0.62, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  if (tile.cloister) {
    // Grundfläche 45–55 % (Spec §5) – hier nur als Silhouette
    const s = rng.range(0.45, 0.52);
    shadow(0.5, 0.5, s, s);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0.5 - s / 2, 0.5 - s / 2, s, s);
    ctx.fillStyle = PALETTE.roofSlate;
    ctx.fillRect(0.5 - s / 2, 0.5 - s / 2, s, s * 0.34);
    ctx.fillRect(0.5 - s * 0.12, 0.5 - s * 0.62, s * 0.24, s * 0.34);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = hairline(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(0.5, 0.5 - s * 0.72); ctx.lineTo(0.5, 0.5 - s * 0.60);
    ctx.moveTo(0.5 - s * 0.05, 0.5 - s * 0.67); ctx.lineTo(0.5 + s * 0.05, 0.5 - s * 0.67);
    ctx.stroke();
  }

  if (tile.cathedral) {
    // Grundfläche 60–65 % (Spec §5). Der höchste Punkt der Türme bleibt bei 0.07 –
    // nichts ragt über den Kachelrand, auch nicht die Helme.
    const s = rng.range(0.60, 0.65);
    const base = 0.62;              // Fußlinie des Schiffs
    const towerTop = 0.16, spireTop = 0.07;
    shadow(0.5, base, s, s * 0.4);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0.5 - s / 2, base - s * 0.42, s, s * 0.42);
    ctx.fillStyle = PALETTE.roofSlate;
    for (const dx of [-s * 0.34, s * 0.34]) {
      ctx.fillRect(0.5 + dx - s * 0.10, towerTop, s * 0.20, base - towerTop);
      ctx.beginPath();
      ctx.moveTo(0.5 + dx - s * 0.13, towerTop);
      ctx.lineTo(0.5 + dx, spireTop);
      ctx.lineTo(0.5 + dx + s * 0.13, towerTop);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = withAlpha(PALETTE.heraldicBlue, 0.9);
    ctx.beginPath();
    ctx.arc(0.5, base - s * 0.30, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tile.inn) {
    const s = 0.24;
    const x = 0.5 + rng.range(-0.12, 0.12), y = 0.62;
    shadow(x, y, s, s);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(x - s / 2, y - s * 0.35, s, s * 0.6);
    ctx.fillStyle = PALETTE.roofTerracotta[0];
    ctx.beginPath();
    ctx.moveTo(x - s * 0.58, y - s * 0.33);
    ctx.lineTo(x, y - s * 0.72);
    ctx.lineTo(x + s * 0.58, y - s * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x + s * 0.5, y - s * 0.28, s * 0.16, s * 0.16);
  }
});

// ------------------------------------------------------------------ Wappen

registerLayer('coatOfArms', (ctx, { tile, rng }) => {
  if (!tile.shield || !tile.cityGroups.length) return;
  const group = tile.cityGroups[0];
  const n = edgeNormal(group[0]);
  const x = 0.5 + n.x * 0.16, y = 0.5 + n.y * 0.16;
  const w = 0.13, h = 0.16;

  ctx.fillStyle = withAlpha(LIGHT.groundShadowColor, 0.3);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 0.01, y - h / 2 + 0.01);
  ctx.lineTo(x + w / 2 + 0.01, y - h / 2 + 0.01);
  ctx.lineTo(x + 0.01, y + h / 2 + 0.01);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.heraldicBlue;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = hairline(ctx, 2);
  ctx.stroke();
  void rng;
});

// ------------------------------------------------------------- Kachelrand

registerLayer('tileEdge', (ctx, { tile }) => {
  const t = hairline(ctx, 1);
  ctx.lineWidth = t;

  // Das Relief darf nicht über einen Anschluss laufen. Sonst zieht sich durch
  // jede zusammengesetzte Stadt und über jede durchgehende Straße eine Linie,
  // und aus dem Randrelief wird das Gitter, das Spec §7/16 ausschließt.
  const gaps = (side) => {
    const type = tile.sides[side];
    if (type === 'city') return null;                    // ganze Kante aussparen
    if (type === 'road') return EDGE.ROAD_WIDTH / 2 + t;
    if (type === 'river') return EDGE.RIVER_WIDTH / 2 + t;
    return 0;
  };

  const drawEdge = (side, color) => {
    const gap = gaps(side);
    if (gap === null) return;
    ctx.strokeStyle = color;
    const spans = gap > 0 ? [[0, 0.5 - gap], [0.5 + gap, 1]] : [[0, 1]];
    for (const [a, b] of spans) {
      if (b - a <= 0) continue;
      ctx.beginPath();
      if (side === N) { ctx.moveTo(a, t / 2); ctx.lineTo(b, t / 2); }
      if (side === S) { ctx.moveTo(a, 1 - t / 2); ctx.lineTo(b, 1 - t / 2); }
      if (side === W) { ctx.moveTo(t / 2, a); ctx.lineTo(t / 2, b); }
      if (side === E) { ctx.moveTo(1 - t / 2, a); ctx.lineTo(1 - t / 2, b); }
      ctx.stroke();
    }
  };

  const light = withAlpha('#FFFFFF', 0.2);
  const dark = withAlpha(PALETTE.shadow, 0.2);
  drawEdge(N, light);
  drawEdge(W, light);
  drawEdge(S, dark);
  drawEdge(E, dark);
});

export { shade, jitterColor, SIDES, N, E, S, W };
