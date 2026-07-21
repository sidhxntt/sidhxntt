"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CloseGlyph, NotificationGlyph } from "./NotificationBanner";
import { openExternal } from "@/lib/browser";
import { GLASS_CLASS, GLASS_STYLE } from "@/lib/glass";
import {
  clearNotifications,
  dismissNotification,
  formatAgo,
  useNotifications,
  type NotificationItem,
} from "@/lib/notification-center";
import { playClick } from "@/lib/sounds";

/**
 * Notification Center — the tray that slides out from the right when you click
 * the menu bar clock (or the status bar clock on a phone). Holds every banner
 * that timed out or was closed, until it's opened or cleared.
 */
export function NotificationCenter({
  open,
  onClose,
  variant = "desktop",
}: {
  open: boolean;
  onClose: () => void;
  variant?: "desktop" | "mobile";
}) {
  const items = useNotifications();
  // relative stamps are only worth re-rendering while the tray is visible
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [open]);
  void tick;

  const isMobile = variant === "mobile";

  const openItem = (n: NotificationItem) => {
    playClick();
    if (n.url) openExternal(n.url);
    // pinned items survive being opened — that's the whole point of them
    if (!n.pinned) dismissNotification(n.id);
  };

  const clearable = items.some((n) => !n.pinned);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Click-off layer — the tray is modal-ish, like the real one */}
          <motion.div
            key="nc-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 z-[5500] ${isMobile ? "bg-black/40 backdrop-blur-[2px]" : ""}`}
          />
          <motion.aside
            key="nc"
            aria-label="Notification Center"
            initial={{ opacity: 0, x: isMobile ? 0 : 32, y: isMobile ? -24 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: isMobile ? 0 : 32, y: isMobile ? -24 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={`fixed z-[5600] flex flex-col gap-2.5 overflow-y-auto p-3 ${
              isMobile ? "inset-x-2 top-2 max-h-[80vh]" : "bottom-0 right-0 top-7 w-[368px]"
            }`}
          >
            <header className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-[15px] font-semibold text-white drop-shadow">Notifications</h2>
              {clearable && (
                <button
                  onClick={() => {
                    playClick();
                    clearNotifications();
                  }}
                  className={`rounded-full px-2.5 py-1 text-[12px] text-white/80 transition hover:brightness-125 ${GLASS_CLASS}`}
                  style={GLASS_STYLE}
                >
                  Clear All
                </button>
              )}
            </header>

            {items.length === 0 ? (
              <div
                className={`flex items-center justify-center rounded-[20px] py-8 text-[13px] text-white/55 ${GLASS_CLASS}`}
                style={GLASS_STYLE}
              >
                No Notifications
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    className={`group relative rounded-[20px] ${GLASS_CLASS}`}
                    style={GLASS_STYLE}
                  >
                    <button
                      onClick={() => openItem(n)}
                      className="flex w-full items-start gap-3 rounded-[20px] p-3 text-left transition active:scale-[0.985]"
                    >
                      <NotificationGlyph />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-white/55">
                            {n.app}
                          </span>
                          <span className="shrink-0 text-[11px] text-white/45">
                            {n.pinned ? "Pinned" : formatAgo(n.at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] font-semibold text-white">
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-white/70">{n.body}</span>
                      </span>
                    </button>
                    {!n.pinned && (
                      <button
                        aria-label={`Dismiss ${n.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick();
                          dismissNotification(n.id);
                        }}
                        className={`absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-neutral-700/90 text-white/80 shadow transition hover:bg-neutral-600 ${
                          isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <CloseGlyph />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
