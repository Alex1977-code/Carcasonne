// ============================================================
// Carcassonne Mobile – Rendering (prozedurale Kartengrafik)
// Detailreiche, handgezeichnet wirkende Kacheln: Städte mit
// Häusern und Zinnenmauern, strukturierte Wiesen, Wasser mit
// Glanzlicht, Holztisch mit Vignette und weiche Schatten.
// ============================================================
import { DEFS } from '../engine/tiles.js';
import { find } from '../engine/game.js';
import { drawFields } from './render/fields.js';
import { adaptTile } from './render/adapt-tiles.js';
import { meepleRings } from './render/meeple-colors.js';
import { SCHEIBEN as SCHEIBEN_ROH, RUTEN, BLEI, scheibenTon } from './render/glass.js';
import { PALETTE, shade as pshade, withAlpha, mix } from './render/palette.js';
import { candleAt, paintTable, paintSheen, paintCandleLight, shadowOffset } from './render/ambience.js';
import { paintingFor, loadPaintings, onPaintingLoaded } from './render/paintings.js';
import { drawTown } from './render/buildings.js';
import { drawMonastery, drawCathedral } from './render/landmarks.js';
import { registerLayer, renderTile } from './render/layers.js';
import { TileCache } from './render/cache.js';
import { LOD, LOD_ORDER, lodFor, renderSizeFor, detailLevel, hairline, EDGE } from './render/contract.js';
import { variantOf, VARIANT_COUNT } from './render/rng.js';

// ---------- Hilfen ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rotPoint([x, y], rot) {
  for (let i = 0; i < rot; i++) { const t = x; x = 1 - y; y = t; }
  return [x, y];
}

// Farbe aufhellen (f>0) oder abdunkeln (f<0). Rückgabe als Hex, damit sich
// das Ergebnis weiterverrechnen lässt – mix() aus palette.js liest Hex.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  const z = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${z(r)}${z(g)}${z(b)}`;
}

const EDGE_MID = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

// ---------- Meeple ----------
// §6: ein geschlossener Pfad aus Bézier-Kurven, kein Rechteck, keine harte
// Ecke. Kopf r ≈ 0,17 der Höhe, Halsübergang tangential (kein Einschnitt),
// Arme als konvexe Bögen mit runden Enden, Beinzwischenraum als U mit
// Radius statt V-Kerbe, Fußlinie leicht nach außen gewölbt.
// Koordinatensystem 0…100, Figurenhöhe 100.
const MEEPLE_PATH = new Path2D(
  // Kopf: Kreis r = 17 um (50, 23), tangential in die Schulter auslaufend
  'M50 6 ' +
  'C59.4 6 67 13.6 67 23 ' +
  'C67 29.6 63.2 35.3 57.7 38.1 ' +
  // rechte Schulter, tangential angesetzt
  'C64.6 40.3 71.2 44.1 77.4 49.4 ' +
  // rechter Arm: konvexer Bogen mit rundem Ende
  'C85.6 56.4 90.6 62.1 92.4 66.5 ' +
  'C94.4 71.4 91.4 75.4 86.6 74.6 ' +
  'C81.2 73.7 74.6 70.6 68.4 66.2 ' +
  // Übergang zur Hüfte
  'C69.6 76.4 72.6 86.4 77.3 94.4 ' +
  'C79.1 97.5 77.4 99.6 74.2 99.6 ' +
  'L60.2 99.6 ' +
  'C57.2 99.6 55.3 97.9 54.7 94.9 ' +
  // Beinzwischenraum: U-Form mit Radius, keine V-Kerbe
  'C53.9 90.9 52.4 88.4 50 88.4 ' +
  'C47.6 88.4 46.1 90.9 45.3 94.9 ' +
  'C44.7 97.9 42.8 99.6 39.8 99.6 ' +
  'L25.8 99.6 ' +
  'C22.6 99.6 20.9 97.5 22.7 94.4 ' +
  'C27.4 86.4 30.4 76.4 31.6 66.2 ' +
  // linker Arm
  'C25.4 70.6 18.8 73.7 13.4 74.6 ' +
  'C8.6 75.4 5.6 71.4 7.6 66.5 ' +
  'C9.4 62.1 14.4 56.4 22.6 49.4 ' +
  'C28.8 44.1 35.4 40.3 42.3 38.1 ' +
  // linke Schulter zurück in den Kopf, tangential
  'C36.8 35.3 33 29.6 33 23 ' +
  'C33 13.6 40.6 6 50 6 Z'
);

// ---------- Bleiglas ----------
//
// Die Figur ist eine Glasscheibe, keine Plastikmarke. Drei Dinge machen den
// Unterschied, und alle drei stehen unten im Code:
//
//   Bleiruten. Die dunklen Stege, die die Scheiben halten. Sie sind das
//   Erste, was man an einem Kirchenfenster erkennt – ohne sie ist es nur
//   eine bunte Fläche. Sie laufen dort, wo die Figur ohnehin Gelenke hat:
//   unter dem Kopf, an den Schultern entlang, um die Hüfte, zwischen den
//   Beinen. Deshalb sitzen die Felder unten auf denselben Ankerpunkten wie
//   die Silhouette und nicht auf frei gewählten.
//
//   Durchlicht statt Auflicht. Vorher lag ein Radialverlauf auf der Figur,
//   als schiene eine Lampe darauf. Glas leuchtet von hinten: in der Mitte
//   einer Scheibe am hellsten, zum Blei hin dunkler. Bei dunklen
//   Spielerfarben muss dieses Leuchten kräftiger sein, sonst bleibt
//   Schwarz eine schwarze Fläche – die Stärke hängt deshalb an der
//   Helligkeit der Farbe.
//
//   Ungleiche Scheiben. Kein Glaser schneidet neun Felder aus derselben
//   Tafel. Kopf, Brust, Bauch, Arme und Beine bekommen leicht verschiedene
//   Tönungen, dazu ein paar Schlieren – Kathedralglas ist nie gleichmäßig.
//
// Der Trennring aus meeple-colors.js bleibt, aber mit fester Rollenteilung:
// die Bleirute ist immer dunkel, der Schein außen immer hell. Vorher hing
// beides an der Füllfarbe. Auf jedem Untergrund trägt damit mindestens
// einer der beiden – helles Blei gibt es nicht.
//
// Formen, Töne und Rutenverlauf stehen in render/glass.js, weil sie als
// reine Rechnung prüfbar sein müssen: das Aufhellen und der Farbstich
// dürfen den Abstand der Spielerfarben nicht auffressen, und das prüft
// tests/palette.test.mjs an der gemalten Figur.
const SCHEIBEN = SCHEIBEN_ROH.map((s) => ({ ...s, p: new Path2D(s.d) }));
const CAME = new Path2D();
for (const d of RUTEN) CAME.addPath(new Path2D(d));

/** Schlieren im Glas. Feste Lagen – im Zeichenweg wird nicht gewürfelt. */
const STREAKS = [
  { d: 'M-12 40 L112 -18', w: 5.0, a: 0.055 },
  { d: 'M-12 58 L112 0',   w: 1.8, a: 0.040 },
  { d: 'M-12 86 L112 26',  w: 3.2, a: 0.050 },
  { d: 'M-12 126 L112 64', w: 6.5, a: 0.038 },
].map((s) => ({ ...s, p: new Path2D(s.d) }));

const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Wahrgenommene Helligkeit 0…1 – entscheidet, wie stark das Glas leuchtet. */
const helligkeit = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// Die fertige Figur je Farbe einmal zeichnen und aufheben. Sie hängt an
// nichts als der Farbe: Größe macht der Aufruf, und die Verläufe wären
// sonst bei zwanzig Gefolgsleuten auf dem Brett vierzig neue Objekte je
// Bild. Gezeichnet wird in einem Kasten von -10 bis 110, damit der Schein
// außen hineinpasst.
const GLAS_KASTEN = 120, GLAS_RAND = 10, GLAS_PX = 288;
const glasCache = new Map();

