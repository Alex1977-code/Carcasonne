/**
 * Auswahlmarken auseinanderrücken.
 *
 * Die Punkte, an denen ein Gefolgsmann stehen kann, stehen in
 * js/engine/tiles.js als `spot` je Segment. Sie sind dafür gewählt, wo die
 * Figur später gut aussieht – nicht dafür, dass man sie mit dem Finger
 * auseinanderhalten kann. Auf Motiv O etwa liegen Straßen- und Wiesenpunkt
 * 0,178 Kachelbreiten auseinander, während die gezeichnete Marke 0,34
 * Kachelbreiten misst: die beiden Scheiben überlappen zu zwei Dritteln.
 *
 * Deshalb bekommt die Auswahlphase eine eigene Anordnung. Sie schiebt nur
 * die Marken, nicht die Figur: ein gesetzter Gefolgsmann steht weiterhin
 * genau auf seinem `spot`. Verschoben wird so wenig wie möglich und nie
 * über den Kartenrand hinaus, damit eine Marke auf ihrem Bauteil bleibt.
 */

/** Wie weit zwei Marken mindestens auseinanderstehen sollen (Kachelbreiten). */
export const MIN_ABSTAND = 0.30;

/** So weit darf eine Marke höchstens von ihrem Punkt wegrücken. */
export const MAX_RUECKUNG = 0.13;

/** Rand, den eine Marke zur Kartenkante einhält. */
const RAND = 0.13;

/**
 * @param {{x:number,y:number}[]} punkte Lage in Kachelkoordinaten (0…1),
 *   bezogen auf die gelegte Karte.
 * @returns {{x:number,y:number}[]} verschobene Lagen, gleiche Reihenfolge.
 */
export function spreizeSpots(punkte) {
  const n = punkte.length;
  const aus = punkte.map((p) => ({ x: p.x, y: p.y }));
  if (n < 2) return aus;

  // Ein paar Entspannungsschritte. Mehr braucht es nicht: bei höchstens
  // acht Marken auf einer Karte ist nach fünf Durchgängen nichts mehr in
  // Bewegung, und ein exaktes Verfahren wäre für das bisschen Versatz
  // aufwendiger als der Nutzen.
  for (let runde = 0; runde < 24; runde++) {
    let bewegt = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = aus[j].x - aus[i].x, dy = aus[j].y - aus[i].y;
        let d = Math.hypot(dx, dy);
        // Genau aufeinander: in eine feste Richtung auseinander, damit das
        // Ergebnis nicht vom Zufall abhängt.
        let ux, uy;
        if (d < 1e-6) { ux = 1; uy = 0; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
        const fehl = MIN_ABSTAND - d;
        if (fehl <= 1e-4) continue;
        const schritt = fehl / 2;
        aus[i].x -= ux * schritt; aus[i].y -= uy * schritt;
        aus[j].x += ux * schritt; aus[j].y += uy * schritt;
        bewegt = true;
      }
    }
    // Nach jedem Durchgang zurückholen: nicht zu weit vom eigenen Punkt
    // und nicht über den Kartenrand.
    for (let i = 0; i < n; i++) {
      const dx = aus[i].x - punkte[i].x, dy = aus[i].y - punkte[i].y;
      const d = Math.hypot(dx, dy);
      if (d > MAX_RUECKUNG) {
        aus[i].x = punkte[i].x + dx / d * MAX_RUECKUNG;
        aus[i].y = punkte[i].y + dy / d * MAX_RUECKUNG;
      }
      aus[i].x = Math.max(RAND, Math.min(1 - RAND, aus[i].x));
      aus[i].y = Math.max(RAND, Math.min(1 - RAND, aus[i].y));
    }
    if (!bewegt) break;
  }
  return aus;
}
