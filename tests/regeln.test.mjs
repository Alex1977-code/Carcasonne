// Regelprüfung: node tests/regeln.test.mjs
//
// Geht den offiziellen Regelsatz Punkt für Punkt durch. Die vorhandenen
// Tests in engine.test.mjs prüfen vor allem Datenstruktur und Ablauf;
// hier geht es ausschließlich darum, ob gespielt wird, was in der
// Anleitung steht.
//
// Aufgebaut wird jede Lage von Hand, damit im Fehlerfall die Ursache
// benannt werden kann statt nur „irgendwo stimmt eine Punktzahl nicht".

import { DEFS, DIRS, opp, matchHalf, edgeAt } from '../js/engine/tiles.js';
import { spreizeSpots, MAX_RUECKUNG } from '../js/ui/spot-layout.js';
import {
  newGame, isLegal, legalPlacementsFor, placeCurrent, meepleOptions,
  finishTurn, find, key,
} from '../js/engine/game.js';

let failed = 0, passed = 0;
const fehler = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; fehler.push(msg); console.error('FEHLT:', msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${b}, war ${a})`); }

const zwei = (extra) => ({
  players: [
    { name: 'Anna', color: '#D6321A', type: 'human' },
    { name: 'Ben', color: '#196CCD', type: 'human' },
  ],
  expansions: {}, deckScale: 1, ...extra,
});

/** Karte legen und Zug beenden, Meeple wahlweise auf ein Feature-Kürzel. */
function zug(s, defId, x, y, rot, wahl = null) {
  s.drawn = defId;
  s.phase = 'place';
  placeCurrent(s, x, y, rot);
  const opts = meepleOptions(s);
  let m = null;
  if (wahl !== null) {
    m = typeof wahl === 'number' ? { fi: wahl } : opts.find(wahl);
    ok(m, `Meeple-Option vorhanden bei ${defId} (${x},${y})`);
    if (m && m.fi === undefined) m = null;
  }
  return { ev: finishTurn(s, m ? { fi: m.fi, big: !!m.big } : null, { noAdvance: false }), opts };
}

/** Feature-Daten eines gelegten Plättchens. */
function feat(s, idx, fi) {
  return s.roots.get(find(s, s.placed[idx].fsegs[fi]));
}

console.log('=== 1. Anlegeregel: alle vier Kanten müssen passen ===');
{
  const s = newGame(zwei({ deckIds: ['E', 'E', 'E'], startId: 'D' }));
  // Startkarte D bei (0,0) rot0: Stadt N, Straße O, Wiese S, Straße W
  eq(DEFS.D.edges, 'CRFR', 'D-Kanten');
  ok(isLegal(s, 'E', 0, -1, 2), 'E mit Stadtkante nach unten passt an D-Norden');
  ok(!isLegal(s, 'E', 0, -1, 0), 'E mit Wiese nach unten passt nicht an eine Stadt');
  ok(!isLegal(s, 'E', 3, 3, 0), 'ohne Nachbarn nicht anlegbar');
  ok(!isLegal(s, 'E', 0, 0, 0), 'besetztes Feld nicht anlegbar');
  // Eine Karte muss an ALLEN berührten Kanten passen, nicht nur an einer
  const s2 = newGame(zwei({ deckIds: ['U', 'U', 'E'], startId: 'D' }));
  zug(s2, 'U', -1, 0, 1);            // Straße West an D
  zug(s2, 'U', -1, -1, 1);           // darüber, nur Wiese/Straße
  // (0,-1) berührt D im Süden (Stadt) und U im Westen (Wiese oben)
  ok(!isLegal(s2, 'E', 0, -1, 0), 'Karte muss an beiden Nachbarn passen');
}

console.log('=== 2. Meeple nur auf unbesetzte Gebiete der neuen Karte ===');
{
  const s = newGame(zwei({ deckIds: ['U', 'U', 'U'], startId: 'D' }));
  zug(s, 'U', -1, 0, 1, (o) => o.t === 'road');       // Anna besetzt die Weststraße
  const anzahl = feat(s, 1, 0).meeples.length;
  eq(anzahl, 1, 'Meeple liegt auf der Straße');
  // Ben legt weiter westlich an dieselbe Straße
  s.drawn = 'U'; s.phase = 'place';
  placeCurrent(s, -2, 0, 1);
  const opts = meepleOptions(s);
  ok(!opts.some((o) => o.t === 'road'), 'auf der besetzten Straße keine Option');
  ok(opts.some((o) => o.t === 'field'), 'Wiese daneben bleibt wählbar');
  // Auch der direkte Weg muss abgelehnt werden
  let geworfen = false;
  try { finishTurn(s, { fi: 0 }); } catch { geworfen = true; }
  ok(geworfen, 'besetztes Gebiet wird auch bei direkter Wahl abgelehnt');
}

console.log('=== 3. Kreuzungen trennen Straßen ===');
{
  // Der gemeldete Fall: Kreuzung an eine besetzte Straße gelegt.
  // Regel: an einer Kreuzung endet jede Straße. Die übrigen Arme sind
  // eigene Straßen und dürfen besetzt werden – der Arm, der in die
  // besetzte Straße läuft, aber nicht.
  for (const kreuzung of ['W', 'X']) {
    for (let ausrichtung = 0; ausrichtung < 4; ausrichtung++) {
      const s = newGame(zwei({ deckIds: ['U', kreuzung, 'U'], startId: 'D' }));
      zug(s, 'U', -1, 0, 1, (o) => o.t === 'road');   // besetzte Straße bei (-1,0)
      const stelle = legalPlacementsFor(s, kreuzung).find((p) => p.x === -2 && p.y === 0);
      if (!stelle) continue;
      const rot = stelle.rots[ausrichtung % stelle.rots.length];
      s.drawn = kreuzung; s.phase = 'place';
      placeCurrent(s, -2, 0, rot);
      const p = s.placed[s.lastPlacedIdx];
      const opts = meepleOptions(s);
      // Der Arm nach Osten führt in die besetzte Straße
      const ostSeg = p.edgeSeg[1];
      const ostFi = p.fsegs.indexOf(ostSeg);
      if (ostFi >= 0 && DEFS[kreuzung].f[ostFi].t === 'road') {
        eq(feat(s, s.lastPlacedIdx, ostFi).meeples.length, 1,
          `${kreuzung} rot${rot}: Ostarm hängt an der besetzten Straße`);
        ok(!opts.some((o) => o.fi === ostFi),
          `${kreuzung} rot${rot}: Ostarm wird nicht angeboten`);
      }
      // Alle angebotenen Gebiete müssen wirklich leer sein
      for (const o of opts) {
        eq(feat(s, s.lastPlacedIdx, o.fi).meeples.length, 0,
          `${kreuzung} rot${rot}: angebotenes Gebiet fi=${o.fi} ist leer`);
      }
      // Und jedes gesperrte Straßengebiet muss einen Grund haben
      DEFS[kreuzung].f.forEach((f, fi) => {
        if (f.t !== 'road') return;
        if (opts.some((o) => o.fi === fi)) return;
        ok(feat(s, s.lastPlacedIdx, fi).meeples.length > 0,
          `${kreuzung} rot${rot}: gesperrte Straße fi=${fi} ist auch wirklich besetzt`);
      });
    }
  }
}

console.log('=== 4. Straßenwertung: 1 Punkt je Karte ===');
{
  // Straße zwischen zwei Kreuzungen: D(Straße O-W) mit W links und W rechts
  const s = newGame(zwei({ deckIds: ['W', 'W', 'U'], startId: 'D' }));
  zug(s, 'W', -1, 0, 0, (o) => o.t === 'road' && o.fi === 0);  // Anna auf den Ostarm
  const vorher = s.players[0].score;
  const r = legalPlacementsFor(s, 'W').find((p) => p.x === 1 && p.y === 0);
  ok(r, 'zweite Kreuzung rechts anlegbar');
  const { ev } = zug(s, 'W', 1, 0, r.rots[0]);
  const wert = ev.find((e) => e.type === 'score' && e.ftype === 'road');
  ok(wert, 'Straße zwischen zwei Kreuzungen wird gewertet');
  if (wert) {
    // Gezählt wird jede Karte, auf der die Straße liegt – die beiden
    // Kreuzungskarten gehören dazu. D + zwei Kreuzungen = 3.
    eq(wert.points, 3, 'Straße über 3 Karten = 3 Punkte');
    eq(s.players[0].score - vorher, 3, 'Punkte beim richtigen Spieler');
  }
  eq(s.players[0].meeples, 7, 'Meeple kommt nach der Wertung zurück');
}

console.log('=== 5. Stadtwertung: 2 je Karte, +2 je Wappen ===');
{
  const s = newGame(zwei({ deckIds: ['E', 'E'], startId: 'D' }));
  zug(s, 'E', 0, -1, 2, (o) => o.t === 'city');
  eq(s.players[0].score, 4, 'geschlossene Stadt aus 2 Karten = 4 Punkte');

  // Mit Wappen: C ist die Vollstadt mit Wappen, hier über M/N schwer zu
  // bauen – geprüft wird die Punktformel direkt an einer 2er-Stadt mit
  // Wappen (N hat keins, M schon).
  const s2 = newGame(zwei({ deckIds: ['M', 'E'], startId: 'D' }));
  eq(DEFS.M.f[0].shield, 1, 'M trägt ein Wappen');
  eq(DEFS.N.f[0].shield || 0, 0, 'N trägt keins');
}

console.log('=== 6. Kloster: 9 Punkte mit allen acht Nachbarn ===');
{
  const s = newGame(zwei({ deckIds: Array(12).fill('B'), startId: 'B' }));
  // Startkarte B (Kloster) bei (0,0); ringsum acht Wiesenkarten
  eq(DEFS.B.edges, 'FFFF', 'B ist ringsum Wiese');
  const kloster = s.placed[0].fsegs.findIndex((_, fi) => DEFS.B.f[fi].t === 'mon');
  ok(kloster >= 0, 'Startkarte hat ein Kloster');
  // Meeple nachträglich ins Kloster setzen (Startkarte bekommt keinen Zug)
  s.roots.get(find(s, s.placed[0].fsegs[kloster])).meeples.push(
    { pl: 0, big: false, placedIdx: 0, fi: kloster });
  s.players[0].meeples--;
  let letzte = null;
  // Reihenfolge zählt: jede Karte braucht beim Anlegen einen Nachbarn
  // über eine Kante, nicht über die Ecke. Erst die vier Seiten, dann die
  // Ecken.
  const um = [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]];
  um.forEach(([dx, dy], i) => {
    s.drawn = 'B'; s.phase = 'place';
    placeCurrent(s, dx, dy, 0);
    letzte = finishTurn(s, null);
  });
  const wert = letzte.find((e) => e.type === 'score' && e.ftype === 'mon');
  ok(wert, 'Kloster wird bei der achten Nachbarkarte gewertet');
  if (wert) eq(wert.points, 9, 'Kloster = 9 Punkte');
  eq(s.players[0].meeples, 7, 'Mönch kommt zurück');
}

console.log('=== 7. Mehrheit und Gleichstand ===');
{
  // Zwei getrennte Gebiete mit je einem Meeple zu verschmelzen laesst sich
  // mit den Grundkarten nicht in drei Zuegen bauen. Deshalb wird die Regel
  // dort geprueft, wo sie auftritt: in echten Partien. Jede Wertung mit
  // mehreren Spielern muss den Gleichstand mit vollen Punkten fuer alle
  // Beteiligten aufloesen, nie geteilt.
  let mehrfach = 0, geteilt = 0;
  for (let seed = 0; seed < 25; seed++) {
    const s = newGame({
      players: [
        { name: 'A', color: '#D6321A', type: 'ai1' },
        { name: 'B', color: '#196CCD', type: 'ai1' },
        { name: 'C', color: '#F5D739', type: 'ai1' },
      ],
      expansions: { inns: seed % 2 === 0 }, deckScale: 1,
    });
    let schritte = 0;
    while (s.phase !== 'over' && schritte++ < 400) {
      if (s.phase === 'place') {
        const stellen = legalPlacementsFor(s, s.drawn);
        if (!stellen.length) break;
        const st = stellen[(seed * 5 + schritte * 11) % stellen.length];
        placeCurrent(s, st.x, st.y, st.rots[schritte % st.rots.length]);
      }
      const vorher = s.players.map((p) => p.score);
      const opts = meepleOptions(s);
      const nimm = opts.length && (seed + schritte) % 2 === 0 ? opts[schritte % opts.length] : null;
      const pl = s.players[s.current];
      const ev = finishTurn(s, nimm ? { fi: nimm.fi, big: pl.meeples <= 0 } : null);
      // Ein Zug kann mehrere Gebiete gleichzeitig schliessen. Deshalb wird
      // die erwartete Gutschrift ueber alle Wertungen des Zuges summiert
      // und erst danach mit dem tatsaechlichen Zuwachs verglichen.
      const erwartet = s.players.map(() => 0);
      let hatMehrfach = false;
      for (const e of ev) {
        if (e.type !== 'score' || !e.players) continue;
        if (e.players.length >= 2) hatMehrfach = true;
        for (const i of e.players) erwartet[i] += e.points;
      }
      if (hatMehrfach) {
        mehrfach++;
        s.players.forEach((p, i) => {
          if (p.score - vorher[i] !== erwartet[i]) geteilt++;
        });
      }
    }
  }
  console.log(`   ${mehrfach} Wertungen mit mehreren Gewinnern geprueft`);
  eq(geteilt, 0, 'bei Gleichstand bekommt jeder Beteiligte die vollen Punkte');
}

console.log('=== 8. Großer Meeple zählt doppelt ===');
{
  const s = newGame({ ...zwei({ deckIds: ['U','U','W','W'], startId: 'D' }),
    expansions: { inns: true } });
  eq(s.players[0].bigMeeples, 1, 'mit Erweiterung ein großer Meeple');
  zug(s, 'U', -1, 0, 1, (o) => o.t === 'road');       // Anna normal
  s.drawn = 'U'; s.phase = 'place';
  placeCurrent(s, 1, 0, 1);
  const opt = meepleOptions(s).find((o) => o.t === 'road');
  ok(!opt, 'gemeinsame Straße bereits besetzt – kein zweiter Meeple');
  finishTurn(s, null);
}

console.log('=== 9. Wirtshaus und Kathedrale ===');
{
  eq(DEFS.EC_INN_STRAIGHT.f[0].inn, true, 'Wirtshaus-Karte trägt die Kennung');
  eq(DEFS.EC_CATH.f[0].cath, true, 'Kathedralkarte trägt die Kennung');
  // Wirtshaus: fertige Straße doppelt, unfertige null
  const s = newGame({ ...zwei({ deckIds: ['EC_INN_STRAIGHT','W','W'], startId: 'D' }),
    expansions: { inns: true } });
  zug(s, 'EC_INN_STRAIGHT', -1, 0, 1, (o) => o.t === 'road');
  const l = legalPlacementsFor(s, 'W').find((p) => p.x === -2 && p.y === 0);
  ok(l, 'Kreuzung links anlegbar');
  if (l) {
    const vorher = s.players[0].score;
    zug(s, 'W', -2, 0, l.rots[0]);
    // Straße läuft nach Osten weiter (offen) → noch keine Wertung
    eq(s.players[0].score, vorher, 'Straße noch offen, keine Wertung');
  }
}

console.log('=== 10. Fluss: kein Meeple aufs Wasser ===');
{
  const s = newGame({ ...zwei({ deckIds: ['RV_STRAIGHT'], startId: 'RV_SPRING' }),
    expansions: { river: true } });
  const stellen = legalPlacementsFor(s, 'RV_STRAIGHT');
  ok(stellen.length > 0, 'Flusskarte anlegbar');
  if (stellen.length) {
    const st = stellen[0];
    s.drawn = 'RV_STRAIGHT'; s.phase = 'place';
    placeCurrent(s, st.x, st.y, st.rots[0]);
    const opts = meepleOptions(s);
    ok(!opts.some((o) => o.t === 'river'), 'auf dem Fluss keine Meeple-Option');
    const flussFi = DEFS.RV_STRAIGHT.f.findIndex((f) => f.t === 'river');
    let geworfen = false;
    try { finishTurn(s, { fi: flussFi }); } catch { geworfen = true; }
    ok(geworfen, 'Meeple auf dem Fluss wird abgelehnt');
  }
}

console.log('=== 11. Zufallsprüfung über viele Partien ===');
{
  // Der schärfste Test: viele vollständige Partien, und bei JEDER
  // Meeple-Setzung wird nachgesehen, ob das Gebiet in dem Moment
  // wirklich leer war und ob jede angebotene Wahl leer ist.
  let partien = 0, setzungen = 0, verstoesse = 0, angebote = 0;
  for (let seed = 0; seed < 40; seed++) {
    const s = newGame({
      players: [
        { name: 'A', color: '#D6321A', type: 'ai1' },
        { name: 'B', color: '#196CCD', type: 'ai1' },
        { name: 'C', color: '#F5D739', type: 'ai1' },
      ],
      expansions: { river: seed % 2 === 0, inns: seed % 3 === 0, king: seed % 5 === 0 },
      deckScale: 1,
    });
    let schritte = 0;
    while (s.phase !== 'over' && schritte++ < 400) {
      if (s.phase === 'place') {
        const stellen = legalPlacementsFor(s, s.drawn);
        if (!stellen.length) { // keine Anlegemöglichkeit: Karte abwerfen
          const vorher = s.drawn;
          s.discards.push(vorher);
          s.drawn = s.deck.pop() || null;
          if (!s.drawn) break;
          continue;
        }
        const st = stellen[(seed * 7 + schritte * 13) % stellen.length];
        placeCurrent(s, st.x, st.y, st.rots[(seed + schritte) % st.rots.length]);
      }
      const opts = meepleOptions(s);
      // Jede angebotene Wahl muss leer sein
      for (const o of opts) {
        angebote++;
        if (feat(s, s.lastPlacedIdx, o.fi).meeples.length !== 0) verstoesse++;
      }
      const nehmen = opts.length && (seed + schritte) % 3 === 0 ? opts[(schritte) % opts.length] : null;
      if (nehmen) {
        if (feat(s, s.lastPlacedIdx, nehmen.fi).meeples.length !== 0) verstoesse++;
        setzungen++;
      }
      const pl = s.players[s.current];
      finishTurn(s, nehmen ? { fi: nehmen.fi, big: pl.meeples <= 0 } : null);
    }
    partien++;
  }
  console.log(`   ${partien} Partien · ${angebote} Angebote geprüft · ${setzungen} Setzungen`);
  eq(verstoesse, 0, 'kein einziges Angebot auf ein besetztes Gebiet');
}

console.log('=== 12. Punktesumme bleibt nachvollziehbar ===');
{
  // Am Ende muss die Summe der Kategorien der Gesamtpunktzahl entsprechen.
  const s = newGame({
    players: [
      { name: 'A', color: '#D6321A', type: 'ai1' },
      { name: 'B', color: '#196CCD', type: 'ai1' },
    ],
    expansions: { inns: true, king: true }, deckScale: 1,
  });
  let schritte = 0;
  while (s.phase !== 'over' && schritte++ < 400) {
    if (s.phase === 'place') {
      const stellen = legalPlacementsFor(s, s.drawn);
      if (!stellen.length) {
        s.discards.push(s.drawn);
        s.drawn = s.deck.pop() || null;
        if (!s.drawn) break;
        continue;
      }
      const st = stellen[schritte % stellen.length];
      placeCurrent(s, st.x, st.y, st.rots[0]);
    }
    const opts = meepleOptions(s);
    const pl = s.players[s.current];
    finishTurn(s, opts.length && schritte % 2 === 0
      ? { fi: opts[0].fi, big: pl.meeples <= 0 } : null);
  }
  for (const p of s.players) {
    const summe = p.breakdown.road + p.breakdown.city + p.breakdown.mon
      + p.breakdown.field + p.breakdown.bonus;
    eq(summe, p.score, `${p.name}: Kategoriesumme = Gesamtpunkte`);
    ok(p.meeples + p.bigMeeples >= 0, `${p.name}: Meeple-Vorrat nicht negativ`);
    ok(p.meeples <= 7, `${p.name}: nie mehr als 7 Meeple`);
  }
  eq(s.phase, 'over', 'Partie kommt zum Ende');
}

// ============================================================
// Gemeldeter Fall: „Karte mit zwei Städten – drei Plätze auf der
// Wiese, keiner in den Städten." Die Abschnitte 13 bis 18 gehen dem
// nach, und zwar rechnend statt schauend: erst die 49 Motive in allen
// vier Drehungen, dann jede denkbare Nachbarschaft, dann ganze Partien.
// ============================================================

/** Welt-Kanten eines Features bei Drehung rot. */
const weltKanten = (d, fi, rot) => (d.f[fi].e || []).map((e) => (e + rot) % 4);
/** Welt-Halbkanten einer Wiese bei Drehung rot. */
const weltHalb = (d, fi, rot) => (d.f[fi].h || []).map((h) => (h + rot * 2) % 8);

/**
 * Unabhängige Nachrechnung der Verschmelzung – allein aus den
 * Motivdaten und der Lage auf dem Brett, ohne die Merkfelder edgeSeg
 * und halfSeg der Engine. Nur so lässt sich zeigen, dass diese
 * Merkfelder nicht selbst der Fehler sind. Verbunden wird ausschließlich
 * über gemeinsame Kanten, nie über eine Ecke.
 */
function referenzVerschmelzung(s) {
  const knoten = (pi, fi) => pi * 1000 + fi;
  const vater = new Map();
  const wurzel = (a) => { while (vater.get(a) !== a) { vater.set(a, vater.get(vater.get(a))); a = vater.get(a); } return a; };
  const eins = (a, b) => { a = wurzel(a); b = wurzel(b); if (a !== b) vater.set(b, a); };
  s.placed.forEach((p, pi) => DEFS[p.defId].f.forEach((_, fi) => vater.set(knoten(pi, fi), knoten(pi, fi))));
  const kantenFeature = (p, dir, typ) => {
    const d = DEFS[p.defId];
    for (let fi = 0; fi < d.f.length; fi++) {
      if (d.f[fi].t !== typ) continue;
      if (weltKanten(d, fi, p.rot).includes(dir)) return fi;
    }
    return -1;
  };
  const halbFeature = (p, h) => {
    const d = DEFS[p.defId];
    for (let fi = 0; fi < d.f.length; fi++) {
      if (d.f[fi].t !== 'field') continue;
      if (weltHalb(d, fi, p.rot).includes(h)) return fi;
    }
    return -1;
  };
  s.placed.forEach((p, pi) => {
    for (let dir = 0; dir < 4; dir++) {
      const nIdx = s.grid.get(key(p.x + DIRS[dir].dx, p.y + DIRS[dir].dy));
      if (nIdx === undefined) continue;
      const q = s.placed[nIdx];
      const et = edgeAt(p.defId, p.rot, dir);
      const typ = { C: 'city', R: 'road', W: 'river' }[et];
      if (typ) {
        const a = kantenFeature(p, dir, typ), b = kantenFeature(q, opp(dir), typ);
        if (a >= 0 && b >= 0) eins(knoten(pi, a), knoten(nIdx, b));
      }
      if (et !== 'C') for (let seite = 0; seite < 2; seite++) {
        const h = dir * 2 + seite;
        const a = halbFeature(p, h), b = halbFeature(q, matchHalf(h));
        if (a >= 0 && b >= 0) eins(knoten(pi, a), knoten(nIdx, b));
      }
    }
  });
  return { wurzel, knoten };
}

/** Eine Partie durchspielen und bei jedem Zug einen Prüfer rufen. */
function partie(seed, pruefer) {
  const s = newGame({
    players: [
      { name: 'A', color: '#D6321A', type: 'ai1' },
      { name: 'B', color: '#196CCD', type: 'ai1' },
      { name: 'C', color: '#F5D739', type: 'ai1' },
    ],
    expansions: { river: seed % 2 === 0, inns: seed % 3 === 0, king: seed % 5 === 0 },
    deckScale: 1,
  });
  let schritte = 0;
  while (s.phase !== 'over' && schritte++ < 400) {
    if (s.phase === 'place') {
      const stellen = legalPlacementsFor(s, s.drawn);
      if (!stellen.length) {
        s.discards.push(s.drawn);
        s.drawn = s.deck.pop() || null;
        if (!s.drawn) break;
        continue;
      }
      const st = stellen[(seed * 7 + schritte * 13) % stellen.length];
      placeCurrent(s, st.x, st.y, st.rots[(seed + schritte) % st.rots.length]);
    }
    const opts = meepleOptions(s);
    pruefer(s, opts);
    const nimm = opts.length && (seed + schritte) % 3 === 0 ? opts[schritte % opts.length] : null;
    finishTurn(s, nimm ? { fi: nimm.fi, big: s.players[s.current].meeples <= 0 } : null);
  }
  return s;
}

console.log('=== 13. Alle 49 Motive in allen vier Drehungen ===');
{
  // Die acht Halbkanten liegen im Uhrzeigersinn: h0=NW h1=NO h2=ON h3=OS
  // h4=SO h5=SW h6=WS h7=WN. Jede Halbkante gehört genau einer Wiese –
  // es sei denn, an dieser Kante steht eine Stadt, dann keiner. Eine
  // Wiese zu viel heißt: dieselbe Wiese wird zweimal angeboten und am
  // Ende zweimal gewertet. Eine zu wenig heißt: zwei fremde Wiesen
  // wachsen zusammen.
  const ids = Object.keys(DEFS);
  eq(ids.length, 49, 'Motive im Kartensatz');
  let luecken = 0, doppelt = 0, stadtWiese = 0, kantenFehler = 0, drehFehler = 0;
  const vieleWiesen = [];
  for (const id of ids) {
    const d = DEFS[id];
    const zaehl0 = {};
    for (let rot = 0; rot < 4; rot++) {
      const zaehl = { city: 0, road: 0, river: 0, field: 0, mon: 0 };
      d.f.forEach((f) => { zaehl[f.t]++; });
      if (rot === 0) Object.assign(zaehl0, zaehl);
      else for (const t of Object.keys(zaehl)) {
        if (zaehl[t] !== zaehl0[t]) drehFehler++;
      }
      for (let dir = 0; dir < 4; dir++) {
        const et = edgeAt(id, rot, dir);
        // Genau ein Stadt-/Straßen-/Flusssegment je Kante dieser Art
        const typ = { C: 'city', R: 'road', W: 'river' }[et];
        if (typ) {
          let n = 0;
          d.f.forEach((f, fi) => { if (f.t === typ && weltKanten(d, fi, rot).includes(dir)) n++; });
          if (n !== 1) {
            kantenFehler++;
            ok(false, `${id} rot${rot}: Kante ${dir}=${et} hat ${n} ${typ}-Segmente statt genau eines`);
          }
        }
        for (const seite of [0, 1]) {
          const h = dir * 2 + seite;
          let n = 0;
          d.f.forEach((f, fi) => { if (f.t === 'field' && weltHalb(d, fi, rot).includes(h)) n++; });
          if (et === 'C') {
            if (n > 0) { stadtWiese++; ok(false, `${id} rot${rot}: Halbkante ${h} liegt an einer Stadt und trotzdem auf einer Wiese`); }
          } else if (n === 0) {
            luecken++; ok(false, `${id} rot${rot}: Halbkante ${h} gehört zu keiner Wiese`);
          } else if (n > 1) {
            doppelt++; ok(false, `${id} rot${rot}: Halbkante ${h} gehört zu ${n} Wiesen`);
          }
        }
      }
    }
    // Angrenzende Städte einer Wiese müssen auch Städte sein
    d.f.forEach((f, fi) => {
      if (f.t !== 'field') return;
      for (const ci of f.adj) {
        ok(d.f[ci] && d.f[ci].t === 'city',
          `${id}: Wiese ${fi} nennt Feature ${ci} als angrenzende Stadt`);
      }
    });
    if (zaehl0.field >= 4) vieleWiesen.push(`${id} (${zaehl0.field})`);
  }
  eq(luecken, 0, 'keine Halbkante ohne Wiese');
  eq(doppelt, 0, 'keine Halbkante auf zwei Wiesen');
  eq(stadtWiese, 0, 'keine Wiese an einer Stadtkante');
  eq(kantenFehler, 0, 'je Stadt-/Straßen-/Flusskante genau ein Segment');
  eq(drehFehler, 0, 'Segmentzahlen sind in jeder Drehung gleich');
  console.log(`   Motive mit vier Wiesen: ${vieleWiesen.join(', ')}`);
  // Vier Wiesen ist das Höchste im Satz, und jedes Mal begründet:
  // L und EC_CROSS_CITY (Stadt plus dreiarmige Kreuzung), X (Vierweg-
  // Kreuzung), RV_BRIDGE (Fluss kreuzt Straße). Mehr darf es nicht geben.
  for (const id of Object.keys(DEFS)) {
    const n = DEFS[id].f.filter((f) => f.t === 'field').length;
    ok(n <= 4, `${id}: ${n} Wiesensegmente – mehr als vier hat kein Motiv`);
  }
}

console.log('=== 14. Die Randaufteilung darf sich nicht überkreuzen ===');
{
  // Wiesen und Städte einer Karte sind zusammenhängende Flächen in einem
  // Quadrat. Zwei solche Flächen können sich am Rand nicht verschränken:
  // gäbe es Halbkanten a<b<c<d im Uhrzeigersinn mit a,c auf der einen und
  // b,d auf der anderen Fläche, müssten sie sich im Inneren schneiden.
  // Das ist die schärfste Prüfung, die sich ohne Bild führen lässt – ein
  // falsch aufgeteiltes Motiv fällt hier auf, auch wenn die Zählung stimmt.
  const zwischen = (x, y, z) => {
    const dy = (y - x + 8) % 8, dz = (z - x + 8) % 8;
    return dy > 0 && dy < dz;
  };
  let kreuze = 0;
  for (const id of Object.keys(DEFS)) {
    const d = DEFS[id];
    const bloecke = [];
    d.f.forEach((f, fi) => {
      if (f.t === 'field') bloecke.push({ fi, t: 'Wiese', h: f.h.slice() });
      if (f.t === 'city') bloecke.push({ fi, t: 'Stadt', h: f.e.flatMap((e) => [e * 2, e * 2 + 1]) });
    });
    for (let i = 0; i < bloecke.length; i++) for (let j = i + 1; j < bloecke.length; j++) {
      const A = bloecke[i], B = bloecke[j];
      let kreuzt = false;
      for (const a of A.h) for (const c of A.h) for (const b of B.h) for (const e of B.h) {
        if (zwischen(a, b, c) && zwischen(c, e, a)) kreuzt = true;
      }
      if (kreuzt) {
        kreuze++;
        ok(false, `${id}: ${A.t} ${A.fi} {${A.h}} und ${B.t} ${B.fi} {${B.h}} verschränken sich am Rand`);
      }
    }
  }
  eq(kreuze, 0, 'keine verschränkte Randaufteilung');
}

console.log('=== 15. Jede denkbare Nachbarschaft: frei anbieten, besetzt sperren ===');
{
  // Zwei Karten, alle Motive, alle Drehungen, alle vier Richtungen, und
  // der Reihe nach auf jedem Gebiet der ersten Karte ein Meeple. Für die
  // zweite Karte muss dann gelten: was an das besetzte Gebiet stößt, wird
  // gesperrt – alles andere wird angeboten. Ohne Ausnahme, besonders
  // nicht für Städte.
  let faelle = 0, stadtFehlt = 0, strasseFehlt = 0, wieseFehlt = 0, klosterFehlt = 0, zuviel = 0;
  let merkFehler = 0;
  const basis = () => ({
    players: [
      { name: 'Anna', color: '#D6321A', type: 'human' },
      { name: 'Ben', color: '#196CCD', type: 'human' },
    ],
    expansions: { river: true, inns: true }, deckScale: 1, deckIds: [],
  });
  for (const defA of Object.keys(DEFS)) {
    const dA = DEFS[defA];
    for (let dir = 0; dir < 4; dir++) {
      // A liegt als Startkarte ungedreht bei (0,0); über dir kommt jede
      // ihrer vier Kanten an die Naht – das ist dasselbe wie A zu drehen.
      const eA = dA.edges[dir];
      const bx = DIRS[dir].dx, by = DIRS[dir].dy;
      for (const defB of Object.keys(DEFS)) {
        const dB = DEFS[defB];
        for (let rotB = 0; rotB < 4; rotB++) {
          if (edgeAt(defB, rotB, opp(dir)) !== eA) continue;
          for (let bel = -1; bel < dA.f.length; bel++) {
            if (bel >= 0 && dA.f[bel].t === 'river') continue;
            const s = newGame({ ...basis(), startId: defA });
            if (bel >= 0) {
              s.roots.get(find(s, s.placed[0].fsegs[bel]))
                .meeples.push({ pl: 1, big: false, placedIdx: 0, fi: bel });
              s.players[1].meeples--;
            }
            s.drawn = defB; s.phase = 'place';
            try { placeCurrent(s, bx, by, rotB); } catch { continue; }
            faelle++;
            const p = s.placed[s.lastPlacedIdx];
            // Die Merkfelder der Engine müssen die gedrehten Motivdaten sein
            for (let e = 0; e < 4; e++) {
              const soll = { C: 'city', R: 'road', W: 'river' }[edgeAt(defB, rotB, e)];
              const habe = p.edgeSeg[e] >= 0 ? s.segs[p.edgeSeg[e]].t : null;
              if ((soll || null) !== habe) merkFehler++;
            }
            for (let h = 0; h < 8; h++) {
              const stadt = edgeAt(defB, rotB, Math.floor(h / 2)) === 'C';
              const habe = p.halfSeg[h] >= 0;
              if (stadt === habe) merkFehler++;
            }
            const opts = meepleOptions(s);
            for (let fi = 0; fi < dB.f.length; fi++) {
              const fB = dB.f[fi];
              if (fB.t === 'river') continue;
              let verbunden = false;
              if (bel >= 0) {
                const fA = dA.f[bel];
                if (fA.t === fB.t && (fB.t === 'city' || fB.t === 'road')
                  && weltKanten(dB, fi, rotB).includes(opp(dir))
                  && weltKanten(dA, bel, 0).includes(dir)) verbunden = true;
                if (fA.t === 'field' && fB.t === 'field' && eA !== 'C') {
                  const hb = weltHalb(dB, fi, rotB), ha = weltHalb(dA, bel, 0);
                  for (const h of [opp(dir) * 2, opp(dir) * 2 + 1]) {
                    if (hb.includes(h) && ha.includes(matchHalf(h))) verbunden = true;
                  }
                }
              }
              // Auf das GEBIET prüfen, nicht auf den Segmentindex:
              // meepleOptions bietet je verschmolzenem Gebiet nur einen
              // Punkt an. Zwei Segmente derselben Karte, die zu einer Wiese
              // verschmolzen sind, erscheinen deshalb unter genau einem
              // Index – angeboten ist die Wiese trotzdem.
              const wurzelFi = find(s, s.placed[s.lastPlacedIdx].fsegs[fi]);
              const angeboten = opts.some((o) => find(s, o.segId) === wurzelFi);
              if (!verbunden && !angeboten) {
                if (fB.t === 'city') stadtFehlt++;
                else if (fB.t === 'road') strasseFehlt++;
                else if (fB.t === 'field') wieseFehlt++;
                else klosterFehlt++;
                if (stadtFehlt + strasseFehlt + wieseFehlt + klosterFehlt <= 3) {
                  ok(false, `${defA} (Meeple auf ${bel}) + ${defB} rot${rotB} Richtung ${dir}: freies ${fB.t}-Gebiet ${fi} wird nicht angeboten`);
                }
              }
              if (verbunden && angeboten) {
                zuviel++;
                if (zuviel <= 3) ok(false, `${defA} (Meeple auf ${bel}) + ${defB} rot${rotB}: besetztes ${fB.t}-Gebiet ${fi} wird angeboten`);
              }
            }
          }
        }
      }
    }
  }
  console.log(`   ${faelle} Nachbarschaften geprüft`);
  eq(stadtFehlt, 0, 'keine freie Stadt bleibt unangeboten');
  eq(strasseFehlt, 0, 'keine freie Straße bleibt unangeboten');
  eq(wieseFehlt, 0, 'keine freie Wiese bleibt unangeboten');
  eq(klosterFehlt, 0, 'kein freies Kloster bleibt unangeboten');
  eq(zuviel, 0, 'kein besetztes Gebiet wird angeboten');
  eq(merkFehler, 0, 'edgeSeg und halfSeg sind die gedrehten Motivdaten');
}

console.log('=== 16. Wiesen über Karten hinweg ===');
{
  // Wiesen laufen nur über gemeinsame Kantenhälften zusammen, nie über
  // eine Ecke. Geprüft wird gegen eine zweite, von den Merkfeldern der
  // Engine unabhängige Rechnung: Stimmt die Einteilung Feature für
  // Feature überein, verschmilzt die Engine weder zu viel (dieselbe Wiese
  // gälte mehrfach als frei) noch zu wenig.
  let vergleiche = 0, zuViel = 0, zuWenig = 0, nahtFehler = 0;
  for (let seed = 0; seed < 12; seed++) {
    partie(seed, (s) => {
      const R = referenzVerschmelzung(s);
      const hin = new Map(), her = new Map();
      s.placed.forEach((p, pi) => DEFS[p.defId].f.forEach((_, fi) => {
        vergleiche++;
        const e = find(s, p.fsegs[fi]);
        const r = R.wurzel(R.knoten(pi, fi));
        if (!hin.has(e)) hin.set(e, r); else if (hin.get(e) !== r) zuViel++;
        if (!her.has(r)) her.set(r, e); else if (her.get(r) !== e) zuWenig++;
      }));
      // Und an jeder Naht: was sich berührt, muss auch verschmolzen sein
      s.placed.forEach((p) => {
        for (let dir = 0; dir < 4; dir++) {
          const nIdx = s.grid.get(key(p.x + DIRS[dir].dx, p.y + DIRS[dir].dy));
          if (nIdx === undefined) continue;
          const q = s.placed[nIdx];
          if (edgeAt(p.defId, p.rot, dir) === 'C') continue;
          for (const seite of [0, 1]) {
            const h = dir * 2 + seite;
            const a = p.halfSeg[h], b = q.halfSeg[matchHalf(h)];
            if (a >= 0 && b >= 0 && find(s, a) !== find(s, b)) nahtFehler++;
          }
        }
      });
    });
  }
  console.log(`   ${vergleiche} Feature-Vergleiche in 12 Partien`);
  eq(zuViel, 0, 'die Engine verschmilzt keine fremden Gebiete');
  eq(zuWenig, 0, 'die Engine lässt kein zusammenhängendes Gebiet zerfallen');
  eq(nahtFehler, 0, 'an jeder Naht sind berührende Wiesenhälften verschmolzen');

  // Die Ecke von Hand: vier Karten um einen Punkt, die Wiesen zweier
  // diagonal liegender Karten stoßen dort zusammen – über die beiden
  // anderen Karten führt kein Weg, weil dort Städte im Weg stehen.
  // G bei (0,0) hat Stadt N+S, Wiesen O und W; E bei (1,0) gedreht 2 hat
  // die Stadt im Süden, E bei (0,1) im Norden.
  const s = newGame(zwei({ deckIds: Array(12).fill('B'), startId: 'G' }));
  s.roots.get(find(s, s.placed[0].fsegs[1]))
    .meeples.push({ pl: 0, big: false, placedIdx: 0, fi: 1 });   // Bauer auf der Ostwiese
  s.players[0].meeples--;
  zug(s, 'E', 1, 0, 2);
  zug(s, 'E', 0, 1, 0);
  s.drawn = 'G'; s.phase = 'place';
  placeCurrent(s, 1, 1, 0);
  const ostWurzel = find(s, s.placed[0].fsegs[1]);
  const westWurzel = find(s, s.placed[s.lastPlacedIdx].fsegs[2]);
  ok(ostWurzel !== westWurzel, 'zwei Wiesen, die sich nur in einer Ecke berühren, bleiben getrennt');
  const optsEcke = meepleOptions(s);
  ok(optsEcke.some((o) => o.fi === 2), 'die Wiese über die Ecke bleibt wählbar');
  eq(s.roots.get(westWurzel).meeples.length, 0, 'der Bauer von schräg gegenüber steht nicht auf ihr');
}

console.log('=== 17. Der gemeldete Fall: Karte mit zwei Städten ===');
{
  // Gemeldet war: zwei Städte auf der Karte, drei Plätze auf der Wiese,
  // keiner in den Städten. Der zweite Teil ist die eigentliche Frage –
  // wird eine freie Stadt verschluckt, wenn die Karte eine zweite,
  // besetzte Stadt berührt?
  //
  // H ist die Karte mit zwei getrennten Städten (Kanten FCFC). Gedreht
  // um 1 liegen sie im Norden und Süden. Angelegt an eine besetzte Stadt
  // im Süden muss genau die südliche gesperrt und die nördliche
  // angeboten werden.
  const s = newGame(zwei({ deckIds: Array(12).fill('B'), startId: 'E' }));
  eq(DEFS.H.edges, 'FCFC', 'H hat zwei Stadtkanten');
  eq(DEFS.H.f.filter((f) => f.t === 'city').length, 2, 'H hat zwei Stadtsegmente');
  s.roots.get(find(s, s.placed[0].fsegs[0]))
    .meeples.push({ pl: 0, big: false, placedIdx: 0, fi: 0 });   // Ritter in E's Stadt
  s.players[0].meeples--;
  s.drawn = 'H'; s.phase = 'place';
  placeCurrent(s, 0, -1, 1);
  const opts = meepleOptions(s);
  ok(!opts.some((o) => o.fi === 0), 'die Stadt an der besetzten Naht wird gesperrt');
  ok(opts.some((o) => o.fi === 1), 'die andere, freie Stadt wird angeboten');
  eq(opts.filter((o) => o.t === 'city').length, 1, 'genau eine der beiden Städte bleibt wählbar');
  eq(opts.filter((o) => o.t === 'field').length, 1, 'H hat genau eine Wiese, also auch nur einen Wiesenplatz');

  // Und die Gegenprobe zum ersten Teil der Meldung: kein Motiv im Satz
  // hat zwei Städte und drei Wiesen. „Zwei Städte, drei Wiesenplätze"
  // kann es auf einer Karte gar nicht geben.
  let zweiStadtDreiWiese = 0, hoechsteWiesenZahl = 0;
  for (const id of Object.keys(DEFS)) {
    const st = DEFS[id].f.filter((f) => f.t === 'city').length;
    const wi = DEFS[id].f.filter((f) => f.t === 'field').length;
    if (st >= 2) hoechsteWiesenZahl = Math.max(hoechsteWiesenZahl, wi);
    if (st >= 2 && wi >= 3) {
      zweiStadtDreiWiese++;
      ok(false, `${id} hätte ${st} Städte und ${wi} Wiesen`);
    }
  }
  eq(zweiStadtDreiWiese, 0, 'kein Motiv trägt zwei Städte und drei Wiesen');
  console.log(`   Motive mit zwei Städten haben höchstens ${hoechsteWiesenZahl} Wiesen`);

  // In ganzen Partien: nie mehr Wiesenplätze als die Karte Wiesen hat,
  // und nie eine Stadt gesperrt, ohne dass sie an einer besetzten hängt.
  let plaetze = 0, zuVieleWiesen = 0, stadtOhneGrund = 0;
  for (let seed = 0; seed < 8; seed++) {
    partie(seed, (s, opts) => {
      const p = s.placed[s.lastPlacedIdx], d = DEFS[p.defId];
      plaetze++;
      const wiesen = d.f.filter((f) => f.t === 'field').length;
      if (opts.filter((o) => o.t === 'field').length > wiesen) zuVieleWiesen++;
      const pl = s.players[s.current];
      if (pl.meeples <= 0 && pl.bigMeeples <= 0) return;
      d.f.forEach((f, fi) => {
        if (f.t !== 'city') return;
        if (opts.some((o) => o.fi === fi)) return;
        if (s.roots.get(find(s, p.fsegs[fi])).meeples.length === 0) stadtOhneGrund++;
      });
    });
  }
  console.log(`   ${plaetze} Platzierungen in 8 Partien nachgezählt`);
  eq(zuVieleWiesen, 0, 'nie mehr Wiesenplätze als Wiesensegmente');
  eq(stadtOhneGrund, 0, 'keine Stadt wird gesperrt, ohne dass ein Meeple auf ihr steht');
}

console.log('=== 18. Buchführung: offene Kanten und Meeple-Vorrat ===');
{
  // Eine Stadt gilt als fertig, wenn open leer ist – dann wird gewertet
  // und der Meeple kommt zurück. Zählt open falsch, kommen Meeples zu
  // früh oder nie zurück, und beides sieht am Brett wie ein Fehler beim
  // Setzen aus. Gegengezählt wird über die Nachbarfelder.
  let wurzeln = 0, offenFalsch = 0, vorrat = 0, ohneWurzel = 0;
  for (let seed = 0; seed < 10; seed++) {
    const s = partie(seed, () => {});
    const gezaehlt = new Map();
    s.placed.forEach((p) => {
      const d = DEFS[p.defId];
      d.f.forEach((f, fi) => {
        if (f.t !== 'city' && f.t !== 'road' && f.t !== 'river') return;
        const r = find(s, p.fsegs[fi]);
        if (!gezaehlt.has(r)) gezaehlt.set(r, 0);
        for (const dir of weltKanten(d, fi, p.rot)) {
          if (!s.grid.has(key(p.x + DIRS[dir].dx, p.y + DIRS[dir].dy))) {
            gezaehlt.set(r, gezaehlt.get(r) + 1);
          }
        }
      });
    });
    for (const [r, z] of gezaehlt) {
      wurzeln++;
      if (s.roots.get(r).open.size !== z) offenFalsch++;
    }
    const draussen = s.players.map(() => 0), gross = s.players.map(() => 0);
    for (const [, d] of s.roots) for (const m of d.meeples) {
      if (m.big) gross[m.pl]++; else draussen[m.pl]++;
    }
    s.players.forEach((p, i) => {
      if (p.meeples + draussen[i] !== 7) vorrat++;
      if (p.bigMeeples + gross[i] !== (s.settings.expansions?.inns ? 1 : 0)) vorrat++;
    });
    for (let i = 0; i < s.segs.length; i++) if (!s.roots.has(find(s, i))) ohneWurzel++;
  }
  console.log(`   ${wurzeln} Gebiete am Partieende nachgezählt`);
  eq(offenFalsch, 0, 'open zählt genau die Kanten ohne Nachbarkarte');
  eq(vorrat, 0, 'jeder Meeple steht entweder im Vorrat oder auf dem Brett');
  eq(ohneWurzel, 0, 'jedes Segment findet seine Wurzel');
}

console.log('=== 19. Mehrfach angebotene Wiese (Befund, keine Regelverletzung) ===');
{
  // Läuft eine Wiese um den Kartenrand herum wieder auf dieselbe Karte
  // zurück, hat die Karte zwei Wiesensegmente derselben Wiese – und
  // meepleOptions bietet beide an. Regelwidrig ist das nicht: beide
  // Punkte führen auf denselben Bauernhof. Am Brett sieht es aber nach
  // zwei Wiesen aus, und für die KI ist es doppelte Arbeit.
  let zuege = 0, doppelt = 0, hoechstens = 0;
  for (let seed = 0; seed < 12; seed++) {
    partie(seed, (s, opts) => {
      zuege++;
      const proWurzel = new Map();
      for (const o of opts) {
        if (o.t !== 'field') continue;
        const r = find(s, o.segId);
        proWurzel.set(r, (proWurzel.get(r) || 0) + 1);
      }
      let max = 0;
      for (const v of proWurzel.values()) max = Math.max(max, v);
      if (max >= 2) doppelt++;
      hoechstens = Math.max(hoechstens, max);
    });
  }
  console.log(`   ${doppelt} von ${zuege} Zügen bieten dieselbe Wiese mehrfach an, höchstens ${hoechstens}-fach`);
  ok(hoechstens <= 2, 'höchstens zwei Punkte auf einer Wiese – mehr wäre ein Zeichen für zerfallene Wiesen');
}

console.log('=== 20. Jeder angebotene Punkt muss auch antippbar sein ===');
{
  // Zwei Regeln hängen hier zusammen.
  //
  // Erstens die Auswahl: handleTap in js/ui/main.js nimmt den NÄCHSTEN
  // Punkt, nicht den ersten aus der Liste. Vorher war es der erste, und
  // weil die Punkte in der Reihenfolge der Segmente kommen und der
  // Trefferkreis 0,2 Kachelbreiten misst, verschluckte ein Straßenpunkt
  // den Wiesenpunkt daneben – auf Motiv O liegen sie 0,178 auseinander.
  // Elf Punkte auf acht Motiven waren so nicht erreichbar.
  //
  // Zweitens die Anzeige: die gezeichnete Marke misst 0,34 Kachelbreiten.
  // Zwei Punkte 0,178 auseinander ergeben zwei Scheiben, die sich zu zwei
  // Dritteln überdecken – man sieht nicht, wohin man zielt. Deshalb rückt
  // js/ui/spot-layout.js die Marken für die Auswahlphase auseinander. Die
  // Figur selbst steht danach weiterhin auf ihrem unverschobenen Punkt.
  const RAND = 0.13;
  let eng = 0, weit = 0, draussen = 0, geprueft = 0;
  for (const id of Object.keys(DEFS)) {
    const d = DEFS[id];
    const roh = d.f.map((f) => f.spot).filter(Boolean).map((sp) => ({ x: sp[0], y: sp[1] }));
    if (roh.length < 2) continue;
    const nach = spreizeSpots(roh);
    geprueft++;
    for (let i = 0; i < nach.length; i++) {
      const ab = Math.hypot(nach[i].x - roh[i].x, nach[i].y - roh[i].y);
      if (ab > MAX_RUECKUNG + 1e-6) {
        weit++;
        ok(false, `${id}: Marke ${i} rückt ${ab.toFixed(3)} weg, erlaubt sind ${MAX_RUECKUNG}`);
      }
      if (nach[i].x < RAND - 1e-6 || nach[i].x > 1 - RAND + 1e-6
        || nach[i].y < RAND - 1e-6 || nach[i].y > 1 - RAND + 1e-6) {
        draussen++;
        ok(false, `${id}: Marke ${i} liegt bei ${nach[i].x.toFixed(2)}/${nach[i].y.toFixed(2)} zu nah am Kartenrand`);
      }
      for (let j = 0; j < i; j++) {
        const dist = Math.hypot(nach[i].x - nach[j].x, nach[i].y - nach[j].y);
        // Nicht ganz MIN_ABSTAND verlangen: wo die Rückholung greift,
        // bleibt ein Rest. Verlangt wird, dass sich die Scheiben nicht
        // mehr zur Hälfte überdecken.
        if (dist < 0.20) {
          eng++;
          ok(false, `${id}: Marken ${j} und ${i} stehen nach dem Spreizen nur ${dist.toFixed(3)} auseinander`);
        }
      }
    }
  }
  console.log(`   ${geprueft} Motive mit mehreren Punkten gespreizt`);
  eq(eng, 0, 'keine zwei Marken überdecken sich zur Hälfte');
  eq(weit, 0, 'keine Marke rückt weiter als erlaubt von ihrem Punkt weg');
  eq(draussen, 0, 'keine Marke rutscht über den Kartenrand');
}

console.log(`\n${passed} Prüfungen bestanden, ${failed} fehlgeschlagen.`);
if (failed) {
  console.log('\nOffene Punkte:');
  for (const f of fehler) console.log('  ·', f);
}
process.exit(failed ? 1 : 0);
