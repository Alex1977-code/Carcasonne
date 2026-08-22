/**
 * Das Rezept der geschliffenen Spielfigur – Facetten, Töne, Durchsicht.
 *
 * Die Figur ist ein geschliffener Stein: farbig, durchscheinend, mit
 * Facetten, die das Licht in harten Kanten brechen. Das ist etwas anderes
 * als die Bleiverglasung, die hier vorher stand. Ein Bleifenster ist flach
 * und in dunkle Ruten gefasst; ein Schliff hat keine Ruten, sondern Kanten,
 * an denen zwei verschieden geneigte Flächen aneinanderstoßen.
 *
 * Drei Dinge machen den Unterschied, und alle drei stehen unten:
 *
 *   Facetten mit echter Neigung. Jede Facette bekommt ihre Helligkeit aus
 *   dem Winkel, in dem sie zum Licht steht – nicht aus einer Liste. Licht
 *   von oben links: eine Facette, deren Normale dorthin zeigt, ist die
 *   hellste, die gegenüberliegende die dunkelste, und dazwischen läuft es
 *   als Kosinus. Deshalb dreht sich das Muster mit, wenn man die Lichtquelle
 *   verschiebt, statt aufgemalt zu bleiben.
 *
 *   Durchsicht. Der Stein ist nicht deckend; der Untergrund scheint durch.
 *   Genau das ist die Gefahr: die Spielerfarben sind auf größten CIELAB-
 *   Abstand über normales Sehen, Deuteranopie und Protanopie gerechnet, und
 *   eine durchscheinende Figur nimmt die Farbe des Untergrunds mit an. Auf
 *   Wiese wird jeder Stein grüner, auf Stadtgold jeder gelber. Deshalb
 *   prüft tests/palette.test.mjs nicht die Füllfarbe, sondern die *über
 *   jedem Untergrund des Spiels zusammengerechnete* Erscheinung.
 *
 *   Funkeln. Ein Schliff blitzt dort, wo mehrere Facettenkanten
 *   zusammenlaufen. Die Stellen stehen fest – im Zeichenweg wird nicht
 *   gewürfelt, sonst flackert die Figur bei jedem Bild.
 *
 * Das Rezept steht als reine Rechnung hier und nicht als Zeichencode in
 * render.js, damit die Prüfung ohne Browser läuft. Die Umrisse sind
 * Zeichenketten, keine Path2D.
 */
import { mix, shade } from './palette.js';

/**
 * Heller oder dunkler – aber immer als Skalierung, nie als Mischung ins
 * Weiße.
 *
 * Der Unterschied ist entscheidend: eine Mischung ins Weiße nimmt der Farbe
 * die Sättigung. Eine helle Violett-Facette wurde damit grau, und der Test
 * meldete zu Recht, dass sie näher an der Spielerfarbe Grau lag als an
 * ihrer eigenen. Ein Stein wird an der Lichtseite nicht blass, sondern
 * leuchtender – seine Farbe bleibt, sie wird nur intensiver. Das ist eine
 * Multiplikation aller drei Kanäle, und genau das macht shade().
 */
const heller = (hex, f) => shade(hex, f);

const TAU = Math.PI * 2;

/**
 * Woher das Licht kommt – von oben links, wie überall im Spiel (die Kerze
 * in render/ambience.js, der Schattenwurf der Karten). Im Bildschirm-
 * Koordinatensystem zeigt y nach unten, oben links ist also atan2(−1, −1).
 */
export const LICHT = Math.atan2(-1, -1);

/**
 * Wie weit die hellste und die dunkelste Facette auseinanderliegen.
 *
 * Der erste Anlauf hat hier den Fehler gemacht, den Wert kleinzudrehen, bis
 * der Farbtest hielt – von 0,30 auf 0,125. Der Test hielt dann, aber die
 * Figur war ein flacher Fleck mit ein paar Linien darauf. Ein Schliff lebt
 * genau von diesem Unterschied.
 *
 * Der Denkfehler: der Test hängt am **Mittelwert** der Figur, und der lässt
 * sich zurückrechnen. Aufhellen verschiebt in CIELAB weiter als Abdunkeln
 * um denselben Betrag; deshalb wanderte der Mittelwert mit wachsender
 * Spreizung ins Helle ab. Das wird jetzt hinterher ausgeglichen (siehe
 * `facettenFarben`), und damit ist die Spreizung frei – begrenzt nur noch
 * dadurch, dass jede einzelne Facette erkennbar die Farbe ihres Spielers
 * bleiben muss.
 */
