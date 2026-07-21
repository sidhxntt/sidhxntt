"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { APPS, type AppDef } from "@/components/apps/registry";
import { useWindowManager } from "@/components/window/WindowManager";
import { getDockSettings, subscribeDock } from "@/lib/dock";
import { playClick } from "@/lib/sounds";
import { requestFinderLocation } from "@/lib/finder-nav";

const RANGE = 140; // px falloff distance for magnification
const MAG_EXTRA = 44; // px added to base size at full magnification

// Icon components are keyed on base/max in Dock() so a settings change simply
// remounts them at the new resting size — no stale closures inside transforms.
function useDockScale(
  mouseX: MotionValue<number>,
  ref: React.RefObject<HTMLElement | null>,
  base: number,
  max: number,
) {
  const distance = useTransform(mouseX, (mx) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || mx === Infinity) return Infinity;
    return mx - (rect.left + rect.width / 2);
  });
  const targetSize = useTransform(distance, [-RANGE, 0, RANGE], [base, max, base], { clamp: true });
  return useSpring(targetSize, { stiffness: 420, damping: 30 });
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-neutral-800/90 px-2.5 py-1 text-xs text-white shadow-lg backdrop-blur">
      {label}
    </span>
  );
}

type IconSizing = { base: number; max: number };

