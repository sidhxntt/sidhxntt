"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { profile } from "@/data/portfolio";
import { playClick } from "@/lib/sounds";
import { Avatar } from "@/components/Avatar";
import { Wallpaper } from "@/components/desktop/Wallpaper";
import { CompatibilityCheck } from "./CompatibilityCheck";

/**
 * Big lock-screen clock, macOS/iOS style: "Tue 21 Jul" over "12:47".
 *
 * The time drops its AM/PM the way the real lock screen does — built from
 * formatToParts rather than a string replace so it survives locales that put
 * the marker first, or use a different one entirely.
 */
function LockClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // reserve the space on the server so the clock doesn't shove the layout
  if (!now) return <div className="h-[124px] md:h-[168px]" aria-hidden />;

  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .formatToParts(now)
    .filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal")
    .map((p) => p.value)
    .join("")
    .trim();

  return (
    <div className="flex flex-col items-center text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
      <p className="text-[15px] font-semibold md:text-lg">{date}</p>
      <p className="text-[76px] font-semibold leading-none tracking-tight tabular-nums md:text-[104px]">
        {time}
      </p>
    </div>
  );
}

export function LoginScreen({ onUnlock }: { onUnlock: () => void }) {
  const [unlocking, setUnlocking] = useState(false);
  const [checking, setChecking] = useState(false);

  const unlock = () => {
    if (unlocking) return;
    playClick();
    setUnlocking(true);
    setTimeout(onUnlock, 550);
  };

  useEffect(() => {
    // Enter logs in — but not while the compatibility report is up, or the
    // visitor reading it gets yanked to the desktop mid-sentence.
    if (checking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") unlock();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocking, checking]);

  if (checking) return <CompatibilityCheck onBack={() => setChecking(false)} />;

  return (
    <motion.div
      className="relative h-full w-full overflow-hidden"
      animate={unlocking ? { opacity: 0, scale: 1.06 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <Wallpaper />
      {/* the real lock screen leaves the wallpaper sharp — just enough scrim to
          keep white text legible over a bright photo */}
      <div className="absolute inset-0 bg-black/25" />

      {/* Clock rides near the top, like macOS Sonoma and iOS */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-x-0 top-[9vh] flex justify-center md:top-[7vh]"
      >
        <LockClock />
      </motion.div>

      {/* User + unlock prompt sit at the bottom */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="absolute inset-x-0 bottom-[9vh] flex flex-col items-center gap-2.5"
      >
        <Avatar size={64} className="text-xl shadow-2xl ring-2 ring-white/30" />
        <p className="text-[15px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
          {profile.name}
        </p>
        <button
          onClick={unlock}
          className="rounded-full bg-white/20 px-5 py-1.5 text-[13px] font-medium text-white backdrop-blur transition hover:bg-white/30"
        >
          {unlocking ? "Logging in…" : "Click or press Enter to log in"}
        </button>
        <button
          onClick={() => {
            playClick();
            setChecking(true);
          }}
          className="mt-0.5 text-[12px] text-white/55 underline underline-offset-4 transition hover:text-white/90"
        >
          Check compatibility
        </button>
      </motion.div>

      <p className="absolute inset-x-0 bottom-4 text-center text-[11px] text-white/40">
        {profile.role} · Portfolio
      </p>
    </motion.div>
  );
}