function glasFigur(color) {
  const hit = glasCache.get(color);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = c.height = GLAS_PX;
  const g = c.getContext('2d');
  const m = GLAS_PX / GLAS_KASTEN;
  g.setTransform(m, 0, 0, m, GLAS_RAND * m, GLAS_RAND * m);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const rings = meepleRings(color);
  const schein = helligkeit(rings.inner) >= helligkeit(rings.outer) ? rings.inner : rings.outer;
  const hell = helligkeit(color);

  // Schein außen: das Licht, das am Blei vorbeigeht. Er ist immer heller
  // als die Füllung und trägt die Silhouette dort, wo das dunkle Blei mit
  // einem dunklen Untergrund verschmilzt.
  g.lineWidth = 13;
  g.strokeStyle = schein;
  g.globalAlpha = 0.55;
  g.stroke(MEEPLE_PATH);
  g.globalAlpha = 1;

  // Grundton: der Rumpf.
  g.fillStyle = color;
  g.fill(MEEPLE_PATH);

  g.save();
  g.clip(MEEPLE_PATH);

  // Die einzelnen Scheiben. Drei Dinge unterscheiden sie: Helligkeit, weil
  // das Licht von oben links kommt; ein kleiner Stich ins Warme oder Kalte,
  // weil kein Glaser sechs Felder aus derselben Tafel schneidet; und ein
  // eigener Lichtpunkt, weil jede Scheibe für sich durchleuchtet wird.
  //
  // Der Stich bleibt klein genug, dass die Spielerfarbe eine Farbe bleibt:
  // die Palette ist auf größten Abstand über Deuteranopie und Protanopie
  // gerechnet, und das darf ein Stilmittel nicht aufweichen.
  //
  // Wie stark das Durchlicht ist, hängt an der Helligkeit der Farbe. Dunkles
  // Glas braucht mehr davon, sonst bleibt Schwarz eine schwarze Fläche –
  // und Schwarz ist eine Spielerfarbe.
  const staerke = 0.09 + (1 - hell) * 0.20;
  for (const sch of SCHEIBEN) {
    g.save();
    g.clip(sch.p);
    g.fillStyle = scheibenTon(color, sch);
    g.fill(MEEPLE_PATH);
    // Linear, nicht radial. Ein Radialverlauf macht aus jeder Scheibe eine
    // Kugel – dann steht da eine Plastikfigur mit Bleirahmen. Eine Scheibe
    // ist flach und wird schräg durchleuchtet: hell an der einen Ecke,
    // dunkel an der gegenüberliegenden, dazwischen gleichmäßig.
    const licht = g.createLinearGradient(sch.mx - sch.r, sch.my - sch.r,
                                         sch.mx + sch.r, sch.my + sch.r);
    licht.addColorStop(0, `rgba(255,251,235,${staerke.toFixed(3)})`);
    licht.addColorStop(0.55, `rgba(255,247,222,${(staerke * 0.30).toFixed(3)})`);
    licht.addColorStop(1, `rgba(28,20,10,${(staerke * 0.34).toFixed(3)})`);
    g.fillStyle = licht;
    g.fill(MEEPLE_PATH);
    // Der Schatten, den die Bleirute auf ihr Glas wirft. Die Hälfte des
    // Strichs fällt aus der Beschneidung heraus, übrig bleibt eine dünne
    // dunkle Kante genau innen an der Rute – daran erkennt man, dass die
    // Scheibe *in* etwas sitzt und nicht aufgemalt ist.
    g.lineWidth = 3.4;
    g.strokeStyle = 'rgba(24,17,8,0.22)';
    g.stroke(sch.p);
    g.restore();
  }

  // Schlieren – Kathedralglas ist nie gleichmäßig.
  for (const s of STREAKS) {
    g.lineWidth = s.w;
    g.strokeStyle = `rgba(255,253,244,${s.a})`;
    g.stroke(s.p);
  }

  // Bleiruten innen, im Schnitt zur Silhouette – sie dürfen nicht
  // überstehen, sonst sehen sie aus wie angeklebte Striche.
  g.lineWidth = 4.6;
  g.strokeStyle = BLEI;
  g.stroke(CAME);
  // Die Lötnaht obenauf: ein Blei ist rund, kein flacher Strich.
  g.lineWidth = 1.1;
  g.strokeStyle = 'rgba(214,200,172,0.22)';
  g.save();
  g.translate(-0.7, -0.8);
  g.stroke(CAME);
  g.restore();
  g.restore();

  // Bleirute außen: die Randfassung. Mittig auf der Silhouette, damit sie
  // wie überall sonst über die Glaskante greift. Schmal halten – der Arm
  // ist nur zehn Einheiten dick, und eine Fassung von sechs frisst ihn auf.
  g.lineWidth = 4.4;
  g.strokeStyle = BLEI;
  g.stroke(MEEPLE_PATH);

  // Ein einzelner Lichtreflex, schmal und schräg – so, wie eine Glasfläche
  // eine Fensterkante spiegelt. Vorher stand hier ein breiter Bogen auf dem
  // Kopf; der machte aus der Kopfscheibe eine Plastikkugel.
  g.save();
  g.clip(MEEPLE_PATH);
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1.7;
  g.beginPath();
  g.moveTo(41, 14);
  g.lineTo(35.5, 26);
  g.moveTo(25, 55);
  g.lineTo(17, 64);
  g.stroke();
  g.restore();

  glasCache.set(color, c);
  return c;
}

export function drawMeeple(ctx, x, y, size, color, { big = false, shadow = true } = {}) {
  const s = size * (big ? 1.45 : 1);

  // Kontaktschatten: flache Ellipse direkt unter den Füßen, kein Vollkreis.
  // Er steht außerhalb der aufgehobenen Figur, weil nicht jeder Aufruf ihn
  // will – die Auswahlmarken zeichnen ohne.
  if (shadow) {
    ctx.save();
    ctx.translate(x - s / 2, y - s / 2);
    ctx.scale(s / 100, s / 100);
    ctx.beginPath();
    ctx.ellipse(52, 99, 30, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59,46,34,0.30)';
    ctx.fill();
    ctx.restore();
  }

  const bild = glasFigur(color);
  const k = (GLAS_KASTEN / 100) * s;
  ctx.drawImage(bild, x - s / 2 - (GLAS_RAND / 100) * s, y - s / 2 - (GLAS_RAND / 100) * s, k, k);
}

// ---------- Kartengrafik ----------
// Gezeichnet wird über die Layer-Registry: die Reihenfolge steht in
// layers.js (LAYER_ORDER) und nicht mehr im Aufrufverlauf. Jeder Layer
// bekommt einen eigenen Zufallsstrom, dadurch verschiebt eine Änderung an
// einem Layer die Details der übrigen nicht mehr.
//
// Der Cache hält Motiv × Rotation × Detailstufe mit harter Obergrenze
// (LRU). Bisher wuchs er unbegrenzt: 49 Motive × 4 Drehungen à 192 px
// waren rund 29 MB, die nie wieder freigegeben wurden.
export const ART_SIZE = renderSizeFor(LOD.LARGE);

/**
 * Der Cache des Pakets deckelt die Anzahl der Einträge. Das genügt hier
 * nicht: eine Kachel der Stufe „large“ ist bei dpr 2 rund 1 MB, 240 davon
 * wären über 250 MB. Deshalb zusätzlich eine Speicherobergrenze – verdrängt
 * wird wie gehabt der am längsten ungenutzte Eintrag.
 */
class BudgetedTileCache extends TileCache {
  constructor({ maxBytes = 40 * 1024 * 1024, ...rest } = {}) {
    super(rest);
    this.maxBytes = maxBytes;
  }

