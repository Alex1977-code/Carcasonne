/**
 * Gemalte Karten.
 *
 * Für einen Teil der Motive liegen gemalte Bilder unter grafik/karten/.
 * Wo eines existiert, wird es statt der gezeichneten Darstellung
 * verwendet; für alle übrigen Motive bleibt es beim Zeichnen. Das ist
 * keine Übergangslösung, sondern die Bedingung dafür, dass das Spiel
 * spielbar bleibt, solange nicht alle 49 Motive gemalt sind.
 *
 * Geladen wird nebenher. Bis ein Bild da ist, zeigt das Brett die
 * gezeichnete Karte – ein leeres Feld wäre schlimmer. Sobald ein Bild
 * eintrifft, meldet dieses Modul das, damit der Kachel-Zwischenspeicher
 * die betroffenen Einträge wegwirft und neu rendert.
 */

// Motive, für die ein Bild vorliegt. Muss zu grafik/bogen-belegung.json
// passen; die Liste steht hier ausgeschrieben, damit der Ladevorgang
// nicht auf 49 fehlschlagende Anfragen läuft.
export const GEMALT = [
  // Grundspiel – vollständig bis auf V, die Straßenkurve
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'W', 'X',
  // Fluss
  'RV_CITY2', 'RV_CURVE', 'RV_LAKE', 'RV_SPRING',
  'RV_STRAIGHT',
  // Wirtshäuser & Kathedralen
  'EC_CATH', 'EC_CITY_FULL', 'EC_CITY_GATE',
  'EC_INN_STRAIGHT', 'EC_MON_ROAD2',
];

const bilder = new Map();
const horcher = [];
let gestartet = false;

/** Bild zu einem Motiv, oder null solange es fehlt. */
export function paintingFor(id) {
  return bilder.get(id) || null;
}

/** Gibt es für dieses Motiv überhaupt eine Malerei? */
export function hasPainting(id) {
  return GEMALT.includes(id);
}

/** Ruf, sobald ein weiteres Bild fertig geladen ist. */
export function onPaintingLoaded(fn) {
  horcher.push(fn);
}

/**
 * Laden anstoßen. Wird beim ersten Kachelrendern aufgerufen, nicht beim
 * Laden des Moduls – so kosten die Bilder nichts, wenn nur die Engine
 * geladen wird (Tests, Node).
 */
export function loadPaintings(basis = 'grafik/karten/') {
  if (gestartet || typeof Image === 'undefined') return;
  gestartet = true;
  for (const id of GEMALT) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      bilder.set(id, img);
      for (const fn of horcher) fn(id);
    };
    // Fehlt eine Datei, bleibt es bei der gezeichneten Karte. Kein Grund,
    // laut zu werden – das Spiel läuft weiter.
    img.onerror = () => {};
    img.src = basis + id + '.webp';
  }
}
