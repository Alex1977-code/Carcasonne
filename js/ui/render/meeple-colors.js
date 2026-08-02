/**
 * Spielerfarben und Trennring für die Meeples.
 *
 * Die sechs Farben stammen aus palette.js: dort wurde der kleinste paarweise
 * CIELAB-Abstand über normales Sehen, Deuteranopie und Protanopie maximiert.
 * Violett ist als siebte Farbe geprüft und hält die Grenzwerte zusammen mit
 * allen sechs – deshalb steht es im Spiel zur Wahl, damit auch der sechste
 * Spieler noch etwas zu entscheiden hat.
 *
 * Grün auf Wiese und Gelb auf Getreide bleiben grenzwertig; das ist ohne
 * Verlust einer der Farben nicht lösbar. Diese Arbeit übernimmt der
 * Trennring: seine Variante (dunkel oder hell) wird pro Untergrund so
 * gewählt, dass der Abstand am größten ist. Die Füllfarbe bleibt damit
 * vollständig für die Unterscheidung der Spieler frei.
 */
import { PLAYER_COLORS, PLAYER_COLOR_ALT, mix, deltaE } from './palette.js';

/**
 * Reihenfolge wie bisher im Spiel (rot, blau, gelb, grün, schwarz, violett),
 * damit gespeicherte Spielstände dieselbe Farbe behalten. Grau kommt als
 * siebte Wahl dazu.
 */
export const PLAYER_PALETTE = [
  { name: 'Rot', hex: PLAYER_COLORS.rot },
  { name: 'Blau', hex: PLAYER_COLORS.blau },
  { name: 'Gelb', hex: PLAYER_COLORS.gelb },
  { name: 'Grün', hex: PLAYER_COLORS.gruen },
  { name: 'Schwarz', hex: PLAYER_COLORS.schwarz },
  { name: 'Violett', hex: PLAYER_COLOR_ALT.violett },
  { name: 'Grau', hex: PLAYER_COLORS.grau },
];

export const PLAYER_HEXES = PLAYER_PALETTE.map((e) => e.hex);
export const PLAYER_NAMES = PLAYER_PALETTE.map((e) => e.name);

/**
 * Untergründe, auf denen ein Meeple stehen kann – mit den Farben, die der
 * Spiel-Renderer dort tatsächlich zeichnet (nicht den Spec-Werten, sonst
 * rechnet der Ring gegen die falsche Fläche).
 */
export const MEEPLE_SURFACES = {
  // Wiese samt Ackerparzellen, auf denen ein Bauer stehen kann
  field: ['#7CAD4B', '#D9B24C', '#A9793F', '#8E7A4E'],
  city: ['#C0925B', '#EDDCAE'],      // Pflaster und Hauswand
  road: ['#E9DCB6', '#7D6543'],      // Fahrbahn und Erdkante
  mon: ['#F4ECD8', '#7CAD4B'],       // Klosterhof und Wiese
  river: ['#3D78B0', '#CFC39B'],     // Wasser und Ufer
  marker: ['#FFFFFF'],               // weißer Auswahlpunkt in der Setzphase
};

const DARK = (fill) => mix(fill, '#101014', 0.55);
const LIGHT = (fill) => mix(fill, '#FFFFFF', 0.65);

const ringCache = new Map();

/**
 * Kontur und Halo für eine Füllfarbe.
 *
 * Eine einzelne Ringfarbe reicht nicht: Flächen wie die Straße haben einen
 * hellen und einen dunklen Ton, gegen beide kann eine Farbe nicht gleichzeitig
 * gewinnen (Gelb auf der Fahrbahn kam nur auf ΔE 18). Deshalb wie in §6 zwei
 * Ringe gegenläufiger Helligkeit:
 *
 *   inner – hebt sich von der *Füllfarbe* ab und zeichnet die Silhouette
 *   outer – hebt sich vom *Untergrund* ab, wo der innere Ring ihm zu nah kommt
 *
 * Bei hellen Füllfarben ist innen dunkel und außen hell, bei dunklen umgekehrt.
 * Damit ist auf jedem Untergrundton mindestens einer der beiden Ringe deutlich.
 */
export function meepleRings(fill) {
  const hit = ringCache.get(fill);
  if (hit) return hit;
  const dark = DARK(fill), light = LIGHT(fill);
  // Innen kommt die Variante, die sich stärker von der Füllfarbe abhebt.
  const inner = deltaE(dark, fill) >= deltaE(light, fill) ? dark : light;
  const outer = inner === dark ? light : dark;
  const rings = { inner, outer };
  ringCache.set(fill, rings);
  return rings;
}

/** Nur die Kontur – für kleine Darstellungen ohne Halo. */
export function meepleRing(fill) {
  return meepleRings(fill).inner;
}

/** Feature-Typ der Engine → Untergrund für den Trennring. */
export function surfaceForFeature(featureType) {
  return MEEPLE_SURFACES[featureType] ? featureType : 'field';
}
