// ============================================================
// Carcassonne Mobile – Rendering (prozedurale Kartengrafik)
// Detailreiche, handgezeichnet wirkende Kacheln: Städte mit
// Häusern und Zinnenmauern, strukturierte Wiesen, Wasser mit
// Glanzlicht, Holztisch mit Vignette und weiche Schatten.
// ============================================================
import { DEFS } from '../engine/tiles.js';
import { find } from '../engine/game.js';

// ---------- Hilfen ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rotPoint([x, y], rot) {
  for (let i = 0; i < rot; i++) { const t = x; x = 1 - y; y = t; }
  return [x, y];
}

// Farbe aufhellen (f>0) oder abdunkeln (f<0)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const EDGE_MID = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

// ---------- Meeple ----------
const MEEPLE_PATH = new Path2D(
  'M50 6 C60 6 67 14 67 23 C67 29 64 33 61 36 C74 41 86 50 92 61 C95 67 91 72 85 72 ' +
  'L67 72 C70 82 75 90 81 96 C81 98 79 99 76 99 L59 99 C56 99 54 97 53 94 ' +
  'Q50 84 47 94 C46 97 44 99 41 99 L24 99 C21 99 19 98 19 96 C25 90 30 82 33 72 ' +
  'L15 72 C9 72 5 67 8 61 C14 50 26 41 39 36 C36 33 33 29 33 23 C33 14 40 6 50 6 Z'
);

export function drawMeeple(ctx, x, y, size, color, { big = false, shadow = true } = {}) {
  const s = size * (big ? 1.45 : 1);
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  ctx.scale(s / 100, s / 100);
  if (shadow) {
    ctx.save();
    ctx.translate(4, 7);
    ctx.fillStyle = 'rgba(10,10,20,0.35)';
    ctx.fill(MEEPLE_PATH);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(40, 26, 6, 50, 55, 75);
  g.addColorStop(0, shade(color, 0.4));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.fill(MEEPLE_PATH);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = shade(color, -0.55);
  ctx.stroke(MEEPLE_PATH);
  ctx.beginPath();
  ctx.ellipse(43, 21, 9, 6, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

// ---------- Kartengrafik ----------
const artCache = new Map();
export const ART_SIZE = 192;

export function tileArt(defId, rot) {
  const k = defId + ':' + rot;
  let c = artCache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = ART_SIZE;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.translate(ART_SIZE / 2, ART_SIZE / 2);
  ctx.rotate(rot * Math.PI / 2);
  ctx.translate(-ART_SIZE / 2, -ART_SIZE / 2);
  ctx.scale(ART_SIZE, ART_SIZE);
  paintTile(ctx, DEFS[defId], rot);
  ctx.restore();
  // Kante mit leichtem Relief (nicht mitrotiert)
  const s = ART_SIZE;
  ctx.strokeStyle = 'rgba(255,250,230,0.20)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1, s - 1); ctx.lineTo(1, 1); ctx.lineTo(s - 1, 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,25,10,0.28)';
  ctx.beginPath(); ctx.moveTo(s - 1, 1); ctx.lineTo(s - 1, s - 1); ctx.lineTo(1, s - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(45,30,15,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, s - 1.5, s - 1.5);
  artCache.set(k, c);
  return c;
}

function paintTile(ctx, d, rot = 0) {
  const rnd = mulberry(hash(d.id));
  paintGrass(ctx, rnd);
  const busyness = d.f.filter(f => f.t !== 'field').length;
  if (busyness <= 2) paintBushes(ctx, rnd, d);
  for (const f of d.f) if (f.t === 'river') paintRiver(ctx, d, f);
  for (const f of d.f) if (f.t === 'road') paintRoad(ctx, d, f);
  if (d.f.filter(f => f.t === 'road').length >= 3) paintPlaza(ctx, rnd);
  for (const f of d.f) if (f.t === 'city') paintCity(ctx, d, f, rot);
  for (const f of d.f) if (f.t === 'city') paintCityDeko(ctx, f, rot);
  for (const f of d.f) if (f.t === 'mon') paintMonastery(ctx, f, rot);
  for (const f of d.f) if (f.t === 'road' && f.inn) paintInn(ctx, f, rot);
  paintFlowers(ctx, d, rnd);
}

// Dekor bleibt aufrecht, egal wie die Karte gedreht liegt
function upright(ctx, x, y, rot, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot * Math.PI / 2);
  draw();
  ctx.restore();
}

// ----- Wiese -----
function paintGrass(ctx, rnd) {
  const g = ctx.createLinearGradient(0, 0, 0.6, 1);
  g.addColorStop(0, '#8dbb58');
  g.addColorStop(0.5, '#7cad4b');
  g.addColorStop(1, '#6d9f41');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 1);
  // weiche Farbflecken für lebendige Fläche
  for (let i = 0; i < 7; i++) {
    const x = rnd(), y = rnd(), r = 0.12 + rnd() * 0.22;
    const p = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    p.addColorStop(0, dark ? 'rgba(48,88,28,0.13)' : 'rgba(215,235,150,0.12)');
    p.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = p;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Grasbüschel
  ctx.lineWidth = 0.006;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = 0.03 + rnd() * 0.94, y = 0.04 + rnd() * 0.94;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(35,70,20,0.20)' : 'rgba(220,240,170,0.28)';
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + b * 0.006, y - 0.012, x + b * 0.012, y - 0.02);
      ctx.stroke();
    }
  }
  // feine Körnung
  for (let i = 0; i < 46; i++) {
    const x = rnd(), y = rnd();
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,220,0.06)' : 'rgba(20,50,10,0.07)';
    ctx.fillRect(x, y, 0.012, 0.012);
  }
}

