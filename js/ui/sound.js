// ============================================================
// Carcassonne Mobile – Sound (WebAudio, ohne Audiodateien)
// ============================================================
let ctx = null;
let master = null;

export const soundState = { sfx: true, music: true };

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Ein Rauschpuffer für alle Geräusche – jedes Mal neu zu würfeln kostet
// bei jedem Klick spürbar Zeit.
let noiseBuf = null;
function noiseBuffer() {
  if (!noiseBuf) {
    const n = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone({ f = 440, t = 0.15, type = 'sine', vol = 0.5, delay = 0, slide = 0, dest = null }) {
  if (!ac()) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + t);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  o.connect(g); g.connect(dest || master);
  o.start(t0); o.stop(t0 + t + 0.05);
}

function noise({ t = 0.1, vol = 0.3, delay = 0, freq = 800, q = 0.7, dest = null }) {
  if (!ac()) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = freq; flt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  src.connect(flt); flt.connect(g); g.connect(dest || master);
  src.start(t0); src.stop(t0 + t + 0.02);
}

// ------------------------------------------------------------ Instrumente
//
// Alles Folgende ist auf Klangfarben aus, die es im Mittelalter gab. Das
// betrifft nicht nur die Auswahl der Töne, sondern vor allem den Klang:
// gestrichene und gezupfte Saiten, Rohrblatt und Fell.

/**
 * Psalterium: gezupfte Saite. Kurzer, heller Anschlag, der schnell
 * abklingt. Zwei leicht verstimmte Sägezähne, weil eine Saite nie exakt
 * mit ihrem Chor zusammenfällt – das leichte Schweben macht den Klang.
 */
function pluck(f, t0, vol = 0.18, dur = 1.1, dest = null) {
  if (!ac()) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(f * 7, t0);
  flt.frequency.exponentialRampToValueAtTime(Math.max(200, f * 2), t0 + dur * 0.7);
  out.connect(flt); flt.connect(dest || master);
  for (const cents of [-4, 5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f * Math.pow(2, cents / 1200);
    o.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
}

/**
 * Schalmei/Blockflöte: Rohrblattton. Der Ansatz ist kurz gehaucht, das
 * Vibrato setzt erst nach einem Moment ein – so spielt ein Mensch, und
 * ohne diese Verzögerung klingt es nach Synthesizer.
 */
function pipe(f, t0, dur, vol = 0.13, dest = null) {
  if (!ac()) return;
  const out = ctx.createGain();
  const a = Math.min(0.09, dur * 0.25);
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(vol, t0 + a);
  out.gain.setValueAtTime(vol, t0 + dur * 0.72);
  out.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(f * 2.4, t0);
  flt.frequency.linearRampToValueAtTime(f * 4.2, t0 + a);
  flt.Q.value = 1.4;
  out.connect(flt); flt.connect(dest || master);

  // Dreieck statt Rechteck. Ein Rechteck hat die ungeraden Obertöne fast
  // ungedämpft und schneidet dadurch – als Melodie, die stundenlang neben
  // einem Brettspiel läuft, ist das nicht auszuhalten. Das Dreieck hat
  // dieselbe Bauart, nur ohne die Schärfe.
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(out);

  // Vibrato, das erst nach dem Ansatz aufgeht – langsam und flach, sonst
  // klingt es nach Leierkasten statt nach Atem.
  const lfo = ctx.createOscillator();
  const lfoAmt = ctx.createGain();
  lfo.frequency.value = 4.1;
  lfoAmt.gain.setValueAtTime(0, t0);
  lfoAmt.gain.linearRampToValueAtTime(f * 0.0035, t0 + Math.min(0.5, dur * 0.7));
  lfo.connect(lfoAmt); lfoAmt.connect(o.frequency);

  o.start(t0); o.stop(t0 + dur + 0.05);
  lfo.start(t0); lfo.stop(t0 + dur + 0.05);

  // Anblasgeräusch nur bei längeren Tönen und nur als Hauch. Auf jedem
  // Achtel ein Zischen war das, was den Satz unruhig gemacht hat.
  if (dur > 0.5) {
    const br = ctx.createBufferSource();
    br.buffer = noiseBuffer();
    const brf = ctx.createBiquadFilter();
    brf.type = 'bandpass'; brf.frequency.value = f * 3; brf.Q.value = 1.2;
    const brg = ctx.createGain();
    brg.gain.setValueAtTime(vol * 0.12, t0);
    brg.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.12);
    br.connect(brf); brf.connect(brg); brg.connect(dest || master);
    br.start(t0); br.stop(t0 + 0.15);
  }
}

/** Tabor: Rahmentrommel. Fell (Rauschen) über einem kurzen Bauchton. */
function tabor(t0, vol = 0.22, low = true, dest = null) {
  if (!ac()) return;
  const d = dest || master;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = low ? 1100 : 2600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * (low ? 0.7 : 0.4), t0);
  g.gain.exponentialRampToValueAtTime(0.0005, t0 + (low ? 0.16 : 0.07));
  src.connect(flt); flt.connect(g); g.connect(d);
  src.start(t0); src.stop(t0 + 0.2);
  if (low) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(96, t0);
    o.frequency.exponentialRampToValueAtTime(58, t0 + 0.13);
    og.gain.setValueAtTime(vol, t0);
    og.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.18);
    o.connect(og); og.connect(d);
    o.start(t0); o.stop(t0 + 0.22);
  }
}

