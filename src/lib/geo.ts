"use client";

// The user's coordinates, captured once during boot by MacExperience and
// shared with anything that fetches weather (Siri, Terminal, widgets).

import type { Coords } from "@/components/desktop/Widgets";

let current: Coords = null;

export function setCoords(c: Coords) {
  current = c;
}

export function getCoords(): Coords {
  return current;
}