function paintBushes(ctx, rnd, d) {
  const n = rnd() < 0.45 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const x = 0.12 + rnd() * 0.76, y = 0.12 + rnd() * 0.76;
    const r = 0.045 + rnd() * 0.02;
    ctx.beginPath(); ctx.ellipse(x + 0.012, y + r * 0.75, r * 1.15, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fill();
    for (const [dx, dy, rr, c] of [
      [-r * 0.45, 0.01, r * 0.72, '#4c7a2e'],
      [r * 0.4, 0.005, r * 0.66, '#55873a'],
      [0, -r * 0.35, r * 0.8, '#5e9440'],
    ]) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.45, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(225,245,170,0.45)'; ctx.fill();
  }
}

function paintFlowers(ctx, d, rnd) {
  const hasCity = d.f.some(f => f.t === 'city');
  const n = hasCity ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const x = 0.08 + rnd() * 0.84, y = 0.08 + rnd() * 0.84;
    const col = ['#ffe28a', '#fff3f3', '#ffb1c1', '#c9a6ff'][i % 4];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 0.009, y + Math.sin(a) * 0.009, 0.006, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.9;
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, 0.005, 0, Math.PI * 2);
    ctx.fillStyle = '#e8a12c'; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ----- Wege -----
function roadEndpoint(d, edge) {
  const hasMon = d.f.some(f => f.t === 'mon');
  const [mx, my] = EDGE_MID[edge];
  const toC = (t) => [mx + (0.5 - mx) * t, my + (0.5 - my) * t];
  const roadCount = d.f.filter(f => f.t === 'road').length;
  if (roadCount >= 3) return toC(0.86);
  if (hasMon) return toC(0.5);
  const bigCity = d.f.find(f => f.t === 'city' && f.e.length >= 2);
  if (bigCity) return toC(0.55);
  const anyCity = d.f.some(f => f.t === 'city');
  // Sackgasse an einer Stadtkappe führt bis ans Stadttor
  return toC(anyCity ? 1.16 : 0.7);
}

function wayPath(ctx, pts, curved) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3 && curved) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function strokePass(ctx, pts, curved, width, style, dash = null, alpha = 1) {
  ctx.save();
  ctx.lineCap = dash ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.globalAlpha = alpha;
  wayPath(ctx, pts, curved);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function roadPoints(d, f) {
  if (f.e.length === 1) return [EDGE_MID[f.e[0]], roadEndpoint(d, f.e[0])];
  if (f.e.length === 2) return [EDGE_MID[f.e[0]], f.ctrl || [0.5, 0.5], EDGE_MID[f.e[1]]];
  return f.e.map(e => EDGE_MID[e]);
}

function paintRoad(ctx, d, f) {
  const pts = roadPoints(d, f);
  const curved = !!f.ctrl || !(f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1]);
  strokePass(ctx, pts, curved, 0.2, 'rgba(60,40,15,0.25)');       // weicher Rand
  strokePass(ctx, pts, curved, 0.165, '#7d6543');                  // Erdkante
  strokePass(ctx, pts, curved, 0.12, '#e9dcb6');                   // Weg
  strokePass(ctx, pts, curved, 0.1, '#f2e7c6', null, 0.5);         // Licht
  strokePass(ctx, pts, curved, 0.02, '#bda379', [0.045, 0.05], 0.9); // Spurrillen/Steine
  if (f.e.length === 1 && !d.f.some(x => x.t === 'mon') && !d.f.some(x => x.t === 'city') &&
      d.f.filter(x => x.t === 'road').length < 3) {
    const e = roadEndpoint(d, f.e[0]);
    ctx.beginPath(); ctx.arc(e[0], e[1], 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#e9dcb6'; ctx.fill();
    ctx.lineWidth = 0.014; ctx.strokeStyle = '#7d6543'; ctx.stroke();
  }
}

function paintPlaza(ctx, rnd) {
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.115, 0, Math.PI * 2);
  ctx.fillStyle = '#e9dcb6'; ctx.fill();
  ctx.lineWidth = 0.015; ctx.strokeStyle = '#7d6543'; ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, r = 0.045 + rnd() * 0.05;
    ctx.beginPath();
    ctx.arc(0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r, 0.008, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140,115,80,0.5)'; ctx.fill();
  }
  // Brunnen
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.034, 0, Math.PI * 2);
  ctx.fillStyle = '#93805e'; ctx.fill();
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.021, 0, Math.PI * 2);
  ctx.fillStyle = '#3d6d9e'; ctx.fill();
  ctx.beginPath(); ctx.arc(0.494, 0.494, 0.007, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
}

