// ============================================================
// Carcassonne Mobile – Rendering (prozedurale Kartengrafik)
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
    ctx.translate(5, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill(MEEPLE_PATH);
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.fill(MEEPLE_PATH);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke(MEEPLE_PATH);
  // Glanzlicht
  ctx.beginPath();
  ctx.arc(43, 22, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
}

// ---------- Kartengrafik ----------
const artCache = new Map();
export const ART_SIZE = 168;

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
  paintTile(ctx, DEFS[defId]);
  ctx.restore();
  // Rahmen (nicht mitrotiert)
  const s = ART_SIZE;
  const fr = c.getContext('2d');
  fr.strokeStyle = 'rgba(60,40,20,0.35)';
  fr.lineWidth = 2;
  fr.strokeRect(1, 1, s - 2, s - 2);
  fr.strokeStyle = 'rgba(255,255,255,0.10)';
  fr.lineWidth = 1;
  fr.strokeRect(2.5, 2.5, s - 5, s - 5);
  artCache.set(k, c);
  return c;
}

function paintTile(ctx, d) {
  const rnd = mulberry(hash(d.id));
  paintGrass(ctx, rnd);
  const cities = d.f.filter(f => f.t === 'city');
  const hasCity = cities.length > 0;
  for (const f of d.f) if (f.t === 'river') paintRiver(ctx, d, f);
  for (const f of d.f) if (f.t === 'road') paintRoad(ctx, d, f);
  const roadFeatures = d.f.filter(f => f.t === 'road');
  if (roadFeatures.length >= 3) paintPlaza(ctx);
  for (const f of d.f) if (f.t === 'city') paintCity(ctx, d, f, rnd);
  for (const f of d.f) if (f.t === 'city') paintCityDeko(ctx, f);
  for (const f of d.f) if (f.t === 'mon') paintMonastery(ctx, f);
  for (const f of d.f) if (f.t === 'road' && f.inn) paintInn(ctx, f);
  paintFlowers(ctx, d, rnd, hasCity);
}

function paintGrass(ctx, rnd) {
  const g = ctx.createLinearGradient(0, 0, 1, 1);
  g.addColorStop(0, '#7fb24f');
  g.addColorStop(0.55, '#74a847');
  g.addColorStop(1, '#699d40');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 1);
  for (let i = 0; i < 60; i++) {
    const x = rnd(), y = rnd(), r = 0.006 + rnd() * 0.014;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,220,0.10)' : 'rgba(20,60,10,0.10)';
    ctx.fill();
  }
}

function paintFlowers(ctx, d, rnd, hasCity) {
  const n = hasCity ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const x = 0.08 + rnd() * 0.84, y = 0.08 + rnd() * 0.84;
    ctx.beginPath();
    ctx.arc(x, y, 0.012, 0, Math.PI * 2);
    ctx.fillStyle = ['#ffe28a', '#fff3f3', '#ffb1c1'][i % 3];
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ----- Straßen -----
function roadEndpoint(d, edge) {
  // Zielpunkt für Sackgassen: Kloster, Stadttor oder Wegende
  const hasMon = d.f.some(f => f.t === 'mon');
  const [mx, my] = EDGE_MID[edge];
  const toC = (t) => [mx + (0.5 - mx) * t, my + (0.5 - my) * t];
  const roadCount = d.f.filter(f => f.t === 'road').length;
  if (roadCount >= 3) return toC(0.86);
  if (hasMon) return toC(0.5);
  const bigCity = d.f.find(f => f.t === 'city' && f.e.length >= 2);
  if (bigCity) return toC(0.55);
  const anyCity = d.f.some(f => f.t === 'city');
  return toC(anyCity ? 0.72 : 0.7);
}

function strokeWay(ctx, pts, wOuter, wInner, cOuter, cInner, curved) {
  const p = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3 && curved) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  p(); ctx.strokeStyle = cOuter; ctx.lineWidth = wOuter; ctx.stroke();
  p(); ctx.strokeStyle = cInner; ctx.lineWidth = wInner; ctx.stroke();
}

function paintRoad(ctx, d, f) {
  let pts;
  if (f.e.length === 1) {
    pts = [EDGE_MID[f.e[0]], roadEndpoint(d, f.e[0])];
  } else if (f.e.length === 2) {
    const [a, b] = f.e;
    pts = [EDGE_MID[a], [0.5, 0.5], EDGE_MID[b]];
  } else {
    pts = f.e.map(e => EDGE_MID[e]);
  }
  const opposite = f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1];
  strokeWay(ctx, pts, 0.17, 0.115, '#8a7148', '#e8dbb6', !opposite);
  // Sackgassen-Punkt
  if (f.e.length === 1 && !d.f.some(x => x.t === 'mon') && !d.f.some(x => x.t === 'city') && d.f.filter(x => x.t === 'road').length < 3) {
    const e = roadEndpoint(d, f.e[0]);
    ctx.beginPath(); ctx.arc(e[0], e[1], 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#e8dbb6'; ctx.fill();
    ctx.lineWidth = 0.015; ctx.strokeStyle = '#8a7148'; ctx.stroke();
  }
}

