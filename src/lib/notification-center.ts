"use client";

/**
 * The notification stack behind the menu bar clock.
 *
 * Deliberately session-only — nothing here is persisted, so every reload
 * re-runs the greeting banner exactly like a fresh login. Banners that time
 * out or get closed fall back into this list; opening one removes it, which is
 * what macOS does.
 */

import { useSyncExternalStore } from "react";
import { ANNOUNCEMENT } from "@/data/notifications";

export type NotificationItem = {
  id: string;
  app: string;
  title: string;
  body: string;
  url?: string;
  /** epoch ms — set when the notification is posted; 0 for pinned items */
  at: number;
  /**
   * Pinned items live in the tray permanently: dismissing and Clear All skip
   * them, and opening one doesn't consume it. The announcement uses this so
   * there is always somewhere to go find it again.
   */
  pinned?: boolean;
};

// The announcement is a permanent resident rather than something the banner
// posts — the banner is just its first, louder appearance. at: 0 because a
// real timestamp at module scope would differ between server and client render.
const PINNED: NotificationItem = {
  id: ANNOUNCEMENT.id,
  app: ANNOUNCEMENT.app,
  title: ANNOUNCEMENT.title,
  body: ANNOUNCEMENT.body,
  url: ANNOUNCEMENT.url,
  at: 0,
  pinned: true,
};

// A stable base array: useSyncExternalStore compares snapshots by identity, so
// a fresh array on every read would loop forever.
const BASE: NotificationItem[] = [PINNED];

let items: NotificationItem[] = BASE; // newest first, pinned last
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getNotifications() {
  return items;
}

export function postNotification(n: NotificationItem) {
  if (items.some((i) => i.id === n.id)) return;
  items = [n, ...items];
  emit();
}

export function dismissNotification(id: string) {
  const next = items.filter((i) => i.id !== id || i.pinned);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function clearNotifications() {
  const next = items.filter((i) => i.pinned);
  if (next.length === items.length) return;
  items = next.length === BASE.length ? BASE : next;
  emit();
}

export function subscribeNotifications(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useNotifications() {
  return useSyncExternalStore(subscribeNotifications, getNotifications, () => BASE);
}

/** "now" · "5m ago" · "2h ago" — the relative stamp on a stacked notification. */
export function formatAgo(at: number, now = Date.now()) {
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
