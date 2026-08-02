/**
 * Dorf statt Streumuster (Priorität A, §3).
 *
 * Reihenfolge der Entstehung – sie macht den Unterschied:
 *   1. Gassennetz durch die Stadtfläche legen (keine Wege im Spielsinn)
 *   2. Häuser in Reihen an die Gassen setzen, Überlappung erlaubt
 *   3. Restfläche mit Poisson-Abstand auffüllen, Dichte fällt nach außen
 *   4. ein bis zwei Höfe frei lassen und mit Grund füllen
 *
 * Größenhierarchie: genau ein dominantes Gebäude je Kachel, alle übrigen
 * mindestens 25 % kleiner (§3 A2).
 *
 * Alle Koordinaten normiert (0…1), Zufall ausschließlich aus dem
 * übergebenen Strom.
 */
import { PALETTE, shade, withAlpha, jitterColor } from './palette.js';
import { EDGE } from './contract.js';

const ALLEY_WIDTH = EDGE.ALLEY_WIDTH;      // 0.05
const MIN_DIST = 0.06;                     // Poisson-Mindestabstand
const WALL_MARGIN = 0.035;                 // Abstand von Gassen/Häusern zur Mauer

/** Fläche um `e` nach innen schrumpfen. */
function erode(inside, e) {
  return (x, y) => inside(x, y)
    && inside(x - e, y) && inside(x + e, y)
    && inside(x, y - e) && inside(x, y + e);
}

/** Schwerpunkt der Stadtfläche, über ein grobes Raster abgetastet. */
function cityCentre(inside) {
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const x = (i + 0.5) / 16, y = (j + 0.5) / 16;
      if (inside(x, y)) { sx += x; sy += y; n++; }
    }
  }
  return n ? { x: sx / n, y: sy / n, coverage: n / 256 } : null;
}

// ---------------------------------------------------------------- Katalog

/** Gewichtete Auswahl nach §3 A1. */
const CATALOG = [
  { kind: 'gable', weight: 30, w: 0.115, h: 0.095 },
  { kind: 'halfTimber', weight: 18, w: 0.155, h: 0.10 },
  { kind: 'longhouse', weight: 12, w: 0.175, h: 0.088 },
  { kind: 'barn', weight: 10, w: 0.16, h: 0.10 },
  { kind: 'roundTower', weight: 8, w: 0.085, h: 0.13 },
  { kind: 'keep', weight: 8, w: 0.105, h: 0.135, needs: 'fortified' },
  { kind: 'market', weight: 6, w: 0.185, h: 0.115, max: 1, needs: 'largeCity' },
  { kind: 'churchTower', weight: 4, w: 0.085, h: 0.16, max: 1 },
  { kind: 'shed', weight: 4, w: 0.075, h: 0.062, attached: true },
];

function pickKind(rnd, used, opts) {
  const pool = CATALOG.filter((c) => {
    if (c.max && (used[c.kind] || 0) >= c.max) return false;
    if (c.needs === 'fortified' && !opts.fortified) return false;
    if (c.needs === 'largeCity' && !opts.largeCity) return false;
    return true;
  });
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = rnd() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[0] || CATALOG[0];
}

// ---------------------------------------------------------------- Gassen

/** Punkt auf der quadratischen Bézier der Gasse. */
function alleyPoint(al, t) {
  const u = 1 - t;
  return {
    x: u * u * al.a.x + 2 * u * t * al.c.x + t * t * al.b.x,
    y: u * u * al.a.y + 2 * u * t * al.c.y + t * t * al.b.y,
  };
}

/** Tangentenwinkel der Gasse an der Stelle t. */
function alleyAngle(al, t) {
  const p0 = alleyPoint(al, Math.max(0, t - 0.02));
  const p1 = alleyPoint(al, Math.min(1, t + 0.02));
  return Math.atan2(p1.y - p0.y, p1.x - p0.x);
}

/**
 * 1–2 Gassen durch die Stadtfläche. Vom Kern nach außen gelaufen, bis die
 * Fläche endet – dadurch enden sie von selbst an der Stadtmauer.
 */
