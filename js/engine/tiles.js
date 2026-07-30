// ============================================================
// Carcassonne Mobile – Kartendefinitionen (Engine, ohne DOM)
// ============================================================
// Richtungen: 0=N, 1=O(E), 2=S, 3=W
// Kantentypen: C=Stadt, R=Straße, F=Wiese, W=Fluss(Wasser)
// Halbkanten (für Wiesen): pro Kante 2 Hälften, Index = Kante*2 + Seite
//   N: 0=NW 1=NO | O: 2=ON 3=OS | S: 4=SO 5=SW | W: 6=WS 7=WN
// Feature-Typen: city, road, river, field, mon (Kloster)
//   field.h  = belegte Halbkanten, field.adj = Indizes angrenzender
//   Stadt-Features derselben Karte (für Bauern-Wertung)
// ============================================================

export const DIRS = [
  { dx: 0, dy: -1 }, // N
  { dx: 1, dy: 0 },  // O
  { dx: 0, dy: 1 },  // S
  { dx: -1, dy: 0 }, // W
];

export const opp = (d) => (d + 2) % 4;
// Gegenüberliegende Halbkante beim Nachbarn
export const matchHalf = (h) => {
  const d = Math.floor(h / 2), s = h % 2;
  return opp(d) * 2 + (1 - s);
};

const city = (e, o = {}) => ({ t: 'city', e, shield: o.shield || 0, cath: !!o.cath, spot: o.spot || [0.5, 0.5] });
const road = (e, o = {}) => ({ t: 'road', e, inn: !!o.inn, spot: o.spot || [0.5, 0.5] });
const river = (e) => ({ t: 'river', e });
const field = (h, adj = [], spot = [0.5, 0.5]) => ({ t: 'field', h, adj, spot });
const mon = (spot = [0.5, 0.47]) => ({ t: 'mon', spot });

// ---------------- Basisspiel (72 Karten) ----------------
export const DEFS = {};
const def = (id, count, set, edges, f, extra = {}) => {
  DEFS[id] = { id, count, set, edges, f, ...extra };
};

