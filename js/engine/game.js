// ============================================================
// Carcassonne Mobile – Spiel-Engine (reine Logik, ohne DOM)
// ============================================================
import { DEFS, DIRS, opp, matchHalf, buildDeck, edgeAt } from './tiles.js';

export const key = (x, y) => x + ',' + y;

// ---------- Union-Find über Segment-IDs ----------
export function find(s, i) {
  let r = i;
  while (s.parent[r] !== r) r = s.parent[r];
  while (s.parent[i] !== r) { const n = s.parent[i]; s.parent[i] = r; i = n; }
  return r;
}

function union(s, a, b) {
  a = find(s, a); b = find(s, b);
  if (a === b) return a;
  if (s.rnk[a] < s.rnk[b]) [a, b] = [b, a];
  if (s.rnk[a] === s.rnk[b]) s.rnk[a]++;
  s.parent[b] = a;
  const A = s.roots.get(a), B = s.roots.get(b);
  for (const t of B.tiles) A.tiles.add(t);
  for (const o of B.open) A.open.add(o);
  A.meeples.push(...B.meeples);
  A.shields += B.shields;
  A.inns += B.inns;
  A.cath = A.cath || B.cath;
  if (B.adjSegs) { A.adjSegs = A.adjSegs || new Set(); for (const c of B.adjSegs) A.adjSegs.add(c); }
  s.roots.delete(b);
  return a;
}

// ---------- Neues Spiel ----------
// settings: { players:[{name,color,type}], expansions:{river,inns,king},
//             deckScale, deckIds?, startId? (für Replay) }
export function newGame(settings) {
  const s = {
    settings,
    players: settings.players.map((p, i) => ({
      idx: i, name: p.name, color: p.color, type: p.type, // 'human' | 'ai1' | 'ai2' | 'ai3'
      score: 0, meeples: 7, bigMeeples: settings.expansions?.inns ? 1 : 0,
      breakdown: { road: 0, city: 0, mon: 0, field: 0, bonus: 0 },
    })),
    current: 0, turn: 1, phase: 'place', // place | meeple | over
    grid: new Map(), placed: [], segs: [], parent: [], rnk: [],
    roots: new Map(), monasteries: [],
    deck: [], discards: [], drawn: null, deckTotal: 0,
    lastPlacedIdx: -1, lastRiverCurve: 0,
    king: null, kingSize: 0, robber: null, robberSize: 0,
    completedCities: 0, completedRoads: 0,
    history: [], initialDeck: null, startId: null,
    events: [], legalCache: null,
  };
  let startId, deck;
  if (settings.deckIds) { startId = settings.startId; deck = settings.deckIds.slice(); }
  else { const b = buildDeck(settings); startId = b.startId; deck = b.deck; }
  s.startId = startId;
  s.initialDeck = deck.slice();
  s.deck = deck;
  s.deckTotal = deck.length + 1;
  placeTileRaw(s, startId, 0, 0, 0);
  drawNext(s);
  return s;
}

// ---------- Legalität ----------
export function isLegal(s, defId, x, y, rot) {
  if (s.grid.has(key(x, y))) return false;
  const d = DEFS[defId];
  let neighbors = 0, waterMatch = 0, inDir = -1;
  for (let dir = 0; dir < 4; dir++) {
    const nk = key(x + DIRS[dir].dx, y + DIRS[dir].dy);
    const nIdx = s.grid.get(nk);
    if (nIdx === undefined) continue;
    neighbors++;
    const n = s.placed[nIdx];
    const mine = edgeAt(defId, rot, dir);
    const theirs = edgeAt(n.defId, n.rot, opp(dir));
    if (mine !== theirs) return false;
    if (mine === 'W') { waterMatch++; inDir = dir; }
  }
  if (neighbors === 0) return false;
  if (d.edges.includes('W')) {
    if (waterMatch === 0) return false; // Fluss muss weiterfließen
    // Kurvenregel: nicht zweimal hintereinander in dieselbe Richtung
    const wdirs = [];
    for (let dir = 0; dir < 4; dir++) if (edgeAt(defId, rot, dir) === 'W') wdirs.push(dir);
    if (wdirs.length === 2 && waterMatch === 1) {
      const out = wdirs[0] === inDir ? wdirs[1] : wdirs[0];
      const rel = (out - inDir + 4) % 4;
      if (rel !== 2 && rel === s.lastRiverCurve) return false;
    }
  }
  return true;
}