function makeAlleys(inside, rnd) {
  const alleys = [];
  const want = rnd() < 0.45 ? 2 : 1;
  for (let i = 0; i < want * 3 && alleys.length < want; i++) {
    const ang = rnd() * Math.PI;
    const cx = 0.5 + (rnd() - 0.5) * 0.22;
    const cy = 0.5 + (rnd() - 0.5) * 0.22;
    if (!inside(cx, cy)) continue;
    const walk = (dir) => {
      let last = { x: cx, y: cy };
      for (let t = 0.03; t < 0.8; t += 0.02) {
        const p = { x: cx + Math.cos(ang) * t * dir, y: cy + Math.sin(ang) * t * dir };
        if (!inside(p.x, p.y)) break;
        last = p;
      }
      return last;
    };
    const a = walk(-1), b = walk(1);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.22) continue;
    // leichte Krümmung, sonst wirkt die Gasse wie mit dem Lineal gezogen
    const c = {
      x: (a.x + b.x) / 2 + (rnd() - 0.5) * 0.1,
      y: (a.y + b.y) / 2 + (rnd() - 0.5) * 0.1,
    };
    // Zweite Gasse deutlich anders ausrichten
    if (alleys.length && Math.abs(Math.sin(ang - alleys[0].ang)) < 0.4) continue;
    alleys.push({ a, b, c, ang });
  }
  return alleys;
}

function paintAlleys(ctx, alleys, detail, rnd) {
  for (const al of alleys) {
    ctx.beginPath();
    ctx.moveTo(al.a.x, al.a.y);
    ctx.quadraticCurveTo(al.c.x, al.c.y, al.b.x, al.b.y);
    ctx.lineCap = 'round';
    ctx.lineWidth = ALLEY_WIDTH * 1.25;
    ctx.strokeStyle = withAlpha(PALETTE.pavingDark, 0.5);
    ctx.stroke();
    ctx.lineWidth = ALLEY_WIDTH;
    ctx.strokeStyle = PALETTE.alley;
    ctx.stroke();
    if (detail > 1) {
      // Pflasterfugen quer zur Gasse
      for (let t = 0.05; t < 1; t += 0.045) {
        const p = alleyPoint(al, t);
        const a = alleyAngle(al, t) + Math.PI / 2;
        const half = ALLEY_WIDTH / 2;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(a) * half, p.y - Math.sin(a) * half);
        ctx.lineTo(p.x + Math.cos(a) * half, p.y + Math.sin(a) * half);
        ctx.lineWidth = 0.004;
        ctx.strokeStyle = withAlpha(PALETTE.pavingDark, 0.22 + rnd() * 0.1);
        ctx.stroke();
      }
    }
  }
}

// ------------------------------------------------------------ Platzierung

/** Kandidat vollständig auf der Stadtfläche? Ecken und Mitte werden geprüft. */
function fitsInside(inside, x, y, w, h, ang, margin) {
  if (!inside(x, y)) return false;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const hw = w / 2 + margin, hh = h / 2 + margin;
  for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [0, -hh], [0, hh]]) {
    if (!inside(x + dx * ca - dy * sa, y + dx * sa + dy * ca)) return false;
  }
  return true;
}

/**
 * Häuser setzen.
 * @param inside     (x,y) → liegt der Punkt auf der Stadtfläche?
 * @param edgeInside (x,y) → wie inside, aber Randreihe bis 0.02 erlaubt
 */
