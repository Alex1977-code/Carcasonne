/**
 * Das Rezept der Bleiverglasung – Formen, Töne und Ruten der Spielfigur.
 *
 * Warum ein eigenes Modul: die Farben, die hier herauskommen, sind nicht
 * Geschmackssache. Die Spielerfarben in palette.js sind darauf gerechnet,
 * dass ihr kleinster paarweiser CIELAB-Abstand über normales Sehen,
 * Deuteranopie und Protanopie so groß wie möglich ist. Ein Stilmittel, das
 * jede Scheibe aufhellt und ins Warme oder Kalte zieht, kann diesen Abstand
 * auffressen, ohne dass es jemandem auffällt – der erste Entwurf hat aus
 * dem Rot ein Lachsrosa gemacht.
 *
 * Deshalb steht das Rezept als reine Rechnung hier und nicht als Zeichencode
 * in render.js: so kann tests/palette.test.mjs die *gemalte* Figur prüfen
 * statt nur die Farbe, mit der sie beginnt. Die Pfade sind Zeichenketten und
 * keine Path2D, damit das Modul ohne Browser lädt.
 *
 * Die Reihenfolge der Scheiben ist die Zeichenreihenfolge.
 */
import { mix, shade } from './palette.js';

/** Ins Weiße (f>0) oder ins Schwarze (f<0). */
const heller = (hex, f) => (f >= 0 ? mix(hex, '#FFFFFF', f) : shade(hex, f));

/** Warmes und kaltes Glas – der Stich, der die Scheiben unterscheidbar macht. */
export const WARM = '#FFC46A';
export const KALT = '#5B7FB8';

/** Die Farbe der Bleirute. Warmes Dunkelgrau, nie reines Schwarz. */
export const BLEI = '#2C2419';

/**
 * Die neun Scheiben.
 *
 *   d       Umriss im Koordinatensystem der Figur (0…100, Höhe 100)
 *   ton     heller (+) oder dunkler (−) als die Spielerfarbe
 *   stich   wie weit ins Warme oder Kalte
 *   hin     wohin der Stich geht
 *   mx,my,r wo das Licht durch die Scheibe fällt und wie weit es reicht
 *   anteil  ungefährer Flächenanteil – nur für die Prüfung, nicht fürs Bild
 *
 * Die Umrisse greifen über die Silhouette hinaus; beschnitten wird beim
 * Zeichnen. Ihre Kanten liegen auf denselben Punkten wie die Ruten, damit
 * die Rute die Fuge deckt und kein heller Saum stehen bleibt.
 */
export const SCHEIBEN = [
  { name: 'Kopf', anteil: 0.13, ton: 0.12, stich: 0.035, hin: WARM,
    mx: 50, my: 22, r: 18,
    d: 'M41.5 37.5 A17 17 0 1 1 58.5 37.5 Q50 42 41.5 37.5 Z' },
  { name: 'Brust', anteil: 0.11, ton: 0.06, stich: 0.02, hin: WARM,
    mx: 48, my: 44, r: 16,
    d: 'M41.5 37.5 Q50 42 58.5 37.5 Q62 43.5 65.5 50 Q50 53.5 34.5 50 Q38 43.5 41.5 37.5 Z' },
  { name: 'Bauch', anteil: 0.16, ton: 0, stich: 0.015, hin: WARM,
    mx: 48, my: 58, r: 19,
    d: 'M34.5 50 Q50 53.5 65.5 50 Q68 58 68.4 66.2 Q50 71.5 31.6 66.2 Q32 58 34.5 50 Z' },
  { name: 'Oberarm links', anteil: 0.10, ton: 0.09, stich: 0.025, hin: WARM,
    mx: 30, my: 52, r: 17,
    d: 'M42.3 38.1 Q32 48 31.6 66.2 L4 52 L-1 -1 Z' },
  { name: 'Unterarm links', anteil: 0.06, ton: 0.04, stich: 0.025, hin: WARM,
    mx: 16, my: 68, r: 15,
    d: 'M31.6 66.2 L4 52 L-1 82 Z' },
  { name: 'Oberarm rechts', anteil: 0.10, ton: -0.05, stich: 0.025, hin: KALT,
    mx: 70, my: 52, r: 17,
    d: 'M57.7 38.1 Q68 48 68.4 66.2 L96 52 L101 -1 Z' },
  { name: 'Unterarm rechts', anteil: 0.06, ton: -0.11, stich: 0.035, hin: KALT,
    mx: 84, my: 68, r: 15,
    d: 'M68.4 66.2 L96 52 L101 82 Z' },
  { name: 'Bein links', anteil: 0.14, ton: -0.03, stich: 0.02, hin: KALT,
    mx: 34, my: 84, r: 19,
    d: 'M50 69 L31 66.6 L-1 66.6 L-1 101 L50 101 Z' },
  { name: 'Bein rechts', anteil: 0.14, ton: -0.13, stich: 0.04, hin: KALT,
    mx: 66, my: 84, r: 19,
    d: 'M50 69 L69 66.6 L101 66.6 L101 101 L50 101 Z' },
];

/**
 * Die Bleiruten. Jede endet in einer anderen Rute oder in der Randfassung –
 * eine Rute, die im Glas aufhört, gibt es an keinem Fenster. Die
 * Ellbogenruten laufen über die Silhouette hinaus und werden beschnitten.
 */
export const RUTEN = [
  'M41.5 37.5 Q50 42 58.5 37.5',      // Hals
  'M57.7 38.1 Q68 48 68.4 66.2',      // Schulter rechts
  'M42.3 38.1 Q32 48 31.6 66.2',      // Schulter links
  'M34.5 50 Q50 53.5 65.5 50',        // Brust
  'M31.6 66.2 Q50 71.5 68.4 66.2',    // Hüfte
  'M50 69.5 L50 88.4',                // zwischen den Beinen
  'M31.6 66.2 L2 50',                 // Ellbogen links
  'M68.4 66.2 L98 50',                // Ellbogen rechts
];

/** Die Farbe einer Scheibe für eine Spielerfarbe. */
export const scheibenTon = (color, sch) => mix(heller(color, sch.ton), sch.hin, sch.stich);

/** Alle neun Scheibenfarben, in Zeichenreihenfolge. */
export const glasToene = (color) => SCHEIBEN.map((s) => scheibenTon(color, s));

/**
 * Der Farbeindruck der fertigen Figur: die Scheiben nach Fläche gemittelt.
 * Das ist die Farbe, an der ein Spieler seine Figur erkennt – und die
 * Größe, die im Test gegen die Palettengrenzen laufen muss.
 */
export function glasMittel(color) {
  let r = 0, g = 0, b = 0, summe = 0;
  for (const s of SCHEIBEN) {
    const hex = scheibenTon(color, s);
    const n = parseInt(hex.slice(1), 16);
    r += ((n >> 16) & 255) * s.anteil;
    g += ((n >> 8) & 255) * s.anteil;
    b += (n & 255) * s.anteil;
    summe += s.anteil;
  }
  const z = (v) => Math.round(v / summe).toString(16).padStart(2, '0');
  return `#${z(r)}${z(g)}${z(b)}`;
}
