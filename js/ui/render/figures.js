/**
 * Fotografierte Spielfiguren.
 *
 * Unter grafik/figuren/ liegt je Spielerfarbe eine freigestellte Aufnahme
 * einer aus Acryl geschnittenen Figur. Wo eine vorliegt, wird sie statt der
 * gezeichneten Figur verwendet; fehlt sie, bleibt es beim geschliffenen
 * Stein aus glass.js. Dieselbe Verabredung wie bei den gemalten Karten –
 * das Spiel bleibt vollständig, auch wenn eine Datei fehlt oder noch lädt.
 *
 * Die Dateien entstehen mit tools/figuren-einbauen.mjs. Dort wird die
 * Vorderfläche der Scheibe auf MEEPLE_PATH eingepasst, damit die
 * fotografierte Figur genau dort steht, wo das Spiel die gezeichnete
 * erwartet. Der Kasten ist deshalb kein beliebiger Ausschnitt, sondern eine
 * Verabredung zwischen Werkzeug und Renderer:
 *
 *   KASTEN 140 Einheiten, der Umriss (0…100) sitzt darin bei 20…120.
 *
 * Der Rand von 20 ist gemessen, nicht geschätzt: die Scheibe ragt nach
 * rechts und unten um gut ein Achtel der Figurenhöhe über die
 * Vorderfläche hinaus. Mit dem Rand 10 der gezeichneten Figur standen die
 * Füße außerhalb des Kastens und wurden abgeschnitten.
 */
import { PLAYER_PALETTE } from './meeple-colors.js';

export const FOTO_KASTEN = 140;
export const FOTO_RAND = 20;

/**
 * Wie deckend die Figur aufgetragen wird.
 *
 * Deckend sieht sie auf dem Brett aus wie aufgeklebt. Sie darf
 * durchscheinen – aber nicht beliebig weit: was der Untergrund
 * durchscheinen lässt, färbt **alle** Figuren gleich ein, und damit rückt
 * jedes Farbpaar zusammen. Gemessen über jeden Untergrund des Spiels, für
 * Normalsicht, Deuteranopie und Protanopie
 * (`node tools/figuren-pruefen.mjs grafik/figuren/*.webp`):
 *
 *   100 %   ΔE 30,0     78 %   ΔE 25,5  ← Grenze
 *    90 %   ΔE 28,2     70 %   ΔE 22,9
 *    80 %   ΔE 26,0     50 %   ΔE 17,3
 *
 * Die Grenze der Palette liegt bei 25; das schwächste Paar ist durchweg
 * Grün/Rot auf der Wiese. 80 % lässt einen kleinen Rest Sicherheit.
 *
 * Ein zweites Modell wurde mitgemessen und verworfen: den Untergrund nur
 * seine Helligkeit durchlassen und die Farbe der Figur behalten (im
 * Browser der Mischmodus 'color'). Klingt physikalischer, ist aber
 * schlechter – dort liegt die Grenze schon bei 90 %, weil Grün und
 * Schwarz sich gerade über die Helligkeit unterscheiden.
 */
export const FOTO_DECKUNG = 0.80;

const bilder = new Map();
const horcher = [];
let gestartet = false;

const schluessel = (hex) => String(hex || '').trim().toUpperCase();

/** Aufnahme zu einer Spielerfarbe, oder null solange keine vorliegt. */
export function figureFor(hex) {
  return bilder.get(schluessel(hex)) || null;
}

/** Ruf, sobald eine weitere Aufnahme geladen ist. */
export function onFigureLoaded(fn) {
  horcher.push(fn);
}

/**
 * Laden anstoßen. Wie bei den Karten erst beim ersten Zeichnen, damit die
 * Engine in Node ohne Bilder auskommt.
 */
export function loadFigures(basis = 'grafik/figuren/') {
  if (gestartet || typeof Image === 'undefined') return;
  gestartet = true;
  for (const e of PLAYER_PALETTE) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      bilder.set(schluessel(e.hex), img);
      for (const fn of horcher) fn(e.hex);
    };
    // Fehlt eine Datei, bleibt es beim gezeichneten Stein.
    img.onerror = () => {};
    img.src = basis + e.datei + '.webp';
  }
}
