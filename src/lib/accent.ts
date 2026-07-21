"use client";

// Tiny store for the system accent color (same subscribe pattern as theme.ts).
// Desktop.tsx exposes the active color as the --accent CSS variable; consumers
// use bg-(--accent) / ring-(--accent) etc.

import { loadPersisted, savePersisted } from "./persist";

export type AccentId = "blue" | "purple" | "pink" | "red" | "orange" | "green" | "graphite";

export const ACCENTS: { id: AccentId; name: string; color: string }[] = [
  { id: "blue", name: "Blue", color: "#3b82f6" },
  { id: "purple", name: "Purple", color: "#a855f7" },
  { id: "pink", name: "Pink", color: "#ec4899" },
  { id: "red", name: "Red", color: "#ef4444" },
  { id: "orange", name: "Orange", color: "#f97316" },
  { id: "green", name: "Green", color: "#22c55e" },
  { id: "graphite", name: "Graphite", color: "#6b7280" },
];

const isAccentId = (v: unknown): v is AccentId => ACCENTS.some((a) => a.id === v);

let current: AccentId = loadPersisted<AccentId>("accent", "blue", isAccentId);
const listeners = new Set<(a: AccentId) => void>();

export function getAccent() {
  return current;
}

export function getAccentColor() {
  return ACCENTS.find((a) => a.id === current)?.color ?? ACCENTS[0].color;
}

export function setAccent(a: AccentId) {
  current = a;
  savePersisted("accent", a);
  listeners.forEach((l) => l(a));
}

export function subscribeAccent(l: (a: AccentId) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
