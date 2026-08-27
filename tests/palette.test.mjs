// Farbprüfung: node tests/palette.test.mjs
// Spielerfarben müssen bei normalem Sehen, Deuteranopie und Protanopie
// paarweise und gegen jeden Untergrund unterscheidbar bleiben (Nachtrag §15).
import {
  PLAYER_COLORS, PLAYER_COLOR_ALT, MEEPLE_BACKGROUNDS, CONTRAST_LIMITS,
  checkPlayerColors, deltaE, mix, separationRing,
} from '../js/ui/render/palette.js';
import { PLAYER_PALETTE, MEEPLE_SURFACES, meepleRings } from '../js/ui/render/meeple-colors.js';
import { glasToene, glasMittel, RAND_TIEFE, RAND_ABZUG } from '../js/ui/render/glass.js';
import { FOTO_DECKUNG } from '../js/ui/render/figures.js';

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL:', msg); }
}

// ---------- 1. Die sechs Spielerfarben ----------
{
  const res = checkPlayerColors();
  const worstPair = res.pairs.reduce((a, p) => Math.min(a, p.min), Infinity);
  const worstBg = res.backgrounds.reduce((a, b) => Math.min(a, b.min), Infinity);
  for (const p of res.pairs) {
    ok(p.passed, `Paar ${p.a}/${p.b}: ΔE ${p.min.toFixed(1)} < ${CONTRAST_LIMITS.playerPair}`);
  }
  for (const b of res.backgrounds) {
    ok(b.passed, `${b.color} auf ${b.background}: ΔE ${b.min.toFixed(1)} < ${CONTRAST_LIMITS.background}`);
  }
  ok(res.passed, 'Farbprüfung insgesamt bestanden');
  console.log(`  Sechser-Satz: kleinster Paarabstand ΔE ${worstPair.toFixed(1)}, ` +
    `schwächster Untergrund ΔE ${worstBg.toFixed(1)}`);
}

// ---------- 2. Violett als siebte Farbe ----------
{
  const seven = { ...PLAYER_COLORS, ...PLAYER_COLOR_ALT };
  const res = checkPlayerColors(seven);
  const worstPair = res.pairs.reduce((a, p) => Math.min(a, p.min), Infinity);
  for (const p of res.pairs) {
    ok(p.passed, `Siebener-Paar ${p.a}/${p.b}: ΔE ${p.min.toFixed(1)}`);
  }
  ok(res.passed, 'Siebener-Satz mit Violett bestanden');
  console.log(`  Siebener-Satz: kleinster Paarabstand ΔE ${worstPair.toFixed(1)}`);
}

// ---------- 3. Palette des Spiels = geprüfte Farben ----------
{
  const known = new Set([...Object.values(PLAYER_COLORS), ...Object.values(PLAYER_COLOR_ALT)]
    .map((c) => c.toUpperCase()));
  ok(PLAYER_PALETTE.length === 7, `Spiel bietet 7 Farben (waren ${PLAYER_PALETTE.length})`);
  for (const entry of PLAYER_PALETTE) {
    ok(known.has(entry.hex.toUpperCase()), `${entry.name} (${entry.hex}) stammt aus der geprüften Palette`);
  }
  const hexes = PLAYER_PALETTE.map((e) => e.hex.toUpperCase());
  ok(new Set(hexes).size === hexes.length, 'keine Farbe doppelt');
}

