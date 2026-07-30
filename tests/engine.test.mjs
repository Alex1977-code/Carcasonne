// Engine-Tests: node tests/engine.test.mjs
import { DEFS, buildDeck, matchHalf, opp } from '../js/engine/tiles.js';
import {
  newGame, isLegal, legalPlacementsFor, placeCurrent, meepleOptions,
  finishTurn, cloneState, serialize, resumeGame, find,
} from '../js/engine/game.js';
import { chooseMove } from '../js/engine/ai.js';

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${b}, war ${a})`); }

// ---------- 1. Definitions-Invarianten ----------
for (const id in DEFS) {
  const d = DEFS[id];
  eq(d.edges.length, 4, `${id}: 4 Kanten`);
  const edgeOwner = [null, null, null, null];
  const halfOwner = new Array(8).fill(null);
  let monCount = 0;
  d.f.forEach((f, fi) => {
    if (f.t === 'city' || f.t === 'road' || f.t === 'river') {
      const want = f.t === 'city' ? 'C' : f.t === 'road' ? 'R' : 'W';
      for (const e of f.e) {
        eq(d.edges[e], want, `${id}: Feature ${fi} (${f.t}) auf Kante ${e}`);
        ok(edgeOwner[e] === null, `${id}: Kante ${e} doppelt belegt`);
        edgeOwner[e] = fi;
      }
    } else if (f.t === 'field') {
      for (const h of f.h) {
        ok(halfOwner[h] === null, `${id}: Halbkante ${h} doppelt belegt`);
        halfOwner[h] = fi;
        const edge = Math.floor(h / 2);
        ok(d.edges[edge] !== 'C', `${id}: Wiese auf Stadtkante ${edge}`);
      }
      for (const adj of f.adj) ok(d.f[adj] && d.f[adj].t === 'city', `${id}: adj ${adj} ist Stadt`);
    } else if (f.t === 'mon') monCount++;
  });
  for (let e = 0; e < 4; e++) {
    if (d.edges[e] !== 'F') ok(edgeOwner[e] !== null, `${id}: Kante ${e} (${d.edges[e]}) ohne Feature`);
    if (d.edges[e] !== 'C') {
      ok(halfOwner[e * 2] !== null && halfOwner[e * 2 + 1] !== null, `${id}: Halbkanten der Kante ${e} unvollständig`);
    } else {
      ok(halfOwner[e * 2] === null && halfOwner[e * 2 + 1] === null, `${id}: Stadtkante ${e} hat Wiesen-Hälften`);
    }
  }
  ok(monCount <= 1, `${id}: höchstens 1 Kloster`);
}

// Halbkanten-Matching
eq(matchHalf(0), 5, 'matchHalf NW<->SW');
eq(matchHalf(1), 4, 'matchHalf NO<->SO');
eq(matchHalf(2), 7, 'matchHalf ON<->WN');
eq(opp(0), 2, 'opp N=S');

// ---------- 2. Deckgrößen ----------
{
  const base = buildDeck({ expansions: {}, deckScale: 1 });
  eq(base.deck.length + 1, 72, 'Basisspiel: 72 Karten');
  eq(base.startId, 'D', 'Startkarte D');
  const river = buildDeck({ expansions: { river: true }, deckScale: 1 });
  eq(river.deck.length + 1, 72 + 12, 'Mit Fluss: 84 Karten');
  eq(river.startId, 'RV_SPRING', 'Fluss beginnt mit Quelle');
  eq(river.deck[10], 'RV_LAKE', 'See als letzte Flusskarte');
  const inns = buildDeck({ expansions: { inns: true }, deckScale: 1 });
  eq(inns.deck.length + 1, 72 + 18, 'Mit W&K: 90 Karten');
  const big = buildDeck({ expansions: {}, deckScale: 2 });
  eq(big.deck.length + 1, 144, 'Großes Deck: 144 Karten');
  const huge = buildDeck({ expansions: {}, deckScale: 4 });
  eq(huge.deck.length + 1, 288, 'Riesiges Deck: 288 Karten');
  const hugeAll = buildDeck({ expansions: { river: true, inns: true }, deckScale: 4 });
  eq(hugeAll.deck.length + 1, 288 + 2 + 40 + 72, 'Riesig + Erweiterungen skaliert');
  const riverBig = buildDeck({ expansions: { river: true }, deckScale: 2 });
  eq(riverBig.deck.filter(id => id === 'RV_SPRING').length, 0, 'nur eine Quelle (Start)');
  eq(riverBig.deck.filter(id => id === 'RV_LAKE').length, 1, 'nur ein See');
  eq(riverBig.deck[20], 'RV_LAKE', 'See nach 20 Fluss-Mittelteilen');
}

// ---------- 3. Legalität & einfache Stadtwertung ----------
function twoPlayers(extra = {}) {
  return {
    players: [
      { name: 'Anna', color: '#e74c3c', type: 'human' },
      { name: 'Ben', color: '#3498db', type: 'human' },
    ],
    expansions: {}, deckScale: 1, ...extra,
  };
}
{
  // Deterministisches Deck: Start D (Stadt N, Straße O-W), dann E, E, U
  const s = newGame(twoPlayers({ deckIds: ['E', 'E', 'U', 'U'], startId: 'D' }));
  eq(s.drawn, 'E', 'erste Karte gezogen');
  // Start-D bei 0,0 rot0: Stadt N, Straße O-W, Wiese S
  ok(isLegal(s, 'E', 0, -1, 2), 'E mit Stadt S über Start-D legal');
  ok(!isLegal(s, 'E', 0, -1, 0), 'E falsch gedreht illegal');
  ok(!isLegal(s, 'E', 5, 5, 0), 'ohne Nachbar illegal');
  ok(!isLegal(s, 'E', 0, 0, 0), 'belegtes Feld illegal');
  // Spieler 0: E oben anlegen, Meeple in die Stadt → 2-Karten-Stadt = 4 Punkte
  placeCurrent(s, 0, -1, 2);
  const opts = meepleOptions(s);
  const cityOpt = opts.find(o => o.t === 'city');
  ok(cityOpt, 'Stadt-Meeple-Option vorhanden');
  const ev = finishTurn(s, { fi: cityOpt.fi });
  const scoreEv = ev.find(e => e.type === 'score' && e.ftype === 'city');
  ok(scoreEv, 'Stadt gewertet');
  eq(scoreEv.points, 4, 'kleine Stadt = 4 Punkte');
  eq(s.players[0].score, 4, 'Punkte bei Anna');
  eq(s.players[0].meeples, 7, 'Meeple sofort zurück');
  eq(s.current, 1, 'Ben am Zug');
}

// ---------- 4. Straße + besetzte Features ----------
{
  const s = newGame(twoPlayers({ deckIds: ['U', 'V', 'V', 'E'], startId: 'D' }));
  // D: Straße O-W. U (Straße N-S) → rot1 = O-W. Links anlegen.
  ok(isLegal(s, 'U', -1, 0, 1), 'U gedreht links an D legal');
  placeCurrent(s, -1, 0, 1);
  const ro = meepleOptions(s).find(o => o.t === 'road');
  ok(ro, 'Straßen-Option da');
  finishTurn(s, { fi: ro.fi });
  // Ben: V-Kurve (S→W); an rechte Seite von D: braucht W-Kante links → rot? V edges FFRR: rot1 => R unten+links? edges FFRR rot1: N=W? Prüfe legal alle rots bei (1,0)
  const lp = legalPlacementsFor(s, 'V').find(p => p.x === 1 && p.y === 0);
  ok(lp, 'V rechts anlegbar');
  placeCurrent(s, 1, 0, lp.rots[0]);
  // Straße von Spieler 0 besetzt → dort keine Meeple-Option
  const opts = meepleOptions(s);
  ok(!opts.some(o => o.t === 'road' && (() => {
    const p = s.placed[s.lastPlacedIdx];
    const data = s.roots.get(find(s, p.fsegs[o.fi]));
    return data.meeples.length > 0;
  })()), 'besetzte Straße nicht wählbar');
  finishTurn(s, null);
  ok(true, 'Runde ohne Meeple ok');
}

// ---------- 5. Straße abschließen ----------
{
  // Kreuzungen (W) beenden Straßen: W links + W rechts an die D-Straße
  const s = newGame(twoPlayers({ deckIds: ['W', 'W', 'E'], startId: 'D' }));
  ok(isLegal(s, 'W', -1, 0, 0), 'Kreuzung links legal');
  placeCurrent(s, -1, 0, 0); // Straßen O,S,W – O verbindet zur D-Straße
  const ro = meepleOptions(s).find(o => o.t === 'road');
  finishTurn(s, { fi: ro.fi });
  placeCurrent(s, 1, 0, 0); // Straßen O,S,W – W verbindet zur D-Straße
  const ev = finishTurn(s, null);
  const scoreEv = ev.find(e => e.type === 'score' && e.ftype === 'road');
  ok(scoreEv, 'Straße gewertet');
  eq(scoreEv.points, 3, 'Straße über 3 Karten = 3 Punkte');
  eq(s.players[0].score, 3, 'Punkte für Anna');
  eq(s.players[0].meeples, 7, 'Meeple zurück');
}

// ---------- 6. Kloster ----------
{
  const s = newGame(twoPlayers({ deckIds: ['B', 'E', 'E', 'E', 'U', 'U', 'U', 'U', 'U', 'E'], startId: 'D' }));
  // Kloster unter Start-D (Wiese S) → B bei (0,1)
  ok(isLegal(s, 'B', 0, 1, 0), 'Kloster unter D legal');
  placeCurrent(s, 0, 1, 0);
  const mo = meepleOptions(s).find(o => o.t === 'mon');
  ok(mo, 'Kloster-Option da');
  finishTurn(s, { fi: mo.fi });
  eq(s.players[0].meeples, 6, 'Meeple auf Kloster');
  ok(true, 'Kloster gesetzt');
}

// ---------- 7. Endwertung: unfertige Features + Wiesen ----------
{
  const s = newGame(twoPlayers({ deckIds: ['E'], startId: 'D' }));
  // Nur 1 Karte: E oben anlegen mit Meeple in Stadt? Stadt wird fertig (4P).
  // Stattdessen: E anlegen, Meeple auf Wiese der E-Karte.
  placeCurrent(s, 0, -1, 2);
  const fo = meepleOptions(s).find(o => o.t === 'field');
  finishTurn(s, { fi: fo.fi });
  eq(s.phase, 'over', 'Spiel vorbei');
  // Wiese grenzt an fertige 2er-Stadt → 3 Punkte
  eq(s.players[0].breakdown.field, 3, 'Wiese: 3 Punkte für fertige Stadt');
  ok(s.winners.includes(0), 'Anna gewinnt');
}
{
  // Unfertige Stadt bei Spielende: 1 Punkt/Karte
  const s = newGame(twoPlayers({ deckIds: ['G'], startId: 'D' }));
  // G = Stadt N-S: an D oben mit Stadtkante S an D-Stadt N
  const lp = legalPlacementsFor(s, 'G').find(p => p.x === 0 && p.y === -1);
  ok(lp, 'G anlegbar');
  placeCurrent(s, 0, -1, lp.rots[0]);
  const co = meepleOptions(s).find(o => o.t === 'city');
  finishTurn(s, { fi: co.fi });
  eq(s.phase, 'over', 'Spiel vorbei');
  eq(s.players[0].breakdown.city, 2, 'unfertige Stadt: 2 Karten = 2 Punkte');
}

// ---------- 8. Fluss ----------
{
  const s = newGame(twoPlayers({
    expansions: { river: true },
    deckIds: ['RV_STRAIGHT', 'RV_CURVE', 'RV_CURVE', 'RV_LAKE', 'E'],
    startId: 'RV_SPRING',
  }));
  eq(s.drawn, 'RV_STRAIGHT', 'Flusskarte gezogen');
  // Quelle rot0: Wasser S → gerade Karte muss unten anschließen
  const lp = legalPlacementsFor(s, 'RV_STRAIGHT');
  ok(lp.every(p => p.x === 0 && p.y === 1), 'Fluss nur an offenem Ende');
  placeCurrent(s, 0, 1, lp[0].rots[0]);
  finishTurn(s, null);
  // Kurve anlegen
  const lp2 = legalPlacementsFor(s, 'RV_CURVE');
  ok(lp2.length > 0, 'Kurve anlegbar');
  placeCurrent(s, lp2[0].x, lp2[0].y, lp2[0].rots[0]);
  finishTurn(s, null);
  // Zweite Kurve: gleiche Drehrichtung muss verboten sein
  const lp3 = legalPlacementsFor(s, 'RV_CURVE');
  ok(lp3.length > 0, 'zweite Kurve anlegbar');
  const totalRots = lp3.reduce((a, p) => a + p.rots.length, 0);
  ok(totalRots <= 2, 'U-Turn-Regel schränkt Drehungen ein');
  placeCurrent(s, lp3[0].x, lp3[0].y, lp3[0].rots[0]);
  finishTurn(s, null);
  // See anlegen
  const lp4 = legalPlacementsFor(s, 'RV_LAKE');
  ok(lp4.length > 0, 'See anlegbar');
  placeCurrent(s, lp4[0].x, lp4[0].y, lp4[0].rots[0]);
  const opts = meepleOptions(s);
  ok(!opts.some(o => o.t === 'river'), 'kein Meeple auf Fluss');
  finishTurn(s, null);
  ok(true, 'Fluss komplett');
}

// ---------- 9. Wirtshaus & Kathedrale & großer Meeple ----------
{
  const s = newGame(twoPlayers({
    expansions: { inns: true },
    deckIds: ['EC_INN_CURVE', 'V', 'U', 'V', 'V', 'E'],
    startId: 'D',
  }));
  eq(s.players[0].bigMeeples, 1, 'großer Meeple vorhanden');
  // Straßen-Schleife um die Startkarte, Wirtshaus-Kurve als erstes Glied
  placeCurrent(s, 1, 0, 0); // Wirtshaus-Kurve: Straße S+W, W verbindet zu D
  const ro = meepleOptions(s).find(o => o.t === 'road');
  finishTurn(s, { fi: ro.fi, big: true });
  eq(s.players[0].bigMeeples, 0, 'großer Meeple gesetzt');
  placeCurrent(s, 1, 1, 1);  // V: Straße N+W
  finishTurn(s, null);
  placeCurrent(s, 0, 1, 1);  // U: Straße O-W
  finishTurn(s, null);
  placeCurrent(s, -1, 1, 2); // V: Straße N+O
  finishTurn(s, null);
  placeCurrent(s, -1, 0, 3); // V: Straße O+S → Schleife geschlossen
  const ev = finishTurn(s, null);
  const scoreEv = ev.find(e => e.type === 'score' && e.ftype === 'road');
  ok(scoreEv, 'Schleife gewertet');
  eq(scoreEv.points, 12, 'Wirtshaus-Straße: 6 Karten × 2 = 12');
  eq(s.players[0].bigMeeples, 1, 'großer Meeple zurück');
}
{
  // Kathedrale: unfertig = 0 Punkte
  const s = newGame(twoPlayers({
    expansions: { inns: true },
    deckIds: ['EC_CATH'],
    startId: 'D',
  }));
  const lp = legalPlacementsFor(s, 'EC_CATH').find(p => p.y === -1);
  ok(lp, 'Kathedrale anlegbar');
  placeCurrent(s, lp.x, lp.y, lp.rots[0]);
  const co = meepleOptions(s).find(o => o.t === 'city');
  finishTurn(s, { fi: co.fi });
  eq(s.phase, 'over', 'vorbei');
  eq(s.players[0].breakdown.city, 0, 'unfertige Kathedralen-Stadt = 0');
}

// ---------- 10. König & Räuber ----------
{
  const s = newGame(twoPlayers({
    expansions: { king: true },
    deckIds: ['E', 'V', 'V', 'E'],
    startId: 'D',
  }));
  placeCurrent(s, 0, -1, 2); // Stadt fertig
  finishTurn(s, null);
  eq(s.completedCities, 1, 'Stadt zählt für König');
  eq(s.king, 0, 'Anna ist König');
}

// ---------- 11. Speichern & Fortsetzen ----------
{
  const s = newGame(twoPlayers({ deckIds: ['E', 'U', 'V', 'V', 'B', 'E'], startId: 'D' }));
  placeCurrent(s, 0, -1, 2);
  finishTurn(s, { fi: 0 });
  const lp = legalPlacementsFor(s, s.drawn)[0];
  placeCurrent(s, lp.x, lp.y, lp.rots[0]);
  finishTurn(s, null);
  const save = serialize(s);
  const r = resumeGame(JSON.parse(JSON.stringify(save)));
  ok(r, 'Fortsetzen klappt');
  eq(r.players[0].score, s.players[0].score, 'Punkte identisch');
  eq(r.turn, s.turn, 'Runde identisch');
  eq(r.drawn, s.drawn, 'gleiche gezogene Karte');
  eq(r.grid.size, s.grid.size, 'gleich viele Karten');
}

// ---------- 12. Klon verändert Original nicht ----------
{
  const s = newGame(twoPlayers({ deckIds: ['E', 'E', 'U', 'V'], startId: 'D' }));
  const snap = JSON.stringify(serialize(s));
  const c = cloneState(s);
  placeCurrent(c, 0, -1, 2);
  finishTurn(c, { fi: 0 });
  eq(JSON.stringify(serialize(s)), snap, 'Original unverändert');
  eq(s.players[0].score, 0, 'Original-Punkte unverändert');
}

// ---------- 13. KI spielt komplette Partien ----------
for (const level of ['ai1', 'ai2', 'ai3']) {
  const s = newGame({
    players: [
      { name: 'KI A', color: '#e74c3c', type: level },
      { name: 'KI B', color: '#3498db', type: level },
    ],
    expansions: { river: true, inns: true, king: true }, deckScale: 1,
  });
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 400) {
    const mv = chooseMove(s);
    ok(mv, `${level}: Zug gefunden`);
    if (!mv) break;
    placeCurrent(s, mv.x, mv.y, mv.rot);
    finishTurn(s, mv.meeple);
  }
  eq(s.phase, 'over', `${level}: Partie beendet`);
  ok(s.players[0].score + s.players[1].score > 0, `${level}: Punkte vergeben`);
  const meeplesTotal = s.players.reduce((a, p) => a + p.meeples, 0);
  eq(meeplesTotal, 14, `${level}: alle Meeples zurückgegeben`);
}

// ---------- 14. Komplette Basispartie – Statistik ----------
{
  const s = newGame({
    players: [
      { name: 'A', color: '#e74c3c', type: 'ai2' },
      { name: 'B', color: '#3498db', type: 'ai3' },
      { name: 'C', color: '#f1c40f', type: 'ai1' },
    ],
    expansions: {}, deckScale: 1,
  });
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 300) {
    const mv = chooseMove(s);
    if (!mv) break;
    placeCurrent(s, mv.x, mv.y, mv.rot);
    finishTurn(s, mv.meeple);
  }
  eq(s.phase, 'over', '3-Spieler-Partie beendet');
  eq(s.grid.size + s.discards.length, 72, 'alle 72 Karten verarbeitet');
  console.log('  Beispielpartie:', s.players.map(p => `${p.name}:${p.score}`).join(' '),
    '| Karten gelegt:', s.grid.size, '| abgeworfen:', s.discards.length);
}

console.log(`\n${passed} Tests bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
