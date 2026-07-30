// ============================================================
// Carcassonne Mobile – App-Steuerung
// ============================================================
import { DEFS, deckSizeFor } from '../engine/tiles.js';
import {
  newGame, cloneState, legalPlacements, placeCurrent, meepleOptions,
  finishTurn, serialize, resumeGame,
} from '../engine/game.js';
import { chooseMove } from '../engine/ai.js';
import { BoardView, drawPreview, tileArt, drawMeeple, meepleSpotWorld } from './render.js';
import { sfx, applySoundOptions, unlockAudio, startMusic, stopMusic, soundState } from './sound.js';
import { Net } from './net.js';

const $ = (id) => document.getElementById(id);
const COLORS = ['#e63946', '#2f7bdb', '#f4c430', '#3fa34d', '#454554', '#8e44ad'];
const COLOR_NAMES = ['Rot', 'Blau', 'Gelb', 'Grün', 'Schwarz', 'Lila'];
const DEFAULT_NAMES = ['Anna', 'Ben', 'Clara', 'David', 'Emma', 'Felix'];

// ---------- Speicher ----------
const store = {
  get(k, fb) { try { const v = localStorage.getItem('carc.' + k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem('carc.' + k, JSON.stringify(v)); } catch { /* voll */ } },
  del(k) { try { localStorage.removeItem('carc.' + k); } catch { /* egal */ } },
};

let options = Object.assign({ sfx: true, music: true, hints: true, anim: true }, store.get('options', {}));
applySoundOptions(options);

// ---------- Screens ----------
let currentScreen = 'menu';
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  currentScreen = name;
  if (name === 'menu') refreshMenu();
  if (name === 'scores') renderScores();
}
document.querySelectorAll('[data-back]').forEach(b =>
  b.addEventListener('click', () => {
    sfx.click();
    if (currentScreen === 'setup' && online && !online.started) teardownOnline();
    showScreen(backTarget);
  }));
let backTarget = 'menu';

// Audio nach erster Interaktion freischalten
window.addEventListener('pointerdown', function unlock() {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
}, { once: false });

// ============================================================
// Hauptmenü
// ============================================================
function refreshMenu() {
  const save = store.get('save', null);
  $('btnContinue').classList.toggle('hidden', !save);
  if (save) $('btnContinue').textContent = `▶ Weiterspielen (Zug ${save.turn})`;
}
$('btnNew').addEventListener('click', () => { sfx.click(); backTarget = 'menu'; showScreen('setup'); });
$('btnScores').addEventListener('click', () => { sfx.click(); backTarget = 'menu'; showScreen('scores'); });
$('btnOptions').addEventListener('click', () => { sfx.click(); backTarget = currentScreen === 'game' ? 'game' : 'menu'; showScreen('options'); });
$('btnHelp').addEventListener('click', () => { sfx.click(); backTarget = 'menu'; showScreen('help'); });
$('btnContinue').addEventListener('click', () => {
  sfx.click();
  const save = store.get('save', null);
  if (!save) return;
  const s = resumeGame(save);
  if (!s || s.phase === 'over') { store.del('save'); refreshMenu(); return; }
  startGameUI(s);
});