// -------------------------------------------------------------- Geräusche

export const sfx = {
  click() { if (soundState.sfx) noise({ t: 0.035, vol: 0.22, freq: 2600, q: 3 }); },
  rotate() { if (soundState.sfx) tone({ f: 440, t: 0.07, type: 'triangle', vol: 0.14, slide: 180 }); },
  draw() { if (soundState.sfx) noise({ t: 0.14, vol: 0.18, freq: 1800 }); },
  place() {
    if (!soundState.sfx) return;
    noise({ t: 0.07, vol: 0.4, freq: 900, q: 2 });
    tone({ f: 150, t: 0.11, type: 'sine', vol: 0.35, slide: -40 });
  },
  meeple() { if (soundState.sfx && ac()) pluck(587.33, ctx.currentTime, 0.16, 0.5); },
  invalid() { if (soundState.sfx) tone({ f: 130, t: 0.2, type: 'triangle', vol: 0.2, slide: -35 }); },
  score(points = 4) {
    // Dorisch statt Dur: d–f–a, dazu bei großen Wertungen die Oktave
    if (!soundState.sfx || !ac()) return;
    const t0 = ctx.currentTime;
    [293.66, 349.23, 440].forEach((f, i) => pluck(f, t0 + i * 0.085, 0.2, 1.0));
    if (points >= 10) pluck(587.33, t0 + 0.27, 0.22, 1.4);
  },
  fanfare() {
    // Naturtrompeten kennen keine Terz: Quinten und Oktaven, dazu Tabor
    if (!soundState.sfx || !ac()) return;
    const t0 = ctx.currentTime;
    const seq = [[146.83, 0], [220, 0.18], [293.66, 0.36], [440, 0.54], [587.33, 0.74]];
    for (const [f, d] of seq) {
      pipe(f, t0 + d, 0.42, 0.16);
      pipe(f * 1.5, t0 + d, 0.42, 0.07);
    }
    for (let i = 0; i < 6; i++) tabor(t0 + i * 0.16, 0.18, i % 3 === 0);
  },
};

// ============================================================
// Hintergrundmusik: ein Spielmann am Nebentisch
// ============================================================
//
// Gebaut nach dem, was im 13./14. Jahrhundert tatsächlich klang:
//
//  - Dorisch auf d, keine Dur-Tonleiter. Das ist der Kern; ein Dur-Akkord
//    schiebt das Stück sofort um vierhundert Jahre nach vorn.
//  - Bordun aus Quinte und Oktave, gehalten wie auf Drehleier oder Dudel-
//    sack. Terzen galten als Missklang und kommen im Bordun nicht vor.
//  - Einstimmige Melodie darüber, überwiegend in Schritten, mit Kadenzen
//    auf d oder a und Atempausen dazwischen.
//  - Der Tabor spielt nicht durchgehend, sondern kommt und geht – ein
//    Trommler, der zwischendurch zuhört.
//
// Terminplanung mit Vorlauf: setInterval allein ist für Musik zu ungenau,
// deshalb legt der Takt nur fest, was in den nächsten 700 ms beginnt, und
// die genauen Zeiten liegen an der Uhr des Audiokontexts.

