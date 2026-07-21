"use client";

// Lets the rest of the OS deep-link the Photos app straight to one picture.
// The query is free text ("mountains") or a picture id ("p2") — Pictures.tsx
// resolves it against the library.

let pending: string | null = null;
const listeners = new Set<(query: string) => void>();

export function requestPhoto(query: string) {
  pending = query;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(query));
    pending = null;
    return;
  }
}

export function consumePendingPhoto(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribePhotoNav(l: (query: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