function paintPlaza(ctx) {
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#e8dbb6'; ctx.fill();
  ctx.lineWidth = 0.016; ctx.strokeStyle = '#8a7148'; ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.028, 0, Math.PI * 2);
  ctx.fillStyle = '#b3a077'; ctx.fill();
}

// ----- Fluss -----
function paintRiver(ctx, d, f) {
  let pts;
  if (f.e.length === 1) pts = [EDGE_MID[f.e[0]], [0.5, 0.5]];
  else pts = [EDGE_MID[f.e[0]], [0.5, 0.5], EDGE_MID[f.e[1]]];
  const opposite = f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1];
  strokeWay(ctx, pts, 0.30, 0.30, 'rgba(210,225,170,0.9)', 'rgba(210,225,170,0.9)', !opposite);
  strokeWay(ctx, pts, 0.24, 0.15, '#2e6da3', '#4d94cf', !opposite);
  // Glitzern
  const [gx, gy] = pts.length === 3 ? [0.5, 0.5] : pts[1];
  if (d.riverStart) {
    ctx.beginPath(); ctx.arc(gx, gy, 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#4d94cf'; ctx.fill();
    ctx.lineWidth = 0.03; ctx.strokeStyle = '#2e6da3'; ctx.stroke();
    ctx.beginPath(); ctx.arc(gx, gy, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#bfe0f7'; ctx.fill();
  }
  if (d.riverEnd) {
    ctx.beginPath(); ctx.ellipse(0.5, 0.55, 0.24, 0.19, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2e6da3'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.5, 0.55, 0.18, 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4d94cf'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.44, 0.5, 0.05, 0.03, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
  }
}

// ----- Stadt -----
function normAdjacentPair(edges) {
  // kanonische Rotation für benachbartes Paar → N+W
  const [a, b] = edges.slice().sort();
  if (b - a === 1) return b;      // z.B. {0,1}: rotiere um 1 → {3,0}=N+W? (0-1)%4=3,(1-1)=0 ✓
  return 0;                        // {0,3} ist schon N+W
}

function paintCity(ctx, d, f, rnd) {
  ctx.save();
  // Region
  const edges = f.e.slice().sort();
  let k = 0;
  if (edges.length === 2 && (edges[1] - edges[0]) !== 2) k = normAdjacentPair(edges);
  else if (edges.length === 1) k = edges[0];
  else if (edges.length === 3) {
    const missing = [0, 1, 2, 3].find(e => !edges.includes(e));
    k = (missing + 2) % 4;
  } else if (edges.length === 2) k = edges[0];

  const region = () => {
    ctx.beginPath();
    if (edges.length === 4) { ctx.rect(0, 0, 1, 1); return; }
    ctx.save();
    ctx.translate(0.5, 0.5); ctx.rotate(k * Math.PI / 2); ctx.translate(-0.5, -0.5);
    if (edges.length === 1) {
      ctx.moveTo(-0.01, -0.01); ctx.lineTo(1.01, -0.01); ctx.lineTo(1, 0);
      ctx.quadraticCurveTo(0.5, 0.62, 0, 0);
      ctx.closePath();
    } else if ((edges[1] - edges[0]) % 4 === 2) {
      ctx.moveTo(0.16, -0.01);
      ctx.quadraticCurveTo(0.3, 0.5, 0.16, 1.01);
      ctx.lineTo(0.84, 1.01);
      ctx.quadraticCurveTo(0.7, 0.5, 0.84, -0.01);
      ctx.closePath();
    } else if (edges.length === 2) {
      ctx.moveTo(1.01, -0.01); ctx.lineTo(-0.01, -0.01); ctx.lineTo(-0.01, 1.01); ctx.lineTo(0, 1);
      ctx.quadraticCurveTo(0.66, 0.66, 1, 0);
      ctx.closePath();
    } else {
      ctx.moveTo(-0.01, 1.01); ctx.lineTo(-0.01, -0.01); ctx.lineTo(1.01, -0.01); ctx.lineTo(1.01, 1.01); ctx.lineTo(1, 1);
      ctx.quadraticCurveTo(0.5, 0.6, 0, 1);
      ctx.closePath();
    }
    ctx.restore();
  };

  // Grundfläche
  region();
  const g = ctx.createLinearGradient(0, 0, 1, 1);
  g.addColorStop(0, '#c98a56');
  g.addColorStop(1, '#a96b3d');
  ctx.fillStyle = g;
  ctx.fill();

  // Dächer-Struktur (im Clip)
  ctx.save();
  region();
  ctx.clip();
  for (let i = -8; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.12, -0.2);
    ctx.lineTo(i * 0.12 + 0.55, 1.2);
    ctx.strokeStyle = i % 2 ? 'rgba(120,60,25,0.20)' : 'rgba(255,220,180,0.12)';
    ctx.lineWidth = 0.045;
    ctx.stroke();
  }
  // kleine Häuser
  const r2 = mulberry(hash(d.id + 'h'));
  for (let i = 0; i < 6; i++) {
    const hx = r2(), hy = r2() * 0.9;
    ctx.fillStyle = 'rgba(90,45,20,0.30)';
    ctx.fillRect(hx, hy, 0.09, 0.07);
    ctx.beginPath();
    ctx.moveTo(hx - 0.012, hy); ctx.lineTo(hx + 0.045, hy - 0.045); ctx.lineTo(hx + 0.102, hy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,60,30,0.45)';
    ctx.fill();
  }
  ctx.restore();

  // Mauerlinie
  region();
  ctx.strokeStyle = '#5f3a1e';
  ctx.lineWidth = 0.028;
  ctx.stroke();
  region();
  ctx.strokeStyle = 'rgba(255,235,200,0.35)';
  ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.restore();
}

function paintShield(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.9);
  ctx.lineTo(s, -s * 0.9);
  ctx.lineTo(s, s * 0.25);
  ctx.quadraticCurveTo(s, s * 0.85, 0, s * 1.1);
  ctx.quadraticCurveTo(-s, s * 0.85, -s, s * 0.25);
  ctx.closePath();
  ctx.fillStyle = '#2f5fb3';
  ctx.fill();
  ctx.lineWidth = s * 0.22;
  ctx.strokeStyle = '#f5f0dc';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.2); ctx.lineTo(0, s * 0.35); ctx.lineTo(s * 0.55, -s * 0.2);
  ctx.strokeStyle = '#f5f0dc';
  ctx.lineWidth = s * 0.28;
  ctx.stroke();
  ctx.restore();
}

