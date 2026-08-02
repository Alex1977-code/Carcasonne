/**
 * Wahrzeichen: Kloster und Kathedrale (Priorität C, §5).
 *
 * Beide waren vorher zu klein, um als Wahrzeichen zu lesen. Vorgabe:
 * Kloster 45–55 % der Kachelfläche, Kathedrale 60–65 % und unbestritten
 * das größte Objekt der Kachel.
 *
 * Der Kantenvertrag gilt weiter: an Straßen-, Fluss- und Stadtkanten
 * bleibt die Sperrzone frei, deshalb richtet sich die Ausdehnung nach den
 * offenen Seiten. Alle Koordinaten normiert, Zufall nur aus dem Strom.
 */
import { PALETTE, shade, withAlpha } from './palette.js';
import { EDGE } from './contract.js';

// ---------------------------------------------------------------- Kloster

/**
 * Wie weit darf die Anlage reichen, ohne in eine Sperrzone zu geraten?
 * Rückgabe: { x, y, w, h } in normierten Koordinaten.
 */
export function landmarkBounds(sides, target) {
  let x0 = 0.04, y0 = 0.04, x1 = 0.96, y1 = 0.96;
  const blocked = (s) => s === 'road' || s === 'river' || s === 'city';
  if (blocked(sides[0])) y0 = Math.max(y0, EDGE.KEEPOUT * 0.82);
  if (blocked(sides[1])) x1 = Math.min(x1, 1 - EDGE.KEEPOUT * 0.82);
  if (blocked(sides[2])) y1 = Math.min(y1, 1 - EDGE.KEEPOUT * 0.82);
  if (blocked(sides[3])) x0 = Math.max(x0, EDGE.KEEPOUT * 0.82);
  const w = Math.min(x1 - x0, target);
  const h = Math.min(y1 - y0, target);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, h };
}

/**
 * Klosteranlage: Kirche mit Apsis und Glockenturm, Kreuzgang mit
 * Arkaden, Klostergarten, umlaufende Mauer mit Torbogen.
 * @param roadSide  Seite, an der ein Weg mündet (oder null)
 */
export function drawMonastery(ctx, { sides, rnd, detail = 2, roadSide = null }) {
  const b = landmarkBounds(sides, 0.7);
  ctx.save();
  ctx.translate(b.x, b.y);
  const W = b.w, H = b.h;

  // --- Kiesweg vom Portal zum Kachelrand (vor der Mauer, liegt darunter)
  if (roadSide !== null) paintGravelPath(ctx, roadSide, b, detail);

  // --- Klostermauer, niedrig, mit Torbogen zur Wegseite
  paintPrecinctWall(ctx, W, H, roadSide, detail);

  // Aufteilung der Anlage: Kirche oben, Kreuzgang rechts darunter,
  // Garten unten links. Die Höhe der Kirche ist so gewählt, dass der
  // Glockenturm samt Kreuz innerhalb der Anlage bleibt – er ragte vorher
  // oben aus der Kachel heraus.
  const churchH = H * 0.24;
  const churchY = -H * 0.16;

  // --- Klostergarten: Beete im Raster, Obstbäume in Reihe
  paintGarden(ctx, W, H, rnd, detail);

  // --- Kreuzgang: quadratischer Hof mit Arkaden an drei Seiten
  paintCloister(ctx, W * 0.17, H * 0.12, W * 0.31, rnd, detail);

  // --- Kirche: Langhaus mit Satteldach, Apsis, Glockenturm
  paintChurch(ctx, -W * 0.08, churchY, W * 0.56, churchH, rnd, detail);

  ctx.restore();
}

function paintGravelPath(ctx, side, b, detail) {
  // vom Portal (Südseite der Anlage) zum Kachelrand
  const to = [[0, -0.55], [0.55, 0], [0, 0.55], [-0.55, 0]][side];
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = 0.055;
  ctx.strokeStyle = withAlpha(PALETTE.roadEdge, 0.55);
  ctx.beginPath();
  ctx.moveTo(0, b.h * 0.2);
  ctx.quadraticCurveTo(to[0] * 0.5, to[1] * 0.5 + b.h * 0.1, to[0], to[1]);
  ctx.stroke();
  ctx.lineWidth = 0.038;
  ctx.strokeStyle = withAlpha(PALETTE.alley, 0.9);
  ctx.stroke();
  ctx.restore();
}

