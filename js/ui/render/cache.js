/**
 * Kachel-Cache.
 * Nachtrag §10.1 und §10.3: Schlüssel ist Motiv × Variante × Rotation × LOD,
 * LRU mit harter Obergrenze, pro Frame ein begrenztes Renderbudget.
 *
 * Der Cache kennt keinen Spielzustand. Meeples, Vorschau-Glow und Punktezahlen
 * werden jeden Frame darüber gezeichnet (Nachtrag §14.2).
 */

import { renderSizeFor } from './contract.js';

const DPR_CAP = 2;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class TileCache {
  constructor({ maxEntries = 512, budgetPerFrame = 2, dpr = 2 } = {}) {
    this.maxEntries = maxEntries;
    this.budgetPerFrame = budgetPerFrame;
    this.dpr = Math.min(dpr, DPR_CAP);
    this.entries = new Map(); // key → { canvas, size, lastUsed }
    this.queue = [];
    this.frozen = false; // true während einer Zoom-Geste
    this.clock = 0;
    this.stats = { hits: 0, misses: 0, renders: 0, evictions: 0 };
  }

  static key(tileTypeId, variant, rotation, lod) {
    return `${tileTypeId}|${variant}|${rotation}|${lod}`;
  }

  /** Fertiges Bitmap oder null. */
  get(tileTypeId, variant, rotation, lod) {
    const key = TileCache.key(tileTypeId, variant, rotation, lod);
    const entry = this.entries.get(key);
    if (entry) {
      entry.lastUsed = ++this.clock;
      this.stats.hits++;
      return entry.canvas;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Bestes verfügbares Bitmap: gewünschte Stufe, sonst die nächstkleinere.
   * Damit steht während des Nachrenderns immer etwas auf dem Schirm.
   */
  getBestAvailable(tileTypeId, variant, rotation, lod, fallbackOrder) {
    const exact = this.get(tileTypeId, variant, rotation, lod);
    if (exact) return { canvas: exact, exact: true };
    for (const alt of fallbackOrder) {
      const key = TileCache.key(tileTypeId, variant, rotation, alt);
      const entry = this.entries.get(key);
      if (entry) {
        entry.lastUsed = ++this.clock;
        return { canvas: entry.canvas, exact: false, lod: alt };
      }
    }
    return { canvas: null, exact: false };
  }

  /** In die Warteschlange stellen. Doppelte Anfragen werden zusammengefasst. */
  request(tileTypeId, variant, rotation, lod, priority = 0) {
    const key = TileCache.key(tileTypeId, variant, rotation, lod);
    if (this.entries.has(key)) return;
    if (this.queue.some((q) => q.key === key)) return;
    this.queue.push({ key, tileTypeId, variant, rotation, lod, priority });
  }

  /**
   * Bis zu budgetPerFrame Einträge rendern.
   * drawFn(ctx, { tileTypeId, variant, rotation, lod, size }) zeichnet in
   * normierten Koordinaten – der Transform ist bereits gesetzt.
   */
  drainBudget(drawFn) {
    if (this.frozen) return 0;
    this.queue.sort((a, b) => b.priority - a.priority);
    let done = 0;
    while (done < this.budgetPerFrame && this.queue.length) {
      const job = this.queue.shift();
      if (this.entries.has(job.key)) continue;
      this._render(job, drawFn);
      done++;
    }
    return done;
  }

  _render(job, drawFn) {
    const size = renderSizeFor(job.lod);
    const px = Math.round(size * this.dpr);
    const canvas = makeCanvas(px, px);
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(px, px); // normierte Koordinaten 0…1
    ctx.beginPath();
    ctx.rect(0, 0, 1, 1);
    ctx.clip(); // Spec §1.2: nichts ragt über die Kachel hinaus
    drawFn(ctx, { ...job, size, px });
    ctx.restore();

    this.entries.set(job.key, { canvas, size: px, lastUsed: ++this.clock });
    this.stats.renders++;
    this._evict();
  }

  _evict() {
    while (this.entries.size > this.maxEntries) {
      let oldestKey = null;
      let oldest = Infinity;
      for (const [k, v] of this.entries) {
        if (v.lastUsed < oldest) { oldest = v.lastUsed; oldestKey = k; }
      }
      this.entries.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /** Nur die kleinste Stufe vorwärmen (Nachtrag §10.3). */
  warm(tiles, lod, rotations = [0], variants = [0]) {
    for (const tile of tiles)
      for (const r of rotations)
        for (const v of variants) this.request(tile.id, v, r, lod, 10);
  }

  freeze() { this.frozen = true; }
  thaw() { this.frozen = false; }

  clear() {
    this.entries.clear();
    this.queue.length = 0;
  }

  /**
   * Alle Einträge eines Motivs verwerfen. Wird gebraucht, wenn die gemalte
   * Karte nachträglich eintrifft: bis dahin liegt die gezeichnete Fassung
   * im Speicher und würde sonst bis zum Neustart weiter angezeigt.
   */
  dropMotif(tileTypeId) {
    const praefix = `${tileTypeId}|`;
    for (const k of [...this.entries.keys()]) {
      if (k.startsWith(praefix)) this.entries.delete(k);
    }
  }

  /** Geschätzter Speicherbedarf in MB – Anzeige in der Galerie. */
  estimatedBytes() {
    let bytes = 0;
    for (const e of this.entries.values()) bytes += e.size * e.size * 4;
    return bytes;
  }

  report() {
    return {
      entries: this.entries.size,
      maxEntries: this.maxEntries,
      queued: this.queue.length,
      megabytes: this.estimatedBytes() / (1024 * 1024),
      ...this.stats,
    };
  }
}