  _evict() {
    super._evict();
    while (this.entries.size > 1 && this.estimatedBytes() > this.maxBytes) {
      let oldestKey = null, oldest = Infinity;
      for (const [k, v] of this.entries) {
        if (v.lastUsed < oldest) { oldest = v.lastUsed; oldestKey = k; }
      }
      if (oldestKey === null) break;
      this.entries.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

const tileCache = new BudgetedTileCache({
  maxEntries: 600,
  maxBytes: 40 * 1024 * 1024,
  budgetPerFrame: 3,
  dpr: Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1),
});

export { tileCache };

// Renderer-Sicht auf ein Motiv, einmal je Kartentyp abgeleitet
const tileViewCache = new Map();
function tileView(defId) {
  let v = tileViewCache.get(defId);
  if (!v) {
    const def = DEFS[defId];
    v = { ...adaptTile(def), def, engineId: defId };
    tileViewCache.set(defId, v);
  }
  return v;
}

// Zeichnet eine Kachel in normierte Koordinaten (der Cache setzt den
// Transform und klippt bereits auf das Einheitsquadrat).
function drawTileJob(ctx, job) {
  const view = tileView(job.tileTypeId);

  // Liegt für dieses Motiv eine gemalte Karte vor, ist sie das Bild –
  // gedreht wie die gezeichnete, sonst stimmten die Ränder nicht.
  const gemalt = paintingFor(job.tileTypeId);
  if (gemalt) {
    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.rotate(job.rotation * Math.PI / 2);
    ctx.translate(-0.5, -0.5);
    // Eine Spur über das Einheitsquadrat hinaus: beim Herunterskalieren
    // franst der äußerste Bildpunkt sonst zur Kachelfuge hin aus.
    ctx.drawImage(gemalt, -0.004, -0.004, 1.008, 1.008);
    ctx.restore();
    return;
  }

  ctx.save();
  // Gedreht wird die Leinwand; die Layer arbeiten dadurch durchgehend im
  // Koordinatensystem der Kartendefinition. canvasRot sagt dem Dekor, wie
  // weit es gegendrehen muss, damit es aufrecht bleibt.
  ctx.translate(0.5, 0.5);
  ctx.rotate(job.rotation * Math.PI / 2);
  ctx.translate(-0.5, -0.5);
  renderTile(ctx, {
    tile: { ...view, canvasRot: job.rotation },
    variant: job.variant,
    rotation: 0,
    lod: job.lod,
  });
  ctx.restore();
}

/**
 * Welche Dekorations-Variante zeigt die Kachel an dieser Stelle?
 * Die Instanz-Id kommt aus dem Spielzustand (Position auf dem Brett), nie
 * aus der Renderreihenfolge – nur so sieht die Karte bei allen Mitspielern
 * gleich aus, auch wenn sie in anderer Reihenfolge gezeichnet wird.
 */
// Die gemalten Karten so früh wie möglich anfordern: wer erst beim ersten
// Zeichnen lädt, zeigt am Anfang durchweg die gezeichnete Fassung und
// tauscht sie dann sichtbar aus.
loadPaintings();
// Trifft eine Malerei nachträglich ein, muss die gezeichnete Fassung aus
// dem Zwischenspeicher – sonst bliebe sie bis zum Neustart stehen.
onPaintingLoaded((id) => tileCache.dropMotif(id));

export function tileVariantAt(x, y) {
  return variantOf(`${x},${y}`);
}

/** Fertiges Bitmap für Motiv/Drehung/Stufe – rendert notfalls sofort. */
export function tileArt(defId, rot = 0, lod = LOD.LARGE, variant = 0) {
  const hit = tileCache.get(defId, variant, rot, lod);
  if (hit) return hit;
  tileCache.request(defId, variant, rot, lod, 100);
  const budget = tileCache.budgetPerFrame;
  tileCache.budgetPerFrame = 1;
  const wasFrozen = tileCache.frozen;
  tileCache.frozen = false;
  tileCache.drainBudget(drawTileJob);
  tileCache.budgetPerFrame = budget;
  tileCache.frozen = wasFrozen;
  return tileCache.get(defId, variant, rot, lod);
}

/**
 * Bestes vorhandenes Bitmap; fehlt die Stufe, wird sie angefordert und
 * solange eine gröbere gezeigt. Nur wenn gar nichts da ist, wird sofort
 * gerendert – ein leeres Brett wäre schlimmer als ein kurzer Ruckler.
 */
function tileArtProgressive(defId, rot, lod, variant = 0) {
  const fallback = LOD_ORDER.filter((l) => l !== lod)
    .sort((a, b) => Math.abs(detailLevel(a) - detailLevel(lod)) - Math.abs(detailLevel(b) - detailLevel(lod)));
  const best = tileCache.getBestAvailable(defId, variant, rot, lod, fallback);
  if (best.canvas) {
    if (!best.exact) tileCache.request(defId, variant, rot, lod, 5);
    return best.canvas;
  }
  return tileArt(defId, rot, lod, variant);
}

// Kachelrand ohne Raster: Ein gerichtetes Relief (hell oben/links, dunkel
// unten/rechts) ergibt über mehrere Karten hinweg ein Gitter – besonders
// sichtbar auf einer zusammengesetzten Stadt. Deshalb eine einzige, gleich
// helle Haarlinie, die an Stadtkanten ganz abbricht und an Straßen und
// Flüssen die Anschlussbreite frei lässt.
const BORDER_GAP = { R: 0.16, W: 0.2 };

function paintTileBorder(ctx, d) {
  const w = hairline(ctx, 1);
  const inset = w / 2;
  // Punkt auf der Kante bei Anteil t (normierte Koordinaten)
  const at = (dir, t) => {
    if (dir === 0) return [t, inset];
    if (dir === 1) return [1 - inset, t];
    if (dir === 2) return [t, 1 - inset];
    return [inset, t];
  };
  ctx.save();
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(52,34,16,0.3)';
  for (let dir = 0; dir < 4; dir++) {
    const type = d.edges[dir];
    if (type === 'C') continue;                   // Stadt: Mauer trägt die Kante
    const gap = BORDER_GAP[type] || 0;            // Straße/Fluss: Anschluss frei
    const spans = gap > 0
      ? [[0, 0.5 - gap / 2], [0.5 + gap / 2, 1]]
      : [[0, 1]];
    for (const [a, b] of spans) {
      const p0 = at(dir, a), p1 = at(dir, b);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Radius um einen Meeple-Setzpunkt, der frei von unruhigem Dekor bleibt
// (Regel 7: dort muss der lokale Kontrast niedrig bleiben).
const MEEPLE_KEEPOUT = 0.13;

// Der Kantenvertrag kennt nur die Sperrzonen an den Kanten. Der Spiel-Renderer
// weiß genauer, wo Stadtfläche und Wahrzeichen liegen – dieser Ausschluss
// verhindert Äcker, die halb unter der Stadtmauer oder dem Kloster hervorsehen.
function fieldAvoider(ctx, d) {
  const regions = d.f.filter((f) => f.t === 'city').map((f) => cityPaths(f.e).region);
  const spots = [];
  for (const f of d.f) {
    if (f.t === 'mon') spots.push({ x: f.spot[0], y: f.spot[1], r: 0.34 });
    if (f.t === 'road' && f.inn) {
      spots.push({ x: Math.min(0.8, f.spot[0] + 0.17), y: Math.max(0.2, f.spot[1] - 0.15), r: 0.2 });
    }
    // Regel 7: wo ein Meeple stehen kann, bleibt der Untergrund ruhig
    if (f.spot) spots.push({ x: f.spot[0], y: f.spot[1], r: MEEPLE_KEEPOUT });
  }
  if (!regions.length && !spots.length) return null;
  const M = ctx.getTransform();
  const inCity = (x, y) => {
    if (!regions.length) return false;
    const pt = M.transformPoint(new DOMPoint(x, y));
    return regions.some((rg) => ctx.isPointInPath(rg, pt.x, pt.y));
  };
  return (x, y, r) => {
    const probes = [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]];
    for (const [dx, dy] of probes) if (inCity(x + dx, y + dy)) return true;
    return spots.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r);
  };
}

// ---------- Layer ----------
// Die Reihenfolge steht in LAYER_ORDER (layers.js). Jeder Layer bekommt
// seinen eigenen Zufallsstrom über rng.fork(name) – deshalb hier immer
// rnd() aus dem übergebenen Strom und nirgends Math.random().
const streamOf = (rng) => () => rng.next();

registerLayer('meadow', (ctx, { tile, rng }) => {
  paintGrass(ctx, streamOf(rng));
});

// fields.js registriert den Layer bereits mit dem Kantenvertrag. Der
// Spiel-Renderer kennt zusätzlich die exakte Stadtfläche und die
// Wahrzeichen und überschreibt die Registrierung deshalb hier.
registerLayer('fields', (ctx, { tile, rng, lod }) => {
  drawFields(ctx, {
    sides: tile.sides,
    rnd: streamOf(rng),
    detail: detailLevel(lod),
    avoid: fieldAvoider(ctx, tile.def),
  });
});

registerLayer('ground', (ctx, { tile, rng, lod }) => {
  const d = tile.def;
  const busyness = d.f.filter((f) => f.t !== 'field').length;
  if (busyness <= 2 && detailLevel(lod) > 0) paintBushes(ctx, streamOf(rng), d);
}, { minLod: LOD.NORMAL });

registerLayer('water', (ctx, { tile, rng }) => {
  const d = tile.def;
  for (const f of d.f) if (f.t === 'river') paintRiver(ctx, d, f, streamOf(rng));
});

registerLayer('roads', (ctx, { tile, rng }) => {
  const d = tile.def;
  for (const f of d.f) if (f.t === 'road') paintRoad(ctx, d, f);
  if (d.f.filter((f) => f.t === 'road').length >= 3) paintPlaza(ctx, streamOf(rng));
});

// Pflaster, Häuser und Mauer entstehen in einem Zug: die Häuser werden auf
// die Stadtfläche geklippt, die Mauer liegt darüber. Ein Aufteilen auf die
// Layer cityPaving / buildings / cityWall würde die Mauer unter die Häuser
// schieben und die Silhouette an der Stadtkante aufbrechen.
registerLayer('cityPaving', (ctx, { tile, rng, lod }) => {
  const d = tile.def;
  for (const f of d.f) if (f.t === 'city') paintCity(ctx, d, f, tile.canvasRot, streamOf(rng), detailLevel(lod));
});

registerLayer('landmarks', (ctx, { tile, rng, lod }) => {
  const d = tile.def;
  const rot = tile.canvasRot;
  const detail = detailLevel(lod);
  const rnd = streamOf(rng);
  // Wahrzeichen werden aufrecht gebaut, unabhängig von der Kacheldrehung
  const upright2 = (draw) => {
    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.rotate(-rot * Math.PI / 2);
    ctx.translate(-0.5, -0.5);
    draw();
    ctx.restore();
  };
  for (const f of d.f) {
    if (f.t !== 'mon') continue;
    // Weg, der am Torbogen münden soll (Südseite bevorzugt)
    const roadFeature = d.f.find((o) => o.t === 'road');
    const roadSide = roadFeature ? roadFeature.e[0] : null;
    upright2(() => drawMonastery(ctx, { sides: tile.sides, rnd, detail, roadSide }));
  }
  for (const f of d.f) {
    if (f.t !== 'city' || !f.cath) continue;
    upright2(() => drawCathedral(ctx, { rnd, detail, centre: f.spot }));
  }
  for (const f of d.f) if (f.t === 'road' && f.inn) paintInn(ctx, f, rot);
});

registerLayer('props', (ctx, { tile, rng }) => {
  paintFlowers(ctx, tile.def, streamOf(rng));
}, { minLod: LOD.NORMAL });

registerLayer('coatOfArms', (ctx, { tile }) => {
  const d = tile.def;
  for (const f of d.f) if (f.t === 'city') paintShields(ctx, f, tile.canvasRot);
});

registerLayer('tileEdge', (ctx, { tile }) => {
  paintTileBorder(ctx, tile.def);
});

// Dekor bleibt aufrecht, egal wie die Karte gedreht liegt
function upright(ctx, x, y, rot, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot * Math.PI / 2);
  draw();
  ctx.restore();
}

// ----- Wiese -----
function paintGrass(ctx, rnd) {
  // Flacher Grundton statt Verlauf: ein gerichteter Verlauf wiederholt sich
  // auf jeder Karte und ergibt über mehrere Karten ein sichtbares Raster.
  // Die Lebendigkeit kommt aus den zufälligen Flecken darunter.
  ctx.fillStyle = '#7cad4b';
  ctx.fillRect(0, 0, 1, 1);
  // weiche Farbflecken für lebendige Fläche
  for (let i = 0; i < 7; i++) {
    const x = rnd(), y = rnd(), r = 0.12 + rnd() * 0.22;
    const p = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    p.addColorStop(0, dark ? 'rgba(48,88,28,0.09)' : 'rgba(215,235,150,0.08)');
    p.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = p;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Grasbüschel
  ctx.lineWidth = 0.006;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = 0.03 + rnd() * 0.94, y = 0.04 + rnd() * 0.94;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(35,70,20,0.13)' : 'rgba(220,240,170,0.19)';
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + b * 0.006, y - 0.012, x + b * 0.012, y - 0.02);
      ctx.stroke();
    }
  }
  // feine Körnung
  for (let i = 0; i < 46; i++) {
    const x = rnd(), y = rnd();
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,220,0.04)' : 'rgba(20,50,10,0.05)';
    ctx.fillRect(x, y, 0.012, 0.012);
  }
}