function paintPrecinctWall(ctx, W, H, roadSide, detail) {
  const hw = W / 2, hh = H / 2;
  ctx.save();
  // Bodenschatten der Anlage
  ctx.beginPath();
  ctx.ellipse(0.01, hh * 0.9, hw * 0.9, hh * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.10);
  ctx.fill();

  // Hoffläche innerhalb der Mauer
  roundRect(ctx, -hw, -hh, W, H, 0.03);
  ctx.fillStyle = withAlpha(PALETTE.meadowLight, 0.35);
  ctx.fill();

  // Mauer als Rahmen, unten eine Lücke für den Torbogen
  ctx.lineWidth = 0.022;
  ctx.strokeStyle = shade(PALETTE.wallStone, -0.12);
  const gate = 0.09;
  ctx.beginPath();
  ctx.moveTo(-gate, hh);
  ctx.lineTo(-hw + 0.03, hh);
  ctx.quadraticCurveTo(-hw, hh, -hw, hh - 0.03);
  ctx.lineTo(-hw, -hh + 0.03);
  ctx.quadraticCurveTo(-hw, -hh, -hw + 0.03, -hh);
  ctx.lineTo(hw - 0.03, -hh);
  ctx.quadraticCurveTo(hw, -hh, hw, -hh + 0.03);
  ctx.lineTo(hw, hh - 0.03);
  ctx.quadraticCurveTo(hw, hh, hw - 0.03, hh);
  ctx.lineTo(gate, hh);
  ctx.stroke();
  ctx.lineWidth = 0.008;
  ctx.strokeStyle = withAlpha(PALETTE.wall, 0.5);
  ctx.stroke();

  // Torbogen an der Wegseite
  ctx.beginPath();
  ctx.moveTo(-gate, hh + 0.012);
  ctx.lineTo(-gate, hh - 0.022);
  ctx.arc(0, hh - 0.022, gate, Math.PI, 0);
  ctx.lineTo(gate, hh + 0.012);
  ctx.lineWidth = 0.018;
  ctx.strokeStyle = shade(PALETTE.wallStone, -0.2);
  ctx.stroke();
  // Durchgang nur dann als dunkle Öffnung, wenn dort ein Weg mündet –
  // sonst wirkt der Bogen wie ein Loch in der Wiese.
  ctx.fillStyle = withAlpha(PALETTE.shadow, roadSide === null ? 0.12 : 0.32);
  ctx.fill();
  ctx.restore();
}

function paintGarden(ctx, W, H, rnd, detail) {
  const gy = H * 0.06;
  const bedW = W * 0.115, bedH = H * 0.07;
  ctx.save();
  // Kräuterbeete im Raster
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const x = -W * 0.44 + c * (bedW + 0.014);
      const y = gy + r * (bedH + 0.014);
      ctx.fillStyle = withAlpha(PALETTE.fieldPlowed, 0.75);
      ctx.fillRect(x, y, bedW, bedH);
      ctx.strokeStyle = withAlpha(shade(PALETTE.fieldPlowed, -0.35), 0.5);
      ctx.lineWidth = 0.004;
      ctx.strokeRect(x, y, bedW, bedH);
      if (detail > 1) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x + bedW * (0.2 + 0.2 * i), y + bedH * 0.5, 0.007, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(PALETTE.meadowDark, 0.75);
          ctx.fill();
        }
      }
    }
  }
  // Obstbäume in einer Reihe
  const n = 2 + ((rnd() * 2) | 0);
  for (let i = 0; i < n; i++) {
    paintFruitTree(ctx, -W * 0.40 + i * W * 0.16, gy + H * 0.30, detail);
  }
  ctx.restore();
}