function placeHouses(alleys, inside, edgeInside, rnd, opts) {
  const houses = [];
  const used = {};
  const courtyards = opts.courtyards;

  const free = (x, y, r) => {
    for (const c of courtyards) if (Math.hypot(c.x - x, c.y - y) < c.r + r * 0.5) return false;
    for (const h of houses) {
      // Reihenbebauung: bis zu 10 % Überlappung erlaubt (§3 A2)
      const allowed = h.row && r > 0 ? MIN_DIST * 0.9 : MIN_DIST;
      if (Math.hypot(h.x - x, h.y - y) < allowed) return false;
    }
    return true;
  };

  const add = (x, y, ang, row, sizeCap) => {
    const c = pickKind(rnd, used, opts);
    const scale = (0.8 + rnd() * 0.6) * (sizeCap || 1);
    // Firstrichtung 0° oder 90° zur Gassenachse. Gebäude werden als
    // aufrechte Ansicht gezeichnet – die Firstrichtung zeigt sich darin,
    // ob man die Traufseite (breit) oder den Giebel (schmal) sieht, nicht
    // in einer gekippten Fassade. Eine gedrehte Fassade sähe aus, als wäre
    // das Haus umgefallen.
    const alongAlley = rnd() < 0.72;
    const wide = alongAlley ? Math.abs(Math.cos(ang)) > 0.55 : Math.abs(Math.cos(ang)) <= 0.55;
    const w = c.w * scale * (wide ? 1.12 : 0.84);
    const h = c.h * scale * (wide ? 0.96 : 1.12);
    // nur eine leichte Kippung von Hand, ±5°
    const a = (rnd() - 0.5) * 0.17;
    const check = row ? edgeInside : inside;
    if (!fitsInside(check, x, y, w, h, a, 0.004)) return false;
    if (!free(x, y, Math.max(w, h))) return false;
    used[c.kind] = (used[c.kind] || 0) + 1;
    houses.push({
      x, y, w, h, a, row, wide,
      kind: c.kind,
      roof: jitterColor(PALETTE.roofTerracotta[(rnd() * 4) | 0], (rnd() - 0.5) * 12, (rnd() - 0.5) * 0.08),
      area: w * h,
    });
    return true;
  };

  // 1. Reihen entlang der Gassen
  for (const al of alleys) {
    for (let t = 0.08; t <= 0.94; t += 0.085 + rnd() * 0.05) {
      const p = alleyPoint(al, t);
      const ang = alleyAngle(al, t);
      const n = { x: Math.cos(ang + Math.PI / 2), y: Math.sin(ang + Math.PI / 2) };
      for (const side of [1, -1]) {
        if (rnd() < 0.18) continue;                     // Lücken lassen
        const off = ALLEY_WIDTH / 2 + 0.055 + rnd() * 0.02;
        add(p.x + n.x * off * side, p.y + n.y * off * side, ang, true);
      }
    }
  }

  // 2. Restfläche auffüllen, Dichte fällt vom Stadtkern nach außen
  const centre = opts.centre || { x: 0.5, y: 0.5 };
  for (let i = 0; i < 120 && houses.length < opts.maxHouses; i++) {
    const x = 0.04 + rnd() * 0.92;
    const y = 0.04 + rnd() * 0.92;
    const d = Math.hypot(x - centre.x, y - centre.y);
    if (rnd() > 1.05 - d * 1.0) continue;               // Dichtegradient
    const near = alleys.length ? alleyAngle(alleys[0], 0.5) : 0;
    add(x, y, near, false);
  }

  // 3. Schuppen an ein vorhandenes Haus anlehnen
  if (houses.length && rnd() < 0.6) {
    const host = houses[(rnd() * houses.length) | 0];
    const a = host.a + (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const off = host.h / 2 + 0.028;
    const sx = host.x + Math.cos(a) * off;
    const sy = host.y + Math.sin(a) * off;
    if (fitsInside(inside, sx, sy, 0.075, 0.062, host.a, 0.002)) {
      houses.push({
        x: sx, y: sy, w: 0.075, h: 0.062, a: host.a, kind: 'shed', row: false, wide: true,
        roof: shade(host.roof, -0.12), area: 0.075 * 0.062,
      });
    }
  }

  // 4. Größenhierarchie: ein dominantes Gebäude, der Rest mindestens 25 % kleiner
  if (houses.length > 1) {
    houses.sort((a, b) => b.area - a.area);
    const lead = houses[0];
    for (let i = 1; i < houses.length; i++) {
      const h = houses[i];
      const ratio = h.area / lead.area;
      if (ratio > 0.75) {
        const f = Math.sqrt(0.72 / ratio);
        h.w *= f; h.h *= f; h.area *= f * f;
      }
    }
  }
  return houses;
}

/** Ein bis zwei freie Flecken – Leere mit Grund (§3 A2). */
function makeCourtyards(inside, rnd) {
  const out = [];
  const want = rnd() < 0.5 ? 2 : 1;
  for (let i = 0; i < want * 6 && out.length < want; i++) {
    const x = 0.1 + rnd() * 0.8;
    const y = 0.1 + rnd() * 0.8;
    const r = 0.05 + rnd() * 0.028;
    if (!inside(x, y) || !inside(x - r, y) || !inside(x + r, y) || !inside(x, y - r) || !inside(x, y + r)) continue;
    if (out.some((c) => Math.hypot(c.x - x, c.y - y) < (c.r + r) * 1.6)) continue;
    out.push({ x, y, r, kind: (rnd() * 4) | 0 });
  }
  return out;
}

// ------------------------------------------------------------- Zeichnen

export function drawTown(ctx, { inside, edgeInside, rnd, detail = 2, opts = {} }) {
  const settings = {
    fortified: !!opts.fortified,
    largeCity: !!opts.largeCity,
    maxHouses: opts.maxHouses || 14,
  };
  // Abstand zur Stadtmauer: sonst lugen Gassen und Häuser durch die
  // Zinnenlücken und die Mauer verliert ihre Silhouette.
  const core = erode(inside, WALL_MARGIN);
  const alleys = makeAlleys(core, rnd);
  const courtyards = makeCourtyards(core, rnd);
  paintAlleys(ctx, alleys, detail, rnd);

  // Der Stadtkern ist die Mitte der Stadtfläche, nicht die Kachelmitte –
  // bei einer Stadtkappe am Rand liegen die beiden weit auseinander.
  const centre = cityCentre(core) || { x: 0.5, y: 0.5 };
  const houses = placeHouses(alleys, core, edgeInside || inside, rnd,
    { ...settings, courtyards, centre });

  // Höfe füllen, bevor die Häuser darüber kommen
  for (const c of courtyards) paintCourtyard(ctx, c, rnd, detail);

  // von hinten nach vorn, damit Schatten und Dächer sich richtig überlagern
  houses.sort((a, b) => a.y - b.y);
  for (const h of houses) paintGroundShadow(ctx, h);
  for (const h of houses) paintBuilding(ctx, h, rnd, detail);
  return houses.length;
}

/** Bodenschatten nach unten-rechts, weich, nie schwarz (§2). */
function paintGroundShadow(ctx, h) {
  ctx.save();
  ctx.translate(h.x + h.w * 0.10, h.y + h.h * 0.40);
  ctx.rotate(h.a);
  ctx.beginPath();
  ctx.ellipse(0, 0, h.w * 0.62, h.h * 0.30, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.25);
  ctx.fill();
  ctx.restore();
}

function paintBuilding(ctx, h, rnd, detail) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.a);
  const w = h.w, d = h.h;
  switch (h.kind) {
    case 'halfTimber': paintHalfTimber(ctx, w, d, h.roof, detail); break;
    case 'longhouse': paintGable(ctx, w, d, h.roof, detail, { long: true }); break;
    case 'barn': paintBarn(ctx, w, d, h.roof, detail); break;
    case 'roundTower': paintRoundTower(ctx, w, d, h.roof, detail); break;
    case 'keep': paintKeep(ctx, w, d, detail); break;
    case 'market': paintMarket(ctx, w, d, h.roof, detail); break;
    case 'churchTower': paintChurchTower(ctx, w, d, detail); break;
    case 'shed': paintShed(ctx, w, d, h.roof); break;
    default: paintGable(ctx, w, d, h.roof, detail, { long: h.wide });
  }
  ctx.restore();
}

