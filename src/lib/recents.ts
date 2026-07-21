"use client";

import type { AppId } from "@/components/AppIcon";

// Session-scoped "recently opened" tracker, fed by the window manager.

export type RecentEntry = { appId: AppId; at: number };

let recents: RecentEntry[] = [];
const listeners = new Set<(r: RecentEntry[]) => void>();

export function recordRecent(appId: AppId) {
  recents = [{ appId, at: Date.now() }, ...recents.filter((r) => r.appId !== appId)].slice(0, 10);
  listeners.forEach((l) => l(recents));
}

export function getRecents() {
  return recents;
}

export function subscribeRecents(l: (r: RecentEntry[]) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