export function legalPlacementsFor(s, defId) {
  const seen = new Set(), out = [];
  for (const k of s.grid.keys()) {
    const [px, py] = k.split(',').map(Number);
    for (let dir = 0; dir < 4; dir++) {
      const x = px + DIRS[dir].dx, y = py + DIRS[dir].dy;
      const ck = key(x, y);
      if (seen.has(ck) || s.grid.has(ck)) continue;
      seen.add(ck);
      const rots = [];
      for (let r = 0; r < 4; r++) if (isLegal(s, defId, x, y, r)) rots.push(r);
      if (rots.length) out.push({ x, y, rots });
    }
  }
  return out;
}

export const anyLegal = (s, defId) => legalPlacementsFor(s, defId).length > 0;

export function legalPlacements(s) {
  if (!s.legalCache || s.legalCache.defId !== s.drawn) {
    s.legalCache = { defId: s.drawn, list: s.drawn ? legalPlacementsFor(s, s.drawn) : [] };
  }
  return s.legalCache.list;
}

// ---------- Platzieren ----------
function placeTileRaw(s, defId, x, y, rot) {
  const d = DEFS[defId];
  const placedIdx = s.placed.length;
  const p = {
    defId, x, y, rot, key: key(x, y),
    edgeSeg: [-1, -1, -1, -1], halfSeg: [-1, -1, -1, -1, -1, -1, -1, -1],
    monSeg: -1, fsegs: [],
  };
  s.placed.push(p);
  s.grid.set(p.key, placedIdx);

  // Segmente anlegen
  d.f.forEach((f, fi) => {
    const segId = s.segs.length;
    s.segs.push({ p: placedIdx, fi, t: f.t });
    s.parent.push(segId); s.rnk.push(0);
    p.fsegs.push(segId);
    const data = {
      t: f.t, tiles: new Set([p.key]), open: new Set(), meeples: [],
      shields: 0, inns: 0, cath: false, scored: false, complete: false,
    };
    if (f.t === 'city' || f.t === 'road' || f.t === 'river') {
      for (const e of f.e) {
        const we = (e + rot) % 4;
        p.edgeSeg[we] = segId;
        data.open.add(key(x, y) + ':' + we);
      }
      if (f.t === 'city') { data.shields = f.shield || 0; data.cath = !!f.cath; }
      if (f.t === 'road') { data.inns = f.inn ? 1 : 0; }
    } else if (f.t === 'field') {
      for (const h of f.h) p.halfSeg[(h + rot * 2) % 8] = segId;
      data.adjSegs = new Set();
    } else if (f.t === 'mon') {
      p.monSeg = segId;
      s.monasteries.push(segId);
    }
    s.roots.set(segId, data);
  });
  // Wiesen: angrenzende Städte (Segment-IDs derselben Karte) eintragen
  d.f.forEach((f, fi) => {
    if (f.t === 'field') {
      const data = s.roots.get(p.fsegs[fi]);
      for (const ci of f.adj) data.adjSegs.add(p.fsegs[ci]);
    }
  });

  // Mit Nachbarn verschmelzen
  let inDir = -1;
  for (let dir = 0; dir < 4; dir++) {
    const nk = key(x + DIRS[dir].dx, y + DIRS[dir].dy);
    const nIdx = s.grid.get(nk);
    if (nIdx === undefined) continue;
    const n = s.placed[nIdx];
    const et = edgeAt(defId, rot, dir);
    if (et === 'C' || et === 'R' || et === 'W') {
      const a = p.edgeSeg[dir], b = n.edgeSeg[opp(dir)];
      const r = union(s, a, b);
      const rd = s.roots.get(r);
      rd.open.delete(key(x, y) + ':' + dir);
      rd.open.delete(nk + ':' + opp(dir));
      if (et === 'W') inDir = dir;
    }
    if (et !== 'C') { // Wiesen-Hälften (auch neben Straßen/Fluss)
      for (let side = 0; side < 2; side++) {
        const h = dir * 2 + side;
        const a = p.halfSeg[h], b = n.halfSeg[matchHalf(h)];
        if (a >= 0 && b >= 0) union(s, a, b);
      }
    }
  }
  // Fluss-Kurvenrichtung merken
  if (d.edges.includes('W') && inDir >= 0) {
    const wdirs = [];
    for (let dir = 0; dir < 4; dir++) if (edgeAt(defId, rot, dir) === 'W') wdirs.push(dir);
    if (wdirs.length === 2) {
      const out = wdirs[0] === inDir ? wdirs[1] : wdirs[0];
      const rel = (out - inDir + 4) % 4;
      s.lastRiverCurve = rel === 2 ? 0 : rel;
    } else s.lastRiverCurve = 0;
  }
  s.lastPlacedIdx = placedIdx;
  s.legalCache = null;
  return placedIdx;
}

