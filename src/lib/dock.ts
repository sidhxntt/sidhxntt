"use client";

// Tiny store for Dock preferences (icon size, magnification strength,
// auto-hide), same subscribe pattern as wallpaper.ts.

import { loadPersisted, savePersisted } from "./persist";

export type DockSettings = {
  size: number; // base icon size in px, 40..64
  magnification: number; // 0..1 zoom strength (0 = off)
  autoHide: boolean;
};

const DEFAULTS: DockSettings = { size: 52, magnification: 0.7, autoHide: false };

const isDockSettings = (v: unknown): v is DockSettings =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as DockSettings).size === "number" &&
  typeof (v as DockSettings).magnification === "number" &&
  typeof (v as DockSettings).autoHide === "boolean";

let current: DockSettings = loadPersisted("dock", DEFAULTS, isDockSettings);
const listeners = new Set<(d: DockSettings) => void>();

function commit(next: DockSettings) {
  current = next;
  savePersisted("dock", current);
  listeners.forEach((l) => l(current));
}

export function getDockSettings() {
  return current;
}

export function setDockSize(size: number) {
  commit({ ...current, size: Math.min(64, Math.max(40, size)) });
}

export function setDockMagnification(m: number) {
  commit({ ...current, magnification: Math.min(1, Math.max(0, m)) });
}

export function setDockAutoHide(autoHide: boolean) {
  commit({ ...current, autoHide });
}

export function subscribeDock(l: (d: DockSettings) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
