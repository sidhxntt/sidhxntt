"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getVolume,
  isMuted,
  playClick,
  setMuted,
  setVolume,
  subscribeMute,
  subscribeVolume,
} from "@/lib/sounds";
import {
  next as playerNext,
  prev as playerPrev,
  toggle as playerToggle,
  usePlayerState,
} from "@/lib/music-player";
import { getBrightness, setBrightness, subscribeBrightness } from "@/lib/ui";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { GLASS_CLASS, GLASS_STYLE } from "@/lib/glass";
import { lockScreen } from "@/lib/power";
import { requestSettingsPane } from "@/lib/settings-nav";
import { useWindowManager } from "@/components/window/WindowManager";
import { APP_BY_ID } from "@/components/apps/registry";
import { SiriOrb, SiriPanel } from "@/components/desktop/SiriPanel";
import { NotificationCenter } from "@/components/NotificationCenter";
import { profile } from "@/data/portfolio";

export function AppleLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  // Hand-drawn apple-ish silhouette (not the Apple asset)
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.2 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.86-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.03-.01-2.6-1-2.7-3.9zM14.8 5.6c.7-.8 1.1-1.9 1-3.1-1 .04-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  // visitor's own timezone — real local date & time
  const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <span className="tabular-nums">
      {date} {time}
    </span>
  );
}

function ControlCenterGlyph({ className = "h-4 w-4" }: { className?: string }) {
  // macOS Control Center pills — two stacked toggle pills
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="6" rx="3" />
      <circle cx="7" cy="7.5" r="1.6" fill="currentColor" stroke="none" />
      <rect x="2.5" y="13.5" width="19" height="6" rx="3" />
      <circle cx="17" cy="16.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WifiGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function BluetoothGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m7 7 10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

function AirDropGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M5.6 5.6a9 9 0 0 1 12.8 0M5.6 18.4a9 9 0 0 0 12.8 0" />
    </svg>
  );
}

function MoonGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SpeakerGlyph({ muted, className = "h-4 w-4" }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m22 3-6 18" />
      ) : (
        <path d="M15 9.3a4 4 0 0 1 0 5.4M17.8 6.6a8 8 0 0 1 0 10.8" />
      )}
    </svg>
  );
}


function SunGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 6.5}
            y1={12 + Math.sin(a) * 6.5}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
          />
        );
      })}
    </svg>
  );
}

function AirplayGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M 5 16 a 8 8 0 1 1 14 0" />
      <path d="M 12 13 l 5 7 H 7 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Now Playing transport control — square hit target, glyph supplied as a path. */
function TransportButton({
  onClick,
  disabled,
  label,
  path,
  big = false,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  path: string;
  big?: boolean;
}) {
  return (
    <button
      onClick={() => {
        playClick();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full transition enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-default"
    >
      <svg viewBox="0 0 24 24" className={big ? "h-6 w-6" : "h-[18px] w-[18px]"} fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  );
}

function CameraGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M 3 7 V 5 a 2 2 0 0 1 2 -2 h 2 M 17 3 h 2 a 2 2 0 0 1 2 2 v 2 M 21 17 v 2 a 2 2 0 0 1 -2 2 h -2 M 7 21 H 5 a 2 2 0 0 1 -2 -2 v -2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M 9 9 h 1.5 l 1 -1.2 h 1 l 1 1.2 H 15" strokeWidth="0" />
    </svg>
  );
}

function ContrastGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 12 3 a 9 9 0 0 1 0 18 Z" fill="currentColor" />
    </svg>
  );
}

