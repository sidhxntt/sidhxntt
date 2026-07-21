"use client";

import { useEffect, useRef, useState } from "react";
import { getBrightness, setBrightness, subscribeBrightness } from "@/lib/ui";
import {
  getVolume,
  isMuted,
  playClick,
  setMuted,
  setVolume,
  subscribeMute,
  subscribeVolume,
} from "@/lib/sounds";

// iOS-style control widgets living on the Today page: the connectivity
// 2×2 tile and the tall brightness/volume sliders.

const TILE = "rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl [background-image:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]";

function Glyph({ d, className = "h-5 w-5", filled = false }: { d: string; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const G = {
  wifi: "M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19h.01",
  bt: "m7 7 10 10-5 5V2l5 5L7 17",
  plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4",
  speaker: "M11 5 6 9H2v6h4l5 4V5zm4.5 3.5a5 5 0 0 1 0 7",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
};

function Round({
  on,
  onClick,
  label,
  children,
  onColor = "bg-blue-500",
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  onColor?: string;
}) {
  return (
    <button
      onClick={() => {
        playClick();
        onClick();
      }}
      aria-label={label}
      aria-pressed={on}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-white transition ${on ? onColor : "bg-white/20"}`}
    >
      {children}
    </button>
  );
}

/** Tall iOS slider — drag anywhere on the track. */
function TallSlider({
  value,
  min = 0,
  onChange,
  label,
  icon,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
  label: string;
  icon: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const fromEvent = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const raw = 1 - (clientY - r.top) / r.height;
    onChange(Math.min(1, Math.max(min, raw)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={min * 100}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="relative h-44 flex-1 touch-none overflow-hidden rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl [background-image:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        fromEvent(e.clientY);
      }}
      onPointerMove={(e) => e.buttons > 0 && fromEvent(e.clientY)}
    >
      <div className="absolute inset-x-0 bottom-0 bg-white" style={{ height: `${value * 100}%` }} />
      <span className={`absolute bottom-3 left-1/2 -translate-x-1/2 ${value > 0.12 ? "text-neutral-600" : "text-white"}`}>
        <Glyph d={icon} className="h-5 w-5" />
      </span>
    </div>
  );
}

/** Connectivity 2×2 + brightness/volume sliders — one Today-page row. */
export function ControlWidgets() {
  const [wifi, setWifi] = useState(true);
  const [bt, setBt] = useState(true);
  const [plane, setPlane] = useState(false);
  const [focus, setFocus] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [vol, setVol] = useState(1);
  const [bright, setBright] = useState(1);

  useEffect(() => {
    setMutedState(isMuted());
    setVol(getVolume());
    setBright(getBrightness());
    const subs = [subscribeMute(setMutedState), subscribeVolume(setVol), subscribeBrightness(setBright)];
    return () => subs.forEach((u) => u());
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`grid h-44 grid-cols-2 place-items-center gap-2 p-4 ${TILE}`}>
        <Round on={plane} onClick={() => setPlane((v) => !v)} label="Aeroplane mode" onColor="bg-orange-500">
          <Glyph d={G.plane} filled />
        </Round>
        <Round on={wifi && !plane} onClick={() => setWifi((v) => !v)} label="Wi-Fi">
          <Glyph d={G.wifi} />
        </Round>
        <Round on={bt && !plane} onClick={() => setBt((v) => !v)} label="Bluetooth">
          <Glyph d={G.bt} />
        </Round>
        <Round on={focus} onClick={() => setFocus((v) => !v)} label="Focus" onColor="bg-indigo-500">
          <Glyph d={G.moon} filled />
        </Round>
      </div>
      <div className="flex gap-3">
        <TallSlider value={bright} min={0.4} onChange={setBrightness} label="Brightness" icon={G.sun} />
        <TallSlider
          value={muted ? 0 : vol}
          onChange={(v) => {
            setVolume(v);
            setMuted(false);
          }}
          label="Volume"
          icon={G.speaker}
        />
      </div>
    </div>
  );
}