// ---------- 4. Kontur und Halo auf jedem Untergrund des Spiels ----------
{
  let worst = Infinity, worstWhere = '';
  let worstFill = Infinity, worstFillWhere = '';
  for (const entry of PLAYER_PALETTE) {
    const { inner, outer } = meepleRings(entry.hex);
    // Die Silhouette braucht Abstand zur Füllfarbe …
    const toFill = deltaE(inner, entry.hex);
    if (toFill < worstFill) { worstFill = toFill; worstFillWhere = entry.name; }
    ok(toFill >= 12, `Kontur hebt sich von ${entry.name} ab: ΔE ${toFill.toFixed(1)}`);
    // … und die beiden Ringe müssen voneinander unterscheidbar sein
    ok(deltaE(inner, outer) >= 25,
      `${entry.name}: Kontur und Halo unterscheidbar (ΔE ${deltaE(inner, outer).toFixed(1)})`);
    // Auf jedem Untergrundton muss mindestens einer der beiden deutlich sein
    for (const [surface, bgs] of Object.entries(MEEPLE_SURFACES)) {
      for (const bg of bgs) {
        const d = Math.max(deltaE(inner, bg), deltaE(outer, bg));
        if (d < worst) { worst = d; worstWhere = `${entry.name} auf ${surface} (${bg})`; }
        ok(d >= 20, `${entry.name} auf ${surface} (${bg}): bester Ring ΔE ${d.toFixed(1)}`);
      }
    }
  }
  console.log(`  Ringe: schwächster Untergrund ΔE ${worst.toFixed(1)} (${worstWhere})`);
  console.log(`  Ringe: schwächster Abstand zur Füllfarbe ΔE ${worstFill.toFixed(1)} (${worstFillWhere})`);
}

// ---------- 5. separationRing des Pakets bleibt konsistent ----------
{
  for (const [, hex] of Object.entries(PLAYER_COLORS)) {
    for (const [, bg] of Object.entries(MEEPLE_BACKGROUNDS)) {
      const r = separationRing(hex, bg);
      ok(r && (r.kind === 'dunkel' || r.kind === 'hell'), 'separationRing liefert eine Variante');
      ok(deltaE(r.color, bg) >= 20, `separationRing ${hex} auf ${bg}: ΔE ${deltaE(r.color, bg).toFixed(1)}`);
    }
  }
  // Mischung ist monoton – Schutz gegen versehentliches Vertauschen
  ok(deltaE(mix('#FFFFFF', '#000000', 0), '#FFFFFF') < 1, 'mix(t=0) ergibt die erste Farbe');
  ok(deltaE(mix('#FFFFFF', '#000000', 1), '#000000') < 1, 'mix(t=1) ergibt die zweite Farbe');
}

