// ============================================================
// Carcassonne Mobile – Computergegner (3 Stärken)
//   ai1 = „Bauer“   (leicht):  zufällige gültige Züge
//   ai2 = „Ritter“  (mittel):  gierige Bewertung mit Rauschen
//   ai3 = „Baumeister“ (schwer): volle Heuristik, blockt Gegner
// ============================================================
import {
  cloneState, legalPlacementsFor, placeCurrent, meepleOptions,
  finishTurn, find,
} from './game.js';

// Erwartete Endpunkte eines Features für seine Mehrheitsbesitzer
function expectedValue(s, data, deckFrac) {
  const n = data.tiles.size;
  if (data.t === 'city') {
    if (data.complete || data.scored) return 0;
    const open = data.open.size;
    let pc = Math.max(0.12, 0.82 - 0.13 * open) * Math.min(1, deckFrac * 3 + 0.15);
    const base = n + data.shields;
    const done = base * (data.cath ? 3 : 2);
    const end = data.cath ? 0 : base;
    return pc * done + (1 - pc) * end;
  }
  if (data.t === 'road') {
    if (data.complete || data.scored) return 0;
    const open = data.open.size;
    let pc = Math.max(0.25, 0.9 - 0.12 * open) * Math.min(1, deckFrac * 3 + 0.2);
    const done = n * (data.inns > 0 ? 2 : 1);
    const end = data.inns > 0 ? 0 : n;
    return pc * done + (1 - pc) * end;
  }
  if (data.t === 'mon') {
    if (data.scored) return 0;
    return 4.5; // grober Mittelwert, echte Nachbarzahl unten separat
  }
  if (data.t === 'field') {
    if (data.scored) return 0;
    let done = 0, undone = 0;
    const seen = new Set();
    for (const cs of (data.adjSegs || [])) {
      const r = find(s, cs);
      if (seen.has(r)) continue;
      seen.add(r);
      if (s.roots.get(r).complete) done++; else undone++;
    }
    return done * 3 + undone * 1.4;
  }
  return 0;
}

function monasteryValue(s, monSegId) {
  const seg = s.segs[monSegId];
  const p = s.placed[seg.p];
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (dx || dy) if (s.grid.has((p.x + dx) + ',' + (p.y + dy))) n++;
  }
  const cur = 1 + n;
  return cur + (9 - cur) * 0.55;
}

// Erwartungswert je Spieler: Punktestand + Anteile an offenen Features
function evalPlayers(s) {
  const exp = s.players.map(p => p.score + p.meeples * 0.9 + p.bigMeeples * 1.4);
  const deckFrac = s.deck.length / Math.max(1, s.deckTotal);
  const seen = new Set();
  for (let i = 0; i < s.segs.length; i++) {
    const r = find(s, i);
    if (seen.has(r)) continue;
    seen.add(r);
    const data = s.roots.get(r);
    if (!data || data.meeples.length === 0 || data.scored) continue;
    let v;
    if (data.t === 'mon') v = monasteryValue(s, i);
    else v = expectedValue(s, data, deckFrac);
    if (v <= 0) continue;
    const w = new Map();
    for (const m of data.meeples) w.set(m.pl, (w.get(m.pl) || 0) + (m.big ? 2 : 1));
    let max = 0; for (const x of w.values()) max = Math.max(max, x);
    const winners = [...w.entries()].filter(([, x]) => x === max).map(([pl]) => pl);
    const share = winners.length > 1 ? 0.6 : 1;
    for (const pl of winners) exp[pl] += v * share;
  }
  return exp;
}

function moveValue(before, after, me) {
  let dMe = after[me] - before[me];
  let worstOpp = 0;
  for (let i = 0; i < after.length; i++) {
    if (i === me) continue;
    worstOpp = Math.max(worstOpp, after[i] - before[i]);
  }
  return dMe - 0.65 * worstOpp;
}

// Führt Zug auf Klon aus und bewertet ihn
function simulate(s, cand, rot, meeple, before, me) {
  const sim = cloneState(s);
  try {
    placeCurrent(sim, cand.x, cand.y, rot);
    finishTurn(sim, meeple, { noAdvance: true });
  } catch { return -1e9; }
  return moveValue(before, evalPlayers(sim), me);
}

