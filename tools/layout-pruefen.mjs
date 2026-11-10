/**
 * Das Layout nachmessen: Hochformat, Querformat, kleines Telefon – jeweils
 * mit sechs Spielern, dem schlimmsten Fall.
 *
 *   node tools/layout-pruefen.mjs                 # nur messen
 *   node tools/layout-pruefen.mjs --bilder=/tmp/lay   # dazu Bildschirmfotos
 *
 * Gemessen wird, was sich messen lässt, statt es anzusehen:
 *
 *   · verdeckt eine Meldung die Spielerleisten (Fläche der Überdeckung)
 *   · liegt die Spalte „Punkte" der Abrechnung im Rahmen
 *   · wird die Abrechnung gestaucht statt gerollt
 *   · liegen „Zurück"/„Ohne Meeple" unter der Seitenleiste
 *   · ist im Hauptmenü alles erreichbar
 *
 * Am Stand vor den Korrekturen: neun Beanstandungen. Die Leisten nahmen
 * auf einem kleinen Telefon 43 % der Höhe ein, jetzt 18 %.
 */
import { starteBrowser, starteServer } from './_browser.mjs';

const BILDER = (process.argv.find((a) => a.startsWith('--bilder=')) || '').split('=')[1] || null;
const srv = await starteServer();
const URL = srv.url;
const browser = await starteBrowser();
const sechs = { players: [0, 1, 2, 3, 4, 5].map((i) => ({ name: ['Alexander', 'Benedikt', 'Charlotte', 'Dominik', 'Elisabeth', 'Friedrich'][i], color: i, type: i === 0 ? 'human' : 'ai1' })), expansions: { river: false, inns: true, king: true }, deckScale: 1 };
const schneidet = (a, b) => a && b && a.w > 0 && b.w > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const flaeche = (a, b) => (schneidet(a, b) ? (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);
let schlecht = 0;
const melde = (b, was) => { if (!b) schlecht++; console.log(b ? '  ✓' : '  ✗', was); };

for (const [name, vw, vh] of [['hoch', 393, 852], ['quer', 852, 393], ['klein', 320, 568]]) {
  console.log(`== ${name} ${vw}×${vh}`);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(`localStorage.setItem('carc.setup', ${JSON.stringify(JSON.stringify(sechs))}); localStorage.setItem('carc.options', '{"sfx":false,"music":false,"hints":true,"anim":false}')`);
  await page.goto(URL);
  await page.waitForTimeout(400);
  const R = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);

  // --- Hauptmenü: alles erreichbar?
  {
    const m = await page.evaluate(() => {
      const s = document.getElementById('screen-menu');
      const k = [...document.querySelectorAll('#screen-menu .btn, #screen-menu .logo, #screen-menu .foot')].filter((e) => e.getBoundingClientRect().width > 0);
      const oben = Math.min(...k.map((e) => e.getBoundingClientRect().top)), unten = Math.max(...k.map((e) => e.getBoundingClientRect().bottom));
      return { oben, unten, hoehe: innerHeight, scrollbar: s.scrollHeight > s.clientHeight + 1, overflow: getComputedStyle(s).overflowY };
    });
    melde(m.oben >= 0 && (m.unten <= m.hoehe || m.scrollbar && m.overflow !== 'visible' && m.overflow !== 'hidden'), `Menü: Inhalt ${m.oben.toFixed(0)}…${m.unten.toFixed(0)} von ${m.hoehe}, ${m.scrollbar ? 'rollbar' : 'passt'} (${m.overflow})`);
    if (BILDER) await page.screenshot({ path: `${BILDER}-${name}-menue.png` });
  }

  await page.click('#btnNew'); await page.waitForTimeout(100);
  await page.click('#btnStart'); await page.waitForTimeout(500);

  // --- Toast gegen Spielerleisten
  await page.evaluate(() => { const t = document.createElement('div'); t.className = 'toast'; t.style.animation = 'none'; t.textContent = 'Alexander & Benedikt: +24 (Stadt, 9 Karten)'; document.getElementById('toasts').appendChild(t); });
  await page.waitForTimeout(100);
  {
    const chips = await page.evaluate(() => [...document.querySelectorAll('.chip')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const toast = await R('.toast');
    const deck = await R('#deckInfo');
    const ueber = chips.reduce((s, c) => s + flaeche(c, toast), 0) + flaeche(deck, toast);
    melde(ueber < 1, `Toast verdeckt Leisten: ${ueber.toFixed(0)} px² (Toast y ${toast.y.toFixed(0)}…${(toast.y + toast.h).toFixed(0)}, Leisten bis ${Math.max(...chips.map((c) => c.y + c.h)).toFixed(0)})`);
    melde(toast.x >= 0 && toast.x + toast.w <= vw + 0.5, `Toast im Bild (${toast.x.toFixed(0)}…${(toast.x + toast.w).toFixed(0)} von ${vw})`);
    const hudUnten = Math.max(...chips.map((c) => c.y + c.h));
    console.log(`     Leisten nehmen ${(hudUnten / vh * 100).toFixed(0)} % der Höhe`);
  }
  if (BILDER) await page.screenshot({ path: `${BILDER}-${name}-spiel.png` });
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));

  // --- Zurück-Knopf gegen Seitenleiste
  {
    const feld = await page.evaluate(() => import('/js/engine/game.js').then(({ legalPlacements }) => { const G = window.__carc.state, b = window.__carc.brett; b.camTarget = null; b.cam.scale = 64; const r = document.getElementById('hud-bottom').getBoundingClientRect(); const h = document.getElementById('hud-top').getBoundingClientRect(); const l = legalPlacements(G).map((c) => ({ c, s: b.worldToScreen(c.x, c.y) })).filter((e) => e.s[1] > h.bottom + 30 && e.s[1] < r.top - 30 && e.s[0] > 30 && e.s[0] < innerWidth - 70)[0]; return l ? l.s : null; }));
    if (feld) {
      await page.touchscreen.tap(feld[0], feld[1]); await page.waitForTimeout(450);
      await page.click('#btnConfirm'); await page.waitForTimeout(450);
      const undo = await R('#btnUndo'), skip = await R('#btnSkipMeeple');
      const seite = await page.evaluate(() => [...document.querySelectorAll('#sideDock .btn')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      const ue = seite.reduce((s, c) => s + flaeche(c, undo) + flaeche(c, skip), 0);
      melde(ue < 1, `Zurück/Ohne Meeple gegen Seitenleiste: ${ue.toFixed(0)} px² Überdeckung`);
      if (BILDER) await page.screenshot({ path: `${BILDER}-${name}-meeple.png` });
      await page.waitForTimeout(300);
      await page.click('#btnSkipMeeple').catch(() => {});
    } else console.log('  – kein freies Feld für die Probe gefunden');
  }

  // --- Endtabelle
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const G = window.__carc.state; G.deck.length = 0; G.players.forEach((p, i) => { p.score = 187 - i * 23; p.breakdown = { road: 38, city: 64, mon: 27, field: 42, bonus: 16 }; }); });
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => { const G = window.__carc.state; return G ? { ph: G.phase, t: G.players[G.current].type } : null; });
    if (!s || s.ph === 'over') break;
    if (s.t === 'human') await page.evaluate(() => window.__carc.autoMove());
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
  {
    const m = await page.evaluate(() => {
      const panel = document.querySelector('#screen-end .panel').getBoundingClientRect();
      const t = document.getElementById('endTable');
      const letzte = [...t.querySelectorAll('tbody tr')].map((tr) => tr.lastElementChild.getBoundingClientRect());
      const kopf = t.querySelector('thead th:last-child').getBoundingClientRect();
      const zeilen = [...t.querySelectorAll('tbody tr')].map((tr) => tr.getBoundingClientRect().height);
      const sc = document.querySelector('#screen-end .panel-scroll');
      const knopf = document.getElementById('btnRematch').getBoundingClientRect();
      return { aktiv: document.querySelector('.screen.active').id, panelR: panel.right, panelL: panel.left, panelH: panel.height, tabH: t.getBoundingClientRect().height,
        rechts: Math.max(kopf.right, ...letzte.map((r) => r.right)), links: Math.min(...letzte.map((r) => r.left)), zeile: Math.min(...zeilen), rollbar: sc.scrollHeight > sc.clientHeight + 1, knopfH: knopf.height };
    });
    melde(m.aktiv === 'screen-end', `Abrechnung erreicht (${m.aktiv})`);
    melde(m.rechts <= m.panelR + 0.5, `Spalte „Punkte" im Rahmen (rechter Rand ${m.rechts.toFixed(0)}, Rahmen bis ${m.panelR.toFixed(0)})`);
    melde(m.panelH >= m.tabH - 1, `Tabelle nicht gestaucht (Rahmen ${m.panelH.toFixed(0)}, Tabelle ${m.tabH.toFixed(0)}, Zeile ${m.zeile.toFixed(0)} px, Knopf ${m.knopfH.toFixed(0)} px)`);
    if (BILDER) await page.screenshot({ path: `${BILDER}-${name}-ende.png` });
  }
  await ctx.close();
}
await browser.close(); srv.close();
console.log(schlecht ? `\n${schlecht} Beanstandungen` : '\nalles in Ordnung');
process.exit(schlecht ? 1 : 0);
