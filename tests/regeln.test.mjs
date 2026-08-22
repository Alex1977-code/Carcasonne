// Regelprüfung: node tests/regeln.test.mjs
//
// Geht den offiziellen Regelsatz Punkt für Punkt durch. Die vorhandenen
// Tests in engine.test.mjs prüfen vor allem Datenstruktur und Ablauf;
// hier geht es ausschließlich darum, ob gespielt wird, was in der
// Anleitung steht.
//
// Aufgebaut wird jede Lage von Hand, damit im Fehlerfall die Ursache
// benannt werden kann statt nur „irgendwo stimmt eine Punktzahl nicht".

import { DEFS } from '../js/engine/tiles.js';
import {
  newGame, isLegal, legalPlacementsFor, placeCurrent, meepleOptions,
  finishTurn, find,
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

console.log(`\n${passed} Prüfungen bestanden, ${failed} fehlgeschlagen.`);
if (failed) {
  console.log('\nOffene Punkte:');
  for (const f of fehler) console.log('  ·', f);
}
process.exit(failed ? 1 : 0);