export function placeCurrent(s, x, y, rot) {
  if (s.phase !== 'place' || !s.drawn) throw new Error('Nicht in Platzierungsphase');
  if (!isLegal(s, s.drawn, x, y, rot)) throw new Error('Ungültige Platzierung');
  const defId = s.drawn;
  placeTileRaw(s, defId, x, y, rot);
  s.phase = 'meeple';
  return s.lastPlacedIdx;
}

// ---------- Meeple ----------
export function meepleOptions(s) {
  if (s.phase !== 'meeple') return [];
  const p = s.placed[s.lastPlacedIdx];
  const pl = s.players[s.current];
  if (pl.meeples <= 0 && pl.bigMeeples <= 0) return [];
  const d = DEFS[p.defId];
  const out = [];
  // Je Gebiet höchstens ein Angebot. Die Schleife läuft über die Segmente
  // der Karte, aber zwei Segmente können nach dem Verschmelzen dasselbe
  // Gebiet sein – eine Wiese, die außen herum auf dieselbe Karte
  // zurückläuft, hätte sonst zwei Punkte. Regelwidrig wäre das nicht,
  // beide führen auf denselben Bauernhof; am Brett sieht es aber nach zwei
  // Wiesen aus, und die Kartenbewertung der KI zählt dieselbe Wiese
  // doppelt. Tritt in rund anderthalb Prozent der Züge auf.
  const gesehen = new Set();
  p.fsegs.forEach((segId, fi) => {
    const f = d.f[fi];
    if (f.t === 'river') return;
    const wurzel = find(s, segId);
    if (gesehen.has(wurzel)) return;
    const data = s.roots.get(wurzel);
    if (data.meeples.length > 0) return;
    gesehen.add(wurzel);
    out.push({ fi, segId, t: f.t, spot: f.spot });
  });
  return out;
}

/**
 * Die Bauteile der eben gelegten Karte, auf die **kein** Gefolgsmann kann,
 * weil in dem Gebiet schon einer steht – mit dem Spieler, dem er gehört.
 *
 * Die Regel ist richtig und alt: ein Gebiet trägt einen Gefolgsmann, und
 * wer zuerst da war, hat es. Nur sieht man das am Brett nicht. Die Stadt
 * auf der frisch gelegten Karte reicht vielleicht zwanzig Karten weit, und
 * am anderen Ende steht seit sechs Zügen ein fremder Ritter, der längst aus
 * dem Bildausschnitt gewandert ist. Auf dem Telefon sieht man dann eine
 * leere Stadt, zwei eigene Gefolgsleute in der Hand – und keine Marke.
 * Genau so gemeldet: „meeple verfügbar aber stadt wird nicht angeboten".
 *
 * Deshalb wird das Gebiet trotzdem gezeigt, nur als besetzt und in der
 * Farbe dessen, dem es gehört. Aus einer stummen Ablehnung wird eine
 * Auskunft.
 */
