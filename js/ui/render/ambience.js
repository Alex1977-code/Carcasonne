/**
 * Tisch und Kerzenlicht.
 *
 * Zielbild: ein Abend im Mittelalter, das Brett liegt auf einem massiven
 * Eichentisch, beleuchtet von einer Kerze, die selbst nicht im Bild ist.
 * Das Licht kommt von schräg oben-links, ist warm, fällt zu den Rändern
 * hin schnell ab und flackert leicht.
 *
 * Zwei Regeln aus dem Renderpfad gelten weiter:
 *   - kein Math.random und keine Uhrzeit im Modul. Die Holztextur zieht aus
 *     einem festen Seed, das Flackern ist eine Funktion der Zeit, die von
 *     außen hereingereicht wird.
 *   - der Tisch wird einmal in eine Kachel gerendert und danach nur noch
 *     geblittet; pro Frame laufen nur Licht und Vignette.
 */

// ------------------------------------------------------------ Zufall (fest)

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wertrauschen mit bilinearer Glättung. Die Perioden sind getrennt, weil
 * die Kachel sonst nicht rundläuft: abgetastet wird bei (u·px, v·py), und
 * nur wenn das Gitter genau bei px bzw. py umschlägt, passt der rechte
 * Rand auf den linken und der untere auf den oberen.
 */
function makeNoise(seed, px, py) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % py) + py) % py) * px + (((x % px) + px) % px)];
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
}

// Oktaven verdoppeln die Frequenz; bleibt die Grundfrequenz ein ganzes
// Vielfaches der Periode, tun es die Oktaven auch.
function fbm(noise, x, y, octaves, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f, y * f) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- Kerzenlicht

/**
 * Zustand der Kerze zum Zeitpunkt `t` (Millisekunden).
 *
 * Kerzenflackern ist kein weißes Rauschen: eine ruhige Flamme atmet
 * langsam, dazu kommen unregelmäßige kurze Zuckungen. Nachgebildet als
 * Summe von Schwingungen mit unharmonischen Frequenzen – dadurch
 * wiederholt sich das Muster praktisch nie und braucht trotzdem keinen
 * Zufallsgenerator.
 *
 * @returns { intensity, dx, dy, warmth }
 *   intensity 0,86…1,12 · dx/dy Versatz der Lichtquelle in Pixeln
 */
export function candleAt(t, calm = false) {
  if (calm) return { intensity: 1, dx: 0, dy: 0, warmth: 1 };
  const s = t / 1000;
  const slow = Math.sin(s * 1.7) * 0.5 + Math.sin(s * 2.63 + 1.1) * 0.3;
  const mid = Math.sin(s * 6.1 + 0.7) * 0.16 + Math.sin(s * 9.37 + 2.3) * 0.1;
  const fast = Math.sin(s * 21.3 + 0.4) * 0.05 + Math.sin(s * 33.7 + 1.9) * 0.03;
  // gelegentliches Zucken: zwei sehr langsame Wellen, die selten zusammenfallen
  const gust = Math.max(0, Math.sin(s * 0.41) * Math.sin(s * 0.27 + 2.1)) ** 3;
  const flicker = slow * 0.09 + mid * 0.07 + fast * 0.05 - gust * 0.14;
  return {
    intensity: 1 + flicker,
    dx: (Math.sin(s * 1.3 + 0.2) + Math.sin(s * 2.9)) * 5.5,
    dy: (Math.sin(s * 1.7 + 1.4) + Math.sin(s * 3.6 + 0.9)) * 3.5,
    // die Flamme wird beim Aufflackern eine Spur weißer
    warmth: 1 - flicker * 0.35,
  };
}

// --------------------------------------------------------------- Holztisch

let tableTile = null;

/**
 * Eichentisch als nahtlose Kachel. Aufgebaut wie echtes Holz:
 * Jahresringe aus verzerrtem Rauschen, Poren längs der Faser, Hobelspuren,
 * dunkle Fugen zwischen den Brettern und eine gewachste Oberfläche.
 */
