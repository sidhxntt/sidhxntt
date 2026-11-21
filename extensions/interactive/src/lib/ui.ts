"use client";

// Tiny store for global UI state (screen brightness), shared by the desktop
// and the Control Center (same subscribe pattern as wallpaper.ts).

import { loadPersisted, savePersisted } from "./persist";

let brightness = loadPersisted(
  "brightness",
  1, // 0.4..1 multiplier applied as a CSS brightness filter
  (v): v is number => typeof v === "number" && v >= 0.4 && v <= 1,
);
const listeners = new Set<(b: number) => void>();

export function getBrightness() {
  return brightness;
}

export function setBrightness(b: number) {
  brightness = Math.min(1, Math.max(0.4, b));
  savePersisted("brightness", brightness);
  listeners.forEach((l) => l(brightness));
}

export function subscribeBrightness(l: (b: number) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
