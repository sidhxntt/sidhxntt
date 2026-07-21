"use client";

import { useEffect, useState } from "react";
import { profile } from "@/data/portfolio";
import {
  getStartupChime,
  getUiSounds,
  getVolume,
  isMuted,
  playChime,
  playClick,
  setMuted,
  setStartupChime,
  setUiSounds,
  setVolume,
  subscribeMute,
  subscribeStartupChime,
  subscribeUiSounds,
  subscribeVolume,
} from "@/lib/sounds";
import { Avatar } from "@/components/Avatar";
import {
  DEFAULT_WALLPAPER,
  getWallpaper,
  setWallpaper,
  subscribeWallpaper,
  WALLPAPERS,
  type WallpaperId,
} from "@/lib/wallpaper";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { ACCENTS, getAccent, setAccent, subscribeAccent, type AccentId } from "@/lib/accent";
import { getBrightness, setBrightness, subscribeBrightness } from "@/lib/ui";
import {
  getDockSettings,
  setDockAutoHide,
  setDockMagnification,
  setDockSize,
  subscribeDock,
} from "@/lib/dock";
import { WallpaperArt } from "@/components/desktop/Wallpaper";
import { consumePendingSettingsPane, subscribeSettingsNav } from "@/lib/settings-nav";
import { useIsMobile } from "@/lib/useIsMobile";
import { lockScreen, restart, shutDown } from "@/lib/power";
import { StorageView } from "@/components/apps/MyFolder";
import { APP_META } from "@/components/apps/app-meta";
import { AppIcon } from "@/components/AppIcon";
import { useWindowManager } from "@/components/window/WindowManager";

// ≥768px: System-Settings-style window — sidebar of panes, detail panel on the right.
// <768px: iOS-Settings-style — root list of grouped rows, panes push full-screen.

type Pane = "general" | "appearance" | "wallpaper" | "display" | "dock" | "sound";

const PANES: { id: Pane; label: string; chip: string; glyph: string }[] = [
  { id: "general", label: "General", chip: "bg-neutral-500", glyph: "⚙︎" },
  { id: "appearance", label: "Appearance", chip: "bg-indigo-500", glyph: "◐" },
  { id: "wallpaper", label: "Wallpaper", chip: "bg-cyan-500", glyph: "🖼" },
  { id: "display", label: "Display", chip: "bg-blue-500", glyph: "☀︎" },
  { id: "dock", label: "Dock", chip: "bg-violet-500", glyph: "▭" },
  { id: "sound", label: "Sound", chip: "bg-pink-500", glyph: "🔊" },
];

// iOS-style grouped sections for the mobile root list.
// iOS-relevant panes only — Dock is a macOS concept, hidden on phones.
// "applications" and "storage" are mobile-only rows (moved here from Finder).
type MobilePane = Pane | "applications" | "storage";
const MOBILE_GROUPS: MobilePane[][] = [
  ["general"],
  ["appearance", "wallpaper", "display"],
  ["sound"],
  ["applications", "storage"],
];
const MOBILE_EXTRAS: { id: MobilePane; label: string; chip: string; glyph: string }[] = [
  { id: "applications", label: "Applications", chip: "bg-blue-500", glyph: "⊞" },
  { id: "storage", label: "Storage", chip: "bg-emerald-500", glyph: "◔" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => {
        playClick();
        onChange(!on);
      }}
      className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-(--accent)" : "bg-black/20 dark:bg-white/20"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-2.5 max-md:min-h-11 dark:bg-neutral-700/60">
      <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
      {children}
    </div>
  );
}

