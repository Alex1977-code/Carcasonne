// ============================================================
// Carcassonne Mobile – Sound (WebAudio, ohne Audiodateien)
// ============================================================
let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;

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

function tone({ f = 440, t = 0.15, type = 'sine', vol = 0.5, delay = 0, slide = 0 }) {
  if (!soundState.sfx || !ac()) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + t);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + t + 0.05);
}

function noise({ t = 0.1, vol = 0.3, delay = 0, freq = 800 }) {
  if (!soundState.sfx || !ac()) return;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, ctx.sampleRate * t, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  click() { tone({ f: 660, t: 0.06, type: 'triangle', vol: 0.25 }); },
  rotate() { tone({ f: 500, t: 0.07, type: 'square', vol: 0.12, slide: 160 }); },
  draw() { noise({ t: 0.12, vol: 0.2, freq: 1600 }); },
  place() { noise({ t: 0.09, vol: 0.45, freq: 500 }); tone({ f: 180, t: 0.1, type: 'sine', vol: 0.4 }); },
  meeple() { tone({ f: 520, t: 0.1, type: 'sine', vol: 0.3, slide: 260 }); },
  invalid() { tone({ f: 160, t: 0.18, type: 'sawtooth', vol: 0.18, slide: -60 }); },
  score(points = 4) {
    const base = [523, 659, 784];
    base.forEach((f, i) => tone({ f, t: 0.14, type: 'triangle', vol: 0.3, delay: i * 0.09 }));
    if (points >= 10) tone({ f: 1047, t: 0.3, type: 'triangle', vol: 0.32, delay: 0.28 });
  },
  fanfare() {
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      tone({ f, t: 0.35, type: 'triangle', vol: 0.32, delay: i * 0.16 }));
    [196, 262, 330, 392, 523].forEach((f, i) =>
      tone({ f, t: 0.4, type: 'sine', vol: 0.22, delay: i * 0.16 }));
  },
};

// Sanfte generative Hintergrundmusik (Akkord-Loop)
const CHORDS = [
  [220, 277.2, 329.6],       // A-Dur
  [196, 246.9, 293.7],       // G-Dur
  [174.6, 220, 261.6],       // F-Dur
  [164.8, 207.7, 246.9],     // E-Dur
];
let chordIdx = 0;

function playChord() {
  if (!soundState.music || !ac()) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.10;
    musicGain.connect(master);
  }
  const chord = CHORDS[chordIdx % CHORDS.length];
  chordIdx++;
  const t0 = ctx.currentTime;
  chord.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * (i === 2 ? 2 : 1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5 / (i + 1), t0 + 1.6);
    g.gain.linearRampToValueAtTime(0, t0 + 5.6);
    o.connect(g); g.connect(musicGain);
    o.start(t0); o.stop(t0 + 6);
  });
  // Leise Melodie-Note
  if (Math.random() < 0.7) {
    const mel = chord[Math.floor(Math.random() * chord.length)] * 2;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = mel;
    const tm = t0 + 1 + Math.random() * 2.4;
    g.gain.setValueAtTime(0, tm);
    g.gain.linearRampToValueAtTime(0.16, tm + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, tm + 1.6);
    o.connect(g); g.connect(musicGain);
    o.start(tm); o.stop(tm + 1.8);
  }
}

export function startMusic() {
  if (musicTimer || !soundState.music) return;
  if (!ac()) return;
  playChord();
  musicTimer = setInterval(playChord, 5200);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

export function applySoundOptions(opts) {
  soundState.sfx = !!opts.sfx;
  soundState.music = !!opts.music;
  if (!soundState.music) stopMusic();
}

// iOS/Android: Audio erst nach erster Nutzer-Interaktion erlauben
export function unlockAudio() {
  ac();
  if (soundState.music) startMusic();
}
