// Web Audio ilə generasiya olunan səslər — heç bir audio fayl lazım deyil.

let ctx = null;
let enabled = true;
let masterGain = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function setSoundEnabled(value) { enabled = !!value; }
export function isSoundEnabled() { return enabled; }

/** Bir notu qısa müddətə çalır (ADSR ilə). */
function tone(freq, durMs, { type = "sine", volume = 0.3, attack = 4, release = 60 } = {}) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack / 1000);
  gain.gain.linearRampToValueAtTime(0, now + (durMs + release) / 1000);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + (durMs + release) / 1000);
}

/** Frekansı zaman ərzində dəyişən ton (sweep). */
function sweep(fromFreq, toFreq, durMs, { type = "sawtooth", volume = 0.25 } = {}) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), now + durMs / 1000);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.05);
}

/** Topun raketdən əks-səda səsi — sürətə görə tonu dəyişir. */
export function playPaddle(speed = 1) {
  const base = 320 + Math.min(800, speed * 30);
  tone(base, 80, { type: "square", volume: 0.18, release: 30 });
  tone(base * 1.5, 50, { type: "sine", volume: 0.10, release: 30 });
}

/** Topun divara dəyməsi. */
export function playWall() {
  tone(220, 60, { type: "triangle", volume: 0.16, release: 30 });
}

/** Xal qazanılması — yüksək, fərəh dolu akkord. */
export function playScore() {
  if (!enabled) return;
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((f, i) => setTimeout(() => tone(f, 130, { type: "sawtooth", volume: 0.18, release: 100 }), i * 60));
}

/** Qələbə — daha böyük arpedjio. */
export function playWin() {
  if (!enabled) return;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => setTimeout(() => tone(f, 200, { type: "square", volume: 0.16, release: 180 }), i * 100));
}

/** Məğlubiyyət — aşağı doğru sweep. */
export function playLose() {
  if (!enabled) return;
  sweep(440, 110, 600, { type: "sawtooth", volume: 0.18 });
}

/** Düymə kliki. */
export function playClick() {
  tone(880, 30, { type: "sine", volume: 0.10, attack: 1, release: 25 });
}

/** AudioContext-i resume etmək (mobil brauzerlər user-gesture tələb edir). */
export function resumeAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}