// §7 Nr. 3: Kronen aus 4–6 Kreisen mit gemeinsamer Schattenseite,
// dazu drei Baumtypen – Laubbaum rund, Spitzbaum schlank, Obstbaum mit Früchten
function paintBushes(ctx, rnd, d) {
  const n = rnd() < 0.55 ? 1 + ((rnd() * 2) | 0) : 0;
  for (let i = 0; i < n; i++) {
    const x = 0.14 + rnd() * 0.72, y = 0.14 + rnd() * 0.72;
    const r = 0.042 + rnd() * 0.022;
    const kind = (rnd() * 3) | 0;
    ctx.beginPath(); ctx.ellipse(x + 0.012, y + r * 0.8, r * 1.1, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59,46,34,0.24)'; ctx.fill();
    if (kind === 1) {
      // Spitzbaum
      ctx.fillStyle = '#3f6b28';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y + r * 0.7);
      ctx.lineTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(150,200,110,0.35)';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y + r * 0.7);
      ctx.lineTo(x, y - r * 1.25);
      ctx.lineTo(x - r * 0.1, y + r * 0.7);
      ctx.closePath(); ctx.fill();
    } else {
      // Krone aus 4–6 Kreisen, Schattenseite unten-rechts
      const lobes = 4 + ((rnd() * 3) | 0);
      for (let l = 0; l < lobes; l++) {
        const a = (l / lobes) * Math.PI * 2 + rnd() * 0.4;
        const dx = Math.cos(a) * r * 0.42, dy = Math.sin(a) * r * 0.36;
        ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = (dx + dy) > 0 ? '#4a7a2c' : '#5e9440';
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.4, r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(225,245,170,0.4)'; ctx.fill();
      if (kind === 2) {
        for (let f = 0; f < 3; f++) {
          ctx.beginPath();
          ctx.arc(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, r * 0.11, 0, Math.PI * 2);
          ctx.fillStyle = '#C0452F'; ctx.fill();
        }
      }
    }
  }
}

// §7 Nr. 2: halbe Dichte, dafür in Gruppen von 3–5 statt einzeln
function paintFlowers(ctx, d, rnd) {
  const groups = d.f.some(f => f.t === 'city') ? 1 : 2;
  for (let g = 0; g < groups; g++) {
    const gx = 0.12 + rnd() * 0.76, gy = 0.12 + rnd() * 0.76;
    const col = ['#ffe28a', '#fff3f3', '#ffb1c1', '#c9a6ff'][(rnd() * 4) | 0];
    const n = 3 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const x = gx + (rnd() - 0.5) * 0.07;
      const y = gy + (rnd() - 0.5) * 0.06;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 0.008, y + Math.sin(a) * 0.008, 0.0055, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.9;
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, 0.0045, 0, Math.PI * 2);
      ctx.fillStyle = '#e8a12c'; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ----- Wege -----
function roadEndpoint(d, edge) {
  const hasMon = d.f.some(f => f.t === 'mon');
  const [mx, my] = EDGE_MID[edge];
  const toC = (t) => [mx + (0.5 - mx) * t, my + (0.5 - my) * t];
  const roadCount = d.f.filter(f => f.t === 'road').length;
  if (roadCount >= 3) return toC(0.86);
  if (hasMon) return toC(0.5);
  const bigCity = d.f.find(f => f.t === 'city' && f.e.length >= 2);
  if (bigCity) return toC(0.55);
  const anyCity = d.f.some(f => f.t === 'city');
  // Sackgasse an einer Stadtkappe führt bis ans Stadttor
  return toC(anyCity ? 1.16 : 0.7);
}

function wayPath(ctx, pts, curved) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3 && curved) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function strokePass(ctx, pts, curved, width, style, dash = null, alpha = 1) {
  ctx.save();
  ctx.lineCap = dash ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.globalAlpha = alpha;
  wayPath(ctx, pts, curved);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function roadPoints(d, f) {
  if (f.e.length === 1) return [EDGE_MID[f.e[0]], roadEndpoint(d, f.e[0])];
  if (f.e.length === 2) return [EDGE_MID[f.e[0]], f.ctrl || [0.5, 0.5], EDGE_MID[f.e[1]]];
  return f.e.map(e => EDGE_MID[e]);
}

function paintRoad(ctx, d, f) {
  const pts = roadPoints(d, f);
  const curved = !!f.ctrl || !(f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1]);
  // Fahrbahnbreite exakt nach Kantenvertrag (EDGE.ROAD_WIDTH = 0.14)
  const W = EDGE.ROAD_WIDTH;
  strokePass(ctx, pts, curved, W * 1.67, 'rgba(60,40,15,0.25)');   // weicher Rand
  strokePass(ctx, pts, curved, W * 1.38, '#7d6543');               // Erdkante
  strokePass(ctx, pts, curved, W, '#e9dcb6');                      // Fahrbahn
  strokePass(ctx, pts, curved, W * 0.83, '#f2e7c6', null, 0.5);    // Licht
  strokePass(ctx, pts, curved, W * 0.17, '#bda379', [0.045, 0.05], 0.9); // Spurrillen
  if (f.e.length === 1 && !d.f.some(x => x.t === 'mon') && !d.f.some(x => x.t === 'city') &&
      d.f.filter(x => x.t === 'road').length < 3) {
    const e = roadEndpoint(d, f.e[0]);
    ctx.beginPath(); ctx.arc(e[0], e[1], 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#e9dcb6'; ctx.fill();
    ctx.lineWidth = 0.014; ctx.strokeStyle = '#7d6543'; ctx.stroke();
    // Poller markieren das Wegende (§7 Nr. 4)
    for (const side of [-1, 1]) {
      const px = e[0] + side * 0.032, py = e[1] + 0.006;
      ctx.beginPath(); ctx.ellipse(px + 0.004, py + 0.012, 0.011, 0.005, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59,46,34,0.28)'; ctx.fill();
      ctx.fillStyle = pshade('#6B4A2F', 0.15);
      ctx.fillRect(px - 0.006, py - 0.018, 0.012, 0.028);
      ctx.fillStyle = pshade('#6B4A2F', -0.25);
      ctx.fillRect(px + 0.001, py - 0.018, 0.005, 0.028);
    }
  }
}

// §7 Nr. 5: Pflaster radial um den Brunnen, zwei Ringe unterschiedlicher
// Steingröße, Brunnen mit Dachgestell
function paintPlaza(ctx, rnd) {
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#e9dcb6'; ctx.fill();
  ctx.lineWidth = 0.014; ctx.strokeStyle = '#7d6543'; ctx.stroke();
  ctx.strokeStyle = 'rgba(140,115,80,0.45)';
  for (const [ring, count, r0, r1] of [[0, 10, 0.055, 0.085], [1, 16, 0.088, 0.118]]) {
    ctx.lineWidth = ring ? 0.004 : 0.005;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.2;
      ctx.beginPath();
      ctx.moveTo(0.5 + Math.cos(a) * r0, 0.5 + Math.sin(a) * r0);
      ctx.lineTo(0.5 + Math.cos(a) * r1, 0.5 + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0.5, 0.5, r1, 0, Math.PI * 2); ctx.stroke();
  }
  // Brunnen mit Dachgestell
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.032, 0, Math.PI * 2);
  ctx.fillStyle = '#93805e'; ctx.fill();
  ctx.beginPath(); ctx.arc(0.5, 0.5, 0.02, 0, Math.PI * 2);
  ctx.fillStyle = '#2b5f95'; ctx.fill();
  ctx.beginPath(); ctx.arc(0.494, 0.494, 0.006, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.strokeStyle = '#6B4A2F'; ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.472, 0.5); ctx.lineTo(0.472, 0.462);
  ctx.moveTo(0.528, 0.5); ctx.lineTo(0.528, 0.462);
  ctx.stroke();
  ctx.fillStyle = '#a8432f';
  ctx.beginPath();
  ctx.moveTo(0.462, 0.462); ctx.lineTo(0.5, 0.438); ctx.lineTo(0.538, 0.462);
  ctx.closePath(); ctx.fill();
}