// Dorisch auf d, zwei Oktaven: d e f g a b c d' …
const SCALE = [
  146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63,   // d3 … c4
  293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25,   // d4 … c5
  587.33, 659.25,                                            // d5 e5
];
const TONIC = 7;          // d4
const DOMINANT = 11;      // a4
const EIGHTH = 0.44;      // Achtel in Sekunden ≈ 68 bpm in 6/8

let musicGain = null, droneGain = null, melGain = null, percGain = null;
let droneNodes = [];
let clock = null;
let nextAt = 0;           // Zeitpunkt des nächsten Ereignisses
let beat = 0;             // Achtel seit Beginn
let phrase = [];          // noch zu spielende Töne der laufenden Phrase
let degree = TONIC;
let taborBars = 0;        // wie viele Takte der Trommler noch mitspielt
let restUntil = 0;        // Atempause bis zu diesem Achtel

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

/**
 * Eine Phrase erfinden: 5–9 Töne, überwiegend Sekundschritte, am Ende
 * eine Kadenz auf d oder a. Der letzte Ton wird lang gehalten, danach
 * folgt eine Atempause – ohne die klingt es gehetzt statt getragen.
 */
function makePhrase() {
  const len = 5 + Math.floor(Math.random() * 5);
  const goal = Math.random() < 0.6 ? TONIC : DOMINANT;
  const out = [];
  for (let i = 0; i < len - 2; i++) {
    // Schritte sind die Regel, Sprünge die Ausnahme; über Quart hinaus
    // springt eine gesungene Melodie so gut wie nie.
    const step = pick([-1, -1, -1, 1, 1, 1, -2, 2, 0, -3, 3]);
    degree = Math.max(4, Math.min(14, degree + step));
    const w = Math.random();
    out.push({ deg: degree, len: w < 0.42 ? 1 : w < 0.82 ? 2 : 3 });
  }
  // Kadenz: Vorhalt einen Schritt über dem Ziel, dann das Ziel
  out.push({ deg: goal + 1, len: 1 });
  out.push({ deg: goal, len: 3 });
  degree = goal;
  return out;
}

function startDrone(t0) {
  // Quinte und Oktave, wie sie eine Drehleier stehen lässt.
  for (const [f, vol, cents] of [[73.42, 0.5, 0], [110.0, 0.36, 4], [146.83, 0.26, -3]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f * Math.pow(2, cents / 1200);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 3.5);
    o.connect(g); g.connect(droneGain);
    o.start(t0);
    droneNodes.push(o, g);
  }
  // Das Rad der Drehleier läuft nie ganz rund – ein langsames Pulsieren,
  // das den Bordun lebendig macht.
  const wheel = ctx.createOscillator();
  const wheelAmt = ctx.createGain();
  wheel.frequency.value = 0.62;
  wheelAmt.gain.value = 0.03;
  wheel.connect(wheelAmt); wheelAmt.connect(droneGain.gain);
  wheel.start(t0);
  droneNodes.push(wheel, wheelAmt);
}