export function meepleBesetzt(s) {
  if (s.phase !== 'meeple') return [];
  const p = s.placed[s.lastPlacedIdx];
  const d = DEFS[p.defId];
  const out = [];
  const gesehen = new Set();
  p.fsegs.forEach((segId, fi) => {
    const f = d.f[fi];
    if (f.t === 'river') return;
    const wurzel = find(s, segId);
    if (gesehen.has(wurzel)) return;
    const data = s.roots.get(wurzel);
    if (!data.meeples.length) return;
    gesehen.add(wurzel);
    out.push({ fi, t: f.t, spot: f.spot, pl: data.meeples[0].pl });
  });
  return out;
}

// ---------- Wertung ----------
function returnMeeples(s, data) {
  for (const m of data.meeples) {
    const pl = s.players[m.pl];
    if (m.big) pl.bigMeeples++; else pl.meeples++;
  }
  data.meeples = [];
}

function majority(s, data) {
  const w = new Map();
  for (const m of data.meeples) w.set(m.pl, (w.get(m.pl) || 0) + (m.big ? 2 : 1));
  let max = 0;
  for (const v of w.values()) max = Math.max(max, v);
  if (max === 0) return [];
  const winners = [];
  for (const [pl, v] of w) if (v === max) winners.push(pl);
  return winners;
}

function centroid(data) {
  let sx = 0, sy = 0, n = 0;
  for (const t of data.tiles) { const [x, y] = t.split(',').map(Number); sx += x; sy += y; n++; }
  return { x: sx / n, y: sy / n };
}

function featurePoints(data, complete) {
  const n = data.tiles.size;
  if (data.t === 'road') {
    if (complete) return n * (data.inns > 0 ? 2 : 1);
    return data.inns > 0 ? 0 : n;
  }
  if (data.t === 'city') {
    const base = n + data.shields;
    if (complete) return base * (data.cath ? 3 : 2);
    return data.cath ? 0 : base;
  }
  return 0;
}

function scoreFeature(s, rootId, complete, category) {
  const data = s.roots.get(rootId);
  if (data.scored) return;
  data.scored = true;
  if (complete) data.complete = true;
  if (data.t === 'city' && complete) {
    s.completedCities++;
    if (s.settings.expansions?.king && data.tiles.size > s.kingSize) {
      s.kingSize = data.tiles.size; s.king = s.current;
    }
  }
  if (data.t === 'road' && complete) {
    s.completedRoads++;
    if (s.settings.expansions?.king && data.tiles.size > s.robberSize) {
      s.robberSize = data.tiles.size; s.robber = s.current;
    }
  }
  if (data.meeples.length === 0) return;
  const pts = featurePoints(data, complete);
  const winners = majority(s, data);
  const c = centroid(data);
  if (pts > 0) {
    for (const w of winners) {
      s.players[w].score += pts;
      s.players[w].breakdown[category] += pts;
    }
  }
  s.events.push({
    type: 'score', ftype: data.t, points: pts, players: winners,
    complete, x: c.x, y: c.y, tiles: data.tiles.size,
    // Welche Karten gewertet wurden. Ohne das ist am Brett nicht zu
    // erkennen, *welches* Gebiet gemeint war – bei zwei Städten
    // nebeneinander sieht eine richtige Wertung dann aus wie ein Fehler.
    felder: [...data.tiles],
  });
  returnMeeples(s, data);
}

function monasteryNeighbors(s, monSegId) {
  const seg = s.segs[monSegId];
  const p = s.placed[seg.p];
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (dx === 0 && dy === 0) continue;
    if (s.grid.has(key(p.x + dx, p.y + dy))) n++;
  }
  return n;
}

function scoreMonastery(s, monSegId, complete) {
  const data = s.roots.get(monSegId);
  if (data.scored) return;
  const n = 1 + monasteryNeighbors(s, monSegId);
  if (!complete && n < 9) { /* Endwertung */ } else if (n < 9) return;
  data.scored = true;
  data.complete = n >= 9;
  if (data.meeples.length === 0) return;
  const seg = s.segs[monSegId];
  const p = s.placed[seg.p];
  const owner = data.meeples[0].pl;
  s.players[owner].score += n;
  s.players[owner].breakdown.mon += n;
  // Gewertet wird der Hof samt Nachbarschaft – deshalb die ganzen 3×3.
  const felder = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const k = key(p.x + dx, p.y + dy);
      if (s.grid.has(k)) felder.push(k);
    }
  }
  s.events.push({ type: 'score', ftype: 'mon', points: n, players: [owner],
    complete: n >= 9, x: p.x, y: p.y, tiles: n, felder });
  returnMeeples(s, data);
}

