"use client";

// Lets things outside the Safari window (currently only Siri) ask Safari to
// open a URL in-app. Everything else keeps using openExternal — see
// src/lib/browser.ts for why.

let pending: string | null = null;
const listeners = new Set<(url: string) => void>();

export function requestSafariUrl(url: string) {
  pending = url;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(url));
    pending = null;
  }
}

/** One-shot read for Safari mounting after the request was made. */
export function consumePendingSafariUrl(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribeSafariNav(l: (url: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