function AppearancePane() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [accent, setAccentState] = useState<AccentId>("blue");
  useEffect(() => {
    setThemeState(getTheme());
    setAccentState(getAccent());
    const a = subscribeTheme(setThemeState);
    const b = subscribeAccent(setAccentState);
    return () => {
      a();
      b();
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-white/70 px-4 py-3 dark:bg-neutral-700/60">
        <p className="mb-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-200">Appearance</p>
        <div className="flex gap-3">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                playClick();
                setTheme(t);
              }}
              className="text-left"
            >
              <div
                className={`h-14 w-24 overflow-hidden rounded-lg ring-2 transition ${
                  theme === t ? "ring-(--accent)" : "ring-black/10 dark:ring-white/15"
                }`}
              >
                {/* tiny mock window preview */}
                <div className={`h-full w-full p-2 ${t === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`}>
                  <div className={`h-full w-full rounded-md ${t === "dark" ? "bg-neutral-600" : "bg-white"} shadow`}>
                    <div className="flex gap-0.5 p-1">
                      <span className="h-1 w-1 rounded-full bg-red-400" />
                      <span className="h-1 w-1 rounded-full bg-yellow-400" />
                      <span className="h-1 w-1 rounded-full bg-green-400" />
                    </div>
                  </div>
                </div>
              </div>
              <p
                className={`mt-1 text-center text-[12px] font-medium capitalize ${
                  theme === t ? "text-neutral-800 dark:text-white" : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {t}
              </p>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-white/70 px-4 py-3 dark:bg-neutral-700/60">
        <p className="mb-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-200">Accent color</p>
        <div className="flex items-center gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                playClick();
                setAccent(a.id);
              }}
              aria-label={`${a.name} accent`}
              title={a.name}
              className={`h-5 w-5 rounded-full transition ${
                accent === a.id ? "ring-2 ring-neutral-500 ring-offset-2 dark:ring-white" : "hover:scale-110"
              }`}
              style={{ backgroundColor: a.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DisplayPane() {
  const [brightness, setBrightnessState] = useState(1);
  useEffect(() => {
    setBrightnessState(getBrightness());
    return subscribeBrightness(setBrightnessState);
  }, []);

  return (
    <div className="space-y-2">
      <Row label="Brightness">
        <input
          type="range"
          min={40}
          max={100}
          value={Math.round(brightness * 100)}
          onChange={(e) => setBrightness(Number(e.target.value) / 100)}
          className="w-40 accent-(--accent)"
          aria-label="Display brightness"
        />
      </Row>
    </div>
  );
}

function DockPane() {
  const [dock, setDock] = useState(getDockSettings());
  useEffect(() => subscribeDock(setDock), []);

  return (
    <div className="space-y-2">
      <Row label="Icon size">
        <input
          type="range"
          min={40}
          max={64}
          value={dock.size}
          onChange={(e) => setDockSize(Number(e.target.value))}
          className="w-40 accent-(--accent)"
          aria-label="Dock icon size"
        />
      </Row>
      <Row label="Magnification">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(dock.magnification * 100)}
          onChange={(e) => setDockMagnification(Number(e.target.value) / 100)}
          className="w-40 accent-(--accent)"
          aria-label="Dock magnification"
        />
      </Row>
      <Row label="Automatically hide Dock">
        <Toggle on={dock.autoHide} onChange={setDockAutoHide} />
      </Row>
    </div>
  );
}

function SoundPane() {
  const [muted, setMutedState] = useState(false);
  const [vol, setVol] = useState(1);
  const [ui, setUi] = useState(true);
  const [chime, setChime] = useState(true);
  useEffect(() => {
    setMutedState(isMuted());
    setVol(getVolume());
    setUi(getUiSounds());
    setChime(getStartupChime());
    const subs = [subscribeMute(setMutedState), subscribeVolume(setVol), subscribeUiSounds(setUi), subscribeStartupChime(setChime)];
    return () => subs.forEach((u) => u());
  }, []);

  return (
    <div className="space-y-2">
      <Row label="Mute all sounds">
        <Toggle on={muted} onChange={setMuted} />
      </Row>
      <Row label="Output volume">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(vol * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="w-40 accent-(--accent)"
          aria-label="Output volume"
        />
      </Row>
      <Row label="UI sound effects">
        <Toggle on={ui} onChange={setUiSounds} />
      </Row>
      <Row label="Play chime on startup">
        <Toggle on={chime} onChange={setStartupChime} />
      </Row>
      <Row label="Startup chime">
        <button
          onClick={() => playChime()}
          className="rounded-md bg-black/[0.07] px-3 py-1 text-[13px] font-medium text-neutral-700 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15"
        >
          Play
        </button>
      </Row>
    </div>
  );
}

function WallpaperPane() {
  const [current, setCurrent] = useState<WallpaperId>(DEFAULT_WALLPAPER);
  useEffect(() => {
    setCurrent(getWallpaper());
    return subscribeWallpaper(setCurrent);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      {WALLPAPERS.map((w) => (
        <button
          key={w.id}
          onClick={() => {
            playClick();
            setWallpaper(w.id);
          }}
          className="group text-left"
        >
          <div
            className={`relative h-24 overflow-hidden rounded-xl ring-2 transition ${
              current === w.id ? "ring-(--accent)" : "ring-transparent group-hover:ring-black/15 dark:group-hover:ring-white/25"
            }`}
          >
            <WallpaperArt id={w.id} preview />
          </div>
          <p
            className={`mt-1 text-[12px] font-medium ${
              current === w.id ? "text-neutral-800 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {w.name}
          </p>
        </button>
      ))}
    </div>
  );
}

