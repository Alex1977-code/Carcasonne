// ============================================================
// Carcassonne Mobile – Online-Mehrspieler
// Host = Autorität, Stern-Topologie. Transport:
//  - PeerJS (WebRTC, kostenloser öffentlicher Broker) für
//    verschiedene Geräte, Raumcode zum Teilen
//  - BroadcastChannel als Fallback/Test (Codes mit „T“ am Anfang:
//    zwei Tabs im selben Browser)
// ============================================================

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode(len = 5) {
  let c = '';
  for (let i = 0; i < len; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
const peerId = (code) => 'carcassonne-mobil-' + code.toLowerCase();

// ---------- BroadcastChannel-Transport (gleicher Browser) ----------
class BCConn {
  constructor(bc, self, other) {
    this.bc = bc; this.self = self; this.id = other;
    this.onData = null; this.onClose = null;
  }
  send(payload) { this.bc.postMessage({ kind: 'data', from: this.self, to: this.id, payload }); }
  close() { this.bc.postMessage({ kind: 'close', from: this.self, to: this.id }); }
}

class BCTransport {
  constructor(code) {
    this.code = code;
    this.bc = new BroadcastChannel('carc-room-' + code);
    this.self = 'p' + Math.random().toString(36).slice(2, 10);
    this.conns = new Map();
    this.onConn = null; this.onOpen = null; this.onError = null; this.onHostLost = null;
    this.isHost = false;
  }
  _wire() {
    this.bc.onmessage = (e) => {
      const m = e.data;
      if (!m || (m.to && m.to !== this.self)) return;
      if (m.kind === 'connect' && this.isHost) {
        const conn = new BCConn(this.bc, this.self, m.from);
        this.conns.set(m.from, conn);
        this.bc.postMessage({ kind: 'accept', from: this.self, to: m.from });
        this.onConn && this.onConn(conn);
      } else if (m.kind === 'accept' && !this.isHost) {
        const conn = new BCConn(this.bc, this.self, m.from);
        this.conns.set(m.from, conn);
        this.onOpen && this.onOpen(conn);
      } else if (m.kind === 'data') {
        const c = this.conns.get(m.from);
        c && c.onData && c.onData(m.payload);
      } else if (m.kind === 'close') {
        const c = this.conns.get(m.from);
        if (c) { this.conns.delete(m.from); c.onClose && c.onClose(); }
      }
    };
  }
  host() { this.isHost = true; this._wire(); return Promise.resolve(this.code); }
  join() {
    this._wire();
    this.bc.postMessage({ kind: 'connect', from: this.self });
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Kein Spiel mit diesem Code gefunden')), 4000);
      this.onOpen = (conn) => { clearTimeout(t); res(conn); };
    });
  }
  destroy() {
    for (const c of this.conns.values()) c.close();
    this.bc.close();
  }
}

// ---------- PeerJS-Transport (verschiedene Geräte) ----------
class PeerConnWrap {
  constructor(conn) {
    this.conn = conn; this.id = conn.peer;
    this.onData = null; this.onClose = null;
    conn.on('data', (d) => this.onData && this.onData(d));
    conn.on('close', () => this.onClose && this.onClose());
    conn.on('error', () => this.onClose && this.onClose());
  }
  send(payload) { try { this.conn.send(payload); } catch { /* Verbindung weg */ } }
  close() { try { this.conn.close(); } catch { /* egal */ } }
}

