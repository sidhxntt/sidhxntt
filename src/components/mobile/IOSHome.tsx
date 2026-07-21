"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AppIcon, type AppId, type LinkAppId } from "@/components/AppIcon";
import { linkApps, pictures } from "@/data/portfolio";
import { openExternal } from "@/lib/browser";
import { APPS, APP_BY_ID } from "@/components/apps/registry";
import { Wallpaper } from "@/components/desktop/Wallpaper";
import type { Coords } from "@/components/desktop/Widgets";
import { useWindowManager, WindowManagerProvider } from "@/components/window/WindowManager";
import { playClick, playOpen, playClose } from "@/lib/sounds";
import { usePlayerState, toggle as playerToggle } from "@/lib/music-player";
import { describeWeather, fetchWeather, type WeatherData } from "@/lib/weather";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { requestFinderLocation } from "@/lib/finder-nav";
import { SiriOrb, SiriPanel } from "@/components/desktop/SiriPanel";
import { ControlWidgets } from "@/components/mobile/ControlCenter";
import { getAccentColor, subscribeAccent } from "@/lib/accent";
import { getBrightness, subscribeBrightness } from "@/lib/ui";
import { NotificationBanner } from "@/components/NotificationBanner";
import { NotificationCenter } from "@/components/NotificationCenter";

// iOS springboard: three swipeable pages — Today widgets ← Home → App Library —
// with the dock riding on the Home page, exactly like a real iPhone.

/**
 * @param onChrome true when the bar sits on an app's own background (which is
 *   light in light mode, near-black in dark mode) rather than on the wallpaper,
 *   where white always reads.
 */
