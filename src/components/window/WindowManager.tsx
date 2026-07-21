"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { AppId } from "@/components/AppIcon";
import { playClose, playOpen } from "@/lib/sounds";

// queue the sound outside the updater so StrictMode's double-invoke stays silent
let openSoundQueued = false;
function playOpenSoon() {
  if (openSoundQueued) return;
  openSoundQueued = true;
  queueMicrotask(() => {
    openSoundQueued = false;
    playOpen();
  });
}
import { recordRecent } from "@/lib/recents";

export type WindowState = {
  appId: AppId;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  /** bounds to restore when leaving full screen */
  prevBounds?: { position: { x: number; y: number }; size: { width: number; height: number } };
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

type WindowManagerValue = {
  windows: Partial<Record<AppId, WindowState>>;
  activeApp: AppId | null;
  openApp: (id: AppId) => void;
  closeApp: (id: AppId) => void;
  minimizeApp: (id: AppId) => void;
  toggleMaximize: (id: AppId) => void;
  focusApp: (id: AppId) => void;
  moveApp: (id: AppId, pos: { x: number; y: number }) => void;
  resizeApp: (id: AppId, size: { width: number; height: number }, pos?: { x: number; y: number }) => void;
};

const WindowManagerContext = createContext<WindowManagerValue | null>(null);

export const DEFAULT_SIZES: Record<AppId, { width: number; height: number }> = {
  about: { width: 860, height: 540 },
  projects: { width: 720, height: 520 },
  resume: { width: 620, height: 560 },
  contact: { width: 540, height: 460 },
  pictures: { width: 680, height: 500 },
  music: { width: 900, height: 560 },
  myfolder: { width: 760, height: 480 },
  calendar: { width: 780, height: 560 },
  settings: { width: 700, height: 500 },
  terminal: { width: 680, height: 440 },
  messages: { width: 720, height: 520 },
  code: { width: 900, height: 580 },
  photobooth: { width: 640, height: 540 },
  activity: { width: 720, height: 520 },
  weather: { width: 620, height: 560 },
  safari: { width: 920, height: 600 },
  "game-snake": { width: 520, height: 620 },
  "game-pacman": { width: 520, height: 620 },
  "game-2048": { width: 520, height: 620 },
  "game-mines": { width: 520, height: 620 },
  "game-breakout": { width: 520, height: 620 },
  "game-dino": { width: 520, height: 368 },
  "game-vault": { width: 520, height: 620 },
  "game-quest": { width: 520, height: 620 },
};

const MENUBAR_HEIGHT = 28;

/** Games keep a fixed playfield — no full screen. */
export function canMaximize(id: AppId): boolean {
  return !id.startsWith("game-");
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<Partial<Record<AppId, WindowState>>>({});
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const zCounter = useRef(10);
  const openCount = useRef(0);

  const openApp = useCallback((id: AppId) => {
    recordRecent(id);
    // side effects stay out of the setState updater (StrictMode double-invokes it)
    const z = ++zCounter.current;
    const cascade = (openCount.current++ % 6) * 32;
    setWindows((prev) => {
      if (!prev[id]?.open) playOpenSoon();
      const existing = prev[id];
      if (existing?.open) {
        return { ...prev, [id]: { ...existing, minimized: false, zIndex: z } };
      }
      const size = existing?.size ?? DEFAULT_SIZES[id];
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const position = existing?.position ?? {
        x: Math.max(12, (vw - size.width) / 2 + cascade - 80),
        y: Math.max(MENUBAR_HEIGHT + 12, (vh - size.height) / 2.4 + cascade),
      };
      return {
        ...prev,
        [id]: { appId: id, open: true, minimized: false, maximized: false, zIndex: z, position, size },
      };
    });
    setActiveApp(id);
  }, []);

  const closeApp = useCallback((id: AppId) => {
    playClose();
    setWindows((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      // a window closed while maximized reopens at its pre-zoom bounds
      const restored = existing.maximized
        ? {
            maximized: false,
            prevBounds: undefined,
            size: existing.prevBounds?.size ?? DEFAULT_SIZES[id],
            position: existing.prevBounds?.position ?? existing.position,
          }
        : null;
      return { ...prev, [id]: { ...existing, ...restored, open: false, minimized: false } };
    });
    setActiveApp((cur) => (cur === id ? null : cur));
  }, []);

  const minimizeApp = useCallback((id: AppId) => {
    playClose();
    setWindows((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, minimized: true } };
    });
    setActiveApp((cur) => (cur === id ? null : cur));
  }, []);

  const toggleMaximize = useCallback((id: AppId) => {
    if (!canMaximize(id)) return;
    setWindows((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (existing.maximized) {
        // fall back to the app's default bounds when saved bounds are missing
        // or themselves near-fullscreen (stale state) — always truly scales down
        let restored = existing.prevBounds;
        if (!restored || restored.size.width > vw - 40 || restored.size.height > vh - 60) {
          const size = DEFAULT_SIZES[id];
          restored = {
            size,
            position: {
              x: Math.max(12, (vw - size.width) / 2),
              y: Math.max(MENUBAR_HEIGHT + 12, (vh - size.height) / 2.4),
            },
          };
        }
        const position = { ...restored.position, y: Math.max(MENUBAR_HEIGHT, restored.position.y) };
        return {
          ...prev,
          [id]: { ...existing, maximized: false, prevBounds: undefined, size: restored.size, position },
        };
      }
      return {
        ...prev,
        [id]: {
          ...existing,
          maximized: true,
          prevBounds: { position: existing.position, size: existing.size },
          position: { x: 0, y: MENUBAR_HEIGHT },
          size: { width: vw, height: vh - MENUBAR_HEIGHT },
          zIndex: ++zCounter.current,
        },
      };
    });
    setActiveApp(id);
  }, []);

  const focusApp = useCallback((id: AppId) => {
    setWindows((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      if (existing.zIndex === zCounter.current) return prev;
      return { ...prev, [id]: { ...existing, zIndex: ++zCounter.current } };
    });
    setActiveApp(id);
  }, []);

  const moveApp = useCallback((id: AppId, pos: { x: number; y: number }) => {
    setWindows((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, position: pos } };
    });
  }, []);

  const resizeApp = useCallback(
    (id: AppId, size: { width: number; height: number }, pos?: { x: number; y: number }) => {
      setWindows((prev) => {
        const existing = prev[id];
        if (!existing) return prev;
        return { ...prev, [id]: { ...existing, size, position: pos ?? existing.position } };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ windows, activeApp, openApp, closeApp, minimizeApp, toggleMaximize, focusApp, moveApp, resizeApp }),
    [windows, activeApp, openApp, closeApp, minimizeApp, toggleMaximize, focusApp, moveApp, resizeApp],
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindowManager must be used inside WindowManagerProvider");
  return ctx;
}
