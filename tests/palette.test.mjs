// Farbprüfung: node tests/palette.test.mjs
// Spielerfarben müssen bei normalem Sehen, Deuteranopie und Protanopie
// paarweise und gegen jeden Untergrund unterscheidbar bleiben (Nachtrag §15).
import {
  PLAYER_COLORS, PLAYER_COLOR_ALT, MEEPLE_BACKGROUNDS, CONTRAST_LIMITS,
  checkPlayerColors, deltaE, mix, separationRing,
} from '../js/ui/render/palette.js';
import { PLAYER_PALETTE, MEEPLE_SURFACES, meepleRings } from '../js/ui/render/meeple-colors.js';

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

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