// Menü-Hintergrund: schwebende Karten
(function menuBackground() {
  const canvas = $('menuBg');
  const ctx = canvas.getContext('2d');
  const ids = ['D', 'C', 'V', 'B', 'Q', 'U', 'M', 'E', 'K', 'RV_CURVE'];
  const tiles = ids.map((id, i) => ({
    id, rot: i % 4,
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00016, vy: (Math.random() - 0.5) * 0.00016,
    a: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 0.0016,
    s: 60 + Math.random() * 70,
  }));
  function frame() {
    if (currentScreen !== 'menu') { requestAnimationFrame(frame); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    for (const t of tiles) {
      t.x = (t.x + t.vx + 1) % 1; t.y = (t.y + t.vy + 1) % 1; t.a += t.va;
      ctx.save();
      ctx.translate(t.x * w, t.y * h);
      ctx.rotate(t.a);
      ctx.globalAlpha = 0.55;
      const art = tileArt(t.id, t.rot);
      ctx.drawImage(art, -t.s / 2, -t.s / 2, t.s, t.s);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ============================================================
// Setup-Screen
// ============================================================
let setup = Object.assign({
  players: [
    { name: 'Anna', color: 0, type: 'human' },
    { name: 'KI Ritter', color: 1, type: 'ai2' },
  ],
  expansions: { river: false, inns: false, king: false },
  deckScale: 1,
}, store.get('setup', {}));
if (![1, 2, 4].includes(setup.deckScale)) setup.deckScale = 1;

// Online-Zustand (null = lokales Spiel)
// { role:'host'|'guest', net, remotes:[{connId,name}], myIdx, started }
let online = null;

function totalPlayerCount() {
  return setup.players.length + (online && online.role === 'host' ? online.remotes.length : 0);
}

function renderPlayerRows() {
  const wrap = $('playerRows');
  wrap.innerHTML = '';
  setup.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.background = COLORS[p.color];
    dot.title = COLOR_NAMES[p.color];
    dot.addEventListener('click', () => {
      sfx.click();
      const used = setup.players.map(q => q.color);
      let c = p.color;
      for (let k = 0; k < 6; k++) {
        c = (c + 1) % COLORS.length;
        if (!used.includes(c)) break;
      }
      p.color = c;
      renderPlayerRows();
    });
    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 14;
    name.value = p.name;
    name.placeholder = 'Name';
    name.addEventListener('input', () => { p.name = name.value; });
    const type = document.createElement('select');
    [['human', '👤 Mensch'], ['ai1', '🤖 KI leicht'], ['ai2', '🤖 KI mittel'], ['ai3', '🤖 KI schwer']]
      .forEach(([v, label]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = label;
        if (p.type === v) o.selected = true;
        type.appendChild(o);
      });
    type.addEventListener('change', () => { p.type = type.value; });
    row.append(dot, name, type);
    if (setup.players.length > (online && online.role === 'host' && online.remotes.length ? 1 : 2)) {
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.textContent = '✕';
      rm.addEventListener('click', () => { sfx.click(); setup.players.splice(i, 1); renderPlayerRows(); });
      row.append(rm);
    }
    wrap.appendChild(row);
  });
  // Online-Gäste als gesperrte Zeilen anzeigen (Host-Sicht)
  if (online && online.role === 'host') {
    online.remotes.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'player-row remote';
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.style.background = COLORS[remoteColor(i)];
      const name = document.createElement('input');
      name.type = 'text';
      name.value = r.name || '…';
      name.readOnly = true;
      const tag = document.createElement('span');
      tag.className = 'remote-tag';
      tag.textContent = '🌐 online';
      row.append(dot, name, tag);
      wrap.appendChild(row);
    });
  }
  $('btnAddPlayer').classList.toggle('hidden', totalPlayerCount() >= 6);
}

// freie Farbe für Gast i (nach den lokalen Spielern)
function remoteColor(i) {
  const used = setup.players.map(p => p.color);
  const free = [];
  for (let c = 0; c < COLORS.length; c++) if (!used.includes(c)) free.push(c);
  return free[i % free.length] ?? (i % COLORS.length);
}

function updateDeckLabels() {
  $('deckSeg').querySelectorAll('button').forEach(b => {
    const n = deckSizeFor(setup.expansions, Number(b.dataset.scale));
    b.querySelector('[data-count]').textContent = n + ' Karten';
  });
}

$('btnAddPlayer').addEventListener('click', () => {
  if (totalPlayerCount() >= 6) return;
  sfx.click();
  const used = setup.players.map(p => p.color);
  const color = COLORS.findIndex((_, i) => !used.includes(i));
  const n = setup.players.length;
  setup.players.push({
    name: DEFAULT_NAMES[n % DEFAULT_NAMES.length],
    color: color < 0 ? n % 6 : color,
    type: 'ai2',
  });
  renderPlayerRows();
});

$('exRiver').checked = !!setup.expansions.river;
$('exInns').checked = !!setup.expansions.inns;
$('exKing').checked = !!setup.expansions.king;
$('exRiver').addEventListener('change', e => { setup.expansions.river = e.target.checked; updateDeckLabels(); });
$('exInns').addEventListener('change', e => { setup.expansions.inns = e.target.checked; updateDeckLabels(); });
$('exKing').addEventListener('change', e => { setup.expansions.king = e.target.checked; updateDeckLabels(); });

$('deckSeg').querySelectorAll('button').forEach(b => {
  if (Number(b.dataset.scale) === setup.deckScale) {
    $('deckSeg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }
  b.addEventListener('click', () => {
    sfx.click();
    $('deckSeg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    setup.deckScale = Number(b.dataset.scale);
  });
});

$('btnStart').addEventListener('click', () => {
  sfx.click();
  setup.players.forEach((p, i) => { if (!p.name.trim()) p.name = DEFAULT_NAMES[i]; });
  store.set('setup', setup);
  if (online && online.role === 'host') {
    if (totalPlayerCount() < 2) { toastSetup('Mindestens 2 Spieler (Gäste oder lokal) nötig'); return; }
    startOnlineGame();
    return;
  }
  const s = newGame({
    players: setup.players.map(p => ({ name: p.name.trim(), color: COLORS[p.color], type: p.type })),
    expansions: { ...setup.expansions },
    deckScale: setup.deckScale,
  });
  store.del('save');
  startGameUI(s);
});

function toastSetup(text) {
  alert(text);
}

renderPlayerRows();
updateDeckLabels();

// ============================================================
// Online-Mehrspieler: Lobby & Protokoll
// ============================================================
function rosterForLobby() {
  const locals = setup.players.map(p => ({
    name: p.name, color: COLORS[p.color],
    kind: p.type === 'human' ? 'human' : 'ai',
  }));
  const remotes = online.remotes.map((r, i) => ({
    name: r.name || '…', color: COLORS[remoteColor(i)], kind: 'remote',
  }));
  return [...locals, ...remotes];
}

function broadcastLobby() {
  if (!online || online.role !== 'host') return;
  const roster = rosterForLobby();
  online.remotes.forEach((r, i) => {
    online.net.sendTo(r.connId, {
      t: 'lobby', roster, you: setup.players.length + i,
    });
  });
  $('hostStatus').textContent = online.remotes.length
    ? `${online.remotes.length} Gast/Gäste verbunden – „Spiel starten“, wenn alle da sind.`
    : 'Warte auf Mitspieler…';
  renderPlayerRows();
}

$('btnHost').addEventListener('click', async () => {
  sfx.click();
  $('btnHost').disabled = true;
  try {
    const net = await Net.host(window.__carcHostCode || undefined);
    online = { role: 'host', net, remotes: [], started: false };
    wireHostNet(net);
    $('onlineOff').classList.add('hidden');
    $('onlineHost').classList.remove('hidden');
    $('roomCode').textContent = net.code;
    $('hostStatus').textContent = 'Warte auf Mitspieler…';
    // Lokal reicht ab jetzt 1 Spieler
    renderPlayerRows();
  } catch (e) {
    toastSetup(e.message || 'Online-Raum konnte nicht erstellt werden');
  } finally {
    $('btnHost').disabled = false;
  }
});

function wireHostNet(net) {
  net.onGuestJoin = () => { /* Name kommt mit hello */ };
  net.onGuestLeave = (connId) => {
    const i = online.remotes.findIndex(r => r.connId === connId);
    if (i >= 0) {
      const gone = online.remotes[i];
      if (!online.started) {
        online.remotes.splice(i, 1);
        broadcastLobby();
      } else {
        remotePlayerLost(gone);
      }
    }
  };
  net.onMessage = (msg, connId) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello' && !online.started) {
      if (totalPlayerCount() >= 6) {
        net.sendTo(connId, { t: 'full' });
        return;
      }
      const name = String(msg.name || 'Gast').slice(0, 14);
      online.remotes.push({ connId, name });
      broadcastLobby();
      sfx.meeple();
    } else if (msg.t === 'move' && online.started && G) {
      const idx = online.remotes.findIndex(r => r.connId === connId);
      const playerIdx = setup.players.length + idx;
      if (idx >= 0) queueRemoteMove(msg.move, playerIdx, connId);
    }
  };
}

$('btnHostCancel').addEventListener('click', () => {
  sfx.click();
  teardownOnline();
});

function teardownOnline() {
  if (online) {
    try { online.net.broadcast && online.net.broadcast({ t: 'quit' }); } catch { /* egal */ }
    if (online.role === 'guest') { try { online.net.sendToHost({ t: 'quit' }); } catch { /* egal */ } }
    online.net.close();
  }
  online = null;
  $('onlineOff').classList.remove('hidden');
  $('onlineHost').classList.add('hidden');
  $('joinModal').classList.add('hidden');
  renderPlayerRows();
}

// ---- Gast-Seite ----
$('btnJoin').addEventListener('click', () => {
  sfx.click();
  $('joinError').textContent = '';
  $('joinForm').classList.remove('hidden');
  $('joinLobby').classList.add('hidden');
  $('joinName').value = setup.players.find(p => p.type === 'human')?.name || 'Gast';
  $('joinModal').classList.remove('hidden');
});
$('btnJoinCancel').addEventListener('click', () => {
  sfx.click();
  teardownOnline();
});

$('btnJoinGo').addEventListener('click', async () => {
  sfx.click();
  const code = $('joinCode').value.trim().toUpperCase();
  const name = $('joinName').value.trim() || 'Gast';
  if (code.length < 4) { $('joinError').textContent = 'Bitte den Raum-Code eingeben.'; return; }
  $('btnJoinGo').disabled = true;
  $('joinError').textContent = 'Verbinde…';
  try {
    const net = await Net.join(code);
    online = { role: 'guest', net, remotes: [], started: false, myIdx: -1 };
    wireGuestNet(net);
    net.sendToHost({ t: 'hello', name });
    $('joinForm').classList.add('hidden');
    $('joinLobby').classList.remove('hidden');
    $('joinRoomCode').textContent = code;
    $('joinError').textContent = '';
  } catch (e) {
    $('joinError').textContent = e.message || 'Verbindung fehlgeschlagen';
  } finally {
    $('btnJoinGo').disabled = false;
  }
});

function wireGuestNet(net) {
  net.onHostLost = () => {
    if (online && online.started && G && G.phase !== 'over') {
      alert('Verbindung zum Host verloren – das Spiel wird beendet.');
      teardownOnline();
      G = null;
      showScreen('menu');
    } else {
      $('joinError').textContent = 'Verbindung zum Host verloren.';
      teardownOnline();
    }
  };
  net.onMessage = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'lobby') {
      online.myIdx = msg.you;
      const ul = $('joinRoster');
      ul.innerHTML = '';
      msg.roster.forEach((r, i) => {
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = r.color;
        const nm = document.createElement('span');
        nm.textContent = r.name + (i === msg.you ? ' (du)' : '') +
          (r.kind === 'ai' ? ' 🤖' : r.kind === 'remote' && i !== msg.you ? ' 🌐' : '');
        li.append(dot, nm);
        ul.appendChild(li);
      });
    } else if (msg.t === 'full') {
      $('joinError').textContent = 'Der Raum ist voll (max. 6 Spieler).';
      teardownOnline();
    } else if (msg.t === 'start') {
      online.started = true;
      $('joinModal').classList.add('hidden');
      const players = msg.settings.players.map((p, i) => ({
        ...p, type: i === online.myIdx ? 'human' : 'remote',
      }));
      const s = newGame({
        players,
        expansions: msg.settings.expansions,
        deckScale: msg.settings.deckScale,
        deckIds: msg.deckIds,
        startId: msg.startId,
      });
      startGameUI(s);
    } else if (msg.t === 'move' && G) {
      queueRemoteMove(msg.move, msg.player, 'host');
    } else if (msg.t === 'quit') {
      net.onHostLost();
    }
  };
}

