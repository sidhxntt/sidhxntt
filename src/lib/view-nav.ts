"use client";

// Lets the rest of the OS deep-link an app to one of its internal views —
// Music's Home/Search/Songs/Favourites, Calendar's Day/Week/Month/Year.
// Keyed by app id so the two never cross wires.

let pending: Record<string, string> = {};
const listeners = new Set<(app: string, view: string) => void>();

export function requestView(app: string, view: string) {
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(app, view));
    return;
  }
  pending[app] = view;
}

/** One-shot read for an app mounting after the request was made. */
export function consumePendingView(app: string): string | null {
  const v = pending[app] ?? null;
  if (v) {
    const { [app]: _drop, ...rest } = pending;
    pending = rest;
  }
  return v;
}

export function subscribeViewNav(l: (app: string, view: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