/**
 * The serial number is a standing job application. Keep the joke, drop the
 * hardcoded year — it always reads as *this* year, so the machine never looks
 * like it shipped a while ago and stopped looking. The year is read on mount
 * rather than during render so the prerendered HTML can't disagree.
 */
function SerialNumber() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return (
    <span className="text-[13px] tabular-nums text-neutral-500 dark:text-neutral-400">
      {year === null ? "H1REME" : `H1REME-${year}`}
    </span>
  );
}

function GeneralPane() {
  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center gap-1 rounded-lg bg-white/70 px-4 py-5 dark:bg-neutral-700/60">
        <Avatar size={56} className="text-lg" />
        <p className="mt-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{profile.name}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{profile.role}</p>
      </div>
      <Row label="Operating System">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400">Portfolio OS 1.0</span>
      </Row>
      <Row label="Chip">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400">Fable Silicon (10-core imagination)</span>
      </Row>
      <Row label="Memory">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400">∞ GB unified dreams</span>
      </Row>
      <Row label="Serial Number">
        <SerialNumber />
      </Row>
    </div>
  );
}

function PaneContent({ pane }: { pane: Pane }) {
  return (
    <>
      {pane === "general" && <GeneralPane />}
      {pane === "appearance" && <AppearancePane />}
      {pane === "wallpaper" && <WallpaperPane />}
      {pane === "display" && <DisplayPane />}
      {pane === "dock" && <DockPane />}
      {pane === "sound" && <SoundPane />}
    </>
  );
}

/** Installed-apps list for the mobile Settings "Applications" row. */
function MobileApplications() {
  const { openApp } = useWindowManager();
  return (
    <div className="overflow-hidden rounded-xl bg-white divide-y divide-black/[0.06] dark:bg-neutral-800 dark:divide-white/10">
      {APP_META.filter((a) => a.id !== "myfolder").map((a) => (
        <button
          key={a.id}
          onClick={() => {
            playClick();
            openApp(a.id);
          }}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-black/[0.06] dark:active:bg-white/[0.08]"
        >
          <AppIcon id={a.id} size={32} />
          <span className="flex-1 text-[16px] text-neutral-900 dark:text-neutral-100">{a.name}</span>
          <span aria-hidden className="text-[17px] font-semibold text-neutral-400/80 dark:text-neutral-500">›</span>
        </button>
      ))}
    </div>
  );
}