function resolveCompletions(s) {
  const p = s.placed[s.lastPlacedIdx];
  const seen = new Set();
  for (const segId of p.fsegs) {
    const seg = s.segs[segId];
    if (seg.t !== 'road' && seg.t !== 'city') continue;
    const r = find(s, segId);
    if (seen.has(r)) continue;
    seen.add(r);
    const data = s.roots.get(r);
    if (!data.scored && data.open.size === 0) {
      scoreFeature(s, r, true, seg.t === 'road' ? 'road' : 'city');
    }
  }
  // Klöster im Umkreis prüfen (inkl. gerade gelegtes)
  for (const monSegId of s.monasteries) {
    const data = s.roots.get(monSegId);
    if (data.scored) continue;
    const seg = s.segs[monSegId];
    const mp = s.placed[seg.p];
    if (Math.abs(mp.x - p.x) <= 1 && Math.abs(mp.y - p.y) <= 1) {
      if (1 + monasteryNeighbors(s, monSegId) >= 9) scoreMonastery(s, monSegId, true);
    }
  }
}

function drawNext(s) {
  while (s.deck.length) {
    const id = s.deck.shift();
    if (anyLegal(s, id)) { s.drawn = id; s.legalCache = null; return; }
    s.discards.push(id);
    s.events.push({ type: 'discard', defId: id });
  }
  s.drawn = null;
  finalScoring(s);
}

// meeple: { fi, big } | null   opts: { noAdvance } für KI-Simulation
export function finishTurn(s, meeple, opts = {}) {
  if (s.phase !== 'meeple') throw new Error('Nicht in Meeple-Phase');
  s.events = [];
  const pl = s.players[s.current];
  if (meeple) {
    const p = s.placed[s.lastPlacedIdx];
    const segId = p.fsegs[meeple.fi];
    const seg = s.segs[segId];
    if (seg.t === 'river') throw new Error('Kein Meeple auf dem Fluss');
    const data = s.roots.get(find(s, segId));
    if (data.meeples.length > 0) throw new Error('Feature besetzt');
    const big = !!meeple.big;
    if (big) { if (pl.bigMeeples <= 0) throw new Error('Kein großer Meeple'); pl.bigMeeples--; }
    else { if (pl.meeples <= 0) throw new Error('Kein Meeple übrig'); pl.meeples--; }
    data.meeples.push({ pl: s.current, big, placedIdx: s.lastPlacedIdx, fi: meeple.fi });
  }
  resolveCompletions(s);
  const p = s.placed[s.lastPlacedIdx];
  s.history.push({ x: p.x, y: p.y, rot: p.rot, m: meeple ? { fi: meeple.fi, big: !!meeple.big } : null });
  if (opts.noAdvance) return s.events;
  s.turn++;
  s.current = (s.current + 1) % s.players.length;
  s.phase = 'place';
  drawNext(s);
  return s.events;
}