// ----- Fluss -----
function paintRiver(ctx, d, f, rnd = null) {
  const pts = roadPoints(d, f);
  let curved = !(f.e.length === 2 && (f.e[0] + 2) % 4 === f.e[1]);
  // Fluss weicht einer Stadt auf derselben Karte aus (Bogen ums Ufer)
  const city = d.f.find(x => x.t === 'city');
  if (city && pts.length === 3) {
    pts[1] = [0.5 + (0.5 - city.spot[0]) * 0.55, 0.5 + (0.5 - city.spot[1]) * 0.55];
    curved = true;
  }
  // Wasserbreite exakt nach Kantenvertrag (EDGE.RIVER_WIDTH = 0.18)
  const W = EDGE.RIVER_WIDTH;
  strokePass(ctx, pts, curved, W * 1.89, '#cfc39b');               // Uferband
  strokePass(ctx, pts, curved, W * 1.67, 'rgba(90,80,45,0.35)');   // Uferkante
  strokePass(ctx, pts, curved, W, '#2b5f95');                      // Wasser
  strokePass(ctx, pts, curved, W * 0.73, '#3d78b0');
  strokePass(ctx, pts, curved, W * 0.39, '#5b93c7', null, 0.8);
  // §7 Nr. 6: Glanzband nur auf der lichtzugewandten Seite (oben-links),
  // dazu kleine Kringel nahe dem Ufer
  ctx.save();
  ctx.translate(-W * 0.16, -W * 0.16);
  strokePass(ctx, pts, curved, W * 0.15, '#a7cdec', [0.07, 0.1], 0.5);
  ctx.restore();
  if (pts.length >= 2) {
    const mid = pts.length === 3 ? pts[1] : [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    for (let i = 0; i < 3; i++) {
      const a = rnd() * Math.PI * 2, rr = W * (0.5 + rnd() * 0.35);
      ctx.beginPath();
      ctx.arc(mid[0] + Math.cos(a) * rr, mid[1] + Math.sin(a) * rr, W * 0.08, 0.6, 2.6);
      ctx.strokeStyle = 'rgba(200,230,250,0.45)';
      ctx.lineWidth = 0.005;
      ctx.stroke();
    }
    // Schilfbüschel an zwei bis drei Stellen am Ufer
    for (let i = 0; i < 2 + ((rnd() * 2) | 0); i++) {
      const t = 0.2 + rnd() * 0.6;
      const base = pts.length === 3
        ? [(1 - t) * (1 - t) * pts[0][0] + 2 * (1 - t) * t * pts[1][0] + t * t * pts[2][0],
           (1 - t) * (1 - t) * pts[0][1] + 2 * (1 - t) * t * pts[1][1] + t * t * pts[2][1]]
        : [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t];
      const side = rnd() > 0.5 ? 1 : -1;
      const rx = base[0] + side * W * 0.62, ry = base[1] + side * W * 0.16;
      ctx.strokeStyle = '#4E8438';
      ctx.lineWidth = 0.005;
      ctx.lineCap = 'round';
      for (let b = -2; b <= 2; b++) {
        ctx.beginPath();
        ctx.moveTo(rx + b * 0.006, ry);
        ctx.quadraticCurveTo(rx + b * 0.009, ry - 0.018, rx + b * 0.014, ry - 0.03);
        ctx.stroke();
      }
    }
  }
  rnd = rnd || mulberry(hash(d.id + 'w'));
  if (d.riverStart) {
    const [gx, gy] = pts[1];
    const g = ctx.createRadialGradient(gx, gy, 0.01, gx, gy, 0.14);
    g.addColorStop(0, '#bfe0f7'); g.addColorStop(0.5, '#4179ad'); g.addColorStop(1, '#2b5f95');
    ctx.beginPath(); ctx.arc(gx, gy, 0.135, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 0.02; ctx.strokeStyle = '#cfc39b'; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(gx + Math.cos(a) * 0.145, gy + Math.sin(a) * 0.145, 0.012, 0, Math.PI * 2);
      ctx.fillStyle = '#93805e'; ctx.fill();
    }
  }
  if (d.riverEnd) {
    const g = ctx.createRadialGradient(0.47, 0.5, 0.02, 0.5, 0.55, 0.28);
    g.addColorStop(0, '#6fa5d4'); g.addColorStop(0.6, '#3d78b0'); g.addColorStop(1, '#2b5f95');
    ctx.beginPath(); ctx.ellipse(0.5, 0.55, 0.25, 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cfc39b'; ctx.lineWidth = 0.05; ctx.strokeStyle = '#cfc39b'; ctx.stroke();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.43, 0.48, 0.06, 0.028, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.56, 0.6, 0.035, 0.016, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
}

// ----- Stadt -----
// Einheitliches Geometrie-System, damit Karten in JEDER Kombination
// nahtlos zusammenpassen:
//  - jede Stadtkante ist am Kartenrand auf VOLLER Breite bedeckt
//  - jede Mauer endet exakt in einer Kartenecke und verlässt sie
//    senkrecht zur Kante → Mauern benachbarter Karten fließen ohne
//    Knick ineinander (zwei Kappen ergeben z. B. ein rundes Oval)
function cityPaths(edges) {
  const set = edges.slice().sort((a, b) => a - b);
  let k = 0;
  if (set.length === 1) k = set[0];
  else if (set.length === 2 && (set[1] - set[0]) % 4 === 2) k = set[0];
  else if (set.length === 2) k = (set[1] - set[0] === 1) ? set[1] : 0;
  else if (set.length === 3) {
    const missing = [0, 1, 2, 3].find(e => !set.includes(e));
    k = (missing + 2) % 4;
  }
  const m = new DOMMatrix().translate(0.5, 0.5).rotate(k * 90).translate(-0.5, -0.5);
  const region = new Path2D();
  const walls = new Path2D();
  let hasWall = true;
  const raw = new Path2D();
  const rawWall = new Path2D();
  // dieselben Kurven noch einmal als Zahlen, damit die Zinnen sie abtasten
  // können – Path2D gibt seine Geometrie nicht heraus
  const wallCurves = [];
  if (set.length === 4) {
    raw.rect(-0.02, -0.02, 1.04, 1.04);
    hasWall = false;
  } else if (set.length === 1) {
    // Kappe an N: U-Bogen, senkrecht in den Ecken, Tiefe 0.375
    raw.moveTo(0, -0.02); raw.lineTo(1, -0.02); raw.lineTo(1, 0);
    raw.bezierCurveTo(1, 0.5, 0, 0.5, 0, 0);
    raw.closePath();
    rawWall.moveTo(1, 0); rawWall.bezierCurveTo(1, 0.5, 0, 0.5, 0, 0);
    wallCurves.push([1, 0, 1, 0.5, 0, 0.5, 0, 0]);
  } else if (set.length === 2 && (set[1] - set[0]) % 4 === 2) {
    // Band N-S: volle Breite an beiden Stadtkanten, seitliche
    // Wiesen-Taschen (Tiefe 0.15), senkrecht in allen vier Ecken
    raw.moveTo(0, -0.02); raw.lineTo(1, -0.02); raw.lineTo(1, 0);
    raw.bezierCurveTo(1, 0.33, 0.85, 0.33, 0.85, 0.5);
    raw.bezierCurveTo(0.85, 0.67, 1, 0.67, 1, 1);
    raw.lineTo(1, 1.02); raw.lineTo(0, 1.02); raw.lineTo(0, 1);
    raw.bezierCurveTo(0, 0.67, 0.15, 0.67, 0.15, 0.5);
    raw.bezierCurveTo(0.15, 0.33, 0, 0.33, 0, 0);
    raw.closePath();
    rawWall.moveTo(1, 0);
    rawWall.bezierCurveTo(1, 0.33, 0.85, 0.33, 0.85, 0.5);
    rawWall.bezierCurveTo(0.85, 0.67, 1, 0.67, 1, 1);
    rawWall.moveTo(0, 0);
    rawWall.bezierCurveTo(0, 0.33, 0.15, 0.33, 0.15, 0.5);
    rawWall.bezierCurveTo(0.15, 0.67, 0, 0.67, 0, 1);
    wallCurves.push([1, 0, 1, 0.33, 0.85, 0.33, 0.85, 0.5], [0.85, 0.5, 0.85, 0.67, 1, 0.67, 1, 1],
      [0, 0, 0, 0.33, 0.15, 0.33, 0.15, 0.5], [0.15, 0.5, 0.15, 0.67, 0, 0.67, 0, 1]);
  } else if (set.length === 2) {
    // Ecke N+W: Bogen von SW-Ecke (senkrecht) über (0.56,0.56)
    // zur NO-Ecke (waagerecht)
    raw.moveTo(1, -0.02); raw.lineTo(-0.02, -0.02); raw.lineTo(-0.02, 1);
    raw.lineTo(0, 1);
    raw.bezierCurveTo(0, 0.76, 0.40, 0.72, 0.56, 0.56);
    raw.bezierCurveTo(0.72, 0.40, 0.76, 0, 1, 0);
    raw.closePath();
    rawWall.moveTo(0, 1);
    rawWall.bezierCurveTo(0, 0.76, 0.40, 0.72, 0.56, 0.56);
    rawWall.bezierCurveTo(0.72, 0.40, 0.76, 0, 1, 0);
    wallCurves.push([0, 1, 0, 0.76, 0.40, 0.72, 0.56, 0.56], [0.56, 0.56, 0.72, 0.40, 0.76, 0, 1, 0]);
  } else {
    // 3 Kanten, offen nach S: Wiesen-Tasche unten (Tiefe ~0.285)
    raw.moveTo(-0.02, 1); raw.lineTo(-0.02, -0.02); raw.lineTo(1.02, -0.02);
    raw.lineTo(1.02, 1); raw.lineTo(1, 1);
    raw.bezierCurveTo(1, 0.62, 0, 0.62, 0, 1);
    raw.closePath();
    rawWall.moveTo(1, 1); rawWall.bezierCurveTo(1, 0.62, 0, 0.62, 0, 1);
    wallCurves.push([1, 1, 1, 0.62, 0, 0.62, 0, 1]);
  }
  region.addPath(raw, m);
  walls.addPath(rawWall, m);
  return { region, walls: hasWall ? walls : null, wallCurves, rot: k };
}

const ROOFS = ['#b5502e', '#a34627', '#c2662f', '#8f3d22', '#ad5a35', '#96482a'];

function paintCity(ctx, d, f, rot, rnd, detail = 2) {
  const { region, walls } = cityPaths(f.e);
  // Grundfläche: warmes Pflaster, flach (siehe paintGrass – kein Raster
  // über Kartengrenzen hinweg)
  ctx.fillStyle = '#c0925b';
  ctx.fill(region);
  ctx.save();
  ctx.clip(region);
  // Pflasterkörnung
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 1.04 - 0.02, y = rnd() * 1.04 - 0.02;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,235,200,0.10)' : 'rgba(90,50,20,0.10)';
    ctx.fillRect(x, y, 0.014, 0.014);
  }
  // Dorf statt Streumuster: Gassennetz, Reihenbebauung, Höfe (§3).
  // isPointInPath erwartet Geräte-Koordinaten → von Hand transformieren.
  const M = ctx.getTransform();
  const inside = (x, y) => {
    const pt = M.transformPoint(new DOMPoint(x, y));
    return ctx.isPointInPath(region, pt.x, pt.y);
  };
  // Randreihe darf bis 0.02 an eine durchgehende Stadtkante (§3 A2), damit
  // zusammengesetzte Städte verschmelzen. Umgesetzt als Toleranz: außerhalb
  // der Fläche zählt ein Punkt noch, wenn er dicht an einer Stadtkante liegt.
  const cityEdge = new Set(f.e);
  const edgeInside = (x, y) => {
    if (inside(x, y)) return true;
    const near = [[0, y <= 0.02], [1, x >= 0.98], [2, y >= 0.98], [3, x <= 0.02]];
    return near.some(([side, hit]) => hit && cityEdge.has(side));
  };
  // Das Dorf wird aufrecht gebaut – die Kachel ist gedreht, die Häuser nicht.
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.rotate(-rot * Math.PI / 2);
  ctx.translate(-0.5, -0.5);
  const toTown = (x, y) => rotPoint([x, y], rot);
  drawTown(ctx, {
    inside: (x, y) => { const [px, py] = toTown(x, y); return inside(px, py); },
    edgeInside: (x, y) => { const [px, py] = toTown(x, y); return edgeInside(px, py); },
    rnd,
    detail,
    opts: {
      fortified: f.shield > 0 || d.f.some((o) => o.t === 'road'),
      largeCity: f.e.length >= 3,
      // Bei einer Kathedrale weichen die Häuser: weniger, kleiner, und die
      // Mitte bleibt frei – die Größenhierarchie macht die Wirkung (§5).
      maxHouses: f.cath ? 8 : (f.e.length >= 3 ? 16 : f.e.length === 2 ? 12 : 9),
      houseScale: f.cath ? 0.75 : 1,
      reserved: f.cath ? { x: f.spot[0], y: f.spot[1], r: 0.42 } : null,
    },
  });
  ctx.restore();
  ctx.restore();
  // Stadtmauer (§7 Nr. 10): Mauerband, darauf einzelne Zinnen mit Licht-
  // und Schattenseite, alle rund 25 % ein Mauerturm.
  if (walls) {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(40,25,12,0.32)';
    ctx.lineWidth = 0.078;
    ctx.stroke(walls);
    ctx.strokeStyle = shade(PALETTE.wallShadow, -0.1);
    ctx.lineWidth = 0.058;
    ctx.stroke(walls);
    ctx.strokeStyle = PALETTE.wallStone;
    ctx.lineWidth = 0.042;
    ctx.stroke(walls);
    // Lichtkante oben-links auf dem Mauerband
    ctx.strokeStyle = withAlpha(shade(PALETTE.wallStone, 0.25), 0.7);
    ctx.lineWidth = 0.012;
    ctx.stroke(walls);
    paintBattlements(ctx, f.e, rnd, detail);
    ctx.restore();
  }
}

/**
 * Zinnen und Mauertürme entlang der Stadtmauer. Abgetastet wird der
 * Mauerpfad, damit die Zinnen der Krümmung folgen.
 */
function paintBattlements(ctx, edges, rnd, detail) {
  const pts = wallSamples(edges);
  if (!pts.length) return;
  const step = detail > 1 ? 3 : 5;
  let sinceTower = 0;
  for (let i = 1; i < pts.length - 1; i += step) {
    const p = pts[i];
    const prev = pts[i - 1], next = pts[Math.min(pts.length - 1, i + 1)];
    const a = Math.atan2(next.y - prev.y, next.x - prev.x);
    sinceTower++;
    // alle rund 25 % der Länge ein Mauerturm
    if (sinceTower * step > pts.length * 0.24) {
      sinceTower = 0;
      paintWallTower(ctx, p.x, p.y, detail);
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    const bw = 0.028, bh = 0.03;
    ctx.fillStyle = shade(PALETTE.wallStone, 0.16);       // Lichtseite
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = shade(PALETTE.wallStone, -0.2);       // Schattenseite
    ctx.fillRect(bw * 0.12, -bh / 2, bw * 0.38, bh);
    ctx.restore();
  }
}

function paintWallTower(ctx, x, y, detail) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, 0.042, 0, Math.PI * 2);
  ctx.fillStyle = shade(PALETTE.wallStone, -0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.008, -0.008, 0.032, 0, Math.PI * 2);
  ctx.fillStyle = shade(PALETTE.wallStone, 0.14);
  ctx.fill();
  if (detail > 0) {
    ctx.fillStyle = withAlpha(PALETTE.shadow, 0.6);
    ctx.fillRect(-0.005, -0.012, 0.01, 0.024);
  }
  ctx.restore();
}