// ---- Start durch den Host ----
function startOnlineGame() {
  const locals = setup.players.map(p => ({
    name: p.name.trim(), color: COLORS[p.color], type: p.type,
  }));
  const remotes = online.remotes.map((r, i) => ({
    name: r.name, color: COLORS[remoteColor(i)], type: 'remote',
  }));
  const players = [...locals, ...remotes];
  const s = newGame({
    players,
    expansions: { ...setup.expansions },
    deckScale: setup.deckScale,
  });
  online.started = true;
  const settingsWire = {
    players: players.map(p => ({ name: p.name, color: p.color, type: p.type === 'remote' ? 'remote' : p.type })),
    expansions: { ...setup.expansions },
    deckScale: setup.deckScale,
  };
  online.remotes.forEach((r) => {
    online.net.sendTo(r.connId, {
      t: 'start', settings: settingsWire, deckIds: s.initialDeck, startId: s.startId,
    });
  });
  startGameUI(s);
}

// ---- Züge über das Netz ----
const netQueue = [];
function queueRemoteMove(move, playerIdx, origin) {
  if (!move) return;
  netQueue.push({ move, playerIdx, origin });
  pumpNet();
}

function pumpNet() {
  if (!G || !online || G.phase !== 'place' || ui.aiBusy) return;
  if (!netQueue.length) return;
  const cur = G.players[G.current];
  if (cur.type !== 'remote') return;
  const item = netQueue.shift();
  if (item.playerIdx !== G.current) {
    console.warn('Zug außer der Reihe ignoriert', item);
    pumpNet();
    return;
  }
  ui.aiBusy = true;
  playMove(item.move, item.origin);
}

