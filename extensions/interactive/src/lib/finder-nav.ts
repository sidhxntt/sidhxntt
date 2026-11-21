"use client";

// Lets things outside the Finder window (e.g. the dock's trash icon)
// ask Finder to show a specific location.

let pending: string | null = null;
const listeners = new Set<(loc: string) => void>();

export function requestFinderLocation(loc: string) {
  pending = loc;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(loc));
    pending = null;
    return;
  }
}

/** One-shot read for Finder mounting after the request was made. */
export function consumePendingFinderLocation(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribeFinderNav(l: (loc: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