/**
 * Punkte entlang der Stadtmauer. Path2D lässt sich nicht abtasten, deshalb
 * liefert cityPaths die Mauer zusätzlich als Kurvenliste.
 */
function wallSamples(edges) {
  const { wallCurves, rot } = cityPaths(edges);
  if (!wallCurves.length) return [];
  const out = [];
  const cos = Math.cos(rot * Math.PI / 2), sin = Math.sin(rot * Math.PI / 2);
  const rotate = (x, y) => ({
    x: 0.5 + (x - 0.5) * cos - (y - 0.5) * sin,
    y: 0.5 + (x - 0.5) * sin + (y - 0.5) * cos,
  });
  for (const c of wallCurves) {
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
      const y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
      out.push(rotate(x, y));
    }
  }
  return out;
}

function paintHouse(ctx, { w, h, roof }) {
  const x = 0, y = 0;
  // Schatten
  ctx.beginPath();
  ctx.ellipse(x + 0.012, y + h * 0.4, w * 0.62, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,20,5,0.28)';
  ctx.fill();
  // Wand
  const wallTop = y - h * 0.08;
  ctx.fillStyle = '#eddcae';
  ctx.fillRect(x - w / 2, wallTop, w, h * 0.5);
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ctx.fillRect(x + w * 0.18, wallTop, w * 0.32, h * 0.5);
  // Dach (zwei Flächen)
  const apexY = y - h * 0.52;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x, wallTop);
  ctx.closePath();
  ctx.fillStyle = shade(roof, 0.12); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x, wallTop);
  ctx.closePath();
  ctx.fillStyle = shade(roof, -0.22); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, wallTop); ctx.lineTo(x, apexY); ctx.lineTo(x + w * 0.6, wallTop);
  ctx.lineWidth = 0.008; ctx.strokeStyle = 'rgba(60,25,10,0.55)'; ctx.stroke();
  // Fenster
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(x - w * 0.16, y + h * 0.05, w * 0.14, h * 0.2);
  ctx.fillStyle = '#f4c95c';
  ctx.fillRect(x + w * 0.08, y + h * 0.02, w * 0.13, h * 0.13);
}

function paintShield(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.9);
    ctx.lineTo(s, -s * 0.9);
    ctx.lineTo(s, s * 0.25);
    ctx.quadraticCurveTo(s, s * 0.85, 0, s * 1.15);
    ctx.quadraticCurveTo(-s, s * 0.85, -s, s * 0.25);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(s * 0.14, s * 0.2);
  path();
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.fill();
  ctx.restore();
  path();
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#4a7ad1');
  g.addColorStop(1, '#27498c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * 0.24;
  ctx.strokeStyle = '#f3e3b8';
  ctx.stroke();
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = 'rgba(90,60,20,0.6)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.2); ctx.lineTo(0, s * 0.38); ctx.lineTo(s * 0.55, -s * 0.2);
  ctx.strokeStyle = '#f3e3b8';
  ctx.lineWidth = s * 0.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.5, s * 0.28, s * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
}

function paintCathedral(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const w = 0.36, h = 0.32;
  ctx.fillStyle = 'rgba(20,10,5,0.3)';
  ctx.beginPath(); ctx.ellipse(0.01, h * 0.46, w * 0.66, 0.055, 0, 0, Math.PI * 2); ctx.fill();
  const wallG = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.4);
  wallG.addColorStop(0, '#f2ead6');
  wallG.addColorStop(1, '#d4c6a4');
  // Schiff
  ctx.fillStyle = wallG;
  ctx.fillRect(-w / 2, -h * 0.18, w, h * 0.56);
  // Türme
  ctx.fillRect(-w / 2 - 0.05, -h * 0.55, 0.1, h * 1.05);
  ctx.fillRect(w / 2 - 0.05, -h * 0.55, 0.1, h * 1.05);
  ctx.fillStyle = 'rgba(120,90,50,0.3)';
  ctx.fillRect(-w / 2 + 0.02, -h * 0.55, 0.03, h * 1.05);
  ctx.fillRect(w / 2 + 0.02, -h * 0.55, 0.03, h * 1.05);
  const spire = (cx, ty) => {
    const sg = ctx.createLinearGradient(cx - 0.06, 0, cx + 0.06, 0);
    sg.addColorStop(0, '#a4523a'); sg.addColorStop(0.5, '#8d3f2c'); sg.addColorStop(1, '#6e2f20');
    ctx.beginPath();
    ctx.moveTo(cx - 0.06, ty); ctx.lineTo(cx, ty - 0.13); ctx.lineTo(cx + 0.06, ty);
    ctx.closePath(); ctx.fillStyle = sg; ctx.fill();
  };
  spire(-w / 2, -h * 0.55);
  spire(w / 2, -h * 0.55);
  // Giebel + Kreuz
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.18); ctx.lineTo(0, -h * 0.58); ctx.lineTo(w / 2, -h * 0.18);
  ctx.closePath(); ctx.fillStyle = '#8d3f2c'; ctx.fill();
  ctx.strokeStyle = '#e8c34e'; ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.58); ctx.lineTo(0, -h * 0.72);
  ctx.moveTo(-0.022, -h * 0.665); ctx.lineTo(0.022, -h * 0.665);
  ctx.stroke();
  // Rosette
  ctx.beginPath(); ctx.arc(0, 0.0, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = '#2f5fb3'; ctx.fill();
  ctx.lineWidth = 0.014; ctx.strokeStyle = '#e8c34e'; ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
    ctx.lineWidth = 0.006; ctx.strokeStyle = '#e8c34e'; ctx.stroke();
  }
  // Portal
  ctx.beginPath();
  ctx.moveTo(-0.04, h * 0.38); ctx.lineTo(-0.04, h * 0.14);
  ctx.arc(0, h * 0.14, 0.04, Math.PI, 0);
  ctx.lineTo(0.04, h * 0.38);
  ctx.closePath();
  ctx.fillStyle = '#553317'; ctx.fill();
  ctx.restore();
}