// ----- Fluss -----
function paintRiver(ctx, d, f) {
  const pts = roadPoints(d, f);
  let curved = !(f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1]);
  // Fluss weicht einer Stadt auf derselben Karte aus (Bogen ums Ufer)
  const city = d.f.find(x => x.t === 'city');
  if (city && pts.length === 3) {
    pts[1] = [0.5 + (0.5 - city.spot[0]) * 0.55, 0.5 + (0.5 - city.spot[1]) * 0.55];
    curved = true;
  }
  strokePass(ctx, pts, curved, 0.34, '#cfc39b');                    // Uferband
  strokePass(ctx, pts, curved, 0.3, 'rgba(90,80,45,0.35)');        // Uferkante
  strokePass(ctx, pts, curved, 0.26, '#2b5f95');
  strokePass(ctx, pts, curved, 0.19, '#3d78b0');
  strokePass(ctx, pts, curved, 0.1, '#5b93c7', null, 0.8);
  strokePass(ctx, pts, curved, 0.045, '#a7cdEC', [0.07, 0.09], 0.65); // Glanzband
  const rnd = mulberry(hash(d.id + 'w'));
  if (d.riverStart) {
    const [gx, gy] = pts[1];
    const g = ctx.createRadialGradient(gx, gy, 0.01, gx, gy, 0.14);
    g.addColorStop(0, '#bfe0f7'); g.addColorStop(0.5, '#4179ad'); g.addColorStop(1, '#2b5f95');
    ctx.beginPath(); ctx.arc(gx, gy, 0.135, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 0.02; ctx.strokeStyle = '#cfc39b'; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(gx + Math.cos(a) * 0.145, gy + Math.sin(a) * 0.145, 0.012, 0, Math.PI * 2);
      ctx.fillStyle = '#93805e'; ctx.fill();
    }
  }
  if (d.riverEnd) {
    const g = ctx.createRadialGradient(0.47, 0.5, 0.02, 0.5, 0.55, 0.28);
    g.addColorStop(0, '#6fa5d4'); g.addColorStop(0.6, '#3d78b0'); g.addColorStop(1, '#2b5f95');
    ctx.beginPath(); ctx.ellipse(0.5, 0.55, 0.25, 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cfc39b'; ctx.lineWidth = 0.05; ctx.strokeStyle = '#cfc39b'; ctx.stroke();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.43, 0.48, 0.06, 0.028, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.56, 0.6, 0.035, 0.016, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
}

// ----- Stadt -----
// Einheitliches Geometrie-System, damit Karten in JEDER Kombination
// nahtlos zusammenpassen:
//  - jede Stadtkante ist am Kartenrand auf VOLLER Breite bedeckt
//  - jede Mauer endet exakt in einer Kartenecke und verlässt sie
//    senkrecht zur Kante → Mauern benachbarter Karten fließen ohne
//    Knick ineinander (zwei Kappen ergeben z. B. ein rundes Oval)
function cityPaths(edges) {
  const set = edges.slice().sort((a, b) => a - b);
  let k = 0;
  if (set.length === 1) k = set[0];
  else if (set.length === 2 && (set[1] - set[0]) % 4 === 2) k = set[0];
  else if (set.length === 2) k = (set[1] - set[0] === 1) ? set[1] : 0;
  else if (set.length === 3) {
    const missing = [0, 1, 2, 3].find(e => !set.includes(e));
    k = (missing + 2) % 4;
  }
  const m = new DOMMatrix().translate(0.5, 0.5).rotate(k * 90).translate(-0.5, -0.5);
  const region = new Path2D();
  const walls = new Path2D();
  let hasWall = true;
  const raw = new Path2D();
  const rawWall = new Path2D();
  if (set.length === 4) {
    raw.rect(-0.02, -0.02, 1.04, 1.04);
    hasWall = false;
  } else if (set.length === 1) {
    // Kappe an N: U-Bogen, senkrecht in den Ecken, Tiefe 0.375
    raw.moveTo(0, -0.02); raw.lineTo(1, -0.02); raw.lineTo(1, 0);
    raw.bezierCurveTo(1, 0.5, 0, 0.5, 0, 0);
    raw.closePath();
    rawWall.moveTo(1, 0); rawWall.bezierCurveTo(1, 0.5, 0, 0.5, 0, 0);
  } else if (set.length === 2 && (set[1] - set[0]) % 4 === 2) {
    // Band N-S: volle Breite an beiden Stadtkanten, seitliche
    // Wiesen-Taschen (Tiefe 0.15), senkrecht in allen vier Ecken
    raw.moveTo(0, -0.02); raw.lineTo(1, -0.02); raw.lineTo(1, 0);
    raw.bezierCurveTo(1, 0.33, 0.85, 0.33, 0.85, 0.5);
    raw.bezierCurveTo(0.85, 0.67, 1, 0.67, 1, 1);
    raw.lineTo(1, 1.02); raw.lineTo(0, 1.02); raw.lineTo(0, 1);
    raw.bezierCurveTo(0, 0.67, 0.15, 0.67, 0.15, 0.5);
    raw.bezierCurveTo(0.15, 0.33, 0, 0.33, 0, 0);
    raw.closePath();
    rawWall.moveTo(1, 0);
    rawWall.bezierCurveTo(1, 0.33, 0.85, 0.33, 0.85, 0.5);
    rawWall.bezierCurveTo(0.85, 0.67, 1, 0.67, 1, 1);
    rawWall.moveTo(0, 0);
    rawWall.bezierCurveTo(0, 0.33, 0.15, 0.33, 0.15, 0.5);
    rawWall.bezierCurveTo(0.15, 0.67, 0, 0.67, 0, 1);
  } else if (set.length === 2) {
    // Ecke N+W: Bogen von SW-Ecke (senkrecht) über (0.56,0.56)
    // zur NO-Ecke (waagerecht)
    raw.moveTo(1, -0.02); raw.lineTo(-0.02, -0.02); raw.lineTo(-0.02, 1);
    raw.lineTo(0, 1);
    raw.bezierCurveTo(0, 0.76, 0.40, 0.72, 0.56, 0.56);
    raw.bezierCurveTo(0.72, 0.40, 0.76, 0, 1, 0);
    raw.closePath();
    rawWall.moveTo(0, 1);
    rawWall.bezierCurveTo(0, 0.76, 0.40, 0.72, 0.56, 0.56);
    rawWall.bezierCurveTo(0.72, 0.40, 0.76, 0, 1, 0);
  } else {
    // 3 Kanten, offen nach S: Wiesen-Tasche unten (Tiefe ~0.285)
    raw.moveTo(-0.02, 1); raw.lineTo(-0.02, -0.02); raw.lineTo(1.02, -0.02);
    raw.lineTo(1.02, 1); raw.lineTo(1, 1);
    raw.bezierCurveTo(1, 0.62, 0, 0.62, 0, 1);
    raw.closePath();
    rawWall.moveTo(1, 1); rawWall.bezierCurveTo(1, 0.62, 0, 0.62, 0, 1);
  }
  region.addPath(raw, m);
  walls.addPath(rawWall, m);
  return { region, walls: hasWall ? walls : null };
}

const ROOFS = ['#b5502e', '#a34627', '#c2662f', '#8f3d22', '#ad5a35', '#96482a'];

function paintCity(ctx, d, f, rot = 0) {
  const { region, walls } = cityPaths(f.e);
  const rnd = mulberry(hash(d.id + ':' + f.e.join('')));
  // Grundfläche: warmes Pflaster
  const g = ctx.createLinearGradient(0, 0, 1, 1);
  g.addColorStop(0, '#cfa269');
  g.addColorStop(1, '#b0824c');
  ctx.fillStyle = g;
  ctx.fill(region);
  ctx.save();
  ctx.clip(region);
  // Pflasterkörnung
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 1.04 - 0.02, y = rnd() * 1.04 - 0.02;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,235,200,0.10)' : 'rgba(90,50,20,0.10)';
    ctx.fillRect(x, y, 0.014, 0.014);
  }
  // Häuser einstreuen (nur wo wirklich Stadtfläche ist).
  // isPointInPath erwartet Geräte-Koordinaten → von Hand transformieren.
  const M = ctx.getTransform();
  const inside = (x, y) => {
    const pt = M.transformPoint(new DOMPoint(x, y));
    return ctx.isPointInPath(region, pt.x, pt.y);
  };
  const houses = [];
  for (let i = 0; i < 48 && houses.length < 11; i++) {
    const w = 0.1 + rnd() * 0.05;
    const h = w * (0.75 + rnd() * 0.3);
    const x = 0.03 + rnd() * 0.94, y = 0.06 + rnd() * 0.9;
    const r = Math.max(w * 0.68, h * 0.62);
    if (inside(x, y) &&
        inside(x - r, y - r) && inside(x + r, y - r) &&
        inside(x - r, y + r) && inside(x + r, y + r) &&
        !houses.some(o => Math.abs(o.x - x) < (o.w + w) * 0.66 && Math.abs(o.y - y) < (o.h + h) * 0.66)) {
      houses.push({ x, y, w, h, roof: ROOFS[(rnd() * ROOFS.length) | 0] });
    }
  }
  houses.sort((a, b) => a.y - b.y);
  for (const hs of houses) upright(ctx, hs.x, hs.y, rot, () => paintHouse(ctx, hs));
  ctx.restore();
  // Stadtmauer mit Zinnen
  if (walls) {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(40,25,12,0.35)';
    ctx.lineWidth = 0.075;
    ctx.stroke(walls);
    ctx.strokeStyle = '#6d5138';
    ctx.lineWidth = 0.052;
    ctx.stroke(walls);
    ctx.setLineDash([0.045, 0.038]);
    ctx.strokeStyle = '#7e5f42';
    ctx.lineWidth = 0.085;
    ctx.stroke(walls);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(245,225,190,0.5)';
    ctx.lineWidth = 0.012;
    ctx.stroke(walls);
    ctx.restore();
  }
}