function paintFruitTree(ctx, x, y, detail) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0.006, 0.026, 0.028, 0.010, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.22);
  ctx.fill();
  ctx.fillStyle = shade(PALETTE.timber, -0.1);
  ctx.fillRect(-0.005, 0.004, 0.01, 0.024);
  for (const [dx, dy, r, lit] of [[-0.017, 0, 0.021, false], [0.016, 0.002, 0.019, false], [0, -0.016, 0.023, true]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fillStyle = lit ? shade(PALETTE.meadow, 0.12) : PALETTE.meadowDark;
    ctx.fill();
  }
  if (detail > 1) {
    for (const [dx, dy] of [[-0.012, -0.006], [0.01, -0.014], [0.004, 0.004]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 0.005, 0, Math.PI * 2);
      ctx.fillStyle = '#C0452F';
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintCloister(ctx, cx, cy, size, rnd, detail) {
  const h = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  // Innenhof
  ctx.fillStyle = withAlpha(PALETTE.alley, 0.85);
  roundRect(ctx, -h, -h, size, size, 0.012);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.pavingDark, 0.5);
  ctx.lineWidth = 0.006;
  ctx.stroke();

  // Arkadenreihe an drei Seiten: Halbkreise mit Schattenlaibung
  if (detail > 0) {
    const arcs = 4;
    const step = size / arcs;
    const drawRow = (from, dir) => {
      for (let i = 0; i < arcs; i++) {
        const t = -h + step * (i + 0.5);
        const px = dir === 'h' ? t : from;
        const py = dir === 'h' ? from : t;
        ctx.beginPath();
        ctx.arc(px, py, step * 0.32, Math.PI, 0);
        ctx.fillStyle = withAlpha(PALETTE.shadow, 0.4);
        ctx.fill();
        ctx.strokeStyle = withAlpha(PALETTE.wall, 0.8);
        ctx.lineWidth = 0.005;
        ctx.stroke();
      }
    };
    drawRow(-h + step * 0.28, 'h');    // Nordflügel
    drawRow(h - step * 0.28, 'h');     // Südflügel
    drawRow(-h + step * 0.28, 'v');    // Westflügel
  }

  // Brunnen oder großer Baum im Hof
  if (rnd() < 0.55) {
    ctx.beginPath(); ctx.arc(0, 0, size * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.wallStone; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, size * 0.065, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.waterDeep; ctx.fill();
    ctx.beginPath(); ctx.arc(-size * 0.02, -size * 0.02, size * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha('#FFFFFF', 0.5); ctx.fill();
  } else {
    paintFruitTree(ctx, 0, -0.004, detail);
  }
  ctx.restore();
}

function paintChurch(ctx, cx, cy, w, h, rnd, detail) {
  ctx.save();
  ctx.translate(cx, cy);
  const hw = w / 2;

  // Bodenschatten
  ctx.beginPath();
  ctx.ellipse(0.014, h * 0.52, hw * 1.02, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.25);
  ctx.fill();

  // Apsis (halbrund) an der Ostseite
  ctx.beginPath();
  ctx.arc(hw, h * 0.08, h * 0.28, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = shade(PALETTE.wall, -0.08);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.35);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Langhaus
  const wallTop = -h * 0.1;
  const g = ctx.createLinearGradient(-hw, 0, hw, 0);
  g.addColorStop(0, shade(PALETTE.wall, 0.1));
  g.addColorStop(1, shade(PALETTE.wall, -0.16));
  ctx.fillStyle = g;
  ctx.fillRect(-hw, wallTop, w, h * 0.46);

  // Satteldach aus Schiefer
  const rg = ctx.createLinearGradient(-hw, 0, hw, 0);
  rg.addColorStop(0, shade(PALETTE.roofSlate, 0.16));
  rg.addColorStop(1, shade(PALETTE.roofSlate, -0.2));
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-hw - 0.012, wallTop);
  ctx.lineTo(0, -h * 0.52);
  ctx.lineTo(hw + 0.012, wallTop);
  ctx.closePath();
  ctx.fill();
  if (detail > 1) {
    ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.2);
    ctx.lineWidth = 0.003;
    for (let t = 0.25; t < 1; t += 0.25) {
      ctx.beginPath();
      ctx.moveTo(-(hw + 0.012) * (1 - t), wallTop + (-h * 0.52 - wallTop) * t);
      ctx.lineTo((hw + 0.012) * (1 - t), wallTop + (-h * 0.52 - wallTop) * t);
      ctx.stroke();
    }
  }

  // Rosette über dem Portal
  ctx.beginPath();
  ctx.arc(-hw * 0.42, wallTop + h * 0.12, h * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.heraldicBlue;
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Portal
  ctx.beginPath();
  ctx.moveTo(-hw * 0.42 - h * 0.06, wallTop + h * 0.46);
  ctx.lineTo(-hw * 0.42 - h * 0.06, wallTop + h * 0.34);
  ctx.arc(-hw * 0.42, wallTop + h * 0.34, h * 0.06, Math.PI, 0);
  ctx.lineTo(-hw * 0.42 + h * 0.06, wallTop + h * 0.46);
  ctx.closePath();
  ctx.fillStyle = shade(PALETTE.timber, -0.2);
  ctx.fill();

  // Glockenturm an der Fassade
  const tw = w * 0.2, tx = -hw + tw * 0.1;
  ctx.fillStyle = shade(PALETTE.wall, 0.04);
  ctx.fillRect(tx, -h * 0.72, tw, h * 1.18);
  ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.3);
  ctx.lineWidth = 0.004;
  ctx.strokeRect(tx, -h * 0.72, tw, h * 1.18);
  // Schallluken
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.6);
  for (const oy of [-0.56, -0.38]) {
    ctx.beginPath();
    ctx.moveTo(tx + tw * 0.24, h * oy + h * 0.12);
    ctx.lineTo(tx + tw * 0.24, h * oy + h * 0.03);
    ctx.arc(tx + tw * 0.5, h * oy + h * 0.03, tw * 0.26, Math.PI, 0);
    ctx.lineTo(tx + tw * 0.76, h * oy + h * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  // Zeltdach
  ctx.fillStyle = shade(PALETTE.roofSlate, -0.05);
  ctx.beginPath();
  ctx.moveTo(tx - tw * 0.22, -h * 0.72);
  ctx.lineTo(tx + tw * 0.5, -h * 1.04);
  ctx.lineTo(tx + tw * 1.22, -h * 0.72);
  ctx.closePath();
  ctx.fill();
  // goldenes Kreuz
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(tx + tw * 0.5, -h * 1.04);
  ctx.lineTo(tx + tw * 0.5, -h * 1.2);
  ctx.moveTo(tx + tw * 0.5 - 0.014, -h * 1.13);
  ctx.lineTo(tx + tw * 0.5 + 0.014, -h * 1.13);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------- Kathedrale

/**
 * Kathedrale: Doppeltürme, Rosette mit Maßwerk, gestuftes Portal mit
 * Treppe, Strebebögen, Dachreiter, Vorplatz mit Radialpflaster.
 */
export function drawCathedral(ctx, { rnd, detail = 2, centre = [0.5, 0.5] }) {
  const S = 0.8;                       // Ausdehnung der Anlage
  ctx.save();
  ctx.translate(centre[0], centre[1]);

  // --- Vorplatz, heller als das Stadtpflaster, Radialmuster zum Portal
  const plazaR = S * 0.46;
  ctx.beginPath();
  ctx.arc(0, S * 0.30, plazaR, 0, Math.PI * 2);
  ctx.fillStyle = shade(PALETTE.pavingLight, 0.2);
  ctx.fill();
  if (detail > 0) {
    ctx.strokeStyle = withAlpha(PALETTE.pavingDark, 0.35);
    ctx.lineWidth = 0.004;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * plazaR * 0.35, S * 0.30 + Math.sin(a) * plazaR * 0.35);
      ctx.lineTo(Math.cos(a) * plazaR, S * 0.30 + Math.sin(a) * plazaR);
      ctx.stroke();
    }
    for (const rr of [0.55, 0.8]) {
      ctx.beginPath();
      ctx.arc(0, S * 0.30, plazaR * rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const w = S * 0.52, h = S * 0.5;
  const hw = w / 2;

  // --- Bodenschatten
  ctx.beginPath();
  ctx.ellipse(0.02, h * 0.56, hw * 1.25, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.28);
  ctx.fill();

  // --- Seitenschiffe mit Strebebögen
  if (detail > 0) {
    ctx.strokeStyle = shade(PALETTE.wall, -0.22);
    ctx.lineWidth = 0.012;
    for (const side of [-1, 1]) {
      for (const oy of [-0.05, 0.12]) {
        ctx.beginPath();
        ctx.moveTo(side * hw, h * oy);
        ctx.quadraticCurveTo(side * (hw + 0.05), h * (oy - 0.12), side * (hw + 0.085), h * (oy + 0.06));
        ctx.stroke();
      }
    }
  }

  // --- Schiff
  const g = ctx.createLinearGradient(-hw, 0, hw, 0);
  g.addColorStop(0, shade(PALETTE.wall, 0.12));
  g.addColorStop(1, shade(PALETTE.wall, -0.18));
  ctx.fillStyle = g;
  ctx.fillRect(-hw, -h * 0.18, w, h * 0.68);

  // Dach des Schiffs
  ctx.fillStyle = shade(PALETTE.roofSlate, -0.05);
  ctx.beginPath();
  ctx.moveTo(-hw - 0.01, -h * 0.18);
  ctx.lineTo(0, -h * 0.52);
  ctx.lineTo(hw + 0.01, -h * 0.18);
  ctx.closePath();
  ctx.fill();

  // Dachreiter über der Vierung
  ctx.fillStyle = shade(PALETTE.roofSlate, 0.1);
  ctx.beginPath();
  ctx.moveTo(-0.022, -h * 0.5);
  ctx.lineTo(0, -h * 0.72);
  ctx.lineTo(0.022, -h * 0.5);
  ctx.closePath();
  ctx.fill();

  // --- Rosette mit radialem Maßwerk
  const rr = h * 0.17;
  ctx.beginPath();
  ctx.arc(0, -h * 0.02, rr, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.shadow, 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -h * 0.02, rr * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.heraldicBlue;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -h * 0.02, rr * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = shade(PALETTE.gold, 0.25);   // warmer Glaskern
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 0.004;
  const spokes = detail > 1 ? 12 : 8;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rr * 0.34, -h * 0.02 + Math.sin(a) * rr * 0.34);
    ctx.lineTo(Math.cos(a) * rr * 0.82, -h * 0.02 + Math.sin(a) * rr * 0.82);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -h * 0.02, rr * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  // --- Portal mit drei gestuften Archivolten und Treppe
  const py = h * 0.5;
  for (let i = 2; i >= 0; i--) {
    const pw = h * (0.1 + i * 0.028);
    ctx.beginPath();
    ctx.moveTo(-pw, py);
    ctx.lineTo(-pw, py - h * 0.16);
    ctx.arc(0, py - h * 0.16, pw, Math.PI, 0);
    ctx.lineTo(pw, py);
    ctx.closePath();
    ctx.fillStyle = i === 0
      ? shade(PALETTE.timber, -0.25)
      : withAlpha(shade(PALETTE.wall, -0.1 - i * 0.08), 1);
    ctx.fill();
  }
  // Treppe, drei Stufen
  for (let i = 0; i < 3; i++) {
    const sw = h * 0.2 + i * h * 0.055;
    ctx.fillStyle = shade(PALETTE.pavingLight, 0.1 - i * 0.06);
    ctx.fillRect(-sw, py + i * h * 0.038, sw * 2, h * 0.038);
  }

  // --- Doppeltürme, höher als das Schiff
  for (const side of [-1, 1]) {
    const tx = side * (hw - h * 0.07);
    paintTower(ctx, tx, h, detail);
  }

  ctx.restore();
}

function paintTower(ctx, tx, h, detail) {
  const tw = h * 0.24;
  const g = ctx.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0);
  g.addColorStop(0, shade(PALETTE.wall, 0.14));
  g.addColorStop(1, shade(PALETTE.wall, -0.2));
  ctx.fillStyle = g;
  ctx.fillRect(tx - tw / 2, -h * 0.62, tw, h * 1.12);
  ctx.strokeStyle = withAlpha(PALETTE.shadow, 0.28);
  ctx.lineWidth = 0.004;
  ctx.strokeRect(tx - tw / 2, -h * 0.62, tw, h * 1.12);
  // Spitzhelm
  const rg = ctx.createLinearGradient(tx - tw, 0, tx + tw, 0);
  rg.addColorStop(0, shade(PALETTE.roofSlate, 0.18));
  rg.addColorStop(1, shade(PALETTE.roofSlate, -0.22));
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(tx - tw * 0.62, -h * 0.62);
  ctx.lineTo(tx, -h * 1.06);
  ctx.lineTo(tx + tw * 0.62, -h * 0.62);
  ctx.closePath();
  ctx.fill();
  // Kreuzblume und goldenes Kreuz
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(tx, -h * 1.06); ctx.lineTo(tx, -h * 1.2);
  ctx.moveTo(tx - 0.014, -h * 1.14); ctx.lineTo(tx + 0.014, -h * 1.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, -h * 1.06, 0.008, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.gold;
  ctx.fill();
  // Spitzbogenfenster
  if (detail > 0) {
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.55);
    for (const oy of [-0.44, -0.2]) {
      ctx.beginPath();
      ctx.moveTo(tx - tw * 0.22, h * oy + h * 0.1);
      ctx.lineTo(tx - tw * 0.22, h * oy + h * 0.02);
      ctx.arc(tx, h * oy + h * 0.02, tw * 0.22, Math.PI, 0);
      ctx.lineTo(tx + tw * 0.22, h * oy + h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
