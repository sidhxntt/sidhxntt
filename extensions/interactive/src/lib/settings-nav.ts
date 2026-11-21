"use client";

// Lets things outside the Settings window (e.g. a menu bar item or another app)
// ask System Settings to show a specific pane.

let pending: string | null = null;
const listeners = new Set<(pane: string) => void>();

export function requestSettingsPane(pane: string) {
  pending = pane;
  if (listeners.size > 0) {
    // a mounted consumer takes it now — don't let a stale value replay later
    listeners.forEach((l) => l(pane));
    pending = null;
    return;
  }
}

/** One-shot read for Settings mounting after the request was made. */
export function consumePendingSettingsPane(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribeSettingsNav(l: (pane: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