// Kathedrale zählt zu den Wahrzeichen, Wappen zum Layer coatOfArms –
// deshalb getrennt und nicht mehr in einem gemeinsamen Dekor-Aufruf.
function paintCathedralAt(ctx, f, rot = 0) {
  const [sx, sy] = f.spot;
  upright(ctx, sx, sy - 0.04, rot, () => paintCathedral(ctx, 0, 0));
}

function paintShields(ctx, f, rot = 0) {
  const [sx, sy] = f.spot;
  const s1x = f.cath ? sx - 0.3 : sx - (f.e.length > 1 ? 0.16 : 0.17);
  const s1y = f.cath ? sy : sy - (f.e.length === 1 ? 0.0 : 0.14);
  if (f.shield >= 1) upright(ctx, s1x, s1y, rot, () => paintShield(ctx, 0, 0, 0.058));
  if (f.shield >= 2) upright(ctx, sx + 0.16, sy - 0.14, rot, () => paintShield(ctx, 0, 0, 0.058));
}

// ----- Kloster -----
function paintMonastery(ctx, f, rot = 0) {
  const [cx, cy] = f.spot;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-rot * Math.PI / 2);
  // Hof & Schatten
  ctx.beginPath(); ctx.ellipse(0.012, 0.14, 0.23, 0.075, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,10,5,0.28)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0.06, 0.27, 0.19, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(233,220,182,0.5)'; ctx.fill();
  ctx.setLineDash([0.02, 0.018]);
  ctx.strokeStyle = 'rgba(110,80,50,0.4)'; ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.setLineDash([]);
  // Bäume
  for (const [tx, ty] of [[-0.21, -0.02], [0.22, 0.0]]) {
    ctx.beginPath(); ctx.arc(tx, ty, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#4c7a2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(tx - 0.015, ty - 0.02, 0.028, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,240,160,0.5)'; ctx.fill();
  }
  // Hauptgebäude
  const wallG = ctx.createLinearGradient(0, -0.1, 0, 0.15);
  wallG.addColorStop(0, '#f4ecd8'); wallG.addColorStop(1, '#d9cba6');
  ctx.fillStyle = wallG;
  ctx.fillRect(-0.17, -0.06, 0.34, 0.2);
  // Anbau rechts
  ctx.fillRect(0.13, -0.02, 0.1, 0.16);
  ctx.fillStyle = '#b0492f';
  ctx.beginPath();
  ctx.moveTo(0.12, -0.02); ctx.lineTo(0.18, -0.07); ctx.lineTo(0.24, -0.02);
  ctx.closePath(); ctx.fill();
  // Dach
  const roofG = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
  roofG.addColorStop(0, '#c25b3b'); roofG.addColorStop(0.5, '#a8432f'); roofG.addColorStop(1, '#8c3423');
  ctx.fillStyle = roofG;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.06); ctx.lineTo(0, -0.2); ctx.lineTo(0.2, -0.06);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,190,0.5)';
  ctx.lineWidth = 0.008;
  ctx.beginPath(); ctx.moveTo(-0.19, -0.062); ctx.lineTo(0, -0.196); ctx.stroke();
  // Turm
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(-0.04, -0.32, 0.08, 0.15);
  ctx.fillStyle = 'rgba(120,90,50,0.3)';
  ctx.fillRect(0.012, -0.32, 0.028, 0.15);
  ctx.fillStyle = '#a8432f';
  ctx.beginPath();
  ctx.moveTo(-0.06, -0.32); ctx.lineTo(0, -0.42); ctx.lineTo(0.06, -0.32);
  ctx.closePath(); ctx.fill();
  // Goldenes Kreuz
  ctx.strokeStyle = '#e8c34e';
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(0, -0.42); ctx.lineTo(0, -0.485);
  ctx.moveTo(-0.022, -0.458); ctx.lineTo(0.022, -0.458);
  ctx.stroke();
  // Turmfenster, Tür & Fenster
  ctx.fillStyle = '#5b4526';
  ctx.beginPath();
  ctx.moveTo(-0.016, -0.22); ctx.lineTo(-0.016, -0.27);
  ctx.arc(0, -0.27, 0.016, Math.PI, 0);
  ctx.lineTo(0.016, -0.22);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.03, 0.14); ctx.lineTo(-0.03, 0.03);
  ctx.arc(0, 0.03, 0.03, Math.PI, 0);
  ctx.lineTo(0.03, 0.14);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3f6ea8';
  ctx.fillRect(-0.125, 0.0, 0.038, 0.05);
  ctx.fillRect(0.08, 0.02, 0.032, 0.045);
  ctx.restore();
}

// ----- Wirtshaus -----
function paintInn(ctx, f, rot = 0) {
  const [sx, sy] = f.spot;
  const x = Math.min(0.8, sx + 0.17), y = Math.max(0.2, sy - 0.15);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot * Math.PI / 2);
  ctx.beginPath(); ctx.ellipse(0.008, 0.085, 0.11, 0.03, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,10,5,0.3)'; ctx.fill();
  const wg = ctx.createLinearGradient(0, -0.02, 0, 0.08);
  wg.addColorStop(0, '#f4e6c0'); wg.addColorStop(1, '#dcc999');
  ctx.fillStyle = wg;
  ctx.fillRect(-0.08, -0.02, 0.16, 0.095);
  const rg = ctx.createLinearGradient(-0.1, 0, 0.1, 0);
  rg.addColorStop(0, '#d3683a'); rg.addColorStop(1, '#a84a24');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-0.102, -0.02); ctx.lineTo(0, -0.1); ctx.lineTo(0.102, -0.02);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,30,10,0.5)'; ctx.lineWidth = 0.008;
  ctx.stroke();
  // Tür + leuchtendes Fenster
  ctx.fillStyle = '#5b4526';
  ctx.fillRect(-0.045, 0.018, 0.038, 0.057);
  ctx.fillStyle = '#ffd66b';
  ctx.fillRect(0.012, 0.008, 0.036, 0.034);
  ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 0.005;
  ctx.strokeRect(0.012, 0.008, 0.036, 0.034);
  // Wirtshausschild
  ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(0.105, 0.075); ctx.lineTo(0.105, -0.055); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.105, -0.06, 0.028, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f'; ctx.fill();
  ctx.lineWidth = 0.006; ctx.strokeStyle = '#8a6a30'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0.105, -0.06, 0.012, 0, Math.PI * 2);
  ctx.fillStyle = '#b03636'; ctx.fill();
  ctx.restore();
}

// ============================================================
// Board-Ansicht mit Kamera
// ============================================================
let woodCanvas = null;
function woodPattern(ctx) {
  if (woodCanvas) return ctx.createPattern(woodCanvas, 'repeat');
  const c = document.createElement('canvas');
  c.width = c.height = 360;
  const w = c.getContext('2d');
  const rnd = mulberry(20260730);
  w.fillStyle = '#33261c';
  w.fillRect(0, 0, 360, 360);
  const plank = 90;
  for (let p = 0; p < 4; p++) {
    const x0 = p * plank;
    const base = 0.92 + rnd() * 0.16;
    const g = w.createLinearGradient(x0, 0, x0 + plank, 0);
    g.addColorStop(0, `rgba(70,50,36,${0.5 * base})`);
    g.addColorStop(0.5, `rgba(58,42,30,${0.45 * base})`);
    g.addColorStop(1, `rgba(48,34,24,${0.5 * base})`);
    w.fillStyle = g;
    w.fillRect(x0, 0, plank, 360);
    // Maserung
    for (let i = 0; i < 14; i++) {
      const gx = x0 + 6 + rnd() * (plank - 12);
      w.beginPath();
      w.moveTo(gx, -10);
      let yy = -10;
      let xx = gx;
      while (yy < 370) {
        yy += 24 + rnd() * 26;
        xx = gx + Math.sin(yy * 0.02 + rnd() * 6) * 4;
        w.lineTo(xx, yy);
      }
      w.strokeStyle = rnd() > 0.6 ? 'rgba(20,12,6,0.10)' : 'rgba(120,88,60,0.07)';
      w.lineWidth = 0.8 + rnd() * 1.4;
      w.stroke();
    }
    // Astloch gelegentlich
    if (rnd() < 0.22) {
      const kx = x0 + 15 + rnd() * (plank - 30), ky = rnd() * 360;
      for (let r = 6; r > 0; r -= 1.6) {
        w.beginPath(); w.ellipse(kx, ky, r, r * 1.5, 0.2, 0, Math.PI * 2);
        w.strokeStyle = 'rgba(25,15,8,0.25)'; w.lineWidth = 1; w.stroke();
      }
    }
    // Plankenfuge
    w.fillStyle = 'rgba(15,9,5,0.6)';
    w.fillRect(x0 + plank - 1.2, 0, 2.4, 360);
    w.fillStyle = 'rgba(140,105,70,0.12)';
    w.fillRect(x0 + 1, 0, 1.4, 360);
  }
  woodCanvas = c;
  return ctx.createPattern(c, 'repeat');
}

let shadowSprite = null;
function makeShadowSprite() {
  if (shadowSprite) return shadowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 144;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,0.42)';
  g.shadowBlur = 11;
  g.shadowOffsetY = 3;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(32, 32, 80, 80);
  shadowSprite = c;
  return c;
}