function paintHouse(ctx, { w, h, roof }) {
  const x = 0, y = 0;
  // Schatten
  ctx.beginPath();
  ctx.ellipse(x + 0.012, y + h * 0.4, w * 0.62, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,20,5,0.28)';
  ctx.fill();
  // Wand
  const wallTop = y - h * 0.08;
  ctx.fillStyle = '#eddcae';
  ctx.fillRect(x - w / 2, wallTop, w, h * 0.5);
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ctx.fillRect(x + w * 0.18, wallTop, w * 0.32, h * 0.5);
  // Dach (zwei Flächen)
  const apexY = y - h * 0.52;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x, wallTop);
  ctx.closePath();
  ctx.fillStyle = shade(roof, 0.12); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x, wallTop);
  ctx.closePath();
  ctx.fillStyle = shade(roof, -0.22); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x + w * 0.6, wallTop);
  ctx.lineWidth = 0.008; ctx.strokeStyle = 'rgba(60,25,10,0.55)'; ctx.stroke();
  // Fenster
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(x - w * 0.16, y + h * 0.05, w * 0.14, h * 0.2);
  ctx.fillStyle = '#f4c95c';
  ctx.fillRect(x + w * 0.08, y + h * 0.02, w * 0.13, h * 0.13);
}

function paintShield(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.9);
    ctx.lineTo(s, -s * 0.9);
    ctx.lineTo(s, s * 0.25);
    ctx.quadraticCurveTo(s, s * 0.85, 0, s * 1.15);
    ctx.quadraticCurveTo(-s, s * 0.85, -s, s * 0.25);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(s * 0.14, s * 0.2);
  path();
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.fill();
  ctx.restore();
  path();
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#4a7ad1');
  g.addColorStop(1, '#27498c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * 0.24;
  ctx.strokeStyle = '#f3e3b8';
  ctx.stroke();
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = 'rgba(90,60,20,0.6)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.2); ctx.lineTo(0, s * 0.38); ctx.lineTo(s * 0.55, -s * 0.2);
  ctx.strokeStyle = '#f3e3b8';
  ctx.lineWidth = s * 0.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.5, s * 0.28, s * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
}