function scheduler() {
  if (!soundState.music || !ctx) return;
  const jetzt = ctx.currentTime;
  if (!(jetzt >= 0)) return;

  // Nachholen ist verboten. Wird die Seite in den Hintergrund geschoben –
  // Telefon gesperrt, App gewechselt, und sei es nur für einen Moment –,
  // dann bremst der Browser setInterval aus, während die Uhr des
  // Audiokontexts weiterläuft. Beim Zurückkommen liegt nextAt weit
  // zurück, und die Schleife würde in einem Rutsch hunderte Töne
  // ansetzen, alle mit einem Zeitpunkt in der Vergangenheit. Das legt das
  // Telefon lahm. Statt nachzuholen wird der Faden neu angeknüpft.
  if (jetzt - nextAt > 1.0) {
    nextAt = jetzt + 0.15;
    phrase = [];
    beat = 0; restUntil = 0; taborBars = 0;
  }

  const horizon = jetzt + 0.7;
  // Zweiter Riegel: was auch immer schiefgeht, in einem Durchgang werden
  // nie mehr als zwei Dutzend Ereignisse angesetzt.
  let sicherung = 24;
  while (nextAt < horizon && sicherung-- > 0) {
    const t0 = nextAt;

    // Tabor: 6/8, schwerer Schlag auf 1 und 4
    if (taborBars > 0) {
      const pos = beat % 6;
      if (pos === 0) tabor(t0, 0.11, true, percGain);
      else if (pos === 3) tabor(t0, 0.08, true, percGain);
      if (pos === 5) {
        taborBars--;
        if (taborBars === 0) restUntil = Math.max(restUntil, beat);
      }
    }

    if (beat >= restUntil) {
      if (!phrase.length) {
        phrase = makePhrase();
        // Nach jeder zweiten oder dritten Phrase greift der Trommler ein.
        if (taborBars === 0 && Math.random() < 0.15) taborBars = 2;
      }
      const n = phrase.shift();
      const f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))];
      const dur = n.len * EIGHTH;
      pipe(f, t0, dur * 0.92, 0.115, melGain);
      // Gezupfte Stütze am Phrasenanfang – der Spielmann greift in die Saiten
      if (n.len === 3) pluck(SCALE[Math.max(0, n.deg - 7)], t0, 0.10, 1.6, melGain);
      beat += n.len;
      nextAt += dur;
      if (!phrase.length) restUntil = beat + 5 + Math.floor(Math.random() * 7);
    } else {
      beat += 1;
      nextAt += EIGHTH;
    }
  }
}

export function startMusic() {
  if (clock || !soundState.music) return;
  if (!ac()) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.46;
    musicGain.connect(master);
    droneGain = ctx.createGain(); droneGain.gain.value = 0.13; droneGain.connect(musicGain);
    melGain = ctx.createGain(); melGain.gain.value = 0.62; melGain.connect(musicGain);
    percGain = ctx.createGain(); percGain.gain.value = 0.32; percGain.connect(musicGain);
  }
  const t0 = ctx.currentTime + 0.1;
  startDrone(t0);
  nextAt = t0 + 1.2;      // der Bordun steht zuerst, dann setzt die Melodie ein
  beat = 0; phrase = []; degree = TONIC; taborBars = 0; restUntil = 0;
  scheduler();
  clock = setInterval(scheduler, 200);
}

export function stopMusic() {
  if (clock) { clearInterval(clock); clock = null; }
  if (!ctx) return;
  const t = ctx.currentTime;
  if (droneGain) droneGain.gain.linearRampToValueAtTime(0, t + 0.6);
  for (const n of droneNodes) { try { if (n.stop) n.stop(t + 0.8); } catch { /* schon gestoppt */ } }
  droneNodes = [];
  // Der Pegel muss zurück, sonst bleibt der Bordun beim nächsten Start stumm.
  if (droneGain) droneGain.gain.setValueAtTime(0.11, t + 0.9);
}

export function applySoundOptions(opts) {
  soundState.sfx = !!opts.sfx;
  soundState.music = !!opts.music;
  if (!soundState.music) stopMusic();
  else if (ctx) startMusic();
}

// iOS/Android: Audio erst nach erster Nutzer-Interaktion erlauben
export function unlockAudio() {
  ac();
  if (soundState.music) startMusic();
}

// Im Hintergrund wird nichts geplant. Der Browser drosselt setInterval,
// sobald die Seite verdeckt ist, die Uhr des Audiokontexts läuft aber
// weiter – der Terminplan liefe dann jedes Mal aus dem Ruder. Beim
// Zurückkommen fängt die Musik einfach neu an.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (clock) { clearInterval(clock); clock = null; }
  } else if (soundState.music && ctx && !clock) {
    nextAt = ctx.currentTime + 0.2;
    phrase = []; beat = 0; restUntil = 0; taborBars = 0;
    clock = setInterval(scheduler, 200);
  }
});