/** Wand mit Licht- und Schattenseite – eine Lichtquelle für alles (§2). */
function wallFill(ctx, w, d, base = PALETTE.wall) {
  const g = ctx.createLinearGradient(-w / 2, -d / 2, w / 2, d / 2);
  g.addColorStop(0, shade(base, 0.12));
  g.addColorStop(1, shade(base, -0.18));
  ctx.fillStyle = g;
}

function roofFill(ctx, w, roof) {
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(roof, 0.12));
  g.addColorStop(1, shade(roof, -0.18));
  ctx.fillStyle = g;
}

function paintGable(ctx, w, d, roof, detail, { long }) {
  const wallTop = -d * 0.08;
  wallFill(ctx, w, d);
  ctx.fillRect(-w / 2, wallTop, w, d * 0.52);
  // Dach: First längs
  const apex = -d * 0.56;
  roofFill(ctx, w, roof);
  ctx.beginPath();
  ctx.moveTo(-w * 0.58, wallTop);
  ctx.lineTo(0, apex);
  ctx.lineTo(w * 0.58, wallTop);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 0.004;
  ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.5);
  ctx.stroke();
  if (detail > 1) {
    // Dachziegelreihen
    for (let t = 0.2; t < 1; t += 0.22) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.58 * (1 - t) - 0.001, wallTop + (apex - wallTop) * t);
      ctx.lineTo(w * 0.58 * (1 - t) + 0.001, wallTop + (apex - wallTop) * t);
      ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.18);
      ctx.lineWidth = 0.003;
      ctx.stroke();
    }
    paintWindows(ctx, w, d, wallTop, long ? 3 : 2);
  }
  paintDoor(ctx, w, d, wallTop);
}