// Gast-Verbindung bricht während des Spiels ab → KI übernimmt (Host)
function remotePlayerLost(gone) {
  if (!G || G.phase === 'over') return;
  const idx = setup.players.length + online.remotes.findIndex(r => r.connId === gone.connId);
  const p = G.players[idx];
  if (p && p.type === 'remote') {
    p.type = 'ai2';
    toast(`${p.name} hat die Verbindung verloren – die KI übernimmt`, '#7cc4ff');
    if (G.current === idx && G.phase === 'place' && !ui.aiBusy) {
      ui.aiBusy = true;
      setTimeout(aiTurn, 600);
    }
    updateHud();
  }
}

// ============================================================
// Spiel-Screen
// ============================================================
const board = new BoardView($('board'));
let G = null;              // Engine-Zustand
let ui = null;             // UI-Zustand des laufenden Spiels
let rafActive = false;

function startGameUI(state) {
  G = state;
  netQueue.length = 0;
  ui = {
    sel: null,             // gewählte Zelle {x,y,rot}
    undoSnap: null,
    meeple: null,          // Meeple-Optionen (Phase 'meeple')
    bigNext: false,
    floaters: [],
    anim: null,
    lastPlaced: state.lastPlacedIdx,
    aiBusy: false,
    over: false,
  };
  showScreen('game');
  board.resize();
  board.centerOn(G);
  renderChips();
  updateHud();
  startLoop();
  if (G.phase === 'meeple') {
    // Fortgesetztes Spiel mitten in Meeple-Phase gibt es nicht (Autosave nach Zügen)
    G.phase = 'place';
  }
  nextTurnFlow(true);
}

// ---------- HUD ----------
function renderChips() {
  const wrap = $('playerChips');
  wrap.innerHTML = '';
  G.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.id = 'chip' + p.idx;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = p.name;
    const pts = document.createElement('span');
    pts.className = 'pts';
    const mps = document.createElement('span');
    mps.className = 'mps';
    chip.append(dot, nm, pts, mps);
    wrap.appendChild(chip);
  });
}