/** iOS-style row in the mobile root list: colored icon chip + label + chevron. */
function MobileRow({ pane, onOpen }: { pane: { id: MobilePane; label: string; chip: string; glyph: string }; onOpen: (p: MobilePane) => void }) {
  return (
    <button
      onClick={() => {
        playClick();
        onOpen(pane.id);
      }}
      className="flex min-h-11 w-full items-center gap-3 px-4 text-left active:bg-black/[0.06] dark:active:bg-white/[0.08]"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[13px] text-white ${pane.chip}`}>
        {pane.glyph}
      </span>
      <span className="flex-1 text-[16px] text-neutral-900 dark:text-neutral-100">{pane.label}</span>
      <span aria-hidden className="text-[17px] font-semibold text-neutral-400/80 dark:text-neutral-500">
        ›
      </span>
    </button>
  );
}

export function SettingsApp() {
  const isMobile = useIsMobile();
  const [pane, setPane] = useState<Pane>("general");
  // Mobile navigation stack: null = root "Settings" list, otherwise the pushed pane.
  const [mobilePane, setMobilePane] = useState<MobilePane | null>(null);

  // outside callers (menu bar, other apps) can deep-link straight to a pane
  useEffect(() => {
    const isPane = (p: string): p is Pane => PANES.some((x) => x.id === p);
    const pending = consumePendingSettingsPane();
    if (pending && isPane(pending)) {
      setPane(pending);
      setMobilePane(pending); // land directly on the pane, root list behind Back
    }
    return subscribeSettingsNav((p) => {
      if (isPane(p)) {
        setPane(p);
        setMobilePane(p);
      }
    });
  }, []);

  if (isMobile) {
    // deep-links to the macOS-only Dock pane land on the root list instead
    const active =
      mobilePane && mobilePane !== "dock"
        ? (PANES.find((p) => p.id === mobilePane) ?? MOBILE_EXTRAS.find((p) => p.id === mobilePane))
        : undefined;
    const openPane = (p: MobilePane) => {
      if (PANES.some((x) => x.id === p)) setPane(p as Pane); // keep desktop selection in sync
      setMobilePane(p);
    };

    if (active) {
      return (
        <div className="flex h-full flex-col bg-neutral-100 dark:bg-neutral-950">
          {/* Top bar with back button */}
          <div className="relative flex min-h-12 shrink-0 items-center border-b border-black/10 bg-neutral-100/90 px-1 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90">
            <button
              onClick={() => {
                playClick();
                setMobilePane(null);
              }}
              className="flex min-h-11 items-center gap-1 px-2 text-[17px] text-(--accent)"
            >
              <span aria-hidden className="text-[24px] leading-none">
                ‹
              </span>
              Settings
            </button>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-neutral-900 dark:text-neutral-100">
              {active.label}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {active.id === "applications" ? (
              <MobileApplications />
            ) : active.id === "storage" ? (
              <div className="-m-4 h-full">
                <StorageView />
              </div>
            ) : (
              <PaneContent pane={active.id as Pane} />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto bg-neutral-100 px-4 pb-8 dark:bg-neutral-950">
        <h1 className="pb-3 pt-4 text-[34px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Settings
        </h1>
        {/* Profile card, like the Apple ID card in iOS Settings */}
        <button
          onClick={() => {
            playClick();
            openPane("general");
          }}
          className="mb-6 flex min-h-11 w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left active:bg-black/[0.06] dark:bg-neutral-800 dark:active:bg-white/[0.08]"
        >
          <Avatar size={48} className="text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-medium text-neutral-900 dark:text-neutral-100">{profile.name}</p>
            <p className="truncate text-[13px] text-neutral-500 dark:text-neutral-400">{profile.role}</p>
          </div>
          <span aria-hidden className="text-[17px] font-semibold text-neutral-400/80 dark:text-neutral-500">
            ›
          </span>
        </button>
        {MOBILE_GROUPS.map((group) => (
          <div
            key={group.join("-")}
            className="mb-6 overflow-hidden rounded-xl bg-white divide-y divide-black/[0.06] dark:bg-neutral-800 dark:divide-white/10"
          >
            {group.map((id) => {
              const p = PANES.find((x) => x.id === id) ?? MOBILE_EXTRAS.find((x) => x.id === id);
              return p ? <MobileRow key={p.id} pane={p} onOpen={openPane} /> : null;
            })}
          </div>
        ))}

        {/* Phones have no Apple menu, so the power actions live here */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white divide-y divide-black/[0.06] dark:bg-neutral-800 dark:divide-white/10">
          {[
            { label: "Lock Screen", action: lockScreen, danger: false },
            { label: "Restart", action: restart, danger: false },
            { label: "Shut Down", action: shutDown, danger: true },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                playClick();
                item.action();
              }}
              className={`flex min-h-11 w-full items-center justify-center px-4 py-3 text-[17px] active:bg-black/[0.06] dark:active:bg-white/[0.08] ${
                item.danger ? "text-red-500" : "text-(--accent)"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-44 shrink-0 space-y-0.5 border-r border-black/5 bg-white/30 px-2 py-3 dark:border-white/10 dark:bg-neutral-900/40">
        <div className="mb-3 flex items-center gap-2 px-2">
          <Avatar size={36} className="text-xs" />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">{profile.name}</p>
            <p className="truncate text-[10px] text-neutral-400">Portfolio Account</p>
          </div>
        </div>
        {PANES.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              playClick();
              setPane(p.id);
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium ${
              pane === p.id
                ? "bg-(--accent) text-white"
                : "text-neutral-600 hover:bg-black/[0.05] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-[6px] text-[11px] text-white ${p.chip}`}
            >
              {p.glyph}
            </span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="min-w-0 flex-1 overflow-auto bg-neutral-100/60 p-4 dark:bg-neutral-800/60">
        <h1 className="mb-3 text-center text-base font-bold text-neutral-800 dark:text-neutral-100">
          {PANES.find((p) => p.id === pane)?.label}
        </h1>
        <PaneContent pane={pane} />
      </div>
    </div>
  );
}