function paintHalfTimber(ctx, w, d, roof, detail) {
  const wallTop = -d * 0.06;
  // Obergeschoss kragt vor
  wallFill(ctx, w, d);
  ctx.fillRect(-w / 2, wallTop + d * 0.2, w * 0.94, d * 0.34);
  ctx.fillRect(-w * 0.54, wallTop, w * 1.08, d * 0.24);
  const apex = -d * 0.52;
  roofFill(ctx, w, roof);
  ctx.beginPath();
  ctx.moveTo(-w * 0.6, wallTop);
  ctx.lineTo(0, apex);
  ctx.lineTo(w * 0.6, wallTop);
  ctx.closePath();
  ctx.fill();
  if (detail > 0) {
    ctx.strokeStyle = withAlpha(PALETTE.timber, 0.85);
    ctx.lineWidth = 0.006;
    // X- und K-Muster im Obergeschoss
    const y0 = wallTop + 0.002, y1 = wallTop + d * 0.22;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(k * w * 0.42, y0); ctx.lineTo(0, y1);
      ctx.moveTo(0, y0); ctx.lineTo(k * w * 0.42, y1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, y1); ctx.lineTo(w * 0.5, y1);
    ctx.stroke();
  }
  paintDoor(ctx, w, d, wallTop + d * 0.2);
}

function paintBarn(ctx, w, d, roof, detail) {
  const wallTop = -d * 0.02;
  // Holzwand statt Putz
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(PALETTE.timber, 0.35));
  g.addColorStop(1, shade(PALETTE.timber, 0.05));
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, wallTop, w, d * 0.5);
  // flacheres, breites Dach
  const apex = -d * 0.36;
  roofFill(ctx, w, roof);
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, wallTop);
  ctx.lineTo(0, apex);
  ctx.lineTo(w * 0.62, wallTop);
  ctx.closePath();
  ctx.fill();
  // großes dunkles Tor
  ctx.fillStyle = shade(PALETTE.timber, -0.45);
  ctx.fillRect(-w * 0.2, wallTop + d * 0.12, w * 0.4, d * 0.38);
  if (detail > 0) {
    // Heuluke im Giebel
    ctx.fillStyle = shade(PALETTE.timber, -0.35);
    ctx.fillRect(-w * 0.06, apex + d * 0.08, w * 0.12, d * 0.1);
    ctx.strokeStyle = withAlpha(PALETTE.timber, 0.6);
    ctx.lineWidth = 0.004;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w * 0.16, wallTop);
      ctx.lineTo(i * w * 0.16, wallTop + d * 0.5);
      ctx.stroke();
    }
  }
}