function updateHud() {
  G.players.forEach(p => {
    const chip = $('chip' + p.idx);
    if (!chip) return;
    chip.classList.toggle('turn', p.idx === G.current && G.phase !== 'over');
    chip.querySelector('.pts').textContent = p.score;
    chip.querySelector('.mps').textContent =
      '●' + p.meeples + (p.bigMeeples ? ' ⬤' + p.bigMeeples : '');
  });
  $('deckCount').textContent = G.drawn ? G.deck.length + 1 : G.deck.length;
  const humanTurn = isHumanTurn();
  $('tileDock').classList.toggle('hidden', !G.drawn);
  drawPreview($('preview'), G.drawn, ui.sel ? ui.sel.rot : previewRot);
  $('btnRotate').classList.toggle('hidden', !humanTurn || G.phase !== 'place');
  $('btnConfirm').classList.toggle('hidden', !(humanTurn && G.phase === 'place' && ui.sel && ui.sel.valid));
  const meeplePhase = humanTurn && G.phase === 'meeple';
  $('btnSkipMeeple').classList.toggle('hidden', !meeplePhase);
  $('btnUndo').classList.toggle('hidden', !meeplePhase || !ui.undoSnap);
  const pl = G.players[G.current];
  $('btnBigMeeple').classList.toggle('hidden', !(meeplePhase && pl.bigMeeples > 0 && pl.meeples > 0));
  $('btnBigMeeple').classList.toggle('on', ui.bigNext);
  $('btnMute').textContent = (soundState.sfx || soundState.music) ? '🔊' : '🔇';
}

const isHumanTurn = () => G && G.phase !== 'over' && G.players[G.current].type === 'human';

function toast(text, color = '#ffd58a') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.setProperty('--tc', color);
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

function showTurnBanner() {
  const p = G.players[G.current];
  const b = $('turnBanner');
  b.textContent = `${p.name} ist am Zug`;
  b.style.setProperty('--bc', p.color);
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  setTimeout(() => b.classList.add('hidden'), 1600);
}