// ---------- Endwertung ----------
function finalScoring(s) {
  s.phase = 'over';
  // Unfertige Straßen & Städte
  const seenRoots = new Set();
  for (let i = 0; i < s.segs.length; i++) {
    const t = s.segs[i].t;
    if (t !== 'road' && t !== 'city') continue;
    const r = find(s, i);
    if (seenRoots.has(r)) continue;
    seenRoots.add(r);
    const data = s.roots.get(r);
    if (!data.scored) scoreFeature(s, r, false, t === 'road' ? 'road' : 'city');
  }
  // Klöster
  for (const monSegId of s.monasteries) scoreMonastery(s, monSegId, false);
  // Wiesen: 3 Punkte je fertiger angrenzender Stadt
  const fieldRoots = new Set();
  for (let i = 0; i < s.segs.length; i++) {
    if (s.segs[i].t !== 'field') continue;
    fieldRoots.add(find(s, i));
  }
  for (const r of fieldRoots) {
    const data = s.roots.get(r);
    if (data.scored || data.meeples.length === 0) continue;
    data.scored = true;
    const cities = new Set();
    for (const cs of (data.adjSegs || [])) {
      const cr = find(s, cs);
      if (s.roots.get(cr).complete) cities.add(cr);
    }
    const pts = cities.size * 3;
    const winners = majority(s, data);
    const c = centroid(data);
    if (pts > 0) for (const w of winners) {
      s.players[w].score += pts;
      s.players[w].breakdown.field += pts;
    }
    s.events.push({ type: 'score', ftype: 'field', points: pts, players: winners, complete: false, x: c.x, y: c.y, tiles: data.tiles.size });
    returnMeeples(s, data);
  }
  // König & Räuber
  if (s.settings.expansions?.king) {
    if (s.king !== null && s.completedCities > 0) {
      s.players[s.king].score += s.completedCities;
      s.players[s.king].breakdown.bonus += s.completedCities;
      s.events.push({ type: 'bonus', kind: 'king', points: s.completedCities, players: [s.king] });
    }
    if (s.robber !== null && s.completedRoads > 0) {
      s.players[s.robber].score += s.completedRoads;
      s.players[s.robber].breakdown.bonus += s.completedRoads;
      s.events.push({ type: 'bonus', kind: 'robber', points: s.completedRoads, players: [s.robber] });
    }
  }
  const max = Math.max(...s.players.map(p => p.score));
  s.winners = s.players.filter(p => p.score === max).map(p => p.idx);
  s.events.push({ type: 'gameover' });
}

// ---------- Klonen (für KI & Undo) ----------
export function cloneState(s) {
  const c = {
    settings: s.settings,
    players: s.players.map(p => ({ ...p, breakdown: { ...p.breakdown } })),
    current: s.current, turn: s.turn, phase: s.phase,
    grid: new Map(s.grid),
    placed: s.placed.slice(),
    segs: s.segs.slice(),
    parent: s.parent.slice(), rnk: s.rnk.slice(),
    roots: new Map(), monasteries: s.monasteries.slice(),
    deck: s.deck.slice(), discards: s.discards.slice(), drawn: s.drawn,
    deckTotal: s.deckTotal,
    lastPlacedIdx: s.lastPlacedIdx, lastRiverCurve: s.lastRiverCurve,
    king: s.king, kingSize: s.kingSize, robber: s.robber, robberSize: s.robberSize,
    completedCities: s.completedCities, completedRoads: s.completedRoads,
    history: s.history.slice(), initialDeck: s.initialDeck, startId: s.startId,
    events: [], legalCache: null, winners: s.winners ? s.winners.slice() : undefined,
  };
  for (const [k, d] of s.roots) {
    c.roots.set(k, {
      t: d.t, tiles: new Set(d.tiles), open: new Set(d.open),
      meeples: d.meeples.map(m => ({ ...m })),
      shields: d.shields, inns: d.inns, cath: d.cath,
      scored: d.scored, complete: d.complete,
      adjSegs: d.adjSegs ? new Set(d.adjSegs) : undefined,
    });
  }
  return c;
}

// ---------- Speichern / Fortsetzen ----------
export function serialize(s) {
  return {
    v: 2,
    settings: {
      players: s.settings.players,
      expansions: s.settings.expansions,
      deckScale: s.settings.deckScale,
    },
    startId: s.startId,
    deckIds: s.initialDeck,
    history: s.history,
    turn: s.turn,
  };
}

export function resumeGame(save) {
  if (!save || save.v !== 2) return null;
  const s = newGame({ ...save.settings, deckIds: save.deckIds, startId: save.startId });
  for (const mv of save.history) {
    if (!s.drawn) break;
    placeCurrent(s, mv.x, mv.y, mv.rot);
    finishTurn(s, mv.m);
  }
  return s;
}
