/**
 * Ein Kartenstapel, der bei jedem Lauf derselbe ist.
 *
 * `buildDeck` mischt mit `Math.random`, und `newGame` reicht nichts anderes
 * durch. Für die Fälle mit fest angegebenen `deckIds` ist das egal – für
 * ganze Partien nicht. Die Regel-Suite zählte bei drei Läufen 670, 670 und
 * 667 Platzierungen, und eine Prüfung, die ein Gebiet über die Segmentnummer
 * statt über das Gebiet suchte, fiel deshalb nur in etwa jedem dritten Lauf
 * auf. Ein Test, der mal grün und mal rot ist, sagt nichts: man sieht ihn
 * rot, lässt ihn noch einmal laufen, er ist grün, und der Fehler bleibt im
 * Spiel.
 *
 * Deshalb bekommen die Partien hier einen Stapel aus einem Zahlenwert.
 * Verschiedene Werte ergeben verschiedene Partien – gemischt wird also
 * weiterhin, nur nicht mehr unbeobachtbar.
 */
import { buildDeck } from '../js/engine/tiles.js';
import { mulberry32 } from '../js/ui/render/rng.js';

/**
 * @param {object} settings Einstellungen wie für `newGame`.
 * @param {number} seed Zahlenwert; gleicher Wert, gleicher Stapel.
 * @returns {object} dieselben Einstellungen mit festem `deckIds`/`startId`.
 */
export function festerStapel(settings, seed) {
  const b = buildDeck(settings, mulberry32((seed >>> 0) * 2654435761 + 0x9e3779b9));
  return { ...settings, deckIds: b.deck, startId: b.startId };
}

/**
 * Eine Würfelquelle für `chooseMove`. Gleicher Zahlenwert, gleiche Partie.
 *
 * @param {number} seed Zahlenwert.
 * @returns {() => number} Zufallszahlen aus [0,1).
 */
export function wuerfelAus(seed) {
  return mulberry32((seed >>> 0) * 40503 + 0x6d2b79f5);
}