// ---------- Render-Loop ----------
function startLoop() {
  if (rafActive) return;
  rafActive = true;
  const frame = (now) => {
    if (currentScreen !== 'game' || !G) { rafActive = false; return; }
    board.tick();
    const humanPlace = isHumanTurn() && G.phase === 'place';
    const view = {
      now,
      legal: humanPlace && options.hints ? legalPlacements(G) : null,
      sel: ui.sel && G.drawn && G.phase === 'place' ? { ...ui.sel, defId: G.drawn } : null,
      meepleSpots: ui.meeple ? ui.meeple.spots : null,
      floaters: ui.floaters,
      lastPlaced: ui.lastPlaced,
      anim: options.anim ? ui.anim : null,
    };
    board.render(G, view);
    ui.floaters = ui.floaters.filter(f => now - f.t0 < 1700);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { board.resize(); });

// ---------- Ereignisse aus der Engine ----------
const FTYPE_NAME = { road: 'Straße', city: 'Stadt', mon: 'Kloster', field: 'Wiese' };
function processEvents(events) {
  let scored = false;
  for (const ev of events) {
    if (ev.type === 'score' && ev.points > 0 && ev.players.length) {
      scored = true;
      const names = ev.players.map(i => G.players[i].name).join(' & ');
      const color = G.players[ev.players[0]].color;
      toast(`${names}: +${ev.points} (${FTYPE_NAME[ev.ftype] || ev.ftype}${ev.complete ? '' : ' – Restwertung'})`, color);
      ui.floaters.push({ x: ev.x, y: ev.y, text: '+' + ev.points, color, t0: performance.now() });
    } else if (ev.type === 'discard') {
      toast('Karte passt nirgendwo – abgeworfen', '#93a0b4');
    } else if (ev.type === 'bonus') {
      const p = G.players[ev.players[0]];
      toast(`${p.name}: +${ev.points} (${ev.kind === 'king' ? '👑 König' : '🗡️ Räuber'})`, p.color);
    }
  }
  if (scored) sfx.score(Math.max(...events.filter(e => e.type === 'score').map(e => e.points), 0));
}

// ---------- Zug-Ablauf ----------
let previewRot = 0;

function setNetStatus(text) {
  const el = $('netStatus');
  el.classList.toggle('hidden', !text);
  if (text) el.textContent = text;
}

function nextTurnFlow(first = false) {
  updateHud();
  if (G.phase === 'over') { setNetStatus(null); endGame(); return; }
  previewRot = 0;
  ui.sel = null;
  ui.meeple = null;
  ui.bigNext = false;
  ui.undoSnap = null;
  const cur = G.players[G.current];
  if (isHumanTurn()) {
    setNetStatus(null);
    if (!first || G.players.filter(p => p.type === 'human').length > 1 || online) showTurnBanner();
    if (G.players.length > 1) sfx.draw();
    updateHud();
  } else if (cur.type === 'remote') {
    showTurnBanner();
    setNetStatus(`🌐 Warte auf ${cur.name}…`);
    updateHud();
    pumpNet();
  } else {
    setNetStatus(null);
    ui.aiBusy = true;
    updateHud();
    setTimeout(aiTurn, first ? 650 : 500);
  }
}

// Führt einen konkreten Zug mit Animation aus (KI oder Netzwerk)
async function playMove(mv, origin = null) {
  ui.sel = { x: mv.x, y: mv.y, rot: mv.rot, valid: true };
  ensureVisible(mv.x, mv.y);
  updateHud();
  await wait(options.anim ? 600 : 120);
  if (!G || currentScreen !== 'game') return;
  ui.sel = null;
  try {
    placeCurrent(G, mv.x, mv.y, mv.rot);
  } catch (e) {
    // Desync-Schutz: sollte nie passieren
    console.error('Zug nicht anwendbar', mv, e);
    ui.aiBusy = false;
    return;
  }
  ui.lastPlaced = G.lastPlacedIdx;
  ui.anim = { placedIdx: G.lastPlacedIdx, t0: performance.now() };
  sfx.place();
  updateHud();
  await wait(options.anim ? 420 : 80);
  if (!G || currentScreen !== 'game') return;
  if (mv.meeple) sfx.meeple();
  finishTurnSafe(mv.meeple, origin);
}

async function aiTurn(force = false) {
  if (!G || G.phase !== 'place' || (isHumanTurn() && !force)) { ui.aiBusy = false; return; }
  const mv = chooseMove(G);
  if (!mv) { // sollte nicht passieren – Karte wäre abgeworfen worden
    finishTurnSafe(null);
    return;
  }
  playMove(mv);
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// origin: connId des Absenders (bei Netz-Zügen), damit der Host das Echo
// nicht an den Absender zurückschickt
function finishTurnSafe(meeple, origin = null) {
  const mover = G.current;
  const events = finishTurn(G, meeple);
  processEvents(events);
  ui.aiBusy = false;
  sendMoveIfOnline(mover, origin);
  autosave();
  nextTurnFlow();
}

function sendMoveIfOnline(mover, origin) {
  if (!online || !online.started) return;
  const mv = G.history[G.history.length - 1];
  if (!mv) return;
  const move = { x: mv.x, y: mv.y, rot: mv.rot, meeple: mv.m };
  if (online.role === 'guest') {
    if (mover === online.myIdx) online.net.sendToHost({ t: 'move', move });
  } else {
    // Host verteilt alle Züge; das Echo geht nicht an den Absender zurück
    online.net.broadcast({ t: 'move', move, player: mover }, origin);
  }
}

function autosave() {
  if (online) return; // Online-Partien werden nicht gespeichert
  if (G.phase === 'over') { store.del('save'); return; }
  store.set('save', serialize(G));
}

function ensureVisible(x, y) {
  if (!options.anim) return;
  const [sx, sy] = board.worldToScreen(x, y);
  const r = board.canvas.getBoundingClientRect();
  const m = 90;
  if (sx < m || sy < m || sx > r.width - m || sy > r.height - m || board.cam.scale < 40) {
    board.camTarget = { x, y, scale: Math.max(board.cam.scale, 64) };
  }
}

// ---------- Eingabe: Pan / Zoom / Tap ----------
const pointers = new Map();
let dragStart = null, pinchStart = null, moved = false;

const bc = $('board');
bc.addEventListener('pointerdown', (e) => {
  bc.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = false;
  if (pointers.size === 1) {
    dragStart = { x: e.clientX, y: e.clientY, camX: board.cam.x, camY: board.cam.y };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      scale: board.cam.scale,
      mid: [(a.x + b.x) / 2, (a.y + b.y) / 2],
    };
    dragStart = null;
  }
});
bc.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1 && dragStart) {
    const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 7) moved = true;
    if (moved) {
      board.camTarget = null;
      board.cam.x = dragStart.camX - dx / board.cam.scale;
      board.cam.y = dragStart.camY - dy / board.cam.scale;
    }
  } else if (pointers.size === 2 && pinchStart) {
    moved = true;
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ns = Math.min(200, Math.max(14, pinchStart.scale * dist / pinchStart.dist));
    board.camTarget = null;
    board.cam.scale = ns;
  }
});
function pointerEnd(e) {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 1) {
    const [a] = [...pointers.values()];
    dragStart = { x: a.x, y: a.y, camX: board.cam.x, camY: board.cam.y };
  }
  if (wasSingle && !moved && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
  if (pointers.size === 0) dragStart = null;
}
bc.addEventListener('pointerup', pointerEnd);
bc.addEventListener('pointercancel', pointerEnd);
bc.addEventListener('wheel', (e) => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 0.9;
  board.camTarget = null;
  board.cam.scale = Math.min(200, Math.max(14, board.cam.scale * f));
}, { passive: false });

