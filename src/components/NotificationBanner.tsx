"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANNOUNCEMENT } from "@/data/notifications";
import { openExternal } from "@/lib/browser";
import { GLASS_CLASS, GLASS_STYLE } from "@/lib/glass";
import { postNotification } from "@/lib/notification-center";
import { playClick, playNotification } from "@/lib/sounds";

/**
 * The macOS/iOS notification banner that greets you on the desktop.
 *
 * It runs on every load — nothing is remembered between visits. Whether it
 * times out or you close it, it lands in Notification Center behind the menu
 * bar clock; only clicking through consumes it.
 */
export function NotificationBanner({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const [shown, setShown] = useState(false);
  const hoverRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** @param keep false when the click-through already handled it */
  const hide = useCallback((keep: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShown(false);
    if (keep) {
      postNotification({
        id: ANNOUNCEMENT.id,
        app: ANNOUNCEMENT.app,
        title: ANNOUNCEMENT.title,
        body: ANNOUNCEMENT.body,
        url: ANNOUNCEMENT.url,
        at: Date.now(),
      });
    }
  }, []);

  const startCountdown = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!hoverRef.current) hide(true);
    }, ANNOUNCEMENT.autoDismissSeconds * 1000);
  }, [hide]);

  // Entrance: only after the desktop has settled.
  useEffect(() => {
    const t = setTimeout(() => {
      setShown(true);
      playNotification();
      startCountdown();
    }, ANNOUNCEMENT.delayMs);
    return () => {
      clearTimeout(t);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [startCountdown]);

  const isMobile = variant === "mobile";
  const offscreen = isMobile ? { y: -80, x: 0 } : { y: 0, x: 40 };

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key="announcement"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 0.96, ...offscreen }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, ...offscreen }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onMouseEnter={() => {
            hoverRef.current = true;
          }}
          onMouseLeave={() => {
            hoverRef.current = false;
            startCountdown();
          }}
          className={`group fixed z-[6000] ${isMobile ? "inset-x-3 top-3" : "right-3 top-9 w-[352px]"}`}
        >
          <div className={`relative rounded-[20px] ${GLASS_CLASS}`} style={GLASS_STYLE}>
            <button
              type="button"
              onClick={() => {
                playClick();
                openExternal(ANNOUNCEMENT.url);
                hide(false);
              }}
              className="flex w-full items-start gap-3 rounded-[20px] p-3 text-left transition active:scale-[0.985]"
            >
              <NotificationGlyph />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium uppercase tracking-wide text-white/55">
                    {ANNOUNCEMENT.app}
                  </span>
                  <span className="shrink-0 text-[11px] text-white/45">now</span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-white">
                  {ANNOUNCEMENT.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-white/70">
                  {ANNOUNCEMENT.body}
                </span>
              </span>
            </button>

            {/* macOS parks the close button on the banner's top-left corner,
                visible on hover; touch has no hover, so phones always show it. */}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={(e) => {
                e.stopPropagation();
                playClick();
                hide(true);
              }}
              className={`absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-neutral-700/90 text-white/80 shadow transition hover:bg-neutral-600 ${
                isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <CloseGlyph />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CloseGlyph({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  );
}

/** The announcement's app tile — shared by the banner and Notification Center. */
export function NotificationGlyph({ size = "h-10 w-10" }: { size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff7a45] via-[#ff3d7f] to-[#8b5cf6] shadow-inner`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden>
        <path d="M12 2l2.2 5.9 5.9 2.2-5.9 2.2L12 18l-2.2-5.7L3.9 10.1l5.9-2.2L12 2z" />
        <circle cx="18.5" cy="18.5" r="2.2" />
      </svg>
    </span>
  );
}