function ControlPill({
  on,
  onClick,
  icon,
  label,
  sublabel,
  badgeOn = "bg-white text-blue-500",
}: {
  on: boolean;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  sublabel: string;
  badgeOn?: string;
}) {
  const inner = (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${on ? badgeOn : "bg-white/20 text-white/70"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[13px] font-semibold leading-tight text-white">{label}</span>
        <span className="block text-[11px] leading-tight text-white/60">{sublabel}</span>
      </span>
    </>
  );
  const cls = `flex w-full items-center gap-2.5 rounded-full px-2.5 py-2 ${GLASS_CLASS}`;
  if (!onClick) {
    return (
      <div className={cls} style={GLASS_STYLE}>
        {inner}
      </div>
    );
  }
  return (
    <button onClick={onClick} className={`${cls} transition hover:brightness-125`} style={GLASS_STYLE}>
      {inner}
    </button>
  );
}

export function MenuBar({
  onRestart,
  onShutDown,
}: {
  onRestart: () => void;
  onShutDown: () => void;
}) {
  const { activeApp, openApp } = useWindowManager();
  const { current: nowPlaying, playing } = usePlayerState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [siriOpen, setSiriOpen] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [ncOpen, setNcOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [brightness, setBrightnessState] = useState(1);
  const [wifiOn, setWifiOn] = useState(true);
  const [btOn, setBtOn] = useState(true);
  const [focusOn, setFocusOn] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");
  const menuRef = useRef<HTMLDivElement>(null);
  const siriRef = useRef<HTMLDivElement>(null);
  const ccBtnRef = useRef<HTMLButtonElement>(null);
  const ccPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMutedState(isMuted());
    return subscribeMute(setMutedState);
  }, []);

  useEffect(() => {
    setVolumeState(getVolume());
    return subscribeVolume(setVolumeState);
  }, []);

  useEffect(() => {
    setBrightnessState(getBrightness());
    return subscribeBrightness(setBrightnessState);
  }, []);

  useEffect(() => {
    setThemeState(getTheme());
    return subscribeTheme(setThemeState);
  }, []);

  // keyboard users can dismiss any popover with Escape
  useEffect(() => {
    if (!menuOpen && !siriOpen && !ccOpen && !ncOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setSiriOpen(false);
      setCcOpen(false);
      setNcOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, siriOpen, ccOpen, ncOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!siriOpen) return;
    const close = (e: PointerEvent) => {
      if (!siriRef.current?.contains(e.target as Node)) setSiriOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [siriOpen]);

  useEffect(() => {
    if (!ccOpen) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ccBtnRef.current?.contains(t) && !ccPanelRef.current?.contains(t)) setCcOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [ccOpen]);

  // The appearance picker never outlives the panel it sits in
  useEffect(() => {
    if (!ccOpen) setAppearanceOpen(false);
  }, [ccOpen]);

  const appName = activeApp ? APP_BY_ID[activeApp].name : "Finder";

  return (
    <div className="absolute inset-x-0 top-0 z-[5000] flex h-7 items-center gap-4 px-4 text-[13px] font-medium text-white">
      {/*
        The bar's own frost lives in this layer, not on the bar element: an
        ancestor with backdrop-filter becomes a backdrop root, which would leave
        the popovers below (Control Center, menus) blurring nothing but the bar.
      */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black/25 backdrop-blur-2xl" aria-hidden />

      {/* Apple menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => {
            playClick();
            setMenuOpen((o) => !o);
          }}
          className={`-mx-2 rounded px-2 py-0.5 transition ${menuOpen ? "bg-white/20" : "hover:bg-white/10"}`}
          aria-label="Apple menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <AppleLogo />
        </button>
        {menuOpen && (
          <div className={`absolute left-0 top-8 w-56 rounded-xl p-1 ${GLASS_CLASS}`} style={GLASS_STYLE}>
            {[
              {
                // macOS opens the machine-info panel here, not a document —
                // that's System Settings › General.
                label: `About ${profile.name.split(" ")[0]}'s Mac`,
                action: () => {
                  requestSettingsPane("general");
                  openApp("settings");
                },
              },
              { label: "Lock Screen", action: lockScreen, rule: true },
              { label: "Restart…", action: onRestart },
              { label: "Shut Down…", action: onShutDown },
            ].map((item) => (
              <div key={item.label}>
                {item.rule && <div className="my-1 h-px bg-white/10" aria-hidden />}
                <button
                  onClick={() => {
                    playClick();
                    setMenuOpen(false);
                    item.action();
                  }}
                  className="block w-full rounded-md px-3 py-1 text-left text-[13px] hover:bg-(--accent)"
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <span className="font-bold">{appName}</span>
      <span className="hidden text-white/80 sm:inline">File</span>
      <span className="hidden text-white/80 sm:inline">Edit</span>
      <span className="hidden text-white/80 sm:inline">View</span>
      <span className="hidden text-white/80 sm:inline">Help</span>

      <div className="ml-auto flex items-center gap-4">
        {/* Spotlight */}
        <button
          onClick={() => {
            playClick();
            window.dispatchEvent(new CustomEvent("portfolio-spotlight"));
          }}
          className="rounded px-1 py-0.5 transition hover:bg-white/10"
          aria-label="Spotlight search"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M 15.5 15.5 L 20.5 20.5" />
          </svg>
        </button>
        {/* Siri */}
        <div ref={siriRef} className="relative">
          <button
            onClick={() => {
              playClick();
              setSiriOpen((o) => !o);
            }}
            className={`rounded px-1 py-0.5 transition ${siriOpen ? "bg-white/20" : "hover:bg-white/10"}`}
            aria-label="Siri"
            aria-haspopup="dialog"
            aria-expanded={siriOpen}
          >
            <SiriOrb />
          </button>
          {siriOpen && (
            <div className="absolute right-0 top-8">
              <SiriPanel onClose={() => setSiriOpen(false)} />
            </div>
          )}
        </div>

        {/* Control Center */}
        <button
          ref={ccBtnRef}
          onClick={() => {
            playClick();
            setCcOpen((o) => !o);
          }}
          className={`rounded px-1 py-0.5 transition ${ccOpen ? "bg-white/20" : "hover:bg-white/10"}`}
          aria-label="Control Center"
          aria-haspopup="dialog"
          aria-expanded={ccOpen}
        >
          <ControlCenterGlyph />
        </button>

        {/* Wifi glyph */}
        <WifiGlyph />
        {/* Battery glyph */}
        <div className="flex items-center gap-0.5" aria-label="Battery full">
          <div className="flex h-3 w-6 items-center rounded-sm border border-white/70 p-px">
            <div className="h-full w-full rounded-[1px] bg-white" />
          </div>
          <div className="h-1.5 w-0.5 rounded-r-sm bg-white/70" />
        </div>
        {/* The clock is the handle for Notification Center, as on a real Mac */}
        <button
          onClick={() => {
            playClick();
            setCcOpen(false);
            setNcOpen((o) => !o);
          }}
          className={`-mx-1 rounded px-1 py-0.5 transition ${ncOpen ? "bg-white/20" : "hover:bg-white/10"}`}
          aria-label="Notification Center"
          aria-haspopup="dialog"
          aria-expanded={ncOpen}
        >
          <Clock />
        </button>
      </div>

      <NotificationCenter open={ncOpen} onClose={() => setNcOpen(false)} />

      {/* Control Center — floating glass islands, no panel background */}
      {ccOpen && (
        <div ref={ccPanelRef} className="absolute right-2 top-8 flex w-[340px] flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Connectivity pills */}
            <div className="flex flex-col gap-2.5">
              <ControlPill
                on={wifiOn}
                onClick={() => {
                  playClick();
                  setWifiOn((o) => !o);
                }}
                icon={<WifiGlyph className="h-4 w-4" />}
                label="Wi-Fi"
                sublabel={wifiOn ? "Home" : "Off"}
              />
              <ControlPill
                on={btOn}
                onClick={() => {
                  playClick();
                  setBtOn((o) => !o);
                }}
                icon={<BluetoothGlyph className="h-4 w-4" />}
                label="Bluetooth"
                sublabel={btOn ? "On" : "Off"}
              />
              <ControlPill
                on
                icon={<AirDropGlyph className="h-4 w-4" />}
                label="AirDrop"
                sublabel="Everyone"
              />
            </div>

            {/* Now Playing */}
            <div
              className={`flex flex-col justify-between gap-2 rounded-3xl p-3 ${GLASS_CLASS}`}
              style={GLASS_STYLE}
            >
              {nowPlaying ? (
                <button
                  onClick={() => {
                    playClick();
                    setCcOpen(false);
                    openApp("music");
                  }}
                  aria-label={`Open Music — ${nowPlaying.name}`}
                  className="flex min-w-0 items-center gap-2.5 text-left transition hover:brightness-125"
                >
                  {nowPlaying.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nowPlaying.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-lg bg-white/20" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold leading-tight text-white">
                      {nowPlaying.name}
                    </span>
                    <span className="block truncate text-[11px] leading-tight text-white/60">
                      {nowPlaying.artists}
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-white/20" />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">Not Playing</p>
                </div>
              )}
              <div
                className={`flex items-center justify-between px-1 ${nowPlaying ? "text-white/80" : "text-white/40"}`}
              >
                <TransportButton
                  onClick={playerPrev}
                  disabled={!nowPlaying}
                  label="Previous track"
                  path="M 20 6 v 12 l -8 -6 Z M 11 6 v 12 l -8 -6 Z"
                />
                <TransportButton
                  onClick={playerToggle}
                  disabled={!nowPlaying}
                  label={playing ? "Pause" : "Play"}
                  big
                  path={playing ? "M 7 5 h 3.5 v 14 H 7 Z M 13.5 5 H 17 v 14 h -3.5 Z" : "M 7 5 l 12 7 -12 7 Z"}
                />
                <TransportButton
                  onClick={playerNext}
                  disabled={!nowPlaying}
                  label="Next track"
                  path="M 4 6 v 12 l 8 -6 Z M 13 6 v 12 l 8 -6 Z"
                />
              </div>
            </div>
          </div>

          {/* Appearance picker · screenshot · Focus */}
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  playClick();
                  setAppearanceOpen((o) => !o);
                }}
                aria-label="Appearance"
                aria-expanded={appearanceOpen}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition hover:brightness-110 ${
                  theme === "dark" ? GLASS_CLASS : "border border-white/40"
                }`}
                style={theme === "dark" ? GLASS_STYLE : { backgroundColor: "#ffffff" }}
              >
                <ContrastGlyph className={`h-6 w-6 ${theme === "dark" ? "text-white" : "text-black"}`} />
              </button>
              {appearanceOpen && (
                <div
                  className={`absolute left-0 top-14 z-10 w-52 rounded-2xl p-2 ${GLASS_CLASS}`}
                  style={GLASS_STYLE}
                >
                  <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    Appearance
                  </p>
                  <div className="flex gap-2">
                    {(["light", "dark"] as Theme[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          playClick();
                          setTheme(t);
                          setAppearanceOpen(false);
                        }}
                        aria-label={`${t} appearance`}
                        aria-pressed={theme === t}
                        className={`flex-1 rounded-xl p-1.5 text-center transition hover:bg-white/10 ${
                          theme === t ? "ring-2 ring-(--accent)" : "ring-1 ring-white/15"
                        }`}
                      >
                        {/* Mini desktop preview */}
                        <span
                          className={`mb-1.5 block h-11 w-full overflow-hidden rounded-lg border ${
                            t === "dark" ? "border-white/15 bg-neutral-900" : "border-black/10 bg-neutral-100"
                          }`}
                        >
                          <span className={`block h-2 w-full ${t === "dark" ? "bg-white/15" : "bg-black/10"}`} />
                          <span
                            className={`mx-auto mt-2 block h-5 w-3/4 rounded ${
                              t === "dark" ? "bg-white/20" : "bg-white shadow-sm"
                            }`}
                          />
                        </span>
                        <span className="block text-[12px] font-medium capitalize text-white">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => playClick()}
              aria-label="Screenshot"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/85 transition hover:brightness-125 ${GLASS_CLASS}`}
              style={GLASS_STYLE}
            >
              <CameraGlyph />
            </button>
            <div className="flex-1">
              <ControlPill
                on={focusOn}
                onClick={() => {
                  playClick();
                  setFocusOn((o) => !o);
                }}
                icon={<MoonGlyph className="h-4 w-4" />}
                label="Focus"
                sublabel={focusOn ? "On" : "Off"}
                badgeOn="bg-indigo-400 text-white"
              />
            </div>
          </div>

          {/* Display */}
          <div className={`rounded-[26px] px-4 py-3 ${GLASS_CLASS}`} style={GLASS_STYLE}>
            <p className="mb-1.5 text-[14px] font-semibold text-white">Display</p>
            <div className="flex items-center gap-2 text-white/80">
              <SunGlyph className="h-3 w-3" />
              <input
                type="range"
                min={40}
                max={100}
                value={Math.round(brightness * 100)}
                onChange={(e) => setBrightness(Number(e.target.value) / 100)}
                className="w-full accent-white"
                aria-label="Display brightness"
              />
              <SunGlyph className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Sound */}
          <div className={`rounded-[26px] px-4 py-3 ${GLASS_CLASS}`} style={GLASS_STYLE}>
            <p className="mb-1.5 text-[14px] font-semibold text-white">Sound</p>
            <div className="flex items-center gap-2 text-white/80">
              <button
                onClick={() => {
                  setMuted(!muted);
                  playClick();
                }}
                aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                className="rounded p-0.5 transition hover:bg-white/10"
              >
                <SpeakerGlyph muted={muted} className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-full accent-white"
                aria-label="Sound volume"
              />
              <button
                onClick={() => playClick()}
                aria-label="AirPlay"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
              >
                <AirplayGlyph className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                playClick();
                setCcOpen(false);
                openApp("settings");
              }}
              className={`rounded-full px-3 py-1 text-[12px] text-white/80 transition hover:brightness-125 ${GLASS_CLASS}`}
              style={GLASS_STYLE}
            >
              Edit Controls
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
