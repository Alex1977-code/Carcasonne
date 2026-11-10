/**
 * Die Bedienung im Browser nachstellen – auf einem Telefon mit Berührung.
 *
 *   node tools/bedienung-pruefen.mjs
 *
 * Die Suiten unter tests/ prüfen die Regeln. Was sie nicht sehen können, ist
 * alles, was erst im Zusammenspiel mit dem Browser schiefgeht – und genau
 * dort saßen die Fehler, die zehn unabhängige Durchsichten gefunden haben:
 *
 *   · Die Zeichenfläche wurde während der Einblendung vermessen und war
 *     für die ganze Partie anderthalb Prozent zu groß.
 *   · Wer während eines KI-Zugs in die Optionen ging, hielt die Partie für
 *     immer an; nach den Optionen stand das Brett still.
 *   · Ein einziges fehlendes Bitmap beendete die Bildschleife.
 *   · Ein Tipp wählte ein Feld und legte im selben Zug die Karte, weil der
 *     Knopf unter dem Finger erschien.
 *   · Ein falscher Eintrag im Speicher brach den Start ab.
 *
 * Jede dieser Lagen wird hier hergestellt. Am Stand vor den Korrekturen
 * schlagen 16 der 40 Prüfungen fehl.
 *
 * Läuft nicht in der CI – dort gibt es keinen Browser. Vor einer Änderung
 * an js/ui/main.js oder js/ui/render.js von Hand laufen lassen.
 */
import { starteBrowser, starteServer } from './_browser.mjs';

const srv = await starteServer(process.argv[2] || undefined);
const URL = srv.url;
const browser = await starteBrowser();
let gut = 0, schlecht = 0;
const ok = (b, was) => { if (b) { gut++; console.log('  ✓', was); } else { schlecht++; console.log('  ✗', was); } };

async function neu(vorher = null) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e.message || e)));
  page.on('dialog', (d) => { page._dialoge = (page._dialoge || []).concat(d.message()); d.accept().catch(() => {}); });
  if (vorher) await page.addInitScript(vorher);
  await page.goto(URL);
  await page.waitForTimeout(300);
  return { ctx, page, fehler };
}
const schirm = (page) => page.evaluate(() => document.querySelector('.screen.active')?.id);
async function starteSpiel(page) {
  await page.click('#btnNew');
  await page.waitForTimeout(100);
  await page.click('#btnStart');
  await page.waitForTimeout(700);
}
const st = (page) => page.evaluate(() => { const G = window.__carc.state; return G && { phase: G.phase, current: G.current, placed: G.placed.length, turn: G.turn, typ: G.players[G.current].type }; });