function handleTap(sx, sy) {
  if (!G || G.phase === 'over') return;
  if (ui.meeple) { // Meeple-Phase: Punkt getroffen?
    const s = board.cam.scale;
    for (const spot of ui.meeple.spots) {
      const [px, py] = board.worldToScreen(spot.wx, spot.wy);
      if (Math.hypot(px - sx, py - sy) < Math.max(24, s * 0.2)) {
        sfx.meeple();
        const big = ui.bigNext || G.players[G.current].meeples <= 0;
        ui.meeple = null;
        finishTurnSafe({ fi: spot.fi, big });
        return;
      }
    }
    return;
  }
  if (!isHumanTurn() || G.phase !== 'place') return;
  const [cx, cy] = board.screenToCell(sx, sy);
  const legal = legalPlacements(G);
  const cell = legal.find(c => c.x === cx && c.y === cy);
  if (!cell) {
    if (ui.sel) { ui.sel = null; updateHud(); }
    return;
  }
  sfx.click();
  if (ui.sel && ui.sel.x === cx && ui.sel.y === cy) {
    rotateSel();
    return;
  }
  ui.sel = { x: cx, y: cy, rot: cell.rots.includes(previewRot) ? previewRot : cell.rots[0], valid: true };
  updateHud();
}

function rotateSel() {
  sfx.rotate();
  if (ui.sel) {
    const legal = legalPlacements(G);
    const cell = legal.find(c => c.x === ui.sel.x && c.y === ui.sel.y);
    const i = cell.rots.indexOf(ui.sel.rot);
    ui.sel.rot = cell.rots[(i + 1) % cell.rots.length];
    previewRot = ui.sel.rot;
  } else {
    previewRot = (previewRot + 1) % 4;
  }
  updateHud();
}

$('btnRotate').addEventListener('click', rotateSel);

$('btnConfirm').addEventListener('click', () => {
  if (!ui.sel || !isHumanTurn() || G.phase !== 'place') return;
  ui.undoSnap = cloneState(G);
  placeCurrent(G, ui.sel.x, ui.sel.y, ui.sel.rot);
  ui.lastPlaced = G.lastPlacedIdx;
  ui.anim = { placedIdx: G.lastPlacedIdx, t0: performance.now() };
  ui.sel = null;
  sfx.place();
  // Meeple-Phase vorbereiten
  const opts = meepleOptions(G);
  if (opts.length === 0) {
    finishTurnSafe(null);
    return;
  }
  ui.meeple = {
    opts,
    spots: opts.map(o => {
      const w = meepleSpotWorld(G, o);
      return { ...w, fi: o.fi, color: G.players[G.current].color };
    }),
  };
  updateHud();
});

$('btnSkipMeeple').addEventListener('click', () => {
  sfx.click();
  ui.meeple = null;
  finishTurnSafe(null);
});

$('btnUndo').addEventListener('click', () => {
  if (!ui.undoSnap) return;
  sfx.click();
  G = ui.undoSnap;
  ui.undoSnap = null;
  ui.meeple = null;
  ui.sel = null;
  ui.lastPlaced = G.lastPlacedIdx;
  updateHud();
});

$('btnBigMeeple').addEventListener('click', () => {
  sfx.click();
  ui.bigNext = !ui.bigNext;
  updateHud();
});

$('btnCenter').addEventListener('click', () => { sfx.click(); board.centerOn(G, options.anim); });

$('btnMute').addEventListener('click', () => {
  const on = !(soundState.sfx || soundState.music);
  options.sfx = on; options.music = on;
  store.set('options', options);
  applySoundOptions(options);
  syncOptionInputs();
  if (on) { startMusic(); sfx.click(); }
  updateHud();
});

$('btnGameMenu').addEventListener('click', () => { sfx.click(); $('gameMenu').classList.remove('hidden'); });
$('btnResume').addEventListener('click', () => { sfx.click(); $('gameMenu').classList.add('hidden'); });
$('btnToOptions').addEventListener('click', () => {
  sfx.click();
  $('gameMenu').classList.add('hidden');
  backTarget = 'game';
  showScreen('options');
});
$('btnQuit').addEventListener('click', () => {
  sfx.click();
  $('gameMenu').classList.add('hidden');
  if (online) teardownOnline();
  store.del('save');
  G = null;
  setNetStatus(null);
  showScreen('menu');
});

// ============================================================
// Spielende & Highscores
// ============================================================
function endGame() {
  if (ui.over) return;
  ui.over = true;
  autosave();
  updateHud();
  sfx.fanfare();
  setTimeout(showEndScreen, options.anim ? 1800 : 400);
}