const SPREIZUNG = 0.34;

/** Die Tafel in der Mitte einer Facettengruppe – die flache Fläche obenauf. */
const TAFEL = 0.26;

/**
 * Benachbarte Facetten sind nie exakt gleich geneigt. Kräftig genug, dass
 * zwei nebeneinanderliegende Flächen sich unterscheiden – das ist die
 * hochfrequente Unruhe, an der das Auge einen Schliff erkennt, und sie
 * kostet den Mittelwert nichts, weil sie sich aufhebt.
 */
const WECHSEL = 0.11;

/**
 * Wo der Stein durchsichtig ist – und warum nicht überall.
 *
 * Die naheliegende Lösung war, die ganze Figur durchscheinend zu machen.
 * Gemessen über alle Untergründe des Spiels geht das nicht: schon bei 94 %
 * Deckung fällt das schwächste Farbpaar auf ΔE 22,6, bei 82 % auf 16,6.
 * Die Grenze der Palette liegt bei 25. Der Grund ist einfach – was der
 * Untergrund durchscheinen lässt, färbt *alle* Figuren gleich ein, und
 * damit rücken sie zusammen. Eine durchsichtige Figur ist eine, die man
 * schlechter von der des Mitspielers unterscheidet.
 *
 * Zwei Auswege, und beide kommen aus der Sache selbst.
 *
 * Erstens: ein Stein ist dort durchsichtig, wo er **dünn** ist. Durch die
 * Mitte geht der längste Weg durch das Material; an der Rundiste, wo er
 * ausläuft, sieht man hindurch. Der Kern bleibt deckend und trägt die
 * Farbe, nur der Saum wird ausgedünnt.
 *
 * Zweitens, und das ist der größere Gewinn: durch einen roten Stein sieht
 * man nicht den grünen Untergrund, sondern **rot gefiltertes** Licht. Das
 * ist eine Multiplikation, keine Überblendung. Gemessen über alle
 * Untergründe hält das Filtern den Farbabstand deutlich besser – bei 95 %
 * Deckung ΔE 25,5 statt 23,8. Deshalb wird der durchgelassene Anteil beim
 * Zeichnen multipliziert und nicht überblendet.
 *
 * RAND_TIEFE ist die Breite dieses Saums in Figurenmaßen (die Figur ist
 * 100 hoch), RAND_ABZUG, wieviel Deckung ihm ganz außen fehlt.
 *
 * Der erste Entwurf nahm 7 Einheiten. Das ist zu viel: ein Arm ist nur zehn
 * Einheiten dick, sieben von jeder Seite lassen nichts Deckendes übrig.
 * Gemessen kam eine mittlere Deckung von 0,725 heraus und nur ein Viertel
 * der Fläche voll deckend – die Farbe hing damit doch wieder am Untergrund.
 * Nachgemessen wird das in tests/palette.test.mjs über KERN_ANTEIL.
 */
export const RAND_TIEFE = 2.4;
export const RAND_ABZUG = 0.62;

/**
 * Die Körperteile. Jedes ist ein Bereich der Silhouette mit einem eigenen
 * Schliff: eine Tafel in der Mitte, darum ein Kranz von Facetten.
 *
 *   d       Umriss im Koordinatensystem der Figur (0…100, Höhe 100)
 *   cx,cy   Mittelpunkt des Schliffs
 *   ri,ro   Radius der Tafel und Länge der Facetten
 *   n       Zahl der Facetten im Kranz
 *   dreh    Verdrehung des Kranzes, damit nicht überall dieselbe Kante steht
 *   anteil  ungefährer Flächenanteil – nur für die Prüfung, nicht fürs Bild
 *
 * Die Umrisse greifen über die Silhouette hinaus; beschnitten wird beim
 * Zeichnen. Ihre Kanten liegen auf denselben Punkten wie die Nachbarn,
 * damit keine Lücke bleibt.
 */