// ---------------------------------------------------------------- 1
console.log('1. Zeichenfläche hat die Größe der Fläche, nicht die der Einblendung');
{
  const { ctx, page, fehler } = await neu();
  await starteSpiel(page);
  const m = await page.evaluate(() => { const c = document.getElementById('board'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: window.__carc.brett.dpr }; });
  ok(m.w === Math.round(m.cw * m.dpr) && m.h === Math.round(m.ch * m.dpr), `Bitmap ${m.w}×${m.h} = Fläche ${m.cw}×${m.ch} × ${m.dpr}`);
  ok(!fehler.length, 'keine Fehler beim Start' + (fehler.length ? ': ' + fehler[0] : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 2
console.log('2. Optionen während eines KI-Zugs: Partie läuft weiter, Brett wird wieder gezeichnet');
{
  const { ctx, page, fehler } = await neu();
  await starteSpiel(page);
  await page.evaluate(() => { const b = window.__carc.brett; b._n = 0; const r = b.render.bind(b); b.render = (...a) => { b._n++; return r(...a); }; });
  const vor = await st(page);
  await page.evaluate(() => window.__carc.autoMove());     // Zug des Menschen
  await page.waitForTimeout(1250);                          // KI ist jetzt dran und wartet
  const mitten = await st(page);
  await page.click('#btnGameMenu'); await page.click('#btnToOptions');
  ok(await schirm(page) === 'screen-options', 'Optionen offen');
  await page.waitForTimeout(3000);
  const inOpt = await st(page);
  await page.click('#screen-options [data-back]');
  await page.waitForTimeout(600);
  ok(await schirm(page) === 'screen-game', 'zurück im Spiel');
  const n1 = await page.evaluate(() => window.__carc.brett._n);
  await page.waitForTimeout(500);
  const n2 = await page.evaluate(() => window.__carc.brett._n);
  ok(n2 > n1 + 5, `Brett wird wieder gezeichnet (${n2 - n1} Bilder in 0,5 s)`);
  await page.waitForTimeout(2500);
  const nach = await st(page);
  ok(nach.typ === 'human' && nach.phase === 'place' && nach.placed > vor.placed + 1, `Partie ist weitergelaufen (Karten ${vor.placed} → ${nach.placed}, am Zug: ${nach.typ})`);
  ok(await page.evaluate(() => window.__carc.autoMove()), 'der Mensch kann wieder ziehen');
  ok(!fehler.length, 'keine Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
  void mitten; void inOpt;
  await ctx.close();
}

// ---------------------------------------------------------------- 3
console.log('3. Ein Fehler in einem Bild beendet die Bildschleife nicht');
{
  const { ctx, page } = await neu();
  await starteSpiel(page);
  await page.evaluate(() => { const b = window.__carc.brett; b._n = 0; const r = b.render.bind(b); let erst = true; b.render = (...a) => { if (erst) { erst = false; b.ctx.save(); b.ctx.scale(3, 3); throw new Error('Probe'); } b._n++; return r(...a); }; });
  await page.waitForTimeout(500);
  const n = await page.evaluate(() => window.__carc.brett._n);
  ok(n > 5, `nach dem Fehler weiter gezeichnet (${n} Bilder)`);
  const t = await page.evaluate(() => { const m = window.__carc.brett.ctx.getTransform(); return [m.a, m.d]; });
  ok(Math.abs(t[0] - 1) < 1e-6 && Math.abs(t[1] - 1) < 1e-6, `Zeichenzustand zurückgesetzt (Maßstab ${t})`);
  await ctx.close();
}

// ---------------------------------------------------------------- 4
console.log('4. Ein Tipp wählt das Feld – und legt nicht gleich die Karte');
{
  const { ctx, page } = await neu();
  await starteSpiel(page);
  // Wo erscheint „Platzieren"? Erst ein Feld wählen, messen, wieder abwählen.
  const feld = await page.evaluate(() => {
    const G = window.__carc.state, b = window.__carc.brett;
    return import('/js/engine/game.js').then(({ legalPlacements }) => { const l = legalPlacements(G)[0]; return { x: l.x, y: l.y, s: b.worldToScreen(l.x, l.y) }; });
  });
  await page.touchscreen.tap(feld.s[0], feld.s[1]);
  await page.waitForTimeout(500);
  const knopf = await page.evaluate(() => { const r = document.getElementById('btnConfirm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sichtbar: r.width > 0 }; });
  ok(knopf.sichtbar, '„Platzieren" erscheint nach der Wahl');
  // abwählen: daneben tippen (kein legales Feld)
  await page.touchscreen.tap(20, 300);
  await page.waitForTimeout(450);
  // Kamera so schieben, dass das Feld genau unter dem Knopf liegt
  await page.evaluate(({ feld, knopf }) => {
    const b = window.__carc.brett, r = b.groesse ? b.groesse() : b.canvas.getBoundingClientRect();
    b.camTarget = null;
    b.cam.x = feld.x - (knopf.x - r.width / 2) / b.cam.scale;
    b.cam.y = feld.y - (knopf.y - r.height / 2) / b.cam.scale;
  }, { feld, knopf });
  await page.waitForTimeout(150);
  await page.touchscreen.tap(knopf.x, knopf.y);
  await page.waitForTimeout(250);
  const s1 = await st(page);
  ok(s1.phase === 'place', `nach einem Tipp liegt die Karte noch nicht (Phase ${s1.phase})`);
  const sichtbar = await page.evaluate(() => !document.getElementById('btnConfirm').classList.contains('hidden'));
  ok(sichtbar, 'das Feld ist gewählt, „Platzieren" steht da');
  // Doppeltipp auf „Platzieren": die Karte liegt, der Zug ist aber noch offen
  await page.waitForTimeout(500);
  const k2 = await page.evaluate(() => { const r = document.getElementById('btnConfirm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(k2.x, k2.y);
  await page.waitForTimeout(90);
  await page.touchscreen.tap(k2.x, k2.y);
  await page.waitForTimeout(300);
  const s2 = await st(page);
  const optionen = await page.evaluate(() => window.__carc.plaetze().length);
  ok(s2.placed === s1.placed + 1, 'der erste Tipp legt die Karte');
  ok(optionen === 0 ? true : s2.phase === 'meeple', `der zweite verschenkt den Gefolgsmann nicht (Phase ${s2.phase}, ${optionen} Plätze)`);
  // … und nach der Sperrzeit geht „Ohne Meeple" ganz normal
  if (s2.phase === 'meeple') {
    await page.waitForTimeout(400);
    await page.click('#btnSkipMeeple');
    await page.waitForTimeout(200);
    const s3 = await st(page);
    ok(s3.turn === s2.turn + 1, '„Ohne Meeple" nimmt den Tipp danach an');
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 5
console.log('5. Zwei-Finger-Zoom bleibt unter den Fingern');
{
  const { ctx, page } = await neu();
  await starteSpiel(page);
  const cdp = await ctx.newCDPSession(page);
  const tp = (pts) => pts.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 }));
  const mitte = [200, 500];
  const vor = await page.evaluate((m) => window.__carc.brett.screenToWorld(m[0], m[1]), mitte);
  const skVor = await page.evaluate(() => window.__carc.brett.cam.scale);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[170, 500], [230, 500]]) });
  for (let d = 30; d <= 90; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[200 - d, 500], [200 + d, 500]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  const nach = await page.evaluate((m) => window.__carc.brett.screenToWorld(m[0], m[1]), mitte);
  const skNach = await page.evaluate(() => window.__carc.brett.cam.scale);
  ok(skNach > skVor * 1.5, `vergrößert (${skVor.toFixed(0)} → ${skNach.toFixed(0)})`);
  ok(Math.hypot(nach[0] - vor[0], nach[1] - vor[1]) < 0.03, `der Punkt unter den Fingern bleibt (${Math.hypot(nach[0] - vor[0], nach[1] - vor[1]).toFixed(3)} Kartenbreiten Versatz)`);
  // zwei Finger auf demselben Punkt
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[200, 400], [200, 400]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[200, 400], [200, 400]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[190, 400], [210, 400]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const cam = await page.evaluate(() => window.__carc.brett.cam);
  ok(Number.isFinite(cam.scale) && Number.isFinite(cam.x) && Number.isFinite(cam.y), `Maßstab bleibt eine Zahl (${cam.scale})`);
  await ctx.close();
}

// ---------------------------------------------------------------- 6
console.log('6. Kaputter Speicher: die App startet trotzdem');
for (const [name, werte] of [
  ['falsche Arten', { 'carc.setup': '"kaputt"', 'carc.scores': '5', 'carc.save': '"x"', 'carc.options': '7' }],
  ['halbe Aufstellung', { 'carc.setup': '{"players":[{"name":"Solo","color":0,"type":"human"}],"expansions":null,"deckScale":9}', 'carc.scores': '[null,{"name":"A"},{"name":"B","score":50,"date":"1","players":2,"tag":"x"}]' }],
  ['kein JSON', { 'carc.setup': '{', 'carc.scores': 'x', 'carc.save': '{{' }],
]) {
  const { ctx, page, fehler } = await neu(`(() => { const w = ${JSON.stringify(werte)}; for (const k in w) localStorage.setItem(k, w[k]); })()`);
  ok(!fehler.length, `${name}: Start ohne Fehler` + (fehler.length ? ' – ' + fehler[0] : ''));
  await page.click('#btnNew').catch(() => {});
  await page.waitForTimeout(100);
  const zeilen = await page.evaluate(() => document.querySelectorAll('#playerRows .player-row').length);
  ok(zeilen >= 2, `${name}: Aufstellung hat ${zeilen} Spieler`);
  await page.click('#screen-setup [data-back]').catch(() => {});
  await page.click('#btnScores').catch(() => {});
  await page.waitForTimeout(100);
  ok(!fehler.length && await schirm(page) === 'screen-scores', `${name}: Bestenliste öffnet`);
  await ctx.close();
}

// ---------------------------------------------------------------- 7
console.log('7. Unladbarer Spielstand macht „Weiterspielen" nicht tot');
{
  const save = { v: 2, settings: { players: [{ name: 'A', color: '#D6321A', type: 'human' }, { name: 'B', color: '#196CCD', type: 'ai1' }], expansions: {}, deckScale: 1 }, startId: 'D', deckIds: ['U', 'U', 'U'], history: [{ x: 5, y: 5, rot: 0, m: null }], turn: 2 };
  const { ctx, page, fehler } = await neu(`localStorage.setItem('carc.save', ${JSON.stringify(JSON.stringify(save))})`);
  const da = await page.evaluate(() => !document.getElementById('btnContinue').classList.contains('hidden'));
  ok(da, '„Weiterspielen" wird angeboten');
  await page.click('#btnContinue');
  await page.waitForTimeout(300);
  ok((page._dialoge || []).length === 1, 'es wird gesagt, dass der Spielstand nicht ladbar war');
  ok(await page.evaluate(() => document.getElementById('btnContinue').classList.contains('hidden')), 'der Knopf ist danach weg');
  ok(await page.evaluate(() => localStorage.getItem('carc.save') === null), 'der Spielstand ist entfernt');
  ok(!fehler.length, 'kein unbehandelter Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 8
console.log('8. Aufgeben gleich nach der letzten Karte / Ende während der Optionen');
{
  const { ctx, page, fehler } = await neu();
  await starteSpiel(page);
  await page.evaluate(() => { const G = window.__carc.state; G.deck.length = 0; });
  await page.evaluate(() => window.__carc.autoMove());
  await page.waitForTimeout(1300);
  ok((await st(page)).phase === 'over', 'Partie ist zu Ende');
  await page.click('#btnGameMenu'); await page.click('#btnQuit');
  await page.waitForTimeout(2500);
  ok(await schirm(page) === 'screen-menu', 'nach dem Aufgeben bleibt das Hauptmenü stehen');
  ok(!fehler.length, 'kein Fehler aus der verspäteten Abrechnung' + (fehler.length ? ': ' + fehler[0] : ''));
  // zweite Partie: Ende, während die Optionen offen sind
  await starteSpiel(page);
  await page.evaluate(() => { const G = window.__carc.state; G.deck.length = 0; });
  await page.evaluate(() => window.__carc.autoMove());
  await page.waitForTimeout(1300);
  await page.click('#btnGameMenu'); await page.click('#btnToOptions');
  await page.waitForTimeout(2500);
  ok(await schirm(page) === 'screen-options', 'die Abrechnung platzt nicht in die Optionen');
  await page.click('#screen-options [data-back]');
  await page.waitForTimeout(400);
  ok(await schirm(page) === 'screen-end', 'sie kommt, sobald man zurück ist');
  await page.click('#btnRematch');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('gameMenu').classList.contains('hidden')), 'nach der Revanche ist das Pausenmenü zu');
  ok(!fehler.length, 'keine Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
  await ctx.close();
}

await browser.close();
srv.close();
console.log(`\n${gut} bestanden, ${schlecht} fehlgeschlagen`);
process.exit(schlecht ? 1 : 0);