function paintCathedral(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const w = 0.34, h = 0.30;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.62, 0.05, 0, 0, Math.PI * 2); ctx.fill();
  // Schiff
  ctx.fillStyle = '#e9e2d0';
  ctx.fillRect(-w / 2, -h * 0.2, w, h * 0.55);
  // Türme
  ctx.fillRect(-w / 2 - 0.045, -h * 0.5, 0.09, h);
  ctx.fillRect(w / 2 - 0.045, -h * 0.5, 0.09, h);
  ctx.fillStyle = '#8d3f2c';
  const spire = (cx, ty) => {
    ctx.beginPath();
    ctx.moveTo(cx - 0.055, ty); ctx.lineTo(cx, ty - 0.11); ctx.lineTo(cx + 0.055, ty);
    ctx.closePath(); ctx.fill();
  };
  spire(-w / 2, -h * 0.5);
  spire(w / 2, -h * 0.5);
  // Mittelgiebel
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.2); ctx.lineTo(0, -h * 0.55); ctx.lineTo(w / 2, -h * 0.2);
  ctx.closePath(); ctx.fill();
  // Rosette
  ctx.beginPath(); ctx.arc(0, 0, 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#2f5fb3'; ctx.fill();
  ctx.lineWidth = 0.012; ctx.strokeStyle = '#e9e2d0'; ctx.stroke();
  // Portal
  ctx.beginPath();
  ctx.moveTo(-0.035, h * 0.35); ctx.lineTo(-0.035, h * 0.12);
  ctx.arc(0, h * 0.12, 0.035, Math.PI, 0);
  ctx.lineTo(0.035, h * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#5f3a1e'; ctx.fill();
  ctx.restore();
}

function paintCityDeko(ctx, f) {
  const [sx, sy] = f.spot;
  if (f.cath) paintCathedral(ctx, sx, sy - 0.04);
  if (f.shield >= 1) paintShield(ctx, f.cath ? sx - 0.28 : sx - (f.e.length > 1 ? 0.16 : 0.17), f.cath ? sy : sy - (f.e.length === 1 ? 0.0 : 0.14), 0.055);
  if (f.shield >= 2) paintShield(ctx, sx + 0.16, sy - 0.14, 0.055);
}

// ----- Kloster -----
function paintMonastery(ctx, f) {
  const [cx, cy] = f.spot;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0.01, 0.16, 0.2, 0.05, 0, 0, Math.PI * 2); ctx.fill();
  // Hof
  ctx.fillStyle = 'rgba(233,226,208,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0.06, 0.24, 0.17, 0, 0, Math.PI * 2); ctx.fill();
  // Gebäude
  ctx.fillStyle = '#efe7d2';
  ctx.fillRect(-0.16, -0.06, 0.32, 0.2);
  // Dach
  ctx.fillStyle = '#a8432f';
  ctx.beginPath();
  ctx.moveTo(-0.19, -0.06); ctx.lineTo(0, -0.19); ctx.lineTo(0.19, -0.06);
  ctx.closePath(); ctx.fill();
  // Turm
  ctx.fillStyle = '#efe7d2';
  ctx.fillRect(-0.035, -0.3, 0.07, 0.14);
  ctx.fillStyle = '#a8432f';
  ctx.beginPath();
  ctx.moveTo(-0.055, -0.3); ctx.lineTo(0, -0.38); ctx.lineTo(0.055, -0.3);
  ctx.closePath(); ctx.fill();
  // Kreuz
  ctx.strokeStyle = '#7a5a1e';
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(0, -0.38); ctx.lineTo(0, -0.44);
  ctx.moveTo(-0.02, -0.415); ctx.lineTo(0.02, -0.415);
  ctx.stroke();
  // Tür & Fenster
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(-0.028, 0.04, 0.056, 0.1);
  ctx.fillStyle = '#3f6ea8';
  ctx.fillRect(-0.115, 0.0, 0.04, 0.05);
  ctx.fillRect(0.075, 0.0, 0.04, 0.05);
  ctx.restore();
}

