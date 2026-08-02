/**
 * Deterministischer Zufall für den Kachel-Renderer.
 *
 * Regel aus dem Spec: niemals Math.random() im Renderpfad. Jede Dekoration wird
 * aus einem seedbaren Strom gezogen, damit dieselbe Kachel bei allen Mitspielern
 * und nach jedem Reload identisch aussieht.
 *
 * Siehe Nachtrag §10.
 */

export const VARIANT_COUNT = 6;

/** FNV-1a, 32 Bit. Stabil über Sitzungen und Engines. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 – schnell, gut verteilt, 32 Bit Zustand. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Welche der VARIANT_COUNT Varianten zeigt diese Kachel-Instanz?
 * instanceId kommt aus dem Spielzustand, nicht aus der Renderreihenfolge.
 */
export function variantOf(instanceId) {
  return hashString(String(instanceId)) % VARIANT_COUNT;
}

/** Seed eines Motivs in einer bestimmten Variante. */
export function tileSeed(tileTypeId, variant) {
  return hashString(`${tileTypeId}#${variant}`);
}

/**
 * Ein Zufallsstrom mit den Hilfsfunktionen, die der Renderer braucht.
 *
 * fork(name) liefert einen unabhängigen Unterstrom. Jeder Layer bekommt seinen
 * eigenen – sonst verschiebt eine Änderung an einem Layer alle folgenden Ziehungen
 * und das ganze Dorf baut sich um (Nachtrag §10.2).
 */
export class Rng {
  constructor(seed, label = '') {
    this.seed = seed >>> 0;
    this.label = label;
    this._next = mulberry32(this.seed);
  }

  fork(name) {
    return new Rng(hashString(`${this.seed}:${name}`), name);
  }

  /** Zurück auf den Anfangszustand – für Determinismus-Tests. */
  reset() {
    this._next = mulberry32(this.seed);
    return this;
  }

  /** [0, 1) */
  next() {
    return this._next();
  }

  /** [min, max) */
  range(min, max) {
    return min + this._next() * (max - min);
  }

  /** Ganzzahl in [min, maxExclusive) */
  int(min, maxExclusive) {
    return Math.floor(this.range(min, maxExclusive));
  }

  bool(p = 0.5) {
    return this._next() < p;
  }

  /** ±amount um base, gleichverteilt. */
  jitter(base, amount) {
    return base + (this._next() * 2 - 1) * amount;
  }

  /** ±percent relativ zu base, z. B. jitterPct(1, 0.06) für ±6 %. */
  jitterPct(base, percent) {
    return base * (1 + (this._next() * 2 - 1) * percent);
  }

  pick(list) {
    return list[Math.floor(this._next() * list.length)];
  }

  /**
   * Gewichtete Auswahl aus [{ value, weight }, …].
   * Einträge mit weight <= 0 werden übersprungen (so lassen sich Gebäudetypen
   * kachelabhängig sperren, ohne die Tabelle umzubauen).
   */
  weighted(entries) {
    let total = 0;
    for (const e of entries) if (e.weight > 0) total += e.weight;
    if (total <= 0) return null;
    let r = this._next() * total;
    for (const e of entries) {
      if (e.weight <= 0) continue;
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  /** Fisher-Yates auf einer Kopie. */
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Poisson-artige Streuung in einem Rechteck.
   * minDist(a, b) bekommt die beiden Kandidaten und entscheidet über den
   * Mindestabstand – so lässt sich der Bounding-Box-Abstand aus Nachtrag §14.3
   * einhängen, statt mit einem festen Radius zu rechnen.
   *
   * Verworfene Kandidaten werden neu gezogen, nie verschoben (Spec §3 A2).
   */
  scatter({ count, bounds, radiusOf, minDist, accept, tries = 30 }) {
    const placed = [];
    const [x0, y0, x1, y1] = bounds;
    for (let i = 0; i < count; i++) {
      for (let t = 0; t < tries; t++) {
        const cand = {
          x: this.range(x0, x1),
          y: this.range(y0, y1),
          r: radiusOf ? radiusOf(this) : 0,
          i,
        };
        if (accept && !accept(cand)) continue;
        let ok = true;
        for (const p of placed) {
          const d = Math.hypot(cand.x - p.x, cand.y - p.y);
          if (d < (minDist ? minDist(cand, p) : cand.r + p.r)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          placed.push(cand);
          break;
        }
      }
    }
    return placed;
  }
}

/** Bequemer Einstieg: Strom für ein Motiv in einer Variante. */
export function rngForTile(tileTypeId, variant) {
  return new Rng(tileSeed(tileTypeId, variant), `${tileTypeId}#${variant}`);
}
