"use client";

// Lets Finder deep-link the Projects app straight to one project's detail.

let pending: string | null = null;
const listeners = new Set<(id: string) => void>();

export function requestProject(id: string) {
  pending = id;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(id));
    pending = null;
    return;
  }
}

export function consumePendingProject(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribeProjectNav(l: (id: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