// ----- Wirtshaus -----
function paintInn(ctx, f) {
  const [sx, sy] = f.spot;
  const x = Math.min(0.82, sx + 0.16), y = Math.max(0.2, sy - 0.14);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 0.075, 0.1, 0.028, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0e3c0';
  ctx.fillRect(-0.075, -0.02, 0.15, 0.09);
  ctx.fillStyle = '#c25b2e';
  ctx.beginPath();
  ctx.moveTo(-0.095, -0.02); ctx.lineTo(0, -0.095); ctx.lineTo(0.095, -0.02);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(-0.02, 0.02, 0.04, 0.05);
  // Schild am Pfosten
  ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(0.1, 0.07); ctx.lineTo(0.1, -0.05); ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(0.1, -0.055, 0.026, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ============================================================
// Board-Ansicht mit Kamera
// ============================================================
export class BoardView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, scale: 90 }; // Weltkoordinaten in Kartenfeldern
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
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

  // view: { legal, sel, meepleSpots, floaters, now, lastPlaced, anim }
  render(state, view = {}) {
    const ctx = this.ctx;
    const r = this.canvas.getBoundingClientRect();
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    // Tisch-Hintergrund
    const bg = ctx.createRadialGradient(r.width / 2, r.height * 0.35, 60, r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.9);
    bg.addColorStop(0, '#3d4657');
    bg.addColorStop(1, '#242a36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, r.width, r.height);

    const s = this.cam.scale;
    const now = view.now || 0;

    // Schatten unter Karten
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      ctx.fillRect(sx - s / 2 + s * 0.03, sy - s / 2 + s * 0.05, s, s);
    }
    // Karten
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      let [sx, sy] = this.worldToScreen(p.x, p.y);
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
    // Markierung: zuletzt gelegte Karte
    if (view.lastPlaced != null && state.placed[view.lastPlaced]) {
      const p = state.placed[view.lastPlaced];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - s / 2 + 1, sy - s / 2 + 1, s - 2, s - 2);
    }

    // Legale Felder
    if (view.legal) {
      const pulse = 0.35 + 0.2 * Math.sin(now / 350);
      for (const c of view.legal) {
        const [sx, sy] = this.worldToScreen(c.x, c.y);
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.35})`;
        ctx.strokeStyle = `rgba(255,255,255,${pulse + 0.25})`;
        ctx.lineWidth = 2;
        const m = s * 0.06;
        this.rounded(ctx, sx - s / 2 + m, sy - s / 2 + m, s - 2 * m, s - 2 * m, s * 0.08);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Vorschau der gewählten Platzierung
    if (view.sel) {
      const { x, y, rot, valid } = view.sel;
      const [sx, sy] = this.worldToScreen(x, y);
      ctx.globalAlpha = 0.92;
      const art = tileArt(view.sel.defId, rot);
      ctx.drawImage(art, sx - s / 2, sy - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = valid ? 'rgba(80,220,120,0.95)' : 'rgba(240,80,80,0.95)';
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
        ctx.arc(sx, sy, s * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(40,40,60,0.8)';
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
        ctx.font = `700 ${Math.max(16, s * 0.34)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(20,20,30,0.85)';
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
