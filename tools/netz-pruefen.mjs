/**
 * Den Online-Mehrspieler nachstellen: ein Gastgeber und ein Gast, zwei
 * Seiten im selben Browser.
 *
 *   node tools/netz-pruefen.mjs
 *   node tools/netz-pruefen.mjs /pfad/zu/einem/frueheren/stand   # Gegenprobe
 *
 * Zwischen beiden sitzt kein echtes WebRTC, sondern ein nachgebauter
 * Vermittler, der sich verhält wie PeerJS – einschließlich der Eigenheit,
 * an der das Spiel hing: wer eine Verbindung schließt, bekommt selbst ein
 * `close` gemeldet, sofort und im selben Aufruf. Der frühere Code
 * antwortete auf `close` mit Aufräumen, das Aufräumen schloss die
 * Verbindung, und das meldete wieder `close`. Auf dem Bildschirm standen
 * dann Hunderte Hinweisfenster hintereinander.
 *
 * Geprüft wird der echte Weg: PeerTransport und PeerConnWrap aus
 * js/ui/net.js laufen unverändert, nur `window.Peer` ist ausgetauscht.
 *
 * Läuft nicht in der CI (kein Browser).
 */
import { starteBrowser, starteServer } from './_browser.mjs';

const srv = await starteServer(process.argv[2] || undefined);
const browser = await starteBrowser();
let gut = 0, schlecht = 0;
const ok = (b, was) => { if (b) { gut++; console.log('  ✓', was); } else { schlecht++; console.log('  ✗', was); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------- der nachgebaute Vermittler
const VERMITTLER = `(() => {
  const kanal = new BroadcastChannel('nachbau-vermittler');
  const alle = new Set();
  class Horcher {
    constructor() { this._h = {}; }
    on(art, f) { (this._h[art] ||= []).push(f); return this; }
    emit(art, ...a) { for (const f of (this._h[art] || []).slice()) f(...a); }
  }
  class Verbindung extends Horcher {
    constructor(eigner, gegen, nr) { super(); this.eigner = eigner; this.peer = gegen; this.nr = nr; this.offen = false; this.zu = false; }
    send(d) {
      if (!this.offen || this.zu) { this.emit('error', new Error('Connection is not open')); return; }
      kanal.postMessage({ k: 'daten', an: this.peer, von: this.eigner.id, nr: this.nr, d });
    }
    // Wie PeerJS: das eigene Schließen meldet sofort selbst „close".
    close() {
      if (this.zu) return;
      this.zu = true; this.offen = false;
      try { kanal.postMessage({ k: 'ende', an: this.peer, von: this.eigner.id, nr: this.nr }); } catch {}
      this.eigner._verb.delete(this.nr);
      this.emit('close');
    }
  }
  class Peer extends Horcher {
    constructor(id) {
      super();
      this.id = id || 'gast-' + Math.random().toString(36).slice(2, 10);
      this.destroyed = false; this.disconnected = false;
      this._verb = new Map();
      alle.add(this);
      setTimeout(() => { if (!this.destroyed) this.emit('open', this.id); }, 20);
    }
    connect(gegen) {
      const nr = Math.random().toString(36).slice(2, 10);
      const v = new Verbindung(this, gegen, nr);
      this._verb.set(nr, v);
      kanal.postMessage({ k: 'anfrage', an: gegen, von: this.id, nr });
      setTimeout(() => { if (!v.offen && !v.zu) this.emit('error', { type: 'peer-unavailable' }); }, 1500);
      return v;
    }
    reconnect() { this.disconnected = false; setTimeout(() => this.emit('open', this.id), 20); }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const v of [...this._verb.values()]) v.close();
      alle.delete(this);
    }
    _empfange(m) {
      if (this.destroyed || m.an !== this.id) return;
      if (m.k === 'anfrage') {
        const v = new Verbindung(this, m.von, m.nr);
        this._verb.set(m.nr, v);
        this.emit('connection', v);
        // Erst hier öffnen, dann zusagen: wie beim echten Datenkanal kann
        // nichts ankommen, bevor diese Seite offen ist.
        setTimeout(() => {
          if (v.zu) return;
          v.offen = true; v.emit('open');
          kanal.postMessage({ k: 'zusage', an: m.von, von: this.id, nr: m.nr });
        }, 10);
        return;
      }
      const v = this._verb.get(m.nr);
      if (!v) return;
      if (m.k === 'zusage') { v.offen = true; v.emit('open'); }
      else if (m.k === 'daten') v.emit('data', m.d);
      else if (m.k === 'ende') { if (!v.zu) { v.zu = true; v.offen = false; this._verb.delete(m.nr); v.emit('close'); } }
    }
  }
  kanal.onmessage = (e) => { for (const p of [...alle]) p._empfange(e.data); };
  // Die echte Bibliothek wird nach diesem Skript geladen und darf den
  // Nachbau nicht überschreiben.
  Object.defineProperty(window, 'Peer', { get: () => Peer, set: () => {}, configurable: true });
  window.__vermittler = { alle, trenne: () => { for (const p of alle) { p.disconnected = true; p.emit('disconnected'); } } };
  // Hinweisfenster zählen statt anzeigen: ein echtes hält die Seite an,
  // und eine Schleife aus Hunderten ließe den Prüflauf stehen.
  window.__hinweise = [];
  window.alert = (t) => { window.__hinweise.push(String(t)); if (window.__hinweise.length > 2000) throw new Error('zu viele Hinweise'); };
})();`;

async function seite(ctx, vorher = '') {
  const page = await ctx.newPage();
  page._fehler = [];
  page.on('pageerror', (e) => page._fehler.push(String(e.message || e)));
  await page.addInitScript(VERMITTLER + vorher);
  await page.addInitScript(`localStorage.setItem('carc.options', '{"sfx":false,"music":false,"hints":true,"anim":false}')`);
  await page.goto(srv.url);
  await pause(300);
  return page;
}
const neu = () => browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
const st = (p) => p.evaluate(() => {
  const G = window.__carc.state, o = window.__carc.netz;
  return {
    schirm: document.querySelector('.screen.active')?.id,
    online: o ? { rolle: o.role, ich: o.myIdx, gestartet: o.started, gaeste: o.remotes.length } : null,
    spiel: G ? { am: G.current, phase: G.phase, karten: G.placed.length, zug: G.turn, typen: G.players.map((x) => x.type), namen: G.players.map((x) => x.name), verlauf: JSON.stringify(G.history) } : null,
    hinweise: window.__hinweise.length,
  };
}).catch(() => null);

/** Gastgeber öffnet einen Raum; liefert den Code. */
async function oeffneRaum(host) {
  await host.click('#btnNew'); await pause(100);
  await host.click('#btnHost');
  await host.waitForFunction(() => !document.getElementById('onlineHost').classList.contains('hidden'), null, { timeout: 5000 });
  return host.evaluate(() => document.getElementById('roomCode').textContent.trim());
}
/** Gast tritt bei (bis zum Klick auf „Beitreten"). */
async function trittBei(gast, code, name = 'Gustav') {
  await gast.click('#btnNew'); await pause(100);
  await gast.click('#btnJoin'); await pause(100);
  await gast.fill('#joinCode', code);
  await gast.fill('#joinName', name);
  await gast.click('#btnJoinGo');
}
const inLobby = (gast) => gast.waitForFunction(() => !document.getElementById('joinLobby').classList.contains('hidden'), null, { timeout: 6000 }).then(() => true, () => false);
/** Wer am Zug ist, zieht – auf dem Gerät, auf dem er ein Mensch ist. */
async function zieh(host, gast) {
  for (const p of [host, gast]) {
    const dran = await p.evaluate(() => { const G = window.__carc.state; return !!G && G.phase === 'place' && G.players[G.current].type === 'human'; }).catch(() => false);
    if (dran && await p.evaluate(() => window.__carc.autoMove())) return true;
  }
  return false;
}

// ---------------------------------------------------------------- 1
console.log('1. Raum, Beitritt, Platz – auch wenn der Gastgeber danach umbaut');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  ok(/^[A-Z0-9]{5}$/.test(code), `Raum offen (${code})`);
  await trittBei(gast, code);
  ok(await inLobby(gast), 'der Gast sieht die Lobby');
  await pause(300);
  const vor = await st(gast);
  // Der Gastgeber nimmt NACH dem Beitritt einen lokalen Spieler dazu
  await host.click('#btnAddPlayer'); await pause(400);
  const nach = await st(gast);
  ok(nach.online.ich === vor.online.ich + 1, `der Platz des Gasts rückt mit (${vor.online.ich} → ${nach.online.ich})`);
  const du = await gast.evaluate(() => [...document.querySelectorAll('#joinRoster li')].findIndex((li) => li.textContent.includes('(du)')));
  ok(du === nach.online.ich, `die Liste zeigt „(du)" an der richtigen Stelle (${du})`);
  await host.click('#btnStart');
  await gast.waitForFunction(() => !!window.__carc.state, null, { timeout: 5000 }).catch(() => {});
  await pause(500);
  const h = await st(host), g = await st(gast);
  ok(!!g.spiel && g.schirm === 'screen-game', 'die Partie beginnt auch beim Gast');
  if (g.spiel) {
    const sitz = g.spiel.typen.indexOf('human');
    ok(g.spiel.namen[sitz] === 'Gustav', `der Gast steuert seine eigene Figur (Platz ${sitz}: ${g.spiel.namen[sitz]})`);
    ok(h.spiel.typen[sitz] === 'remote', `und beim Gastgeber ist genau dieser Platz „online" (${h.spiel.typen.join(',')})`);
    ok(g.spiel.typen.filter((t) => t === 'human').length === 1, 'genau ein Platz gehört dem Gast');
  }
  // Ein paar Züge hin und her
  let gleich = true, zuege = 0;
  for (let i = 0; i < 40 && zuege < 9; i++) {
    if (await zieh(host, gast)) zuege++;
    await pause(450);
  }
  await pause(900);
  const h2 = await st(host), g2 = await st(gast);
  gleich = !!h2.spiel && !!g2.spiel && h2.spiel.verlauf === g2.spiel.verlauf;
  ok(zuege >= 6 && !!h2.spiel && h2.spiel.karten > 6, `es wird gespielt (${h2.spiel ? h2.spiel.karten : 0} Karten liegen)`);
  ok(gleich, 'beide Geräte haben denselben Verlauf');
  ok(!host._fehler.length && !gast._fehler.length, 'keine Fehler' + (host._fehler[0] || gast._fehler[0] ? ': ' + (host._fehler[0] || gast._fehler[0]) : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 2
console.log('2. Der Gastgeber geht mitten in der Partie');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  await trittBei(gast, code); await inLobby(gast); await pause(300);
  await host.click('#btnStart');
  await gast.waitForFunction(() => !!window.__carc.state, null, { timeout: 5000 }).catch(() => {});
  await pause(600);
  await host.click('#btnGameMenu'); await pause(100);
  await host.click('#btnQuit');
  await pause(1500);
  const g = await st(gast);
  ok(g.hinweise === 1, `der Gast bekommt genau einen Hinweis (waren ${g.hinweise})`);
  ok(g.schirm === 'screen-menu' && g.online === null && g.spiel === null, `und steht aufgeräumt im Hauptmenü (${g.schirm})`);
  ok(!gast._fehler.length, 'ohne Fehler' + (gast._fehler[0] ? ': ' + gast._fehler[0].slice(0, 90) : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 3
console.log('3. Der Gast geht mitten in der Partie');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  await trittBei(gast, code); await inLobby(gast); await pause(300);
  await host.click('#btnStart');
  await gast.waitForFunction(() => !!window.__carc.state, null, { timeout: 5000 }).catch(() => {});
  await pause(600);
  const sitz = (await st(gast)).spiel.typen.indexOf('human');
  await gast.click('#btnGameMenu'); await pause(100);
  await gast.click('#btnQuit');
  await pause(1500);
  const h = await st(host), g = await st(gast);
  ok(h.spiel && h.spiel.typen[sitz] !== 'remote', `beim Gastgeber übernimmt die KI den Platz (${h.spiel && h.spiel.typen[sitz]})`);
  ok(h.hinweise === 0 && g.hinweise === 0, `kein Hinweisfenster auf beiden Seiten (${h.hinweise}/${g.hinweise})`);
  ok(g.schirm === 'screen-menu' && g.online === null, 'der Gast steht im Hauptmenü');
  // … und die Partie läuft beim Gastgeber weiter
  const vor = h.spiel.karten;
  for (let i = 0; i < 12; i++) { await host.evaluate(() => window.__carc.autoMove()); await pause(350); }
  const h2 = await st(host);
  ok(h2.spiel.karten > vor + 1, `die Partie läuft weiter (${vor} → ${h2.spiel.karten} Karten)`);
  ok(!host._fehler.length && !gast._fehler.length, 'ohne Fehler' + (host._fehler[0] || gast._fehler[0] ? ': ' + (host._fehler[0] || gast._fehler[0]).slice(0, 90) : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 4
console.log('4. Unsinn aus dem Netz');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  await trittBei(gast, code); await inLobby(gast); await pause(300);
  await host.click('#btnStart');
  await gast.waitForFunction(() => !!window.__carc.state, null, { timeout: 5000 }).catch(() => {});
  await pause(600);
  // Bis der Gast am Zug ist
  for (let i = 0; i < 20; i++) {
    const h = await st(host);
    if (h.spiel.typen[h.spiel.am] === 'remote' && h.spiel.phase === 'place') break;
    await zieh(host, gast); await pause(450);
  }
  const vor = await st(host);
  ok(vor.spiel.typen[vor.spiel.am] === 'remote', 'Ausgangslage: der Gast ist am Zug');
  // Nachrichten, als kämen sie vom Gast
  const spiele = (msg) => host.evaluate((m) => { const o = window.__carc.netz; o.net.onMessage(m, o.remotes[0].connId); }, msg);
  for (const [was, move] of [
    ['rot als Zeichenkette', { x: 0, y: 1, rot: '0' }], ['rot = 7', { x: 0, y: 1, rot: 7 }],
    ['x fehlt', { y: 1, rot: 0 }], ['gar kein Zug', null], ['eine Zahl', 5],
    ['Meeple ohne Gebiet', { x: 0, y: 1, rot: 0, meeple: {} }],
  ]) {
    await spiele({ t: 'move', move });
    await pause(250);
    const s = await st(host);
    ok(s.spiel.karten === vor.spiel.karten && s.spiel.zug === vor.spiel.zug, `${was}: verworfen, nichts verändert`);
  }
  // Ein gültiger Platz mit einem Gefolgsmann, den es nicht gibt
  const platz = await host.evaluate(() => import('/js/engine/game.js').then(({ legalPlacements }) => { const l = legalPlacements(window.__carc.state)[0]; return { x: l.x, y: l.y, rot: l.rots[0] }; }));
  await spiele({ t: 'move', move: { ...platz, meeple: { fi: 99, big: false } } });
  await pause(1200);
  const nach = await st(host);
  ok(nach.spiel.karten === vor.spiel.karten + 1, 'ein gültiger Zug mit unmöglichem Gefolgsmann: die Karte liegt');
  ok(nach.spiel.zug === vor.spiel.zug + 1, 'und der Zug ist beendet – die Partie steht nicht');
  ok(!host._fehler.length, 'kein Fehler beim Gastgeber' + (host._fehler[0] ? ': ' + host._fehler[0].slice(0, 90) : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- 5
console.log('5. Eine Start-Nachricht, die nicht stimmt');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  await trittBei(gast, code); await inLobby(gast); await pause(300);
  const schick = (msg) => gast.evaluate((m) => { const o = window.__carc.netz; if (o) o.net.onMessage(m, 'host'); }, msg);
  const gut = { players: [{ name: 'A', color: '#D6321A', type: 'human' }, { name: 'B', color: '#196CCD', type: 'remote' }], expansions: {}, deckScale: 1 };
  // Farbe mit Markup: darf nirgends als HTML landen
  await schick({ t: 'lobby', you: 1, roster: [{ name: 'A', color: '#D6321A', kind: 'human' }, { name: '<img src=x onerror=window.__xss=1>', color: 'red"><img src=x onerror=window.__xss=1>', kind: 'remote' }] });
  await pause(200);
  ok(await gast.evaluate(() => !window.__xss && !document.querySelector('#joinRoster img')), 'Name und Farbe aus der Lobby werden nicht als HTML gelesen');
  await schick({ t: 'start', you: 1, settings: { ...gut, players: 'viele' }, deckIds: ['U'], startId: 'D' });
  await schick({ t: 'start', you: 1, settings: gut, deckIds: ['GIBTS_NICHT'], startId: 'D' });
  await schick({ t: 'start', you: 7, settings: gut, deckIds: ['U'], startId: 'D' });
  await pause(300);
  const s = await st(gast);
  ok(!s.spiel && !gast._fehler.length, 'kaputte Start-Nachrichten bauen keine Partie und werfen nichts' + (gast._fehler[0] ? ': ' + gast._fehler[0].slice(0, 90) : ''));
  const text = await gast.evaluate(() => document.getElementById('joinError').textContent);
  const offen = await gast.evaluate(() => !document.getElementById('joinModal').classList.contains('hidden'));
  ok(offen && text.length > 10, `der Gast erfährt es („${text}")`);
  await ctx.close();
}

// ---------------------------------------------------------------- 6
console.log('6. „Abbrechen", während die Verbindung noch aufgebaut wird');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  // Der Beitritt dauert künstlich länger
  await gast.evaluate(() => import('/js/ui/net.js').then(({ Net }) => { const echt = Net.join; Net.join = async (...a) => { const n = await echt.apply(Net, a); await new Promise((r) => setTimeout(r, 1500)); return n; }; }));
  await trittBei(gast, code);
  await pause(400);
  await gast.click('#btnJoinCancel');
  await pause(2600);
  const h = await st(host), g = await st(gast);
  ok(g.online === null, 'der Gast ist nicht heimlich im Raum');
  ok(h.online.gaeste === 0, `der Gastgeber führt ihn nicht als Gast (${h.online.gaeste})`);
  ok(await gast.evaluate(() => document.getElementById('joinModal').classList.contains('hidden')), 'der Dialog bleibt zu');
  await host.click('#btnAddPlayer'); await pause(100);
  await host.click('#btnStart'); await pause(900);
  ok((await st(gast)).spiel === null, 'startet der Gastgeber, springt beim Gast keine Partie auf');
  await ctx.close();
}

// ---------------------------------------------------------------- 7
console.log('7. Der Raum ist voll / der Raum verschwindet');
{
  const ctx = await neu();
  const host = await seite(ctx), gast = await seite(ctx);
  const code = await oeffneRaum(host);
  for (let i = 0; i < 4; i++) { await host.click('#btnAddPlayer').catch(() => {}); await pause(60); }
  await trittBei(gast, code);
  await pause(1200);
  const text = await gast.evaluate(() => document.getElementById('joinError').textContent);
  const offen = await gast.evaluate(() => !document.getElementById('joinModal').classList.contains('hidden') && !document.getElementById('joinForm').classList.contains('hidden'));
  ok(/voll/.test(text) && offen, `„Der Raum ist voll" ist zu lesen („${text}", Dialog ${offen ? 'offen' : 'zu'})`);
  await ctx.close();

  const ctx2 = await neu();
  const host2 = await seite(ctx2), gast2 = await seite(ctx2);
  const code2 = await oeffneRaum(host2);
  await trittBei(gast2, code2); await inLobby(gast2); await pause(300);
  await host2.click('#btnHostCancel');
  await pause(1000);
  const t2 = await gast2.evaluate(() => document.getElementById('joinError').textContent);
  const offen2 = await gast2.evaluate(() => !document.getElementById('joinModal').classList.contains('hidden'));
  const g2 = await st(gast2);
  ok(/Host|Gastgeber/.test(t2) && offen2, `schließt der Gastgeber den Raum, steht das da („${t2}")`);
  ok(g2.online === null && g2.hinweise === 0, 'ohne Hinweisfenster, und der Gast ist wieder frei');
  await ctx2.close();
}

// ---------------------------------------------------------------- 8
console.log('8. Raumcodes mit T und der Vermittler');
{
  const ctx = await neu();
  const p = await seite(ctx);
  const r = await p.evaluate(async () => {
    const { Net } = await import('/js/ui/net.js');
    const vor = window.__vermittler.alle.size;
    const net = await Net.host('TABCD');
    const echt = window.__vermittler.alle.size === vor + 1;      // lief über den Vermittler, nicht über den Prüfkanal
    let gemeldet = null;
    net.onError = (t) => { gemeldet = t; };
    // Der Vermittler verliert die Verbindung
    window.__vermittler.trenne();
    await new Promise((res) => setTimeout(res, 1500));
    const wieder = [...window.__vermittler.alle].every((x) => !x.disconnected);
    net.close();
    return { echt, wieder, gemeldet };
  });
  ok(r.echt, 'ein Code mit T am Anfang ist ein ganz normaler Raum');
  ok(r.wieder, 'reißt die Verbindung zum Vermittler ab, meldet sich der Raum wieder an');
  await ctx.close();
}

await browser.close();
srv.close();
console.log(`\n${gut} bestanden, ${schlecht} fehlgeschlagen`);
process.exit(schlecht ? 1 : 0);