function paintCathedral(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const w = 0.36, h = 0.32;
  ctx.fillStyle = 'rgba(20,10,5,0.3)';
  ctx.beginPath(); ctx.ellipse(0.01, h * 0.46, w * 0.66, 0.055, 0, 0, Math.PI * 2); ctx.fill();
  const wallG = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.4);
  wallG.addColorStop(0, '#f2ead6');
  wallG.addColorStop(1, '#d4c6a4');
  // Schiff
  ctx.fillStyle = wallG;
  ctx.fillRect(-w / 2, -h * 0.18, w, h * 0.56);
  // Türme
  ctx.fillRect(-w / 2 - 0.05, -h * 0.55, 0.1, h * 1.05);
  ctx.fillRect(w / 2 - 0.05, -h * 0.55, 0.1, h * 1.05);
  ctx.fillStyle = 'rgba(120,90,50,0.3)';
  ctx.fillRect(-w / 2 + 0.02, -h * 0.55, 0.03, h * 1.05);
  ctx.fillRect(w / 2 + 0.02, -h * 0.55, 0.03, h * 1.05);
  const spire = (cx, ty) => {
    const sg = ctx.createLinearGradient(cx - 0.06, 0, cx + 0.06, 0);
    sg.addColorStop(0, '#a4523a'); sg.addColorStop(0.5, '#8d3f2c'); sg.addColorStop(1, '#6e2f20');
    ctx.beginPath();
    ctx.moveTo(cx - 0.06, ty); ctx.lineTo(cx, ty - 0.13); ctx.lineTo(cx + 0.06, ty);
    ctx.closePath(); ctx.fillStyle = sg; ctx.fill();
  };
  spire(-w / 2, -h * 0.55);
  spire(w / 2, -h * 0.55);
  // Giebel + Kreuz
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.18); ctx.lineTo(0, -h * 0.58); ctx.lineTo(w / 2, -h * 0.18);
  ctx.closePath(); ctx.fillStyle = '#8d3f2c'; ctx.fill();
  ctx.strokeStyle = '#e8c34e'; ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.58); ctx.lineTo(0, -h * 0.72);
  ctx.moveTo(-0.022, -h * 0.665); ctx.lineTo(0.022, -h * 0.665);
  ctx.stroke();
  // Rosette
  ctx.beginPath(); ctx.arc(0, 0.0, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = '#2f5fb3'; ctx.fill();
  ctx.lineWidth = 0.014; ctx.strokeStyle = '#e8c34e'; ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
    ctx.lineWidth = 0.006; ctx.strokeStyle = '#e8c34e'; ctx.stroke();
  }
  // Portal
  ctx.beginPath();
  ctx.moveTo(-0.04, h * 0.38); ctx.lineTo(-0.04, h * 0.14);
  ctx.arc(0, h * 0.14, 0.04, Math.PI, 0);
  ctx.lineTo(0.04, h * 0.38);
  ctx.closePath();
  ctx.fillStyle = '#553317'; ctx.fill();
  ctx.restore();
}

function paintCityDeko(ctx, f, rot = 0) {
  const [sx, sy] = f.spot;
  if (f.cath) upright(ctx, sx, sy - 0.04, rot, () => paintCathedral(ctx, 0, 0));
  const s1x = f.cath ? sx - 0.3 : sx - (f.e.length > 1 ? 0.16 : 0.17);
  const s1y = f.cath ? sy : sy - (f.e.length === 1 ? 0.0 : 0.14);
  if (f.shield >= 1) upright(ctx, s1x, s1y, rot, () => paintShield(ctx, 0, 0, 0.058));
  if (f.shield >= 2) upright(ctx, sx + 0.16, sy - 0.14, rot, () => paintShield(ctx, 0, 0, 0.058));
}