function StatusBar({
  onChrome = false,
  onSiri,
  onClock,
}: {
  onChrome?: boolean;
  onSiri?: () => void;
  onClock?: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const color = onChrome ? "text-neutral-900 dark:text-neutral-100" : "text-white";
  return (
    <div className={`flex items-center justify-between px-6 pt-3 text-sm font-semibold ${color}`}>
      {/* Tapping the time pulls down Notification Center, like a swipe-down */}
      <button
        onClick={onClock}
        disabled={!onClock}
        aria-label={onClock ? "Notification Center" : undefined}
        className="-m-1 p-1 tabular-nums active:opacity-70 disabled:active:opacity-100"
      >
        {now?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) ?? ""}
      </button>
      <div className="flex items-center gap-1.5">
        {onSiri && (
          <button onClick={onSiri} aria-label="Siri" className="-my-1 mr-0.5 p-1 active:opacity-70">
            <SiriOrb className="h-4 w-4" />
          </button>
        )}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" />
        </svg>
        <div className="flex h-3 w-6 items-center rounded-sm border border-current p-px">
          <div className="h-full w-4/5 rounded-[1px] bg-current" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Today (widgets) page ---------- */

function CalendarCard({ onOpen }: { onOpen: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="h-40 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl [background-image:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />;
  return (
    <button onClick={onOpen} className="flex h-40 flex-col rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl [background-image:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))] p-4 text-left active:opacity-80">
      <span className="text-xs font-bold uppercase tracking-wide text-red-400">
        {now.toLocaleDateString(undefined, { weekday: "long" })}
      </span>
      <span className="text-4xl font-semibold text-white">{now.getDate()}</span>
      <span className="mt-auto text-[13px] text-white/60">
        {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </span>
      <span className="text-[12px] text-white/40">No events today</span>
    </button>
  );
}

function WeatherCard({ coords, onOpen }: { coords: Coords; onOpen: () => void }) {
  const [w, setW] = useState<WeatherData | null>(null);
  useEffect(() => {
    let alive = true;
    fetchWeather(coords).then((d) => alive && setW(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [coords]);
  return (
    <button onClick={onOpen} className="flex h-40 flex-col rounded-3xl bg-gradient-to-br from-sky-600/70 to-indigo-800/70 p-4 text-left backdrop-blur-xl active:opacity-80">
      {w ? (
        <>
          <span className="truncate text-[15px] font-semibold text-white">{w.city}</span>
          <span className="text-4xl font-light text-white">{w.temp}°</span>
          <span className="mt-auto text-xl">{describeWeather(w.code).icon}</span>
          <span className="text-[13px] text-white/85">{describeWeather(w.code).label}</span>
          <span className="text-[12px] text-white/60">H:{w.high}° L:{w.low}°</span>
        </>
      ) : (
        <span className="m-auto text-sm text-white/60">Loading…</span>
      )}
    </button>
  );
}

function NowPlayingCard({ onOpen }: { onOpen: () => void }) {
  const { current, playing } = usePlayerState();
  return (
    <div className="flex h-24 items-center gap-3 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl [background-image:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))] p-4">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-80">
        <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-800 ${current?.image ? "" : "flex items-center justify-center text-2xl"}`}>
          {current?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.image} alt="" className="h-full w-full object-cover" />
          ) : (
            "🎵"
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{current?.name ?? "Music"}</p>
          <p className="truncate text-[12px] text-white/60">{current?.artists ?? "Nothing playing"}</p>
        </div>
      </button>
      {current && (
        <button
          onClick={() => {
            playClick();
            playerToggle();
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
        >
          {/* SVG, not a Unicode glyph — iOS renders U+23F8/U+25B6 with emoji presentation */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path
              d={
                playing
                  ? "M7 4h3.5v16H7V4zm6.5 0H17v16h-3.5V4z"
                  : "M8 5.14v13.72a.5.5 0 0 0 .76.43l11.2-6.86a.5.5 0 0 0 0-.86L8.76 4.71a.5.5 0 0 0-.76.43z"
              }
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// Same rotation as the desktop Photos widget — stills only, so the card never
// pulls a movie file just to sit on the Today page.
const widgetPhotos = pictures.filter((p) => p.kind === "photo");

function PhotosCard({ onOpen }: { onOpen: () => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % widgetPhotos.length), 4000);
    return () => clearInterval(t);
  }, []);
  const pic = widgetPhotos[index];

  return (
    <button onClick={onOpen} className="relative block h-44 w-full overflow-hidden rounded-3xl text-left active:opacity-90">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={pic.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <Image src={pic.src} alt={pic.caption} fill sizes="100vw" className="object-cover" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <span className="absolute bottom-3 left-4 text-[15px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
        {pic.caption}
      </span>
    </button>
  );
}

function TodayPage({ coords, open }: { coords: Coords; open: (id: AppId) => void }) {
  return (
    <div className="h-full overflow-y-auto px-4 pb-14 pt-4">
      <ControlWidgets />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <CalendarCard onOpen={() => open("calendar")} />
        <WeatherCard coords={coords} onOpen={() => open("weather")} />
      </div>
      <div className="mt-3">
        <NowPlayingCard onOpen={() => open("music")} />
      </div>
      <div className="mt-3">
        <PhotosCard onOpen={() => open("pictures")} />
      </div>
    </div>
  );
}

/* ---------- App Library page ---------- */

const LIBRARY: { title: string; ids: AppId[] }[] = [
  { title: "Portfolio", ids: ["about", "myfolder", "contact"] },
  { title: "Media", ids: ["music", "pictures", "photobooth", "safari"] },
  { title: "Life", ids: ["calendar", "weather", "messages"] },
  { title: "Utilities", ids: ["settings", "terminal", "activity", "code"] },
  { title: "Games", ids: ["game-snake", "game-pacman", "game-2048", "game-mines"] },
  { title: "More Games", ids: ["game-breakout", "game-dino", "game-vault", "game-quest"] },
];

function LibraryPage({ open }: { open: (id: AppId) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  // Search spans real apps and link-only ones; each row keeps its own action.
  const matches = useMemo(() => {
    if (!query) return null;
    const apps = APPS.filter((a) => a.name.toLowerCase().includes(query)).map((a) => ({
      id: a.id as AppId | LinkAppId,
      name: a.name,
      onOpen: () => open(a.id),
    }));
    const links = linkApps
      .filter((a) => a.name.toLowerCase().includes(query))
      .map((a) => ({
        id: a.id as AppId | LinkAppId,
        name: a.name,
        onOpen: () => {
          playClick();
          openExternal(a.url);
        },
      }));
    return [...apps, ...links];
  }, [query, open]);

  return (
    <div className="h-full overflow-y-auto px-4 pb-14 pt-4">
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-black/40 px-4 py-2.5 backdrop-blur-xl">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M 15.5 15.5 L 20.5 20.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="App Library"
          aria-label="Search apps"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder:text-white/50 outline-none"
        />
      </div>

      {matches ? (
        <div className="space-y-1">
          {matches.map((a) => (
            <button
              key={a.id}
              onClick={a.onOpen}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left active:bg-white/10"
            >
              <AppIcon id={a.id} size={40} />
              <span className="text-[15px] font-medium text-white">{a.name}</span>
            </button>
          ))}
          {matches.length === 0 && <p className="pt-8 text-center text-sm text-white/50">No apps found</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {LIBRARY.map((group) => (
            <div key={group.title}>
              <div className="grid aspect-square grid-cols-2 place-content-center gap-2.5 rounded-[26px] bg-white/15 p-3 backdrop-blur-xl">
                {group.ids.slice(0, 4).map((id) => (
                  <button key={id} onClick={() => open(id)} className="flex items-center justify-center active:opacity-70" aria-label={`Open ${APP_BY_ID[id].name}`}>
                    <AppIcon id={id} size={64} />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-center text-[13px] font-medium text-white/90">{group.title}</p>
            </div>
          ))}
          <div>
            <div className="grid aspect-square grid-cols-2 place-content-center gap-2.5 rounded-[26px] bg-white/15 p-3 backdrop-blur-xl">
              {linkApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    playClick();
                    openExternal(app.url);
                  }}
                  className="flex items-center justify-center active:opacity-70"
                  aria-label={`Open ${app.name}`}
                >
                  <AppIcon id={app.id} size={64} />
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-center text-[13px] font-medium text-white/90">Writing</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Home page ---------- */

// dock + library-only apps stay off the home grid
const HOME_HIDDEN = new Set<AppId>(["projects", "resume", "contact", "messages", "safari", "pictures"]);
const HOME_APPS = (a: (typeof APPS)[number]) => !HOME_HIDDEN.has(a.id);
const DOCK: AppId[] = ["contact", "messages", "safari", "pictures"];

function HomePage({ open }: { open: (id: AppId) => void }) {
  return (
    <div className="grid h-full auto-rows-min grid-cols-4 content-start gap-x-2 gap-y-6 overflow-y-auto px-5 pb-32 pt-8">
      {APPS.filter(HOME_APPS).map((app) => (
        <button key={app.id} onClick={() => open(app.id)} className="flex flex-col items-center gap-1.5 active:opacity-70">
          <AppIcon id={app.id} size={58} />
          <span className="text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
            {app.name}
          </span>
        </button>
      ))}
      {/* Link-only apps — same tile, but they leave for a browser tab */}
      {linkApps.map((app) => (
        <button
          key={app.id}
          onClick={() => {
            playClick();
            openExternal(app.url);
          }}
          className="flex flex-col items-center gap-1.5 active:opacity-70"
        >
          <AppIcon id={app.id} size={58} />
          <span className="text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
            {app.name}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Shell ---------- */

function IOSShell({ coords }: { coords: Coords }) {
  const { activeApp, openApp, closeApp } = useWindowManager();
  const [theme, setThemeState] = useState<Theme>("light");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [brightness, setBrightnessState] = useState(getBrightness());

  // scopes Tailwind's dark: variant on phones, mirroring Desktop.tsx
  useEffect(() => {
    setThemeState(getTheme());
    return subscribeTheme(setThemeState);
  }, []);
  // …and so do --accent and brightness: Settings can be opened from the phone,
  // so every system preference has to land somewhere on this root too.
  useEffect(() => {
    setAccentColor(getAccentColor());
    return subscribeAccent(() => setAccentColor(getAccentColor()));
  }, []);
  useEffect(() => subscribeBrightness(setBrightnessState), []);
  const [openId, setOpenId] = useState<AppId | null>(null);
  const [siriOpen, setSiriOpen] = useState(false);
  const [ncOpen, setNcOpen] = useState(false);
  const [page, setPage] = useState(1); // 0 Today · 1 Home · 2 Library
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Apps navigate each other via openApp (Projects → Safari, Siri-style
  // deep-links…) — mirror the window manager's active app into the phone UI.
  useEffect(() => {
    if (activeApp && activeApp !== openId) {
      setOpenId(activeApp);
      setSiriOpen(false);
    }
  }, [activeApp, openId]);

  const open = (id: AppId) => {
    playOpen();
    // Projects is a folder, like on the desktop — it opens inside Finder
    if (id === "projects") {
      requestFinderLocation("projects");
      openApp("myfolder");
      setOpenId("myfolder");
      return;
    }
    openApp(id);
    setOpenId(id);
  };

  const goHome = () => {
    // closeApp plays the close sound itself
    if (openId) closeApp(openId);
    else playClose();
    setOpenId(null);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    setPage((p) => Math.min(2, Math.max(0, p + (dx < 0 ? 1 : -1))));
  };

  const openApp_ = openId ? APP_BY_ID[openId] : null;
  const Content = openApp_?.component;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      data-theme={theme}
      style={{ filter: `brightness(${brightness})`, "--accent": accentColor } as React.CSSProperties}
    >
      <Wallpaper />
      {/* Today page gets a darker scrim like iOS */}
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${page === 0 ? "opacity-100" : "opacity-0"}`} />

      <div className="relative z-10 flex h-full flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <StatusBar
          onSiri={() => { playClick(); setSiriOpen(true); }}
          onClock={() => { playClick(); setNcOpen(true); }}
        />

        {/* Pages */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full w-[300%] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${page * (100 / 3)}%)` }}
          >
            <div className="h-full w-1/3">
              <TodayPage coords={coords} open={open} />
            </div>
            <div className="h-full w-1/3">
              <HomePage open={open} />
            </div>
            <div className="h-full w-1/3">
              <LibraryPage open={open} />
            </div>
          </div>
        </div>

        {/* Page dots */}
        <div className={`pointer-events-none absolute inset-x-0 flex justify-center gap-1.5 transition-all duration-300 ${page === 1 ? "bottom-[104px]" : "bottom-4"}`}>
          {(["Today", "Home", "App Library"] as const).map((name, i) => (
            <button
              key={name}
              aria-label={`${name} page`}
              aria-current={page === i}
              onClick={() => setPage(i)}
              className="pointer-events-auto p-1.5"
            >
              <span className={`block h-1.5 w-1.5 rounded-full transition ${page === i ? "bg-white" : "bg-white/40"}`} />
            </button>
          ))}
        </div>

        {/* Dock — overlays the Home page like iOS; other pages get the full screen */}
        <div className={`absolute inset-x-3 bottom-4 flex justify-center gap-5 rounded-3xl bg-white/20 px-4 py-3 backdrop-blur-xl transition-opacity duration-300 ${page === 1 ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {DOCK.map((id) => (
            <button key={id} onClick={() => open(id)} className="active:opacity-70" aria-label={`Open ${APP_BY_ID[id].name}`}>
              <AppIcon id={id} size={54} />
            </button>
          ))}
        </div>
      </div>

      {/* Siri — bottom sheet over whatever is on screen */}
      <AnimatePresence>
        {siriOpen && (
          <motion.div
            key="siri"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col justify-end bg-black/40 backdrop-blur-[2px]"
            onClick={() => setSiriOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="mx-auto mb-6 w-[min(20rem,calc(100%-1.5rem))]"
              onClick={(e) => e.stopPropagation()}
            >
              <SiriPanel onClose={() => setSiriOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen app view */}
      <AnimatePresence>
        {openId && Content && (
          <motion.div
            key={openId}
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 40 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="absolute inset-0 z-20 flex flex-col bg-[#f2f2f7] dark:bg-neutral-950"
          >
            <div className="shrink-0 bg-white/70 backdrop-blur dark:bg-neutral-900/70">
              <StatusBar onChrome />
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-base font-bold text-neutral-900 dark:text-white">{openApp_.name}</span>
                <button
                  onClick={goHome}
                  className="rounded-full bg-black/[0.07] px-3.5 py-1 text-sm font-semibold text-(--accent) dark:bg-white/10"
                >
                  Done
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <Content />
            </div>
            {/* home indicator */}
            <button aria-label="Home" onClick={goHome} className="flex shrink-0 justify-center bg-transparent py-2">
              <div className="h-1.5 w-32 rounded-full bg-neutral-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drops in from the top over the status bar, like a real iOS banner */}
      <NotificationBanner variant="mobile" />
      <NotificationCenter open={ncOpen} onClose={() => setNcOpen(false)} variant="mobile" />
    </div>
  );
}

export function IOSHome({ coords = null }: { coords?: Coords }) {
  // Apps call useWindowManager() internally — give them a real provider so
  // cross-app navigation (Projects → Safari, Finder deep-links) works here too.
  return (
    <WindowManagerProvider>
      <IOSShell coords={coords} />
    </WindowManagerProvider>
  );
}