function gauss(sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Liefert { x, y, rot, meeple } für den aktuellen Spieler/aktuelle Karte
export function chooseMove(s) {
  const me = s.current;
  const pl = s.players[me];
  const level = pl.type; // ai1 | ai2 | ai3
  const cands = legalPlacementsFor(s, s.drawn);
  if (!cands.length) return null;

  if (level === 'ai1') {
    const c = cands[Math.floor(Math.random() * cands.length)];
    const rot = c.rots[Math.floor(Math.random() * c.rots.length)];
    const sim = cloneState(s);
    placeCurrent(sim, c.x, c.y, rot);
    let meeple = null;
    const opts = meepleOptions(sim);
    if (opts.length && Math.random() < 0.55 && (pl.meeples > 0 || pl.bigMeeples > 0)) {
      const pref = opts.filter(o => o.t === 'city');
      const pool = pref.length && Math.random() < 0.7 ? pref : opts;
      meeple = { fi: pool[Math.floor(Math.random() * pool.length)].fi, big: pl.meeples <= 0 };
    }
    return { x: c.x, y: c.y, rot, meeple };
  }

  const sigma = level === 'ai2' ? 2.4 : 0.35;
  const before = evalPlayers(s);
  const deckFrac = s.deck.length / Math.max(1, s.deckTotal);
  // Kandidaten begrenzen, damit die KI auf dem Handy flott bleibt
  let flat = [];
  for (const c of cands) for (const r of c.rots) flat.push({ c, r });
  const capFlat = level === 'ai3' ? 120 : 70;
  if (flat.length > capFlat) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    flat = flat.slice(0, capFlat);
  }

  // Stufe 1: jede Platzierung einmal simulieren (ohne Meeple) und den
  // besten Meeple-Wert nur schätzen – spart teure Klone.
  const ranked = [];
  for (const { c, r } of flat) {
    const sim = cloneState(s);
    try { placeCurrent(sim, c.x, c.y, r); } catch { continue; }
    const opts = meepleOptions(sim);
    let bestOpt = 0;
    for (const o of opts) {
      const root = find(sim, o.segId);
      const data = sim.roots.get(root);
      const v = data.t === 'mon' ? monasteryValue(sim, o.segId) : expectedValue(sim, data, deckFrac);
      if (v > bestOpt) bestOpt = v;
    }
    try { finishTurn(sim, null, { noAdvance: true }); } catch { continue; }
    const nullVal = moveValue(before, evalPlayers(sim), me);
    ranked.push({ c, r, nullVal, bestOpt, opts });
  }
  ranked.sort((a, b) => (b.nullVal + 0.9 * b.bestOpt) - (a.nullVal + 0.9 * a.bestOpt));

  // Stufe 2: Top-Kandidaten mit allen Meeple-Varianten voll durchrechnen
  const K = Math.min(ranked.length, level === 'ai3' ? 12 : 7);
  let best = null, bestV = -Infinity;
  for (let i = 0; i < K; i++) {
    const { c, r, nullVal, opts } = ranked[i];
    {
      const v = nullVal + gauss(sigma);
      if (v > bestV) { bestV = v; best = { x: c.x, y: c.y, rot: r, meeple: null }; }
    }
    const choices = [];
    for (const o of opts) {
      if (pl.meeples > 0) choices.push({ fi: o.fi, big: false });
      if (pl.bigMeeples > 0 && (level === 'ai3' && (o.t === 'city' || o.t === 'field') || pl.meeples <= 0)) {
        choices.push({ fi: o.fi, big: true });
      }
    }
    for (const meeple of choices) {
      let v = simulate(s, c, r, meeple, before, me);
      if (v <= -1e8) continue;
      // Meeple-Ökonomie: knappe Meeples nicht verschwenden
      const left = meeple.big ? pl.bigMeeples : pl.meeples;
      v -= Math.max(0, 2.6 - 0.55 * left);
      if (meeple.big) v -= 0.8;
      v += gauss(sigma);
      if (v > bestV) { bestV = v; best = { x: c.x, y: c.y, rot: r, meeple }; }
    }
  }
  if (!best) {
    const c = cands[0];
    best = { x: c.x, y: c.y, rot: c.rots[0], meeple: null };
  }
  return best;
}

export const AI_NAMES = {
  ai1: 'KI · Bauer (leicht)',
  ai2: 'KI · Ritter (mittel)',
  ai3: 'KI · Baumeister (schwer)',
};