// ----- Kloster -----
function paintMonastery(ctx, f, rot = 0) {
  const [cx, cy] = f.spot;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-rot * Math.PI / 2);
  // Hof & Schatten
  ctx.beginPath(); ctx.ellipse(0.012, 0.14, 0.23, 0.075, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,10,5,0.28)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0.06, 0.27, 0.19, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(233,220,182,0.5)'; ctx.fill();
  ctx.setLineDash([0.02, 0.018]);
  ctx.strokeStyle = 'rgba(110,80,50,0.4)'; ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.setLineDash([]);
  // Bäume
  for (const [tx, ty] of [[-0.21, -0.02], [0.22, 0.0]]) {
    ctx.beginPath(); ctx.arc(tx, ty, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#4c7a2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(tx - 0.015, ty - 0.02, 0.028, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,240,160,0.5)'; ctx.fill();
  }
  // Hauptgebäude
  const wallG = ctx.createLinearGradient(0, -0.1, 0, 0.15);
  wallG.addColorStop(0, '#f4ecd8'); wallG.addColorStop(1, '#d9cba6');
  ctx.fillStyle = wallG;
  ctx.fillRect(-0.17, -0.06, 0.34, 0.2);
  // Anbau rechts
  ctx.fillRect(0.13, -0.02, 0.1, 0.16);
  ctx.fillStyle = '#b0492f';
  ctx.beginPath();
  ctx.moveTo(0.12, -0.02); ctx.lineTo(0.18, -0.07); ctx.lineTo(0.24, -0.02);
  ctx.closePath(); ctx.fill();
  // Dach
  const roofG = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
  roofG.addColorStop(0, '#c25b3b'); roofG.addColorStop(0.5, '#a8432f'); roofG.addColorStop(1, '#8c3423');
  ctx.fillStyle = roofG;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.06); ctx.lineTo(0, -0.2); ctx.lineTo(0.2, -0.06);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,190,0.5)';
  ctx.lineWidth = 0.008;
  ctx.beginPath(); ctx.moveTo(-0.19, -0.062); ctx.lineTo(0, -0.196); ctx.stroke();
  // Turm
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(-0.04, -0.32, 0.08, 0.15);
  ctx.fillStyle = 'rgba(120,90,50,0.3)';
  ctx.fillRect(0.012, -0.32, 0.028, 0.15);
  ctx.fillStyle = '#a8432f';
  ctx.beginPath();
  ctx.moveTo(-0.06, -0.32); ctx.lineTo(0, -0.42); ctx.lineTo(0.06, -0.32);
  ctx.closePath(); ctx.fill();
  // Goldenes Kreuz
  ctx.strokeStyle = '#e8c34e';
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(0, -0.42); ctx.lineTo(0, -0.485);
  ctx.moveTo(-0.022, -0.458); ctx.lineTo(0.022, -0.458);
  ctx.stroke();
  // Turmfenster, Tür & Fenster
  ctx.fillStyle = '#5b4526';
  ctx.beginPath();
  ctx.moveTo(-0.016, -0.22); ctx.lineTo(-0.016, -0.27);
  ctx.arc(0, -0.27, 0.016, Math.PI, 0);
  ctx.lineTo(0.016, -0.22);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.03, 0.14); ctx.lineTo(-0.03, 0.03);
  ctx.arc(0, 0.03, 0.03, Math.PI, 0);
  ctx.lineTo(0.03, 0.14);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3f6ea8';
  ctx.fillRect(-0.125, 0.0, 0.038, 0.05);
  ctx.fillRect(0.08, 0.02, 0.032, 0.045);
  ctx.restore();
}

// ----- Wirtshaus -----
function paintInn(ctx, f, rot = 0) {
  const [sx, sy] = f.spot;
  const x = Math.min(0.8, sx + 0.17), y = Math.max(0.2, sy - 0.15);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot * Math.PI / 2);
  ctx.beginPath(); ctx.ellipse(0.008, 0.085, 0.11, 0.03, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,10,5,0.3)'; ctx.fill();
  const wg = ctx.createLinearGradient(0, -0.02, 0, 0.08);
  wg.addColorStop(0, '#f4e6c0'); wg.addColorStop(1, '#dcc999');
  ctx.fillStyle = wg;
  ctx.fillRect(-0.08, -0.02, 0.16, 0.095);
  const rg = ctx.createLinearGradient(-0.1, 0, 0.1, 0);
  rg.addColorStop(0, '#d3683a'); rg.addColorStop(1, '#a84a24');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-0.102, -0.02); ctx.lineTo(0, -0.1); ctx.lineTo(0.102, -0.02);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,30,10,0.5)'; ctx.lineWidth = 0.008;
  ctx.stroke();
  // Tür + leuchtendes Fenster
  ctx.fillStyle = '#5b4526';
  ctx.fillRect(-0.045, 0.018, 0.038, 0.057);
  ctx.fillStyle = '#ffd66b';
  ctx.fillRect(0.012, 0.008, 0.036, 0.034);
  ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 0.005;
  ctx.strokeRect(0.012, 0.008, 0.036, 0.034);
  // Wirtshausschild
  ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(0.105, 0.075); ctx.lineTo(0.105, -0.055); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.105, -0.06, 0.028, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f'; ctx.fill();
  ctx.lineWidth = 0.006; ctx.strokeStyle = '#8a6a30'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0.105, -0.06, 0.012, 0, Math.PI * 2);
  ctx.fillStyle = '#b03636'; ctx.fill();
  ctx.restore();
}

