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
 * Wie deckend die Figur aufgetragen wird – und warum nicht als eine Zahl.
 *
 * Glas ist nicht überall gleich durchsichtig. Wo Licht von der Oberfläche
 * zurückkommt, im Glanzlicht, ist es undurchsichtig; wo man in das
 * Material hineinsieht, in den dunklen Flächen, ist es offen. Genau so
 * wird die Deckung verteilt:
 *
 *   d = FOTO_DECKUNG_MIN + (1 − FOTO_DECKUNG_MIN) · g
 *
 * mit g = 0 in den dunkelsten und g = 1 in den hellsten Flächen der Figur,
 * normiert an ihren eigenen Perzentilen (20 % / 95 %). Ohne diese Normierung
 * gälte die schwarze Figur durchweg als „dunkel“ und verschwände.
 *
 * Gleichmäßige Deckung war der erste Versuch, und sie ist die schlechtere
 * Verteilung derselben Menge Durchsicht. Gemessen über jeden Untergrund des
 * Spiels, für Normalsicht, Deuteranopie und Protanopie
 * (`node tools/figuren-pruefen.mjs grafik/figuren/*.webp`):
 *
 *   gleichmäßig   Grenze bei 78 % Deckung
 *   verteilt      Grenze bei 70 % Deckung der dunklen Flächen
 *
 * Beide sind für „durchsichtig wie buntes Glas“ zu wenig – man sieht kaum
 * etwas. Deshalb steht der Körper jetzt bei 45 %, deutlich unter der
 * Grenze, und der Farbabstand liegt nicht mehr in der Fläche:
 *
 *   Fläche bei 45 %: schwächstes Paar ΔE ≈ 19,7 – unter der Grenze 25.
 *   Saum:            die reine Spielerfarbe, deckend. Ihre Paare halten
 *                    den Abstand von Haus aus, das prüft palette.test.mjs.
 *
 * Das ist keine Abschwächung der Bedingung, sondern eine Verlagerung:
 * woran man die Figur erkennt, ist jetzt die Kontur, nicht die Füllung.
 * Bleiverglasung arbeitet genauso – die Scheibe ist durchsichtig, die
 * Fassung trägt die Zeichnung.
 */
export const FOTO_DECKUNG_MIN = 0.45;
export const FOTO_PERZENTIL = [0.20, 0.95];

/** Breite des Saums, in Einheiten der Figurenhöhe (100). */
export const FOTO_SAUM = 1.8;

const bilder = new Map();
const horcher = [];
let gestartet = false;

const schluessel = (hex) => String(hex || '').trim().toUpperCase();

/** Aufnahme zu einer Spielerfarbe, oder null solange keine vorliegt. */
export function figureFor(hex) {
  return bilder.get(schluessel(hex)) || null;
}

// Die zerlegte Figur je Farbe, einmal gerechnet und aufgehoben. Beide
// Teile brauchen Pixelzugriff, das will man nicht pro Bild und Meeple.
const teile = new Map();

/**
 * Die Figur in ihre zwei Auftragungen zerlegen.
 *
 *   voll    – die Aufnahme, wie sie ist. Für den multiplizierenden
 *             Durchgang: das Licht, das durch das Glas geht.
 *   koerper – dieselbe Aufnahme mit über die eigene Helligkeit verteilter
 *             Deckung. Für den normalen Durchgang.
 *   saum    – ein deckender Rand in der reinen Spielerfarbe. Er trägt die
 *             Erkennbarkeit, die der durchsichtige Körper abgibt.
 */
export function figurTeile(hex) {
  const k = schluessel(hex);
  const fertig = teile.get(k);
  if (fertig) return fertig;
  const voll = bilder.get(k);
  if (!voll || typeof document === 'undefined') return null;

  const n = voll.naturalWidth || voll.width;
  const leinwand = () => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    return c;
  };

  // ---- Körper: Deckung über die eigene Helligkeit verteilen
  const kc = leinwand();
  const kg = kc.getContext('2d', { willReadFrequently: true });
  kg.drawImage(voll, 0, 0);
  const bild = kg.getImageData(0, 0, n, n);
  const d = bild.data;
  const hell = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 230) continue;
    hell.push(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
  }
  hell.sort((a, b) => a - b);
  const yU = hell.length ? hell[Math.floor(hell.length * FOTO_PERZENTIL[0])] : 0;
  const yO = hell.length ? hell[Math.floor(hell.length * FOTO_PERZENTIL[1])] : 255;
  const spanne = Math.max(1, yO - yU);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const y = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
    const g = Math.max(0, Math.min(1, (y - yU) / spanne));
    d[i + 3] *= FOTO_DECKUNG_MIN + (1 - FOTO_DECKUNG_MIN) * g;
  }
  kg.putImageData(bild, 0, 0);

  // ---- Saum: die Silhouette geweitet, dann die eigene Fläche ausgestanzt
  const sc = leinwand();
  const sg = sc.getContext('2d');
  const w = FOTO_SAUM * (n / FOTO_KASTEN);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    sg.drawImage(voll, Math.cos(a) * w, Math.sin(a) * w);
  }
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = hex;
  sg.fillRect(0, 0, n, n);
  sg.globalCompositeOperation = 'destination-out';
  sg.drawImage(voll, 0, 0);

  const satz = { voll, koerper: kc, saum: sc };
  teile.set(k, satz);
  return satz;
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
