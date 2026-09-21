/* UI sounds, synthesised with Web Audio so the OS ships no audio files. */

import { store } from './store.js';

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ac, { freq, to, start = 0, dur = 0.12, type = 'sine', gain = 0.06 }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(ac, { start = 0, dur = 0.08, gain = 0.08 }) {
  const t0 = ac.currentTime + start;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(hp).connect(g).connect(ac.destination);
  src.start(t0);
}

const SOUNDS = {
  unlock(ac) {
    tone(ac, { freq: 520, to: 780, dur: 0.14, type: 'triangle', gain: 0.05 });
    tone(ac, { freq: 780, to: 1170, start: 0.07, dur: 0.18, type: 'sine', gain: 0.045 });
  },
  lock(ac) {
    tone(ac, { freq: 700, to: 420, dur: 0.16, type: 'triangle', gain: 0.05 });
    noise(ac, { start: 0.02, dur: 0.04, gain: 0.03 });
  },
  notify(ac) {
    tone(ac, { freq: 988, dur: 0.16, gain: 0.04 });
    tone(ac, { freq: 1319, start: 0.1, dur: 0.24, gain: 0.035 });
  },
  tap(ac) {
    tone(ac, { freq: 1600, dur: 0.03, type: 'square', gain: 0.012 });
  },
  shutter(ac) {
    noise(ac, { dur: 0.05, gain: 0.12 });
    noise(ac, { start: 0.07, dur: 0.06, gain: 0.09 });
  }
};

export function play(name) {
  if (!store.get('sound')) return;
  try {
    const ac = audio();
    if (ac) SOUNDS[name]?.(ac);
  } catch { /* sound is a nicety; never break the UI for it */ }
}
