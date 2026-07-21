"use client";

// Lets the rest of the OS deep-link the Notes app straight to one note.
// The query is free text matched against note titles, then bodies.

let pending: string | null = null;
const listeners = new Set<(query: string) => void>();

export function requestNote(query: string) {
  pending = query;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(query));
    pending = null;
    return;
  }
}

/** One-shot read for Notes mounting after the request was made. */
export function consumePendingNote(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribeNoteNav(l: (query: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