def('A', 2, 'base', 'FFRF', [
  mon([0.5, 0.42]),
  road([2], { spot: [0.5, 0.88] }),
  field([0, 1, 2, 3, 4, 5, 6, 7], [], [0.16, 0.2]),
]);
def('B', 4, 'base', 'FFFF', [
  mon(),
  field([0, 1, 2, 3, 4, 5, 6, 7], [], [0.16, 0.2]),
]);
def('C', 1, 'base', 'CCCC', [
  city([0, 1, 2, 3], { shield: 1, spot: [0.5, 0.5] }),
]);
def('D', 4, 'base', 'CRFR', [
  city([0], { spot: [0.5, 0.13] }),
  road([1, 3], { spot: [0.5, 0.5] }),
  field([2, 7], [0], [0.88, 0.31]),
  field([3, 4, 5, 6], [], [0.5, 0.79]),
], { start: true });
def('E', 5, 'base', 'CFFF', [
  city([0], { spot: [0.5, 0.13] }),
  field([2, 3, 4, 5, 6, 7], [0], [0.5, 0.64]),
]);
def('F', 2, 'base', 'FCFC', [
  city([1, 3], { shield: 1, spot: [0.5, 0.5] }),
  field([0, 1], [0], [0.5, 0.09]),
  field([4, 5], [0], [0.5, 0.91]),
]);
def('G', 1, 'base', 'CFCF', [
  city([0, 2], { spot: [0.5, 0.5] }),
  field([2, 3], [0], [0.9, 0.5]),
  field([6, 7], [0], [0.1, 0.5]),
]);
def('H', 3, 'base', 'FCFC', [
  city([1], { spot: [0.88, 0.5] }),
  city([3], { spot: [0.12, 0.5] }),
  field([0, 1, 4, 5], [0, 1], [0.5, 0.5]),
]);
def('I', 2, 'base', 'FCCF', [
  city([1], { spot: [0.88, 0.5] }),
  city([2], { spot: [0.5, 0.88] }),
  field([0, 1, 6, 7], [0, 1], [0.28, 0.28]),
]);
def('J', 3, 'base', 'CRRF', [
  city([0], { spot: [0.5, 0.13] }),
  road([1, 2], { spot: [0.64, 0.64] }),
  field([2, 5, 6, 7], [0], [0.25, 0.46]),
  field([3, 4], [], [0.87, 0.87]),
]);
def('K', 3, 'base', 'CFRR', [
  city([0], { spot: [0.5, 0.13] }),
  road([2, 3], { spot: [0.36, 0.64] }),
  field([2, 3, 4, 7], [0], [0.75, 0.46]),
  field([5, 6], [], [0.13, 0.87]),
]);
def('L', 3, 'base', 'CRRR', [
  city([0], { spot: [0.5, 0.13] }),
  road([1], { spot: [0.83, 0.5] }),
  road([2], { spot: [0.5, 0.83] }),
  road([3], { spot: [0.17, 0.5] }),
  field([2], [0], [0.88, 0.31]),
  field([3, 4], [], [0.85, 0.85]),
  field([5, 6], [], [0.15, 0.85]),
  field([7], [0], [0.12, 0.31]),
]);
def('M', 2, 'base', 'CFFC', [
  city([0, 3], { shield: 1, spot: [0.3, 0.3] }),
  field([2, 3, 4, 5], [0], [0.73, 0.73]),
]);
def('N', 3, 'base', 'CFFC', [
  city([0, 3], { spot: [0.3, 0.3] }),
  field([2, 3, 4, 5], [0], [0.73, 0.73]),
]);
def('O', 2, 'base', 'CRRC', [
  city([0, 3], { shield: 1, spot: [0.27, 0.27] }),
  road([1, 2], { spot: [0.74, 0.74], ctrl: [0.66, 0.66] }),
  field([2, 5], [0], [0.63, 0.6]),
  field([3, 4], [], [0.89, 0.89]),
]);
def('P', 3, 'base', 'CRRC', [
  city([0, 3], { spot: [0.27, 0.27] }),
  road([1, 2], { spot: [0.74, 0.74], ctrl: [0.66, 0.66] }),
  field([2, 5], [0], [0.63, 0.6]),
  field([3, 4], [], [0.89, 0.89]),
]);
def('Q', 1, 'base', 'CCFC', [
  city([0, 1, 3], { shield: 1, spot: [0.5, 0.4] }),
  field([4, 5], [0], [0.5, 0.9]),
]);
def('R', 3, 'base', 'CCFC', [
  city([0, 1, 3], { spot: [0.5, 0.4] }),
  field([4, 5], [0], [0.5, 0.9]),
]);
def('S', 2, 'base', 'CCRC', [
  city([0, 1, 3], { shield: 1, spot: [0.5, 0.38] }),
  road([2], { spot: [0.5, 0.84] }),
  field([4], [0], [0.68, 0.92]),
  field([5], [0], [0.32, 0.92]),
]);
def('T', 1, 'base', 'CCRC', [
  city([0, 1, 3], { spot: [0.5, 0.38] }),
  road([2], { spot: [0.5, 0.84] }),
  field([4], [0], [0.68, 0.92]),
  field([5], [0], [0.32, 0.92]),
]);
def('U', 8, 'base', 'RFRF', [
  road([0, 2], { spot: [0.5, 0.5] }),
  field([1, 2, 3, 4], [], [0.78, 0.5]),
  field([0, 5, 6, 7], [], [0.22, 0.5]),
]);
def('V', 9, 'base', 'FFRR', [
  road([2, 3], { spot: [0.36, 0.64] }),
  field([0, 1, 2, 3, 4, 7], [], [0.62, 0.32]),
  field([5, 6], [], [0.14, 0.86]),
]);
def('W', 4, 'base', 'FRRR', [
  road([1], { spot: [0.83, 0.5] }),
  road([2], { spot: [0.5, 0.83] }),
  road([3], { spot: [0.17, 0.5] }),
  field([0, 1, 2, 7], [], [0.5, 0.2]),
  field([3, 4], [], [0.85, 0.85]),
  field([5, 6], [], [0.15, 0.85]),
]);
def('X', 1, 'base', 'RRRR', [
  road([0], { spot: [0.5, 0.17] }),
  road([1], { spot: [0.83, 0.5] }),
  road([2], { spot: [0.5, 0.83] }),
  road([3], { spot: [0.17, 0.5] }),
  field([1, 2], [], [0.82, 0.18]),
  field([3, 4], [], [0.82, 0.82]),
  field([5, 6], [], [0.18, 0.82]),
  field([7, 0], [], [0.18, 0.18]),
]);