// ---------- 6. Der Schliff frisst den Farbabstand nicht ----------
//
// Die Figur ist ein geschliffener Stein: viele Facetten, jede etwas heller
// oder dunkler, und ein Saum, durch den der Untergrund scheint. Beides ist
// der Stil – und beides kann den Abstand der Spielerfarben auffressen,
// ohne dass es jemandem auffällt.
//
// Gemessen wurde beim Bauen zweierlei:
//
//   Die Spreizung der Facetten. Bei 0,30 lag die gemalte Figur ΔE 14 von
//   ihrer Spielerfarbe entfernt und Grün/Schwarz bei ΔE 22,8.
//
//   Die Durchsicht. Eine gleichmäßig durchscheinende Figur geht gar nicht:
//   was der Untergrund durchscheinen lässt, färbt alle Figuren gleich ein,
//   und damit rücken sie zusammen. Schon bei 94 % Deckung fiel das
//   schwächste Paar auf ΔE 22,6. Deshalb ist der Kern deckend und nur der
//   Saum dünn – und deshalb wird der durchgelassene Anteil *multipliziert*
//   statt überblendet: durch einen roten Stein sieht man rot gefiltertes
//   Licht, nicht den Untergrund. Das allein bringt bei 95 % Deckung ΔE 25,5
//   statt 23,8.
//
// Geprüft wird deshalb die Erscheinung über jedem Untergrund des Spiels,
// nicht die Füllfarbe.
{
  // Aus der gezeichneten Figur gemessen (scratchpad/deckung-messen.mjs):
  // mittlere Deckung innerhalb der Silhouette. Absichtlich pessimistisch
  // eingesetzt – so, als wäre die ganze Figur so dünn wie ihr Mittelwert.
  const GEMESSENE_DECKUNG = 0.95;

  const zahl = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const zurueck = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');

  const mittel = {};
  let schlimmste = 0, wo = '';
  for (const entry of PLAYER_PALETTE) {
    const m = glasMittel(entry.hex);
    mittel[entry.name] = m;
    const ab = deltaE(m, entry.hex);
    if (ab > schlimmste) { schlimmste = ab; wo = entry.name; }
    ok(ab <= 10, `${entry.name}: gemalte Figur ΔE ${ab.toFixed(1)} von der Spielerfarbe entfernt`);
    // Keine einzelne Facette darf für sich schon aussehen wie eine andere
    // Spielerfarbe – sonst greift man am Brett nach dem falschen Kopf.
    for (const ton of glasToene(entry.hex)) {
      for (const fremd of PLAYER_PALETTE) {
        if (fremd.name === entry.name) continue;
        ok(deltaE(ton, fremd.hex) > deltaE(ton, entry.hex),
          `${entry.name}: eine Facette (${ton}) liegt näher an ${fremd.name} als an der eigenen Farbe`);
      }
    }
  }

  // Über jedem Untergrund, auf dem im Spiel eine Figur stehen kann.
  const gruende = [...new Set(Object.values(MEEPLE_SURFACES).flat())];
  let schwaechste = Infinity, schwachWo = '';
  for (const grund of gruende) {
    const drauf = {};
    for (const entry of PLAYER_PALETTE) {
      const v = zahl(mittel[entry.name]), u = zahl(grund);
      drauf[entry.name] = zurueck([0, 1, 2].map((i) =>
        v[i] * GEMESSENE_DECKUNG + (v[i] * u[i] / 255) * (1 - GEMESSENE_DECKUNG)));
    }
    const res = checkPlayerColors(drauf);
    for (const p of res.pairs) {
      if (p.min < schwaechste) { schwaechste = p.min; schwachWo = `${p.a}/${p.b} auf ${grund}`; }
      ok(p.passed, `auf ${grund}, Paar ${p.a}/${p.b}: ΔE ${p.min.toFixed(1)} < ${CONTRAST_LIMITS.playerPair}`);
    }
  }

  // Und der Saum muss ein Saum bleiben. Wer RAND_TIEFE hochdreht, macht die
  // ganze Figur dünn – ein Arm ist nur zehn Einheiten dick, und genau das
  // ist im ersten Entwurf passiert.
  ok(RAND_TIEFE <= 4, `Saum bleibt ein Saum: ${RAND_TIEFE} von 100 Figurenhöhen`);
  ok(RAND_ABZUG <= 0.7, `Saum bleibt nicht ganz durchsichtig: Abzug ${RAND_ABZUG}`);

  // Dasselbe für die fotografierte Figur. Ihre Erscheinung lässt sich hier
  // nicht nachrechnen – die Bilder sind WebP, und Node hat keinen Decoder.
  // Gemessen wird sie mit tools/figuren-pruefen.mjs im Browser; dort kam
  // als Grenze 78 % Deckung heraus (ΔE 25,5 bei Grün/Rot auf der Wiese).
  // Was hier steht, ist der Riegel dagegen, dass jemand die Durchsicht
  // später aufdreht, ohne neu zu messen.
  ok(FOTO_DECKUNG >= 0.78,
    `Foto-Figur bleibt über der gemessenen Grenze: ${FOTO_DECKUNG} < 0,78`);
  ok(FOTO_DECKUNG <= 1, `Deckung ist ein Anteil: ${FOTO_DECKUNG}`);

  console.log(`  Schliff: größte Abweichung von der Spielerfarbe ΔE ${schlimmste.toFixed(1)} (${wo})`);
  console.log(`  Schliff: schwächstes Paar über allen Untergründen ΔE ${schwaechste.toFixed(1)} (${schwachWo})`);
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