function paintRoundTower(ctx, w, d, roof, detail) {
  const r = w / 2;
  const baseY = d * 0.22;
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, shade(PALETTE.wallStone, 0.14));
  g.addColorStop(1, shade(PALETTE.wallStone, -0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-r, baseY);
  ctx.lineTo(-r, -d * 0.16);
  ctx.lineTo(r, -d * 0.16);
  ctx.lineTo(r, baseY);
  ctx.ellipse(0, baseY, r, r * 0.32, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  // Kegeldach
  roofFill(ctx, w, roof);
  ctx.beginPath();
  ctx.moveTo(-r * 1.2, -d * 0.16);
  ctx.lineTo(0, -d * 0.58);
  ctx.lineTo(r * 1.2, -d * 0.16);
  ctx.closePath();
  ctx.fill();
  if (detail > 0) {
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.65);
    ctx.fillRect(-0.006, -d * 0.06, 0.012, d * 0.12);
  }
}

function paintKeep(ctx, w, d, detail) {
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(PALETTE.wallStone, 0.14));
  g.addColorStop(1, shade(PALETTE.wallStone, -0.22));
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -d * 0.34, w, d * 0.72);
  // Zinnen
  const n = 4, bw = w / (n * 2 - 1);
  ctx.fillStyle = shade(PALETTE.wallStone, 0.06);
  for (let i = 0; i < n; i++) {
    ctx.fillRect(-w / 2 + i * bw * 2, -d * 0.46, bw, d * 0.13);
  }
  if (detail > 0) {
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.7);
    for (const sx of [-w * 0.22, w * 0.22]) ctx.fillRect(sx - 0.005, -d * 0.2, 0.01, d * 0.16);
  }
}

function paintMarket(ctx, w, d, roof, detail) {
  const wallTop = -d * 0.04;
  wallFill(ctx, w, d);
  ctx.fillRect(-w / 2, wallTop, w, d * 0.5);
  // Walmdach
  roofFill(ctx, w, roof);
  ctx.beginPath();
  ctx.moveTo(-w * 0.6, wallTop);
  ctx.lineTo(-w * 0.22, -d * 0.46);
  ctx.lineTo(w * 0.22, -d * 0.46);
  ctx.lineTo(w * 0.6, wallTop);
  ctx.closePath();
  ctx.fill();
  // Arkadenbögen im Erdgeschoss
  const arcs = 4, aw = w * 0.86 / arcs;
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.55);
  for (let i = 0; i < arcs; i++) {
    const cx = -w * 0.43 + aw * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - aw * 0.32, wallTop + d * 0.5);
    ctx.lineTo(cx - aw * 0.32, wallTop + d * 0.26);
    ctx.arc(cx, wallTop + d * 0.26, aw * 0.32, Math.PI, 0);
    ctx.lineTo(cx + aw * 0.32, wallTop + d * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  if (detail > 1) {
    ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.3);
    ctx.lineWidth = 0.003;
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -d * 0.46); ctx.lineTo(w * 0.22, -d * 0.46);
    ctx.stroke();
  }
}

function paintChurchTower(ctx, w, d, detail) {
  wallFill(ctx, w, d);
  ctx.fillRect(-w / 2, -d * 0.3, w, d * 0.68);
  // Spitzhelm
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(PALETTE.roofSlate, 0.16));
  g.addColorStop(1, shade(PALETTE.roofSlate, -0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, -d * 0.3);
  ctx.lineTo(0, -d * 0.82);
  ctx.lineTo(w * 0.62, -d * 0.3);
  ctx.closePath();
  ctx.fill();
  // Kreuz
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0, -d * 0.82); ctx.lineTo(0, -d * 0.95);
  ctx.moveTo(-0.012, -d * 0.9); ctx.lineTo(0.012, -d * 0.9);
  ctx.stroke();
  // Schallluke, Zifferblatt erst bei large
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.65);
  ctx.fillRect(-w * 0.13, -d * 0.2, w * 0.26, d * 0.2);
  if (detail > 1) {
    ctx.beginPath();
    ctx.arc(0, d * 0.08, w * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.wall;
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 0.004;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, d * 0.08); ctx.lineTo(0, d * 0.02);
    ctx.moveTo(0, d * 0.08); ctx.lineTo(w * 0.1, d * 0.08);
    ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.8);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
}