export const KOERPER = [
  { name: 'Kopf', anteil: 0.13, cx: 50, cy: 23, ri: 6.5, ro: 30, n: 12, dreh: 0.20,
    d: 'M41.5 37.5 A17 17 0 1 1 58.5 37.5 Q50 42 41.5 37.5 Z' },
  { name: 'Brust', anteil: 0.11, cx: 50, cy: 44, ri: 4.5, ro: 26, n: 10, dreh: 0.45,
    d: 'M41.5 37.5 Q50 42 58.5 37.5 Q62 43.5 65.5 50 Q50 53.5 34.5 50 Q38 43.5 41.5 37.5 Z' },
  { name: 'Bauch', anteil: 0.16, cx: 50, cy: 58, ri: 5.5, ro: 28, n: 11, dreh: 0.10,
    d: 'M34.5 50 Q50 53.5 65.5 50 Q68 58 68.4 66.2 Q50 71.5 31.6 66.2 Q32 58 34.5 50 Z' },
  { name: 'Oberarm links', anteil: 0.10, cx: 30, cy: 52, ri: 4, ro: 26, n: 9, dreh: 0.55,
    d: 'M42.3 38.1 Q32 48 31.6 66.2 L4 52 L-1 -1 Z' },
  { name: 'Unterarm links', anteil: 0.06, cx: 17, cy: 66, ri: 3.5, ro: 22, n: 8, dreh: 0.15,
    d: 'M31.6 66.2 L4 52 L-1 82 Z' },
  { name: 'Oberarm rechts', anteil: 0.10, cx: 70, cy: 52, ri: 4, ro: 26, n: 9, dreh: 0.30,
    d: 'M57.7 38.1 Q68 48 68.4 66.2 L96 52 L101 -1 Z' },
  { name: 'Unterarm rechts', anteil: 0.06, cx: 83, cy: 66, ri: 3.5, ro: 22, n: 8, dreh: 0.65,
    d: 'M68.4 66.2 L96 52 L101 82 Z' },
  { name: 'Bein links', anteil: 0.14, cx: 34, cy: 84, ri: 4.5, ro: 26, n: 10, dreh: 0.25,
    d: 'M50 69 L31 66.6 L-1 66.6 L-1 101 L50 101 Z' },
  { name: 'Bein rechts', anteil: 0.14, cx: 66, cy: 84, ri: 4.5, ro: 26, n: 10, dreh: 0.50,
    d: 'M50 69 L69 66.6 L101 66.6 L101 101 L50 101 Z' },
];

/**
 * Die Facetten eines Körperteils: erst die Tafel, dann der Kranz.
 *
 * @param {object} k Eintrag aus KOERPER.
 * @returns {{d:string, winkel:number|null, ton:number}[]} Umriss als
 *   Pfadangabe, Neigungswinkel (null für die Tafel) und der Ton, der sich
 *   daraus ergibt.
 */
export function facetten(k) {
  const p = (r, a) => [k.cx + r * Math.cos(a), k.cy + r * Math.sin(a)];
  const pfad = (punkte) => 'M' + punkte.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + ' Z';
  const aus = [];

  // Die Tafel ist ein Sechseck, egal wie viele Facetten der Kranz hat. Mit
  // zwölf Ecken war sie faktisch ein Kreis, und ein Kreis mitten im Schliff
  // sieht aus wie ein aufgesetzter Knopf.
  const ecken = Math.min(6, k.n);
  const tafel = [];
  for (let i = 0; i < ecken; i++) tafel.push(p(k.ri, k.dreh + (i / ecken) * TAU));
  aus.push({ d: pfad(tafel), winkel: null, ton: TAFEL });

  // Zwei Kränze, gegeneinander versetzt – ein Brillantschliff hat eine
  // Krone und darunter das Unterteil, und die Kanten der beiden treffen
  // sich auf Lücke. Ein einzelner Kranz aus langen Keilen sieht aus wie ein
  // Spinnennetz, nicht wie ein Stein.
  const KRAENZE = [
    { von: k.ri, bis: k.ri + (k.ro - k.ri) * 0.42, ab: 0, kipp: 0.55 },
    { von: k.ri + (k.ro - k.ri) * 0.42, bis: k.ro, ab: 0.5, kipp: 1.0 },
  ];
  for (const kranz of KRAENZE) {
    for (let i = 0; i < k.n; i++) {
      const a0 = k.dreh + ((i + kranz.ab) / k.n) * TAU;
      const a1 = k.dreh + ((i + 1 + kranz.ab) / k.n) * TAU;
      const mitte = (a0 + a1) / 2;
      // Lambert: die Facette ist am hellsten, wenn ihre Normale zum Licht
      // zeigt. Der innere Kranz steht flacher und schwankt deshalb weniger.
      // Die Schattenseite fällt flacher aus als die Lichtseite steigt. Ein
      // Stein sammelt auch im Schatten noch Licht aus dem Inneren ein –
      // und ohne diese Bremse rutscht eine dunkle Blau-Facette in die Nähe
      // von Violett, wie der Test gemeldet hat.
      const roh = SPREIZUNG * kranz.kipp * Math.cos(mitte - LICHT);
      const ton = (roh < 0 ? roh * 0.62 : roh) + (i % 2 ? -WECHSEL : WECHSEL);
      aus.push({
        d: pfad([p(kranz.von, a0), p(kranz.bis, a0), p(kranz.bis, a1), p(kranz.von, a1)]),
        winkel: mitte, ton,
      });
    }
  }
  return aus;
}

