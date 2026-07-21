"use client";

// Global music player singleton — owns the HTMLAudio element so playback
// survives the Music window unmounting (minimize/close). UI components
// subscribe to a single immutable state object (useSyncExternalStore-friendly).

import { useEffect, useState } from "react";
import { getVolume as getMasterVolume, isMuted, subscribeMute, subscribeVolume } from "@/lib/sounds";

export type Track = {
  id: string;
  name: string;
  artists: string;
  album: string;
  image: string;
  durationMs: number;
  previewUrl: string | null;
  spotifyUrl: string;
};

export type PlayerState = {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  progress: { time: number; duration: number };
  shuffle: boolean;
  repeat: boolean;
  volume: number;
  /** Track id whose preview is currently being resolved. */
  loadingTrackId: string | null;
  /** Track id that briefly shows a "No preview available" notice. */
  noPreviewId: string | null;
};

let state: PlayerState = {
  current: null,
  queue: [],
  playing: false,
  progress: { time: 0, duration: 0 },
  shuffle: false,
  repeat: false,
  volume: 0.8,
  loadingTrackId: null,
  noPreviewId: null,
};

const listeners = new Set<(s: PlayerState) => void>();
let audio: HTMLAudioElement | null = null;

// iTunes preview resolution cache (Spotify track id -> preview url | null)
const previewCache = new Map<string, string | null>();
let playReq = 0;
let noPreviewTimer: ReturnType<typeof setTimeout> | null = null;

function emit(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getState(): PlayerState {
  return state;
}

export function subscribe(listener: (s: PlayerState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook: player state EXCLUDING progress ticks. Progress updates fire
 * ~4x/sec while playing; components using this hook keep their previous
 * snapshot (React bails out of the re-render) unless something else changed.
 * The `progress` field on the returned snapshot may be stale — components
 * that render progress should subscribe to the store directly instead.
 */
export function usePlayerState(): PlayerState {
  const [snap, setSnap] = useState(getState);
  useEffect(() => {
    setSnap(getState());
    return subscribe((s) => {
      setSnap((prev) =>
        prev.current === s.current &&
        prev.queue === s.queue &&
        prev.playing === s.playing &&
        prev.shuffle === s.shuffle &&
        prev.repeat === s.repeat &&
        prev.volume === s.volume &&
        prev.loadingTrackId === s.loadingTrackId &&
        prev.noPreviewId === s.noPreviewId
          ? prev
          : s
      );
    });
  }, []);
  return snap;
}

/** Playback loudness = the player's own volume × the system sound bar. */
function effectiveVolume(): number {
  return Math.min(1, Math.max(0, state.volume * getMasterVolume()));
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    const a = new Audio();
    a.muted = isMuted();
    a.volume = effectiveVolume();
    a.addEventListener("timeupdate", () => {
      emit({ progress: { time: a.currentTime, duration: a.duration || 30 } });
    });
    a.addEventListener("ended", () => {
      if (state.repeat) {
        a.currentTime = 0;
        void a.play();
      } else if (state.queue.length > 1) {
        step(1);
      } else {
        emit({ playing: false });
      }
    });
    // Respect the global mute switch and sound bar for the element's lifetime.
    subscribeMute((m) => {
      a.muted = m;
    });
    subscribeVolume(() => {
      a.volume = effectiveVolume();
    });
    audio = a;
  }
  return audio;
}

/* ----- preview resolution (iTunes Search API) ----- */

async function resolvePreview(t: Track): Promise<string | null> {
  if (t.previewUrl) return t.previewUrl;
  if (previewCache.has(t.id)) return previewCache.get(t.id) ?? null;
  try {
    const r = await fetch(`/api/itunes/preview?term=${encodeURIComponent(`${t.name} ${t.artists}`)}`);
    const d = (await r.json()) as { previewUrl: string | null };
    const url = d.previewUrl ?? null;
    previewCache.set(t.id, url);
    return url;
  } catch {
    previewCache.set(t.id, null);
    return null;
  }
}

// Resolve a track's preview and start playing it (replacing whatever is current).
async function startTrack(t: Track) {
  const req = ++playReq;
  emit({ loadingTrackId: t.id });
  const url = await resolvePreview(t);
  if (playReq !== req) return; // superseded by a newer request
  emit({ loadingTrackId: null });
  if (!url) {
    if (noPreviewTimer) clearTimeout(noPreviewTimer);
    emit({ noPreviewId: t.id });
    noPreviewTimer = setTimeout(() => {
      if (state.noPreviewId === t.id) emit({ noPreviewId: null });
    }, 2500);
    return;
  }
  const a = getAudio();
  a.pause();
  a.src = url;
  a.volume = effectiveVolume();
  a.muted = isMuted();
  emit({ current: t, progress: { time: 0, duration: 30 }, playing: true });
  void a.play();
}

function step(dir: 1 | -1) {
  const { current, queue } = state;
  if (!current || queue.length === 0) return;
  const i = queue.findIndex((t) => t.id === current.id);
  let next: Track;
  if (state.shuffle && queue.length > 1) {
    do {
      next = queue[Math.floor(Math.random() * queue.length)];
    } while (next.id === current.id);
  } else {
    next = queue[(i + dir + queue.length) % queue.length];
  }
  if (next.id === current.id) return;
  void startTrack(next);
}

/* ----- public controls ----- */

/** Play a track (optionally replacing the queue); toggles if it's already current. */
export function play(t: Track, queue?: Track[]) {
  if (queue) emit({ queue });
  if (state.current?.id === t.id) {
    toggle();
    return;
  }
  void startTrack(t);
}

export function pause() {
  const a = audio;
  if (!a) return;
  a.pause();
  emit({ playing: false });
}

export function toggle() {
  const a = audio;
  if (!a || !state.current) return;
  if (a.paused) {
    void a.play();
    emit({ playing: true });
  } else {
    a.pause();
    emit({ playing: false });
  }
}

export function next() {
  step(1);
}

export function prev() {
  step(-1);
}

export function setVolume(v: number) {
  const vol = Math.min(1, Math.max(0, v));
  emit({ volume: vol });
  if (audio) audio.volume = effectiveVolume();
}

export function setQueue(queue: Track[]) {
  emit({ queue });
}

export function setShuffle(on: boolean) {
  emit({ shuffle: on });
}

export function setRepeat(on: boolean) {
  emit({ repeat: on });
}