// ---------------- Der Fluss (12 Karten) ----------------
def('RV_SPRING', 1, 'river', 'FFWF', [
  river([2]),
  field([0, 1, 2, 3, 4, 5, 6, 7], [], [0.2, 0.2]),
], { riverStart: true });
def('RV_LAKE', 1, 'river', 'WFFF', [
  river([0]),
  field([0, 1, 2, 3, 4, 5, 6, 7], [], [0.2, 0.8]),
], { riverEnd: true });
def('RV_STRAIGHT', 2, 'river', 'WFWF', [
  river([0, 2]),
  field([1, 2, 3, 4], [], [0.8, 0.5]),
  field([0, 5, 6, 7], [], [0.2, 0.5]),
]);
def('RV_CURVE', 3, 'river', 'FFWW', [
  river([2, 3]),
  field([0, 1, 2, 3, 4, 7], [], [0.62, 0.32]),
  field([5, 6], [], [0.13, 0.87]),
]);
def('RV_BRIDGE', 1, 'river', 'WRWR', [
  river([0, 2]),
  road([1, 3], { spot: [0.78, 0.5] }),
  field([1, 2], [], [0.84, 0.2]),
  field([3, 4], [], [0.84, 0.8]),
  field([5, 6], [], [0.16, 0.8]),
  field([7, 0], [], [0.16, 0.2]),
]);
def('RV_CITY', 1, 'river', 'WCWF', [
  river([0, 2]),
  city([1], { spot: [0.89, 0.5] }),
  field([1, 4], [1], [0.76, 0.13]),
  field([0, 5, 6, 7], [], [0.18, 0.5]),
]);
def('RV_MON', 1, 'river', 'FFWW', [
  mon([0.6, 0.32]),
  river([2, 3]),
  field([0, 1, 2, 3, 4, 7], [], [0.85, 0.6]),
  field([5, 6], [], [0.13, 0.87]),
]);
def('RV_ROADCURVE', 1, 'river', 'RRWW', [
  road([0, 1], { spot: [0.66, 0.34] }),
  river([2, 3]),
  field([1, 2], [], [0.86, 0.14]),
  field([0, 3, 4, 7], [], [0.44, 0.5]),
  field([5, 6], [], [0.13, 0.87]),
]);
def('RV_CITY2', 1, 'river', 'WFWC', [
  river([0, 2]),
  city([3], { spot: [0.11, 0.5] }),
  field([1, 2, 3, 4], [], [0.8, 0.5]),
  field([0, 5], [1], [0.25, 0.13]),
]);

// ------- Wirtshäuser & Kathedralen (18 Karten) -------
def('EC_CATH', 2, 'ec', 'CCCC', [
  city([0, 1, 2, 3], { cath: true, spot: [0.5, 0.62] }),
]);
def('EC_INN_STRAIGHT', 1, 'ec', 'RFRF', [
  road([0, 2], { inn: true, spot: [0.5, 0.5] }),
  field([1, 2, 3, 4], [], [0.8, 0.5]),
  field([0, 5, 6, 7], [], [0.2, 0.5]),
]);
def('EC_INN_CURVE', 2, 'ec', 'FFRR', [
  road([2, 3], { inn: true, spot: [0.36, 0.64] }),
  field([0, 1, 2, 3, 4, 7], [], [0.62, 0.32]),
  field([5, 6], [], [0.14, 0.86]),
]);
def('EC_INN_TJUNC', 1, 'ec', 'FRRR', [
  road([1], { spot: [0.83, 0.5] }),
  road([2], { inn: true, spot: [0.5, 0.83] }),
  road([3], { spot: [0.17, 0.5] }),
  field([0, 1, 2, 7], [], [0.5, 0.2]),
  field([3, 4], [], [0.85, 0.85]),
  field([5, 6], [], [0.15, 0.85]),
]);
def('EC_INN_CITYCURVE', 1, 'ec', 'CRRF', [
  city([0], { spot: [0.5, 0.13] }),
  road([1, 2], { inn: true, spot: [0.64, 0.64] }),
  field([2, 5, 6, 7], [0], [0.25, 0.46]),
  field([3, 4], [], [0.87, 0.87]),
]);
def('EC_INN_CITYSTRAIGHT', 1, 'ec', 'CRFR', [
  city([0], { spot: [0.5, 0.13] }),
  road([1, 3], { inn: true, spot: [0.5, 0.5] }),
  field([2, 7], [0], [0.88, 0.31]),
  field([3, 4, 5, 6], [], [0.5, 0.79]),
]);
def('EC_CITY_DIAG', 1, 'ec', 'RCCR', [
  road([0, 3], { spot: [0.34, 0.34] }),
  city([1], { spot: [0.89, 0.5] }),
  city([2], { spot: [0.5, 0.89] }),
  field([0, 7], [], [0.12, 0.12]),
  field([1, 6], [1, 2], [0.5, 0.38]),
]);
def('EC_TRIPLE_CITY', 1, 'ec', 'CCFC', [
  city([0], { spot: [0.5, 0.11] }),
  city([1], { spot: [0.89, 0.5] }),
  city([3], { spot: [0.11, 0.5] }),
  field([4, 5], [0, 1, 2], [0.5, 0.82]),
]);
def('EC_CITY_ROADPASS', 1, 'ec', 'CRCR', [
  city([0], { spot: [0.5, 0.11] }),
  city([2], { spot: [0.5, 0.89] }),
  road([1, 3], { spot: [0.5, 0.5] }),
  field([2, 7], [0], [0.87, 0.3]),
  field([3, 6], [1], [0.13, 0.7]),
]);
def('EC_CITY_FULL', 1, 'ec', 'CCCC', [
  city([0, 1, 2, 3], { shield: 1, spot: [0.5, 0.5] }),
]);
def('EC_DOUBLE_CURVE', 1, 'ec', 'RRRR', [
  road([0, 1], { spot: [0.66, 0.34] }),
  road([2, 3], { spot: [0.34, 0.66] }),
  field([1, 2], [], [0.87, 0.13]),
  field([5, 6], [], [0.13, 0.87]),
  field([0, 3, 4, 7], [], [0.32, 0.32]),
]);
def('EC_DOUBLE_CURVE2', 1, 'ec', 'RRRR', [
  road([0, 3], { spot: [0.34, 0.34] }),
  road([1, 2], { spot: [0.66, 0.66] }),
  field([0, 7], [], [0.13, 0.13]),
  field([3, 4], [], [0.87, 0.87]),
  field([1, 2, 5, 6], [], [0.68, 0.32]),
]);
def('EC_CROSS_CITY', 1, 'ec', 'CRRR', [
  city([0], { shield: 1, spot: [0.5, 0.13] }),
  road([1], { spot: [0.83, 0.5] }),
  road([2], { spot: [0.5, 0.83] }),
  road([3], { spot: [0.17, 0.5] }),
  field([2], [0], [0.88, 0.31]),
  field([3, 4], [], [0.85, 0.85]),
  field([5, 6], [], [0.15, 0.85]),
  field([7], [0], [0.12, 0.31]),
]);
def('EC_MON_ROAD2', 1, 'ec', 'RFRF', [
  mon([0.5, 0.45]),
  road([0], { spot: [0.5, 0.12] }),
  road([2], { spot: [0.5, 0.88] }),
  field([0, 1, 2, 3, 4, 5, 6, 7], [], [0.16, 0.2]),
]);
def('EC_CITY_GATE', 1, 'ec', 'CFRF', [
  city([0], { spot: [0.5, 0.13] }),
  road([2], { spot: [0.5, 0.7] }),
  field([2, 3, 4], [0], [0.78, 0.55]),
  field([5, 6, 7], [0], [0.22, 0.55]),
]);
def('EC_CITY_3SHIELD', 1, 'ec', 'CCFC', [
  city([0, 1, 3], { shield: 2, spot: [0.5, 0.4] }),
  field([4, 5], [0], [0.5, 0.9]),
]);