function DockIcon({ app, mouseX, sizing }: { app: AppDef; mouseX: MotionValue<number>; sizing: IconSizing }) {
  const { windows, openApp } = useWindowManager();
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const size = useDockScale(mouseX, ref, sizing.base, sizing.max);

  const isRunning = !!windows[app.id]?.open;

  return (
    <button
      ref={ref}
      onClick={() => {
        playClick();
        openApp(app.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center justify-end"
      aria-label={`Open ${app.name}`}
    >
      {hovered && <Tooltip label={app.name} />}
      <motion.div
        style={{ width: size, height: size, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.35))" }}
      >
        <AppIcon id={app.id} size="100%" variant="dock" />
      </motion.div>
      <span
        className={`absolute -bottom-[7px] h-[4px] w-[4px] rounded-full bg-white/70 ${isRunning ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}

function TrashIcon({ mouseX, sizing }: { mouseX: MotionValue<number>; sizing: IconSizing }) {
  const { openApp } = useWindowManager();
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [wiggle, setWiggle] = useState(0);
  const size = useDockScale(mouseX, ref, sizing.base, sizing.max);

  return (
    <button
      ref={ref}
      onClick={() => {
        playClick();
        setWiggle((w) => w + 1);
        requestFinderLocation("trash");
        openApp("myfolder");
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center justify-end"
      aria-label="Trash (empty)"
    >
      {hovered && <Tooltip label="Trash (full — don't ask)" />}
      <motion.div
        key={wiggle}
        animate={wiggle ? { rotate: [0, -8, 8, -5, 5, 0] } : undefined}
        transition={{ duration: 0.45 }}
        style={{ width: size, height: size, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.35))" }}
      >
        {/* frosted full bin — crumpled colorful trash peeking over the rim */}
        <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
          <defs>
            <linearGradient id="bin-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#e8eaee" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#c6cad2" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="bin-shine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="30%" stopColor="#fff" stopOpacity="0" />
              <stop offset="80%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#aab0ba" stopOpacity="0.5" />
            </linearGradient>
            <clipPath id="bin-clip">
              <path d="M 26 30 L 30 84 a 8 8 0 0 0 8 7 h 24 a 8 8 0 0 0 8 -7 L 74 30 Z" />
            </clipPath>
          </defs>
          {/* trash inside, peeking above rim */}
          <g>
            <circle cx="38" cy="26" r="7" fill="#60a5fa" />
            <circle cx="49" cy="23" r="8" fill="#f4f4f5" />
            <circle cx="61" cy="26" r="7" fill="#fbbf24" />
            <circle cx="44" cy="28" r="5" fill="#f87171" />
            <circle cx="56" cy="29" r="5" fill="#a78bfa" />
          </g>
          {/* frosted body (translucent so trash shows through top) */}
          <path
            d="M 26 30 L 30 84 a 8 8 0 0 0 8 7 h 24 a 8 8 0 0 0 8 -7 L 74 30 Z"
            fill="url(#bin-body)"
          />
          <g clipPath="url(#bin-clip)">
            <rect x="26" y="30" width="48" height="62" fill="url(#bin-shine)" />
            {/* blurred trash silhouettes behind frosted glass */}
            <circle cx="40" cy="42" r="8" fill="#60a5fa" opacity="0.25" />
            <circle cx="58" cy="45" r="9" fill="#fbbf24" opacity="0.2" />
            <circle cx="49" cy="55" r="10" fill="#f87171" opacity="0.15" />
          </g>
          {/* rim */}
          <path d="M 24 27 h 52 a 2.5 2.5 0 0 1 0 5 H 24 a 2.5 2.5 0 0 1 0 -5 Z" fill="#dfe2e7" opacity="0.95" />
        </svg>
      </motion.div>
      <span className="absolute -bottom-[7px] h-[4px] w-[4px] opacity-0" />
    </button>
  );
}

function MinimizedIcon({ app, mouseX, sizing }: { app: AppDef; mouseX: MotionValue<number>; sizing: IconSizing }) {
  const { openApp } = useWindowManager();
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const size = useDockScale(mouseX, ref, sizing.base, sizing.max);

  return (
    <button
      ref={ref}
      onClick={() => {
        playClick();
        openApp(app.id); // restores the minimized window
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center justify-end"
      aria-label={`Restore ${app.name}`}
    >
      {hovered && <Tooltip label={app.name} />}
      <motion.div
        style={{ width: size, height: size, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.35))" }}
        className="opacity-90"
      >
        <AppIcon id={app.id} size="100%" variant="dock" />
      </motion.div>
    </button>
  );
}

export function Dock() {
  const mouseX = useMotionValue(Infinity);
  const { windows } = useWindowManager();
  const [dock, setDock] = useState(getDockSettings());
  const [revealed, setRevealed] = useState(false);
  useEffect(() => subscribeDock(setDock), []);

  const sizing: IconSizing = { base: dock.size, max: dock.size + dock.magnification * MAG_EXTRA };
  const sizeKey = `${sizing.base}-${sizing.max}`;
  const hidden = dock.autoHide && !revealed;
  const minimized = APPS.filter((a) => windows[a.id]?.open && windows[a.id]?.minimized);

  return (
    <>
      {/* hover strip that reveals an auto-hidden dock */}
      {dock.autoHide && (
        <div className="absolute inset-x-0 bottom-0 z-[3999] h-2" onMouseEnter={() => setRevealed(true)} />
      )}
      <div
        className={`absolute inset-x-0 bottom-1.5 z-[4000] flex justify-center transition-transform duration-300 ${
          hidden ? "translate-y-[calc(100%+10px)]" : ""
        }`}
        onMouseEnter={() => setRevealed(true)}
        onMouseLeave={() => setRevealed(false)}
      >
        <motion.div
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className="flex items-end gap-[9px] rounded-[24px] border border-white/15 px-3 pb-[10px] shadow-2xl backdrop-blur-2xl"
          style={{ height: sizing.base + 20, backgroundColor: "rgba(35,35,40,0.4)" }}
        >
          {APPS.filter((a) => a.inDock).map((app) => (
            <DockIcon key={`${app.id}-${sizeKey}`} app={app} mouseX={mouseX} sizing={sizing} />
          ))}
          {/* separator */}
          <div className="mx-1 self-center" style={{ height: sizing.base * 0.75 }}>
            <div className="h-full w-px bg-white/25" />
          </div>
          {/* minimized windows live right of the separator, like real macOS */}
          {minimized.map((app) => (
            <MinimizedIcon key={`min-${app.id}-${sizeKey}`} app={app} mouseX={mouseX} sizing={sizing} />
          ))}
          {minimized.length > 0 && (
            <div className="mx-1 self-center" style={{ height: sizing.base * 0.75 }}>
              <div className="h-full w-px bg-white/25" />
            </div>
          )}
          <TrashIcon key={`trash-${sizeKey}`} mouseX={mouseX} sizing={sizing} />
        </motion.div>
      </div>
    </>
  );
}