export class BoardView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, scale: 90 };
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.lod = null;          // aktuelle Detailstufe, mit Hysterese
  }

  /** Während einer Zoom-Geste nichts Neues rendern (Nachtrag §10.3). */
  freezeCache() { tileCache.freeze(); }
  thawCache() { tileCache.thaw(); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  worldToScreen(wx, wy) {
    const r = this.canvas.getBoundingClientRect();
    return [
      (wx - this.cam.x) * this.cam.scale + r.width / 2,
      (wy - this.cam.y) * this.cam.scale + r.height / 2,
    ];
  }

  screenToWorld(sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    return [
      (sx - r.width / 2) / this.cam.scale + this.cam.x,
      (sy - r.height / 2) / this.cam.scale + this.cam.y,
    ];
  }

  screenToCell(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    return [Math.round(wx), Math.round(wy)];
  }

  centerOn(state, animate = false) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const k of state.grid.keys()) {
      const [x, y] = k.split(',').map(Number);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const r = this.canvas.getBoundingClientRect();
    const w = maxX - minX + 3, h = maxY - minY + 3;
    const scale = Math.min(140, Math.max(14, Math.min(r.width / w, r.height / h)));
    const tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    if (animate) {
      this.camTarget = { x: tx, y: ty, scale };
    } else {
      this.cam = { x: tx, y: ty, scale };
      this.camTarget = null;
    }
  }

  tick() {
    if (this.camTarget) {
      const t = this.camTarget, c = this.cam, k = 0.16;
      c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.scale += (t.scale - c.scale) * k;
      if (Math.abs(t.x - c.x) < 0.005 && Math.abs(t.scale - c.scale) < 0.3) this.camTarget = null;
      return true;
    }
    return false;
  }

  render(state, view = {}) {
    const ctx = this.ctx;
    const r = this.canvas.getBoundingClientRect();
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const s = this.cam.scale;
    const now = view.now || 0;
    // Die Kerze ist nicht im Bild, ihr Schein aber immer in Bewegung.
    // Bei abgeschalteten Animationen brennt sie ruhig weiter.
    const candle = candleAt(now, view.calm);
    this.candle = candle;

    // Eichentisch: die Textur wandert mit der Kamera, damit das Brett
    // wirklich auf dem Tisch zu liegen scheint und nicht darüber schwebt.
    paintTable(
      ctx, r.width, r.height,
      -this.cam.x * this.cam.scale * 0.12,
      -this.cam.y * this.cam.scale * 0.12,
    );
    // Wachsglanz auf dem blanken Holz – muss unter die Kacheln, sonst
    // glänzt auch die Pappe.
    paintSheen(ctx, r.width, r.height, candle);

    // Kachelschatten: Länge und Richtung folgen dem Kerzenschein
    const sh = makeShadowSprite();
    const shScale = s / 80;
    const so = shadowOffset(candle, s * 0.055);
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      ctx.drawImage(sh, sx - 72 * shScale + so.x, sy - 72 * shScale + so.y, 144 * shScale, 144 * shScale);
    }
    // Karten – Detailstufe folgt der Bildschirmgröße, mit Hysterese
    this.lod = lodFor(s * this.dpr, this.lod);
    for (const [, idx] of state.grid) {
      const p = state.placed[idx];
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      // außerhalb des Sichtfelds nichts anfordern
      if (sx < -s || sy < -s || sx > r.width + s || sy > r.height + s) continue;
      let scale = 1;
      if (view.anim && view.anim.placedIdx === idx) {
        const t = Math.min(1, (now - view.anim.t0) / 260);
        scale = 1 + (1 - t) * 0.25;
        ctx.globalAlpha = 0.4 + 0.6 * t;
      }
      const art = tileArtProgressive(p.defId, p.rot, this.lod, tileVariantAt(p.x, p.y));
      const ds = s * scale;
      ctx.drawImage(art, sx - ds / 2, sy - ds / 2, ds, ds);
      ctx.globalAlpha = 1;
    }
    // Nachgeforderte Stufen in kleinen Portionen nachziehen
    tileCache.drainBudget(drawTileJob);
    // legale Felder: dezente, flache Markierung ohne Leuchten
    if (view.legal) {
      // §7 Nr. 22: nur ein ruhig pulsierender Rand, keine gefüllte Fläche
      const m = s * 0.06;
      const pulse = 0.32 + 0.16 * Math.sin(now / 520);
      for (const c of view.legal) {
        const [sx, sy] = this.worldToScreen(c.x, c.y);
        this.rounded(ctx, sx - s / 2 + m, sy - s / 2 + m, s - 2 * m, s - 2 * m, s * 0.06);
        ctx.strokeStyle = `rgba(255,246,224,${pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Vorschau
    if (view.sel) {
      const { x, y, rot, valid } = view.sel;
      const [sx, sy] = this.worldToScreen(x, y);
      ctx.globalAlpha = 0.93;
      const art = tileArtProgressive(view.sel.defId, rot, this.lod || LOD.NORMAL, tileVariantAt(x, y));
      ctx.drawImage(art, sx - s / 2, sy - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = valid ? 'rgba(130,200,150,0.8)' : 'rgba(220,100,100,0.85)';
      this.rounded(ctx, sx - s / 2 + 1, sy - s / 2 + 1, s - 2, s - 2, s * 0.04);
      ctx.stroke();
    }

    // Meeples
    for (const [, data] of state.roots) {
      for (const m of data.meeples) {
        const p = state.placed[m.placedIdx];
        if (!p) continue;
        const f = DEFS[p.defId].f[m.fi];
        const [lx, ly] = rotPoint(f.spot, p.rot);
        const [sx, sy] = this.worldToScreen(p.x - 0.5 + lx, p.y - 0.5 + ly);
        drawMeeple(ctx, sx, sy, s * 0.34, state.players[m.pl].color, { big: m.big });
      }
    }

    // Meeple-Auswahlpunkte.
    //
    // Die Scheibe trägt die Farbe des Bauteils, auf das der Gefolgsmann
    // käme. Vorher war jede Marke gleich weiß, und dann ist nicht zu
    // erkennen, welche für die Stadt und welche für die Wiese steht –
    // schlimmer noch: auf Motiv F liegen alle drei Punkte übereinander in
    // der Mittelspalte, die mittlere davon auf dem Stadtband, und die
    // weiße Scheibe verdeckt genau die Stadt, für die sie steht.
    // Besetzte Gebiete: erst, damit eine freie Marke darüber liegt, wenn
    // die beiden sich trotz Spreizen noch berühren. Gedämpft und in der
    // Farbe dessen, dem das Gebiet gehört, mit einem Riegel darüber – wer
    // hier hinlangt, soll sehen, dass es nicht am Spiel liegt.
    if (view.meepleBesetzt) {
      for (const spot of view.meepleBesetzt) {
        const [sx, sy] = this.worldToScreen(spot.wx, spot.wy);
        const rad = s * 0.15;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(38,30,22,0.86)';
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, s * 0.014);
        ctx.strokeStyle = spot.color;
        ctx.stroke();
        drawMeeple(ctx, sx, sy, s * 0.17, spot.color, { shadow: false });
        // Der Riegel: ein Schrägstrich, wie er auf Verbotsschildern steht.
        ctx.beginPath();
        ctx.moveTo(sx - rad * 0.72, sy + rad * 0.72);
        ctx.lineTo(sx + rad * 0.72, sy - rad * 0.72);
        ctx.lineWidth = Math.max(2, s * 0.022);
        ctx.strokeStyle = 'rgba(248,242,232,0.92)';
        ctx.stroke();
        ctx.lineWidth = Math.max(1, s * 0.010);
        ctx.strokeStyle = 'rgba(40,26,16,0.9)';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (view.meepleSpots) {
      for (const spot of view.meepleSpots) {
        const [sx, sy] = this.worldToScreen(spot.wx, spot.wy);
        const pulse = 1 + 0.08 * Math.sin(now / 250 + sx);
        const f = SPOT_FARBEN[spot.t] || SPOT_FARBEN.field;
        ctx.beginPath();
        ctx.arc(sx, sy + 2, s * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,10,20,0.35)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = f.fuell;
        ctx.fill();
        // Heller Innenring: hebt die Marke von der Karte ab, auch wenn sie
        // in derselben Farbe darauf liegt.
        ctx.lineWidth = Math.max(1.5, s * 0.012);
        ctx.strokeStyle = 'rgba(255,252,244,0.85)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.17 * pulse + ctx.lineWidth, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.5, s * 0.01);
        ctx.strokeStyle = f.rand;
        ctx.stroke();
        drawMeeple(ctx, sx, sy, s * 0.2, spot.color, { shadow: false });
      }
    }

    // Kerzenschein über die ganze Szene – erst hier, damit auch die
    // Kacheln im Licht liegen und die Ränder wirklich dunkel werden.
    paintCandleLight(ctx, r.width, r.height, candle);

    // Punkte-Floater
    if (view.floaters) {
      for (const f of view.floaters) {
        const age = (now - f.t0) / 1600;
        if (age > 1) continue;
        const [sx, sy] = this.worldToScreen(f.x, f.y);
        ctx.globalAlpha = 1 - age * age;
        ctx.font = `800 ${Math.max(17, s * 0.36)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(15,15,25,0.9)';
        ctx.strokeText(f.text, sx, sy - age * s * 0.8);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy - age * s * 0.8);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// Vorschau-Canvas (HUD) füllen
export function drawPreview(canvas, defId, rot) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!defId) return;
  const art = tileArt(defId, rot, LOD.LARGE);
  ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
}

/**
 * Farbe der Auswahlmarke je Bauteil. Genommen aus den gemalten Karten:
 * Stadtgold, Wegelfenbein, Wiesengrün, Klosterlapis.
 */
const SPOT_FARBEN = {
  city: { fuell: 'rgba(214,166,43,0.95)', rand: 'rgba(92,66,12,0.9)' },
  road: { fuell: 'rgba(238,229,206,0.95)', rand: 'rgba(120,102,66,0.9)' },
  field: { fuell: 'rgba(62,138,58,0.95)', rand: 'rgba(24,64,22,0.9)' },
  mon: { fuell: 'rgba(46,79,166,0.95)', rand: 'rgba(18,34,80,0.9)' },
};

// Meeple-Punkte in Weltkoordinaten für die Auswahlphase
export function meepleSpotWorld(state, opt) {
  const p = state.placed[state.lastPlacedIdx];
  const [lx, ly] = rotPoint(opt.spot, p.rot);
  return { wx: p.x - 0.5 + lx, wy: p.y - 0.5 + ly };
}

export { find };