class PeerTransport {
  constructor(code) {
    this.code = code;
    this.peer = null;
    this.conns = new Map();
    this.onConn = null; this.onError = null;
    this.isHost = false;
  }
  _newPeer(id) {
    if (typeof window === 'undefined' || !window.Peer) {
      throw new Error('Online-Modul nicht geladen');
    }
    return new window.Peer(id, { debug: 0 });
  }
  host() {
    this.isHost = true;
    return new Promise((res, rej) => {
      let tries = 0;
      const attempt = () => {
        this.peer = this._newPeer(peerId(this.code));
        this.peer.on('open', () => res(this.code));
        this.peer.on('error', (e) => {
          if (e.type === 'unavailable-id' && tries++ < 3) {
            this.code = makeCode();
            try { this.peer.destroy(); } catch { /* egal */ }
            attempt();
          } else if (e.type === 'peer-unavailable') {
            // Gast weg – ignorieren
          } else {
            rej(new Error(netErrorText(e)));
            this.onError && this.onError(e);
          }
        });
        this.peer.on('connection', (c) => {
          const wrap = new PeerConnWrap(c);
          this.conns.set(wrap.id, wrap);
          c.on('open', () => this.onConn && this.onConn(wrap));
        });
      };
      attempt();
    });
  }
  join() {
    return new Promise((res, rej) => {
      this.peer = this._newPeer(undefined);
      let settled = false;
      this.peer.on('open', () => {
        const c = this.peer.connect(peerId(this.code), { reliable: true });
        const t = setTimeout(() => { if (!settled) { settled = true; rej(new Error('Kein Spiel mit diesem Code gefunden')); } }, 12000);
        c.on('open', () => {
          if (settled) return;
          settled = true; clearTimeout(t);
          const wrap = new PeerConnWrap(c);
          this.conns.set(wrap.id, wrap);
          res(wrap);
        });
      });
      this.peer.on('error', (e) => {
        if (!settled) { settled = true; rej(new Error(netErrorText(e))); }
        this.onError && this.onError(e);
      });
    });
  }
  destroy() {
    try { this.peer && this.peer.destroy(); } catch { /* egal */ }
  }
}

function netErrorText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Kein Spiel mit diesem Code gefunden';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
    return 'Keine Verbindung zum Online-Dienst – Internet prüfen';
  }
  if (t === 'browser-incompatible') return 'Dieser Browser unterstützt kein WebRTC';
  return 'Online-Fehler: ' + (t || e && e.message || 'unbekannt');
}

// ---------- Öffentliche API ----------
// Host:  const net = await Net.host();  net.onGuestJoin/... ; net.code
// Gast:  const net = await Net.join(code);
export class Net {
  constructor(transport, role) {
    this.transport = transport;
    this.role = role;                    // 'host' | 'guest'
    this.code = transport.code;
    this.guests = new Map();             // host: connId → { conn, name }
    this.hostConn = null;                // guest
    this.onMessage = null;               // (msg, connId)
    this.onGuestJoin = null;             // host: (connId)
    this.onGuestLeave = null;            // host: (connId)
    this.onHostLost = null;              // guest
  }

  static async host(code = makeCode(), useBC = false) {
    const t = (useBC || code.startsWith('T')) ? new BCTransport(code) : new PeerTransport(code);
    const net = new Net(t, 'host');
    t.onConn = (conn) => {
      net.guests.set(conn.id, { conn, name: null });
      conn.onData = (msg) => net.onMessage && net.onMessage(msg, conn.id);
      conn.onClose = () => {
        net.guests.delete(conn.id);
        net.onGuestLeave && net.onGuestLeave(conn.id);
      };
      net.onGuestJoin && net.onGuestJoin(conn.id);
    };
    await t.host();
    net.code = t.code;
    return net;
  }

  static async join(code) {
    const t = code.startsWith('T') ? new BCTransport(code) : new PeerTransport(code);
    const net = new Net(t, 'guest');
    const conn = await t.join();
    net.hostConn = conn;
    conn.onData = (msg) => net.onMessage && net.onMessage(msg, 'host');
    conn.onClose = () => net.onHostLost && net.onHostLost();
    return net;
  }

  sendToHost(msg) { this.hostConn && this.hostConn.send(msg); }
  sendTo(connId, msg) {
    const g = this.guests.get(connId);
    g && g.conn.send(msg);
  }
  broadcast(msg, exceptId = null) {
    for (const [id, g] of this.guests) if (id !== exceptId) g.conn.send(msg);
  }
  close() {
    try { this.transport.destroy(); } catch { /* egal */ }
    this.guests.clear();
    this.hostConn = null;
  }
}