export function tableTexture(size = 640) {
  if (tableTile && tableTile.width === size) return tableTile;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;

  // Faser läuft senkrecht: quer viele Zellen (Ringe), längs wenige.
  const grain = makeNoise(0x51f3a2, 48, 6);
  const warpX = makeNoise(0x9c1e77, 12, 4);
  const warpY = makeNoise(0x2ab45d, 8, 4);
  const pore = makeNoise(0x7f20c9, 96, 12);

  const PLANKS = 3;
  const plankW = size / PLANKS;
  const plankSeed = mulberry32(0x4d19);
  const plankShift = [], plankTone = [];
  for (let i = 0; i < PLANKS; i++) {
    plankShift.push(plankSeed() * 40);
    plankTone.push(0.88 + plankSeed() * 0.24);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = Math.floor(x / plankW);
      const inPlank = x - p * plankW;
      const u = x / size, v = y / size;

      // Das Rauschen wird quer gestaucht, damit längliche Ringe statt
      // Wolken entstehen. Alle Abtastungen laufen bei u=1 bzw. v=1 um.
      const wx = warpX(u * 12, v * 4) - 0.5;
      const wy = warpY(u * 8, v * 4) - 0.5;
      const ringInput = u * 48 + wx * 2.2 + plankShift[p];
      const along = v * 6 + wy * 0.9;
      let rings = fbm(grain, ringInput, along, 3, 0.55);
      // scharfe Jahresringe: Sägezahn statt weicher Verlauf
      rings = Math.abs(((rings * 7) % 1) - 0.5) * 2;
      rings = Math.pow(rings, 0.65);

      // Poren als feine dunkle Striche längs der Faser
      const pores = fbm(pore, u * 96, v * 12, 2, 0.5);
      const poreDark = pores > 0.62 ? (pores - 0.62) * 1.9 : 0;

      // Grundton Eiche, warm
      let r = 112, gg = 80, b = 53;
      const tone = plankTone[p];
      const dark = rings * 0.42 + poreDark * 0.5;
      r = (r * tone) * (1 - dark * 0.52);
      gg = (gg * tone) * (1 - dark * 0.58);
      b = (b * tone) * (1 - dark * 0.62);

      // Hobelspuren: sehr flache breite Wellen quer zur Faser
      const plane = Math.sin(v * Math.PI * 2 * 34 + wx * 8) * 0.5 + 0.5;
      const planeAmt = 0.045 * plane;
      r += 12 * planeAmt; gg += 9 * planeAmt; b += 6 * planeAmt;

      // Fase und Fuge zwischen den Brettern
      const edge = Math.min(inPlank, plankW - inPlank);
      if (edge < 5) {
        const k = 1 - edge / 5;
        const groove = k * k;
        r *= 1 - groove * 0.72; gg *= 1 - groove * 0.74; b *= 1 - groove * 0.76;
      } else if (edge < 11) {
        const k = 1 - (edge - 5) / 6;
        r += 16 * k; gg += 12 * k; b += 8 * k;      // Lichtkante der Fase
      }

      const i = (y * size + x) * 4;
      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, gg));
      d[i + 2] = Math.max(0, Math.min(255, b));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // Gebrauchsspuren: feine Kratzer und ein paar dunkle Flecken
  const rnd = mulberry32(0x7788aa);
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = 6 + rnd() * 46;
    const a = (rnd() - 0.5) * 0.5 + Math.PI / 2;
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '255,236,205' : '38,24,13'},${0.04 + rnd() * 0.06})`;
    g.lineWidth = 0.6 + rnd() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 34;
    const st = g.createRadialGradient(x, y, 0, x, y, r);
    st.addColorStop(0, `rgba(46,28,14,${0.05 + rnd() * 0.06})`);
    st.addColorStop(1, 'rgba(46,28,14,0)');
    g.fillStyle = st;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  tableTile = c;
  return c;
}

/**
 * Tischfläche füllen. Die Kachel wird mit `ox`/`oy` verschoben, damit die
 * Fläche mit der Kamera wandert statt am Bildschirm zu kleben.
 */
export function paintTable(ctx, w, h, ox = 0, oy = 0, scale = 1) {
  const tile = tableTexture();
  const step = tile.width * scale;
  ctx.save();
  ctx.translate(((ox % step) + step) % step - step, ((oy % step) + step) % step - step);
  for (let ty = 0; ty < h + step * 2; ty += step) {
    for (let tx = 0; tx < w + step * 2; tx += step) {
      ctx.drawImage(tile, tx, ty, step, step);
    }
  }
  ctx.restore();
}

/**
 * Wachsglanz: eine langgezogene Aufhellung dort, wo die Kerze sich in der
 * gewachsten Oberfläche spiegelt. Ohne sie wirkt das Holz wie bedrucktes
 * Papier – der Glanz ist das, was „echtes Möbelstück“ verkauft.
 */
export function paintSheen(ctx, w, h, candle) {
  const cx = w * 0.38 + candle.dx * 1.6;
  const cy = h * 0.30 + candle.dy * 1.6;
  const rx = Math.max(w, h) * 0.42 * candle.intensity;
  const ry = rx * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.20 * candle.intensity;
  ctx.translate(cx, cy);
  ctx.rotate(-0.32);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(255,226,168,0.55)');
  g.addColorStop(0.35, 'rgba(238,186,118,0.24)');
  g.addColorStop(0.7, 'rgba(190,132,74,0.07)');
  g.addColorStop(1, 'rgba(150,96,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// ------------------------------------------------------- Licht und Vignette

let lightSprite = null;

/** Warmer Lichtkegel als Sprite – wird nur verschoben und skaliert. */
export function candleSprite(size = 512) {
  if (lightSprite) return lightSprite;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, r * 0.04, r, r, r);
  grad.addColorStop(0, 'rgba(255,214,140,0.95)');
  grad.addColorStop(0.18, 'rgba(255,196,116,0.62)');
  grad.addColorStop(0.42, 'rgba(255,171,92,0.30)');
  grad.addColorStop(0.72, 'rgba(214,132,66,0.10)');
  grad.addColorStop(1, 'rgba(180,104,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  lightSprite = c;
  return c;
}

/**
 * Kerzenlicht über die Szene legen.
 * Erst ein warmer Kegel additiv, dann die Vignette multiplikativ – in
 * dieser Reihenfolge, sonst frisst die Vignette das Licht wieder auf.
 */
export function paintCandleLight(ctx, w, h, candle) {
  // Die Kerze steht etwas oberhalb der Mitte, nicht im oberen Viertel. Auf
  // einem hohen Telefonbildschirm liegt sonst die ganze untere Hälfte im
  // Abfall – gemessen war der unterste Streifen auf ein Drittel der oberen
  // Helligkeit abgedunkelt, und genau dort sitzen Kartenablage und Knöpfe.
  const cx = w * 0.40 + candle.dx;
  const cy = h * 0.36 + candle.dy;
  // Nicht nur die Helligkeit flackert, auch der Lichtkreis atmet – das ist
  // der Teil, den man tatsächlich sieht. Reine Helligkeitsschwankung fiel
  // im Bild mit gut 1 % kaum auf.
  const falloff = Math.hypot(w, h) * 0.98 * (1 + (candle.intensity - 1) * 0.55);

  // 1. Abend: die Szene wird gedämpft und warm eingefärbt. Der dunkelste
  //    Punkt bleibt bei gut der Hälfte stehen – tiefer wird aus Stimmung
  //    Unlesbarkeit, und auf einem Telefon in einem hellen Raum sieht man
  //    dort nichts mehr.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const dusk = ctx.createRadialGradient(cx, cy, falloff * 0.04, cx, cy, falloff);
  dusk.addColorStop(0, 'rgba(255,250,240,1)');
  dusk.addColorStop(0.24, 'rgba(248,232,206,1)');
  dusk.addColorStop(0.48, 'rgba(226,198,164,1)');
  dusk.addColorStop(0.70, 'rgba(198,167,133,1)');
  dusk.addColorStop(0.88, 'rgba(172,142,112,1)');
  dusk.addColorStop(1, 'rgba(154,126,100,1)');
  ctx.fillStyle = dusk;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Der eigentliche Schein, additiv und nur im Kern – ein großzügiger
  //    Zusatz bleicht die Kacheln aus, statt sie zu beleuchten.
  const glow = falloff * 0.85;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.11 * candle.intensity * candle.intensity;
  ctx.drawImage(candleSprite(), cx - glow / 2, cy - glow / 2, glow, glow);
  ctx.restore();
}

/** Richtung, in die Objekte ihren Schatten werfen (weg von der Kerze). */
export function shadowOffset(candle, strength = 1) {
  const ang = Math.atan2(1, 1);   // Kerze oben-links → Schatten unten-rechts
  return {
    x: Math.cos(ang) * strength * (1 + candle.dx / 60),
    y: Math.sin(ang) * strength * (1 + candle.dy / 60),
  };
}
