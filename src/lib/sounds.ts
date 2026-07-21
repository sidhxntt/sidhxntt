"use client";

// All UI sounds are synthesized with the Web Audio API — no audio assets,
// no licensing issues (the real Apple chime is copyrighted).

import { loadPersisted, savePersisted } from "./persist";

const isBool = (v: unknown): v is boolean => typeof v === "boolean";

let ctx: AudioContext | null = null;
let muted = loadPersisted("muted", false, isBool);
let volume = loadPersisted("volume", 1, (v): v is number => typeof v === "number" && v >= 0 && v <= 1); // 0..1 master multiplier, applied via a shared master gain
let uiSounds = loadPersisted("uiSounds", true, isBool); // gates click/open/close SFX only
let startupChime = loadPersisted("startupChime", true, isBool); // gates the boot chime only
const listeners = new Set<(m: boolean) => void>();
const volListeners = new Set<(v: number) => void>();
const uiListeners = new Set<(u: boolean) => void>();
const chimeListeners = new Set<(c: boolean) => void>();
let masterGain: GainNode | null = null;

function getMaster(ac: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = ac.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ac.destination);
  }
  return masterGain;
}

export function getVolume() {
  return volume;
}

export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (masterGain) masterGain.gain.value = volume;
  savePersisted("volume", volume);
  volListeners.forEach((l) => l(volume));
}

export function subscribeVolume(l: (v: number) => void) {
  volListeners.add(l);
  return () => {
    volListeners.delete(l);
  };
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  savePersisted("muted", m);
  listeners.forEach((l) => l(m));
}

export function subscribeMute(l: (m: boolean) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getUiSounds() {
  return uiSounds;
}

export function setUiSounds(u: boolean) {
  uiSounds = u;
  savePersisted("uiSounds", u);
  uiListeners.forEach((l) => l(u));
}

export function subscribeUiSounds(l: (u: boolean) => void) {
  uiListeners.add(l);
  return () => {
    uiListeners.delete(l);
  };
}

export function getStartupChime() {
  return startupChime;
}

export function setStartupChime(c: boolean) {
  startupChime = c;
  savePersisted("startupChime", c);
  chimeListeners.forEach((l) => l(c));
}

export function subscribeStartupChime(l: (c: boolean) => void) {
  chimeListeners.add(l);
  return () => {
    chimeListeners.delete(l);
  };
}

/** Must be called from a user gesture (the power button click) to unlock audio. */
export function unlockAudio() {
  getCtx();
}

function tone(
  ac: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  attack: number,
  hold: number,
  release: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + attack + hold + release + 0.05);
}

/** Startup chime — a warm F# major swell, reminiscent-but-not-identical. */
export function playChime() {
  const ac = getCtx();
  if (!ac || muted) return;
  const t = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(getMaster(ac));
  // F#2 root + F# major chord stack with slow attack
  const freqs = [92.5, 185, 233, 277.2, 370, 466.2, 554.4];
  freqs.forEach((f, i) => {
    tone(ac, master, f, t, 0.35, 1.2, 1.6, 0.16 - i * 0.012, i < 2 ? "triangle" : "sine");
  });
}

/** Short filtered click for UI interactions. */
export function playClick() {
  const ac = getCtx();
  if (!ac || muted || !uiSounds) return;
  const t = ac.currentTime;
  const buf = ac.createBuffer(1, ac.sampleRate * 0.03, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.value = 0.25;
  src.connect(filter).connect(gain).connect(getMaster(ac));
  src.start(t);
}

/** Rising whoosh for opening a window. */
export function playOpen() {
  const ac = getCtx();
  if (!ac || muted || !uiSounds) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(640, t + 0.18);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain).connect(getMaster(ac));
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Falling whoosh for closing / minimizing a window. */
export function playClose() {
  const ac = getCtx();
  if (!ac || muted || !uiSounds) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(560, t);
  osc.frequency.exponentialRampToValueAtTime(240, t + 0.18);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain).connect(getMaster(ac));
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Two-note bell for an incoming notification banner. */
export function playNotification() {
  const ac = getCtx();
  if (!ac || muted || !uiSounds) return;
  const t = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = 0.6;
  master.connect(getMaster(ac));
  // B5 then E6 — a rising perfect fourth, struck rather than swelled
  tone(ac, master, 987.8, t, 0.005, 0.02, 0.35, 0.1);
  tone(ac, master, 1318.5, t + 0.11, 0.005, 0.02, 0.5, 0.09);
  // faint octave shimmer on top of the second strike
  tone(ac, master, 2637, t + 0.11, 0.005, 0.01, 0.3, 0.025);
}

/** Simple synth note used by the Music app's fake player. */
export function playNote(freq: number, duration = 0.3) {
  const ac = getCtx();
  if (!ac || muted) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(getMaster(ac));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}