function paintShed(ctx, w, d, roof) {
  wallFill(ctx, w, d, shade(PALETTE.timber, 0.4));
  ctx.fillRect(-w / 2, -d * 0.1, w, d * 0.5);
  // Pultdach
  ctx.fillStyle = shade(roof, -0.1);
  ctx.beginPath();
  ctx.moveTo(-w * 0.58, -d * 0.1);
  ctx.lineTo(w * 0.58, -d * 0.34);
  ctx.lineTo(w * 0.58, -d * 0.16);
  ctx.lineTo(-w * 0.58, d * 0.04);
  ctx.closePath();
  ctx.fill();
}

function paintWindows(ctx, w, d, wallTop, n) {
  const y = wallTop + d * 0.2;
  for (let i = 0; i < n; i++) {
    const x = -w * 0.32 + (w * 0.64 * i) / Math.max(1, n - 1);
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.6);
    ctx.fillRect(x - w * 0.055, y, w * 0.11, d * 0.14);
    ctx.fillStyle = withAlpha('#F4C95C', 0.75);
    ctx.fillRect(x - w * 0.04, y + d * 0.015, w * 0.08, d * 0.11);
  }
}

function paintDoor(ctx, w, d, wallTop) {
  ctx.fillStyle = shade(PALETTE.timber, -0.1);
  ctx.fillRect(-w * 0.07, wallTop + d * 0.28, w * 0.14, d * 0.24);
}

/** Leere mit Grund: Brunnen, Marktstand, Karren, Fässer oder Baum. */
function paintCourtyard(ctx, c, rnd, detail) {
  ctx.save();
  ctx.translate(c.x, c.y);
  // gepflasterter Hof, feiner als die Gasse
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.pavingLight, 0.55);
  ctx.fill();
  if (detail === 0) { ctx.restore(); return; }

  const shadow = (rx, ry) => {
    ctx.beginPath();
    ctx.ellipse(0.006, ry, rx, rx * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.25);
    ctx.fill();
  };

  if (c.kind === 0) {                       // Brunnen
    shadow(0.026, 0.016);
    ctx.beginPath(); ctx.arc(0, 0, 0.024, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.wallStone; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 0.014, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.waterDeep; ctx.fill();
    ctx.strokeStyle = PALETTE.timber; ctx.lineWidth = 0.005;
    ctx.beginPath(); ctx.moveTo(-0.022, -0.006); ctx.lineTo(0, -0.036); ctx.lineTo(0.022, -0.006);
    ctx.stroke();
  } else if (c.kind === 1) {                // Marktstand
    shadow(0.03, 0.02);
    ctx.fillStyle = shade(PALETTE.timber, 0.2);
    ctx.fillRect(-0.03, -0.004, 0.06, 0.022);
    ctx.fillStyle = '#B4452F';
    ctx.beginPath();
    ctx.moveTo(-0.036, -0.006); ctx.lineTo(0, -0.03); ctx.lineTo(0.036, -0.006);
    ctx.closePath(); ctx.fill();
  } else if (c.kind === 2) {                // Karren
    shadow(0.026, 0.018);
    ctx.fillStyle = shade(PALETTE.timber, 0.25);
    ctx.fillRect(-0.028, -0.012, 0.056, 0.018);
    ctx.fillStyle = shade(PALETTE.timber, -0.3);
    for (const wx of [-0.016, 0.016]) {
      ctx.beginPath(); ctx.arc(wx, 0.008, 0.009, 0, Math.PI * 2); ctx.fill();
    }
  } else {                                  // Baum
    shadow(0.028, 0.022);
    ctx.fillStyle = shade(PALETTE.timber, -0.15);
    ctx.fillRect(-0.005, -0.005, 0.01, 0.026);
    for (const [dx, dy, r] of [[-0.014, -0.012, 0.021], [0.013, -0.01, 0.019], [0, -0.026, 0.022]]) {
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fillStyle = dy < -0.02 ? shade(PALETTE.meadow, 0.1) : PALETTE.meadowDark;
      ctx.fill();
    }
  }
  ctx.restore();
}