// ============================================================
// Board-Ansicht mit Kamera
// ============================================================
let woodCanvas = null;
function woodPattern(ctx) {
  if (woodCanvas) return ctx.createPattern(woodCanvas, 'repeat');
  const c = document.createElement('canvas');
  c.width = c.height = 360;
  const w = c.getContext('2d');
  const rnd = mulberry(20260730);
  w.fillStyle = '#33261c';
  w.fillRect(0, 0, 360, 360);
  const plank = 90;
  for (let p = 0; p < 4; p++) {
    const x0 = p * plank;
    const base = 0.92 + rnd() * 0.16;
    const g = w.createLinearGradient(x0, 0, x0 + plank, 0);
    g.addColorStop(0, `rgba(70,50,36,${0.5 * base})`);
    g.addColorStop(0.5, `rgba(58,42,30,${0.45 * base})`);
    g.addColorStop(1, `rgba(48,34,24,${0.5 * base})`);
    w.fillStyle = g;
    w.fillRect(x0, 0, plank, 360);
    // Maserung
    for (let i = 0; i < 14; i++) {
      const gx = x0 + 6 + rnd() * (plank - 12);
      w.beginPath();
      w.moveTo(gx, -10);
      let yy = -10;
      let xx = gx;
      while (yy < 370) {
        yy += 24 + rnd() * 26;
        xx = gx + Math.sin(yy * 0.02 + rnd() * 6) * 4;
        w.lineTo(xx, yy);
      }
      w.strokeStyle = rnd() > 0.6 ? 'rgba(20,12,6,0.16)' : 'rgba(120,88,60,0.10)';
      w.lineWidth = 0.8 + rnd() * 1.4;
      w.stroke();
    }
    // Astloch gelegentlich
    if (rnd() < 0.5) {
      const kx = x0 + 15 + rnd() * (plank - 30), ky = rnd() * 360;
      for (let r = 6; r > 0; r -= 1.6) {
        w.beginPath(); w.ellipse(kx, ky, r, r * 1.5, 0.2, 0, Math.PI * 2);
        w.strokeStyle = 'rgba(25,15,8,0.25)'; w.lineWidth = 1; w.stroke();
      }
    }
    // Plankenfuge
    w.fillStyle = 'rgba(15,9,5,0.6)';
    w.fillRect(x0 + plank - 1.2, 0, 2.4, 360);
    w.fillStyle = 'rgba(140,105,70,0.12)';
    w.fillRect(x0 + 1, 0, 1.4, 360);
  }
  woodCanvas = c;
  return ctx.createPattern(c, 'repeat');
}

function makeGlowSprite(color, fill = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 144;
  const g = c.getContext('2d');
  g.shadowColor = color;
  g.shadowBlur = 20;
  g.lineWidth = 5;
  g.strokeStyle = color;
  const p = new Path2D();
  const r = 14;
  p.moveTo(32 + r, 32);
  p.arcTo(112, 32, 112, 112, r);
  p.arcTo(112, 112, 32, 112, r);
  p.arcTo(32, 112, 32, 32, r);
  p.arcTo(32, 32, 112, 32, r);
  p.closePath();
  if (fill) { g.fillStyle = color.replace(/[\d.]+\)$/, '0.16)'); g.fill(p); }
  g.stroke(p);
  g.stroke(p);
  return c;
}

let shadowSprite = null;
function makeShadowSprite() {
  if (shadowSprite) return shadowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 144;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 16;
  g.shadowOffsetY = 5;
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(32, 32, 80, 80);
  shadowSprite = c;
  return c;
}

