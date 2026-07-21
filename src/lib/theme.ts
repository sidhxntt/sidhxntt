"use client";

// Tiny store for the system appearance (light/dark), shared by the desktop,
// Control Center, and the Settings app (same subscribe pattern as wallpaper.ts).
// Desktop.tsx mirrors this into a data-theme attribute that scopes Tailwind's
// `dark:` variant (see globals.css @custom-variant).

import { loadPersisted, savePersisted } from "./persist";

export type Theme = "light" | "dark";

let current: Theme = loadPersisted<Theme>("theme", "light", (v): v is Theme => v === "light" || v === "dark");
const listeners = new Set<(t: Theme) => void>();

export function getTheme() {
  return current;
}

export function setTheme(t: Theme) {
  current = t;
  savePersisted("theme", t);
  listeners.forEach((l) => l(t));
}

export function subscribeTheme(l: (t: Theme) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
