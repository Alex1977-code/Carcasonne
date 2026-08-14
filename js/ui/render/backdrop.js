/**
 * Hintergrund für alle Bildschirme außerhalb der Partie.
 *
 * Idee: Menü, Aufstellung, Hilfe und Auswertung liegen nicht „im Nichts“,
 * sondern auf demselben Eichentisch, auf dem später gespielt wird. Die
 * Kerze steht links außerhalb des Bildes; sichtbar ist nur ihr Schein, und
 * der flackert leicht weiter, auch wenn niemand etwas tut.
 *
 * Der Tisch selbst kostet einmal Rechenzeit und wird danach nur noch
 * geblittet. Pro Bild laufen der Wachsglanz und das Licht – zwei
 * Verlaufsfüllungen. Damit das auf dem Handy nichts frisst, läuft die
 * Schleife mit halber Bildrate und pausiert, sobald der Tisch verdeckt ist.
 */

import { candleAt, paintTable, paintSheen, paintCandleLight } from './ambience.js';

const FPS = 30;
const MAX_DPR = 1.5;      // weiche Fläche, feiner braucht sie nicht zu sein

/**
 * Startet den Hintergrund auf `canvas`.
 *
 * @param canvas   bildschirmfüllendes <canvas> hinter der Oberfläche
 * @param opts.visible  () => boolean  – false pausiert die Schleife
 * @param opts.calm     () => boolean  – true lässt die Kerze ruhig brennen
 * @param opts.decor    (ctx, w, h, candle) => void – liegt auf dem Tisch und
 *                      bekommt dasselbe Licht ab wie er; alles andere würde
 *                      wie aufgeklebt wirken.
 */
export function startBackdrop(canvas, opts = {}) {
  const visible = opts.visible || (() => true);
  const calm = opts.calm || (() => false);
  const decor = opts.decor || null;
  const ctx = canvas.getContext('2d');

  let base = null;              // Tisch, einmal gerendert
  let w = 0, h = 0, dpr = 1;
  let last = -1e9;

  function resize() {
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    const d = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (cw === w && ch === h && d === dpr && base) return false;
    w = cw; h = ch; dpr = d;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    base = document.createElement('canvas');
    base.width = canvas.width;
    base.height = canvas.height;
    const bg = base.getContext('2d');
    bg.scale(dpr, dpr);
    // Der Tisch steht etwas schräg im Bild, damit die Bretter nicht exakt
    // parallel zum Bildschirmrand laufen – parallel wirkt sofort gedruckt.
    bg.save();
    bg.translate(w / 2, h / 2);
    bg.rotate(-0.045);
    const over = Math.hypot(w, h);
    bg.translate(-over / 2, -over / 2);
    paintTable(bg, over, over, -w * 0.12, -h * 0.2, Math.max(1, over / 1100));
    bg.restore();
    return true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible()) { last = -1e9; return; }
    const still = calm();
    // Bei ruhiger Kerze ändert sich nichts mehr – dann reicht ein Bild.
    if (still && last > -1e8 && !resize()) return;
    if (!still && now - last < 1000 / FPS) return;
    last = now;
    resize();

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.drawImage(base, 0, 0, w, h);
    const candle = candleAt(now, still);
    if (decor) {
      ctx.save();
      decor(ctx, w, h, candle);
      ctx.restore();
    }
    paintSheen(ctx, w, h, candle);
    paintCandleLight(ctx, w, h, candle);
    ctx.restore();
  }

  resize();
  window.addEventListener('resize', () => { base = null; last = -1e9; resize(); });
  requestAnimationFrame(frame);
}