/**
 * Die Farbe einer Facette.
 *
 * Dunklere Facetten sind zugleich gesättigter: in einem Stein ist der Weg
 * durch das Material dort länger, und lange Wege färben kräftiger. Ohne das
 * sehen die Schattenfacetten nach grauem Kunststoff aus.
 */
export function facettenTon(color, ton) {
  const grund = heller(color, ton);
  return ton < 0 ? mix(grund, color, 0.45) : grund;
}

const rgbRoh = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexRoh = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v)))
  .toString(16).padStart(2, '0')).join('');

/**
 * Alle Facettenfarben der Figur, in Zeichenreihenfolge – mit
 * zurückgerechnetem Mittelwert.
 *
 * Aufhellen verschiebt eine Farbe weiter als Abdunkeln um denselben Betrag.
 * Ohne Ausgleich wandert der Mittelwert der Figur deshalb mit wachsender
 * Spreizung ins Helle ab: bei 0,30 waren es ΔE 14 von der Spielerfarbe weg,
 * und aus Rot wurde ein Lachsrosa. Der erste Anlauf hat daraufhin die
 * Spreizung kleingedreht und die Figur flachgemacht.
 *
 * Richtig ist, den Versatz hinterher abzuziehen: die Facetten werden so
 * verschoben, dass ihr flächengewichteter Mittelwert genau auf der
 * Spielerfarbe liegt. Damit ist die Spreizung frei, und begrenzt wird sie
 * nur noch dadurch, dass jede einzelne Facette erkennbar die Farbe ihres
 * Spielers bleibt – was tests/palette.test.mjs Facette für Facette prüft.
 */
const farbCache = new Map();
export function glasToene(color) {
  const hit = farbCache.get(color);
  if (hit) return hit;

  const roh = [], gewicht = [];
  for (const k of KOERPER) {
    const fs = facetten(k);
    for (const f of fs) { roh.push(rgbRoh(facettenTon(color, f.ton))); gewicht.push(k.anteil / fs.length); }
  }
  const summe = gewicht.reduce((a, b) => a + b, 0);
  const mittel = [0, 1, 2].map((i) => roh.reduce((a, c, j) => a + c[i] * gewicht[j], 0) / summe);
  const soll = rgbRoh(color);
  const versatz = [0, 1, 2].map((i) => soll[i] - mittel[i]);

  const aus = roh.map((c) => hexRoh([0, 1, 2].map((i) => c[i] + versatz[i])));
  farbCache.set(color, aus);
  return aus;
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = ([r, g, b]) => '#' + [r, g, b]
  .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/**
 * Der Farbeindruck der fertigen Figur: die Facetten nach Fläche gemittelt.
 * Innerhalb eines Körperteils zählt jede Facette gleich viel – die Tafel
 * ist kleiner, dafür liegt sie mittig und fällt stärker auf.
 */
export function glasMittel(color) {
  const toene = glasToene(color);
  let r = 0, g = 0, b = 0, summe = 0, i = 0;
  for (const k of KOERPER) {
    const fs = facetten(k);
    const teil = k.anteil / fs.length;
    for (let j = 0; j < fs.length; j++, i++) {
      const c = rgb(toene[i]);
      r += c[0] * teil; g += c[1] * teil; b += c[2] * teil;
      summe += teil;
    }
  }
  return hex([r / summe, g / summe, b / summe]);
}

/**
 * Wie die Figur über einem Untergrund erscheint – das ist die Farbe, die
 * ein Spieler wirklich sieht, und die Größe, die gegen die Palettengrenzen
 * laufen muss. Ein durchscheinender Stein hat keine eigene Farbe mehr,
 * sondern eine je Untergrund.
 *
 * @param {string} color Spielerfarbe.
 * @param {string} untergrund Farbe darunter.
 * @param {number} [deckung] 0…1; ohne Angabe die des Spiels.
 */
export function ueberGrund(color, untergrund, deckung = DECKUNG) {
  const v = rgb(glasMittel(color)), u = rgb(untergrund);
  return hex([0, 1, 2].map((i) => v[i] * deckung + u[i] * (1 - deckung)));
}
