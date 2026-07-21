"use client";

// Tiny store for the active wallpaper, shared by the desktop, login screen,
// and the Settings app (same subscribe pattern as sounds.ts).

import { loadPersisted, savePersisted } from "./persist";

// The catalog itself lives in wallpaper-data.ts (no "use client") so server
// code — the Siri route — can read it too. Re-exported here so client
// importers keep their single import site.
export { WALLPAPERS, DEFAULT_WALLPAPER, type WallpaperId } from "./wallpaper-data";
import { WALLPAPERS, DEFAULT_WALLPAPER, type WallpaperId } from "./wallpaper-data";

// A stored id from an older build (the retired CSS gradients) fails this guard
// and falls back to the default rather than rendering nothing.
let current: WallpaperId = loadPersisted<WallpaperId>("wallpaper", DEFAULT_WALLPAPER, (v): v is WallpaperId =>
  WALLPAPERS.some((w) => w.id === v),
);
const listeners = new Set<(w: WallpaperId) => void>();

export function getWallpaper() {
  return current;
}

export function setWallpaper(w: WallpaperId) {
  current = w;
  savePersisted("wallpaper", w);
  listeners.forEach((l) => l(w));
}

export function subscribeWallpaper(l: (w: WallpaperId) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
