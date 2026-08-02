/**
 * Palette, Licht und Farbprüfung.
 * Werte aus Spec §2, Spielerfarben aus Nachtrag §15.
 */

export const PALETTE = {
  meadow: '#6FA84A',
  meadowDark: '#4E8438',
  meadowLight: '#8CBE5C',

  fieldPlowed: '#A9793F',
  fieldGrain: '#D9B24C',
  fieldFallow: '#8E7A4E',
  fieldYoung: '#7FB05A',

  pavingLight: '#C69A6D',
  pavingDark: '#A97F55',
  alley: '#D9C3A2',

  wallStone: '#B9A98F',
  wallShadow: '#8C7B63',

  roofTerracotta: ['#B4452F', '#A03B27', '#C25A3C', '#8E3324'],
  roofSlate: '#4B5560',

  wall: '#F2E7D5',
  timber: '#6B4A2F',

  roadSurface: '#E5D8B8',
  roadEdge: '#B79A6B',
  roadShadow: '#8A6E48',

  waterLight: '#7CB6E0',
  waterMid: '#3E7FBF',
  waterDeep: '#2B5F94',

  gold: '#D8A93B',
  heraldicBlue: '#2C5AA8',

  shadow: '#3B2E22',
};

/** Eine Lichtquelle für alles: oben-links, 315°. */
export const LIGHT = {
  angleDeg: 315,
  dx: -Math.SQRT1_2,
  dy: -Math.SQRT1_2,
  litGain: 0.12,
  shadeGain: -0.18,
  groundShadowAlpha: 0.25,
  groundShadowColor: PALETTE.shadow,
};

export const PLAYER_COLORS = {
  rot: '#D6321A',
  gelb: '#F5D739',
  gruen: '#296345',
  blau: '#196CCD',
  grau: '#A3ABB7',
  schwarz: '#16191B',
};

/**
 * Ersatzfarbe. Hält die Grenzwerte auch zusammen mit allen sechs oben,
 * ein Siebener-Satz wäre also möglich.
 */
export const PLAYER_COLOR_ALT = { violett: '#4A356E' };

/** Untergründe, gegen die Meeples lesbar bleiben müssen (Spec §8). */
export const MEEPLE_BACKGROUNDS = {
  Wiese: PALETTE.meadow,
  Acker: PALETTE.fieldGrain,
  Stadtpflaster: PALETTE.pavingLight,
  Fluss: PALETTE.waterMid,
};

// ---------------------------------------------------------------- Farbwerkzeug

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative Aufhellung/Abdunklung in Prozent, z. B. shade(hex, -0.18). */
export function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 + amount;
  return rgbToHex({ r: r * f, g: g * f, b: b * f });
}

/** Hue-Jitter in Grad, Helligkeits-Jitter relativ – für die ±6 %-Variation aus §2. */
export function jitterColor(hex, hueDeg = 0, lightAmount = 0) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({
    h: (h + hueDeg / 360 + 1) % 1,
    s,
    l: Math.max(0, Math.min(1, l * (1 + lightAmount))),
  }));
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
}

// ------------------------------------------------------- Farbprüfung (§15)

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, v * 255));
}

export function toLab(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** CIE76. Für Ampelwerte in der Galerie ausreichend genau. */
export function deltaE(hexA, hexB) {
  const A = toLab(hexA), B = toLab(hexB);
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}

/**
 * Farbfehlsichtigkeit simulieren (Viénot/Brettel-Näherung im linearen LMS-Raum).
 * type: 'deuteranopia' | 'protanopia' | 'tritanopia'
 */
export function simulateCvd(hex, type) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);

  const L = 0.31399022 * R + 0.63951294 * G + 0.04649755 * B;
  const M = 0.15537241 * R + 0.75789446 * G + 0.08670142 * B;
  const S = 0.01775239 * R + 0.10944209 * G + 0.87256922 * B;

  let l = L, m = M, s = S;
  if (type === 'protanopia') l = 1.05118294 * M - 0.05116099 * S;
  else if (type === 'deuteranopia') m = 0.9513092 * L + 0.04866992 * S;
  else if (type === 'tritanopia') s = -0.86744736 * L + 1.86727089 * M;

  const R2 = 5.47221206 * l - 4.6419601 * m + 0.16963708 * s;
  const G2 = -1.1252419 * l + 2.29317094 * m - 0.1678952 * s;
  const B2 = 0.02980165 * l - 0.19318073 * m + 1.16364789 * s;

  return rgbToHex({ r: linearToSrgb(R2), g: linearToSrgb(G2), b: linearToSrgb(B2) });
}

export const CONTRAST_LIMITS = { playerPair: 25, background: 20 };

/**
 * Vollständige Prüfung nach Nachtrag §15.
 * Liefert { pairs, backgrounds, passed } – die Galerie färbt daraus die Tabelle.
 */
export function checkPlayerColors(colors = PLAYER_COLORS, backgrounds = MEEPLE_BACKGROUNDS) {
  const views = ['normal', 'deuteranopia', 'protanopia'];
  const view = (hex, v) => (v === 'normal' ? hex : simulateCvd(hex, v));
  const names = Object.keys(colors);

  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const entry = { a: names[i], b: names[j], values: {}, min: Infinity };
      for (const v of views) {
        const d = deltaE(view(colors[names[i]], v), view(colors[names[j]], v));
        entry.values[v] = d;
        entry.min = Math.min(entry.min, d);
      }
      entry.passed = entry.min >= CONTRAST_LIMITS.playerPair;
      pairs.push(entry);
    }
  }

  const bgResults = [];
  for (const name of names) {
    for (const [bgName, bgHex] of Object.entries(backgrounds)) {
      const entry = { color: name, background: bgName, values: {}, min: Infinity };
      for (const v of views) {
        const d = deltaE(view(colors[name], v), view(bgHex, v));
        entry.values[v] = d;
        entry.min = Math.min(entry.min, d);
      }
      entry.passed = entry.min >= CONTRAST_LIMITS.background;
      bgResults.push(entry);
    }
  }

  return {
    pairs,
    backgrounds: bgResults,
    passed: pairs.every((p) => p.passed) && bgResults.every((b) => b.passed),
  };
}

// ---------------------------------------------- Trennring (Spec §6, Nachtrag §15)

/** Lineare Mischung zweier Farben, t = 0…1. */
export function mix(hexA, hexB, t) {
  const A = hexToRgb(hexA), B = hexToRgb(hexB);
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

/**
 * Der Ring, der die Meeple-Silhouette vom Untergrund trennt.
 *
 * §6 sieht eine Kontur 12 % dunkler vor und auf dunklem Grund zusätzlich einen
 * hellen Halo. Verallgemeinert: es wird die Variante gewählt, die gegen den
 * konkreten Untergrund den größeren Abstand hat. Dadurch bleibt jede Spielerfarbe
 * auf jedem Untergrund lesbar, ohne dass die Füllfarbe selbst verbogen wird.
 */
export function separationRing(fillHex, bgHex) {
  const candidates = [
    { kind: 'dunkel', color: mix(fillHex, '#101014', 0.55) },
    { kind: 'hell', color: mix(fillHex, '#FFFFFF', 0.65) },
  ];
  let best = null;
  for (const c of candidates) {
    const d = deltaE(c.color, bgHex);
    if (!best || d > best.deltaE) best = { ...c, deltaE: d };
  }
  return best;
}
