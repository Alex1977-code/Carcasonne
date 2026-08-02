/**
 * Kantenmessung für den Prüfstand.
 *
 * Für den Kantenvertrag genügt die Unterscheidung „Wiese" gegen „Anschluss".
 * Feiner zu klassifizieren scheitert an den Übergangspixeln zwischen Fahrbahn,
 * Fahrbahnkante und Schatten – die sind gewollt und sagen über den Vertrag nichts.
 */

const REF = [
  ['meadow', '#6FA84A'], ['meadow', '#4E8438'], ['meadow', '#8CBE5C'],
  ['road', '#E5D8B8'], ['road', '#B79A6B'], ['road', '#8A6E48'], ['road', '#D9C3A2'],
  ['river', '#7CB6E0'], ['river', '#3E7FBF'], ['river', '#2B5F94'],
  ['city', '#C69A6D'], ['city', '#A97F55'], ['city', '#B9A98F'], ['city', '#8C7B63'],
  ['building', '#4B5560'], ['building', '#F2E7D5'], ['building', '#B4452F'], ['building', '#6B4A2F'],
].map(([k, hex]) => [k, parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);

/** Nächste Palettenfarbe. */
export function classify(r, g, b) {
  let best = null, bd = Infinity;
  for (const [k, rr, gg, bb] of REF) {
    const d = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/** true = Wiese, false = irgendein Anschluss. */
export function isMeadow(r, g, b) {
  return classify(r, g, b) === 'meadow';
}

/** Pixelzeile entlang einer Kante. */
export function edgePixels(canvas, side) {
  const ctx = canvas.getContext('2d');
  const n = canvas.width;
  return side === 0 ? ctx.getImageData(0, 0, n, 1)
       : side === 2 ? ctx.getImageData(0, n - 1, n, 1)
       : side === 1 ? ctx.getImageData(n - 1, 0, 1, n)
       : ctx.getImageData(0, 0, 1, n);
}

/**
 * Zusammenhängender Anschlussbereich um die Kantenmitte.
 * Liefert Breite und Mitte in normierten Einheiten sowie die Art des Anschlusses,
 * abgelesen am Pixel genau in der Kantenmitte.
 */
export function measureEdge(canvas, side) {
  const d = edgePixels(canvas, side).data;
  const n = d.length / 4;
  const mid = Math.floor(n / 2);
  const at = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];

  const kind = classify(...at(mid));
  if (kind === 'meadow') return { kind: 'field', width: 0, from: null, to: null, center: null };

  let a = mid, b = mid;
  while (a > 0 && !isMeadow(...at(a - 1))) a--;
  while (b < n - 1 && !isMeadow(...at(b + 1))) b++;
  return {
    kind,
    from: a / n,
    to: (b + 1) / n,
    width: (b + 1 - a) / n,
    center: (a + b + 1) / (2 * n),
  };
}