function showEndScreen() {
  const sorted = [...G.players].sort((a, b) => b.score - a.score);
  const winners = G.winners.map(i => G.players[i].name);
  $('endWinner').textContent =
    winners.length > 1 ? `Unentschieden: ${winners.join(' & ')}!` : `🏆 ${winners[0]} gewinnt!`;
  const medals = ['🥇', '🥈', '🥉'];
  const t = $('endTable');
  t.innerHTML = `
    <thead><tr><th>Spieler</th><th title="Straßen">🛤</th><th title="Städte">🏰</th><th title="Klöster">⛪</th><th title="Wiesen">🌾</th><th title="Bonus">✨</th><th>Punkte</th></tr></thead>
    <tbody>${sorted.map((p, i) => `
      <tr>
        <td><span class="pname"><span class="dot" style="background:${p.color}"></span>${medals[i] || ''} ${esc(p.name)}</span></td>
        <td>${p.breakdown.road}</td><td>${p.breakdown.city}</td><td>${p.breakdown.mon}</td>
        <td>${p.breakdown.field}</td><td>${p.breakdown.bonus}</td>
        <td class="total">${p.score}</td>
      </tr>`).join('')}
    </tbody>`;
  // Highscores (nur Menschen)
  const isNew = saveHighscores();
  $('endHighscore').classList.toggle('hidden', !isNew);
  // Revanche würde online aus dem Takt laufen
  $('btnRematch').classList.toggle('hidden', !!online);
  showScreen('end');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function expansionTag() {
  const e = G.settings.expansions || {};
  const tags = [];
  if (e.river) tags.push('Fluss');
  if (e.inns) tags.push('W&K');
  if (e.king) tags.push('K&R');
  if (G.settings.deckScale > 1) tags.push(G.settings.deckScale === 2 ? 'Riesig' : 'Groß');
  return tags.length ? tags.join(' · ') : 'Basisspiel';
}

function saveHighscores() {
  const scores = store.get('scores', []);
  let isNew = false;
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  for (const p of G.players) {
    if (p.type !== 'human') continue;
    scores.push({
      name: p.name, score: p.score, date,
      players: G.players.length,
      tag: expansionTag(),
      won: G.winners.includes(p.idx),
    });
    isNew = true;
  }
  if (!isNew) return false;
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, 25);
  store.set('scores', scores);
  // War einer der neuen Einträge in den Top 5?
  const humanScores = G.players.filter(p => p.type === 'human').map(p => p.score);
  return scores.slice(0, 5).some(s => humanScores.includes(s.score) && G.players.some(p => p.type === 'human' && p.name === s.name));
}

$('btnRematch').addEventListener('click', () => {
  sfx.click();
  const s = newGame({
    players: G.settings.players,
    expansions: G.settings.expansions,
    deckScale: G.settings.deckScale,
  });
  store.del('save');
  startGameUI(s);
});
$('btnEndMenu').addEventListener('click', () => {
  sfx.click();
  if (online) teardownOnline();
  G = null;
  showScreen('menu');
});

function renderScores() {
  const scores = store.get('scores', []);
  const list = $('scoreList');
  list.innerHTML = '';
  $('scoreEmpty').classList.toggle('hidden', scores.length > 0);
  scores.slice(0, 20).forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">${i + 1}</span>
      <span class="who"><b>${esc(s.name)} ${s.won ? '👑' : ''}</b>
      <em>${s.date} · ${s.players} Spieler · ${esc(s.tag)}</em></span>
      <span class="pts">${s.score}</span>`;
    list.appendChild(li);
  });
}

$('btnClearScores').addEventListener('click', () => {
  if (confirm('Alle Highscores löschen?')) {
    store.del('scores');
    renderScores();
    sfx.click();
  }
});

// ============================================================
// Optionen
// ============================================================
function syncOptionInputs() {
  $('optSfx').checked = !!options.sfx;
  $('optMusic').checked = !!options.music;
  $('optHints').checked = !!options.hints;
  $('optAnim').checked = !!options.anim;
}
syncOptionInputs();

$('optSfx').addEventListener('change', e => {
  options.sfx = e.target.checked;
  store.set('options', options);
  applySoundOptions(options);
  if (options.sfx) sfx.score(4);
  updateHudSafe();
});
$('optMusic').addEventListener('change', e => {
  options.music = e.target.checked;
  store.set('options', options);
  applySoundOptions(options);
  if (options.music) startMusic(); else stopMusic();
  updateHudSafe();
});
$('optHints').addEventListener('change', e => { options.hints = e.target.checked; store.set('options', options); });
$('optAnim').addEventListener('change', e => { options.anim = e.target.checked; store.set('options', options); });
function updateHudSafe() { if (G && currentScreen === 'game') updateHud(); }

// ============================================================
// Service-Worker (offline / installierbar)
// ============================================================
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-Cache optional */ });
  });
}

refreshMenu();

// Debug-/Test-Hook (auch nützlich als „Zug vorschlagen“)
window.__carc = {
  get state() { return G; },
  autoMove() {
    if (G && isHumanTurn() && G.phase === 'place' && !ui.meeple && !ui.aiBusy) {
      ui.aiBusy = true;
      aiTurn(true);
      return true;
    }
    return false;
  },
};