// ---------------- Deck-Aufbau ----------------
export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// settings: { expansions:{river,inns,king}, deckScale: 1|2|4 }
// Der Kartensatz skaliert Basisspiel UND aktive Erweiterungen
// (Standard ×1 = 72, Groß ×2 = 144, Riesig ×4 = 288 Basiskarten).
// Beim Fluss bleiben Quelle und See einmalig, der Lauf wird länger.
// Liefert { startId, deck } – deck wird per shift() gezogen.
export function buildDeck(settings, rnd = Math.random) {
  const ex = settings.expansions || {};
  const scale = Math.max(1, Math.round(settings.deckScale || 1));
  const main = [];
  for (const id in DEFS) {
    const d = DEFS[id];
    if (d.set === 'base' || (d.set === 'ec' && ex.inns)) {
      for (let i = 0; i < d.count * scale; i++) main.push(id);
    }
  }
  let startId;
  if (ex.river) {
    startId = 'RV_SPRING';
  } else {
    startId = 'D';
    main.splice(main.indexOf('D'), 1);
  }
  shuffle(main, rnd);
  const deck = [];
  if (ex.river) {
    const mids = [];
    for (const id in DEFS) {
      const d = DEFS[id];
      if (d.set === 'river' && !d.riverStart && !d.riverEnd) {
        for (let i = 0; i < d.count * scale; i++) mids.push(id);
      }
    }
    shuffle(mids, rnd);
    deck.push(...mids, 'RV_LAKE');
  }
  deck.push(...main);
  return { startId, deck };
}

// Gesamtzahl der Karten für die Setup-Anzeige
export function deckSizeFor(expansions, scale) {
  let n = 72 * scale;
  if (expansions?.river) n += 2 + 10 * scale;
  if (expansions?.inns) n += 18 * scale;
  return n;
}

export function edgeAt(defId, rot, dir) {
  const d = DEFS[defId];
  return d.edges[(dir - rot + 4) % 4];
}