export class BoardView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, scale: 90 };
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.glowWhite = makeGlowSprite('rgba(255,255,255,0.9)', true);
    this.glowGold = makeGlowSprite('rgba(255,205,110,0.9)');
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  worldToScreen(wx, wy) {
    const r = this.canvas.getBoundingClientRect();
    return [
      (wx - this.cam.x) * this.cam.scale + r.width / 2,
      (wy - this.cam.y) * this.cam.scale + r.height / 2,
    ];
  }

  screenToWorld(sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    return [
      (sx - r.width / 2) / this.cam.scale + this.cam.x,
      (sy - r.height / 2) / this.cam.scale + this.cam.y,
    ];
  }

  screenToCell(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    return [Math.round(wx), Math.round(wy)];
  }

  centerOn(state, animate = false) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const k of state.grid.keys()) {
      const [x, y] = k.split(',').map(Number);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const r = this.canvas.getBoundingClientRect();
    const w = maxX - minX + 3, h = maxY - minY + 3;
    const scale = Math.min(140, Math.max(14, Math.min(r.width / w, r.height / h)));
    const tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    if (animate) {
      this.camTarget = { x: tx, y: ty, scale };
    } else {
      this.cam = { x: tx, y: ty, scale };
      this.camTarget = null;
    }
  }

  tick() {
    if (this.camTarget) {
      const t = this.camTarget, c = this.cam, k = 0.16;
      c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.scale += (t.scale - c.scale) * k;
      if (Math.abs(t.x - c.x) < 0.005 && Math.abs(t.scale - c.scale) < 0.3) this.camTarget = null;
      return true;
    }
    return false;
  }

  render(state, view = {}) {
    const ctx = this.ctx;
    const r = this.canvas.getBoundingClientRect();
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Holztisch
    ctx.save();
    const off = 360;
    ctx.translate(((-this.cam.x * this.cam.scale) % off), ((-this.cam.y * this.cam.scale) % off));
    ctx.fillStyle = woodPattern(ctx);
    ctx.fillRect(-off, -off, r.width + 2 * off, r.height + 2 * off);
    ctx.restore();
    // warmes Licht + Vignette
    const light = ctx.createRadialGradient(r.width / 2, r.height * 0.38, 40, r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.85);
    light.addColorStop(0, 'rgba(255,225,170,0.10)');
    light.addColorStop(0.55, 'rgba(0,0,0,0)');
    light.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, r.width, r.height);

    const s = this.cam.scale;
    const now = view.now || 0;

    // weiche Schatten
    const sh = makeShadowSprite();
    const shScale = s / 80;
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      ctx.drawImage(sh, sx - 72 * shScale, sy - 72 * shScale, 144 * shScale, 144 * shScale);
    }
    // Karten
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      let scale = 1;
      if (view.anim && view.anim.placedIdx === idx) {
        const t = Math.min(1, (now - view.anim.t0) / 260);
        scale = 1 + (1 - t) * 0.25;
        ctx.globalAlpha = 0.4 + 0.6 * t;
      }
      const art = tileArt(p.defId, p.rot);
      const ds = s * scale;
      ctx.drawImage(art, sx - ds / 2, sy - ds / 2, ds, ds);
      ctx.globalAlpha = 1;
    }
    // zuletzt gelegte Karte: goldener Schein
    if (view.lastPlaced != null && state.placed[view.lastPlaced]) {
      const p = state.placed[view.lastPlaced];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      const gsc = s / 80;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.glowGold, sx - 72 * gsc, sy - 72 * gsc, 144 * gsc, 144 * gsc);
      ctx.globalAlpha = 1;
    }

    // legale Felder
    if (view.legal) {
      const pulse = 0.4 + 0.2 * Math.sin(now / 320);
      const gsc = s / 80;
      for (const c of view.legal) {
        const [sx, sy] = this.worldToScreen(c.x, c.y);
        ctx.globalAlpha = pulse;
        ctx.drawImage(this.glowWhite, sx - 72 * gsc, sy - 72 * gsc, 144 * gsc, 144 * gsc);
        ctx.globalAlpha = 1;
      }
    }

    // Vorschau
    if (view.sel) {
      const { x, y, rot, valid } = view.sel;
      const [sx, sy] = this.worldToScreen(x, y);
      ctx.globalAlpha = 0.93;
      const art = tileArt(view.sel.defId, rot);
      ctx.drawImage(art, sx - s / 2, sy - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = valid ? 'rgba(90,225,130,0.95)' : 'rgba(240,80,80,0.95)';
      this.rounded(ctx, sx - s / 2 + 1.5, sy - s / 2 + 1.5, s - 3, s - 3, s * 0.05);
      ctx.stroke();
    }

    // Meeples
    for (const [, data] of state.roots) {
      for (const m of data.meeples) {
        const p = state.placed[m.placedIdx];
        if (!p) continue;
        const f = DEFS[p.defId].f[m.fi];
        const [lx, ly] = rotPoint(f.spot, p.rot);
        const [sx, sy] = this.worldToScreen(p.x - 0.5 + lx, p.y - 0.5 + ly);
        drawMeeple(ctx, sx, sy, s * 0.34, state.players[m.pl].color, { big: m.big });
      }
    }

    // Meeple-Auswahlpunkte
    if (view.meepleSpots) {
      for (const spot of view.meepleSpots) {
        const [sx, sy] = this.worldToScreen(spot.wx, spot.wy);
        const pulse = 1 + 0.08 * Math.sin(now / 250 + sx);
        ctx.beginPath();
        ctx.arc(sx, sy + 2, s * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,10,20,0.35)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(40,40,60,0.85)';
        ctx.stroke();
        drawMeeple(ctx, sx, sy, s * 0.2, spot.color, { shadow: false });
      }
    }

    // Punkte-Floater
    if (view.floaters) {
      for (const f of view.floaters) {
        const age = (now - f.t0) / 1600;
        if (age > 1) continue;
        const [sx, sy] = this.worldToScreen(f.x, f.y);
        ctx.globalAlpha = 1 - age * age;
        ctx.font = `800 ${Math.max(17, s * 0.36)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(15,15,25,0.9)';
        ctx.strokeText(f.text, sx, sy - age * s * 0.8);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy - age * s * 0.8);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// Vorschau-Canvas (HUD) füllen
export function drawPreview(canvas, defId, rot) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!defId) return;
  const art = tileArt(defId, rot);
  ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
}

// Meeple-Punkte in Weltkoordinaten für die Auswahlphase
export function meepleSpotWorld(state, opt) {
  const p = state.placed[state.lastPlacedIdx];
  const [lx, ly] = rotPoint(opt.spot, p.rot);
  return { wx: p.x - 0.5 + lx, wy: p.y - 0.5 + ly };
}

export { find };
