"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { profile, projects } from "@/data/portfolio";
import { openExternal } from "@/lib/browser";
import { consumePendingSafariUrl, subscribeSafariNav } from "@/lib/safari-nav";
import { playClick } from "@/lib/sounds";
import { useIsMobile } from "@/lib/useIsMobile";

// ── Internal history model ────────────────────────────────────────────────
type Page = { kind: "start" } | { kind: "web"; url: string };

// Tile gradients for the start-page project shortcuts, assigned by position.
const TILE_GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-amber-400 to-orange-600",
  "from-pink-400 to-fuchsia-600",
  "from-cyan-400 to-sky-600",
  "from-lime-400 to-emerald-600",
];

function brandColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("github")) return "#24292f";
  if (l.includes("linkedin")) return "#0a66c2";
  if (l.includes("twitter") || l.includes(" x") || l === "x" || l.includes("x.com"))
    return "#1d9bf0";
  if (l.includes("mail") || l.includes("email")) return "#1a73e8";
  return "#6b7280";
}

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** URL-ish: contains a dot, no spaces. Otherwise treat as a search term. */
function resolveInput(raw: string): string {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes(".") && !/\s/.test(t)) return `https://${t}`;
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(t)}`;
}

/** Compact display form for the iOS address pill, e.g. "github.com". */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Safari() {
  const [history, setHistory] = useState<Page[]>([{ kind: "start" }]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("Hello");
  const [spinning, setSpinning] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // iOS-only: whether the bottom address pill is being edited.
  const [editingAddress, setEditingAddress] = useState(false);
  const isMobile = useIsMobile() === true;

  const current = history[index] ?? { kind: "start" as const };
  const canBack = index > 0;
  const canForward = index < history.length - 1;

  /** Push a "web" page onto the internal history and show it in the iframe. */
  const navigate = useCallback(
    (url: string) => {
      setHistory((h) => [...h.slice(0, index + 1), { kind: "web", url }]);
      setIndex(index + 1);
      setInput(url);
      setBannerDismissed(false);
      setFrameKey((k) => k + 1);
    },
    [index]
  );

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  // Siri steers Safari to a URL in-app (its browse action never leaves the OS)
  const navRef = useRef<(url: string) => void>(() => {});
  navRef.current = navigate;
  useEffect(() => {
    const pending = consumePendingSafariUrl();
    if (pending) navRef.current(pending);
    return subscribeSafariNav((url) => navRef.current(url));
  }, []);

  // Start-page tiles point at real external sites (socials, project demos),
  // all of which refuse to be framed — so they leave the OS for a real tab.
  // Typed addresses and in-page links still browse inside Safari via navigate().
  const openShortcut = (url: string) => {
    playClick();
    openExternal(url);
  };

  const submitAddress = () => {
    const t = input.trim();
    if (!t) return;
    const url = resolveInput(t);
    playClick();
    navigate(url);
  };

  const goTo = (i: number) => {
    playClick();
    setIndex(i);
    const page = history[i];
    setInput(page && page.kind === "web" ? page.url : "");
    setBannerDismissed(false);
  };

  const reload = () => {
    playClick();
    setFrameKey((k) => k + 1);
    if (spinning) return;
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  };

  // Favourites: socials + project tiles
  const favourites = profile.socials.map((s) => ({
    key: s.label,
    label: s.label,
    url: s.url as string | undefined,
    color: brandColor(s.label),
    gradient: undefined as string | undefined,
  }));
  const projectTiles = projects.map((p, i) => ({
    key: p.id,
    label: p.name,
    url: p.link ?? p.repo,
    color: undefined as string | undefined,
    // start-page tiles are favicon-sized — a letter on a gradient reads better
    // than a shrunken screenshot, so they don't use project.preview
    gradient: TILE_GRADIENTS[i % TILE_GRADIENTS.length],
  }));

  // ── iOS layout (<768px only) — the desktop layout below is untouched ──
  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
        {/* Content */}
        {current.kind === "start" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#fafafa] to-[#eef0f4] dark:from-neutral-900 dark:to-neutral-950">
            <div className="px-5 pb-8 pt-6">
              <h1 className="text-[28px] font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                {greeting}
              </h1>
              <p className="mt-1 text-[15px] text-neutral-500 dark:text-neutral-400">
                Welcome to {profile.name}&apos;s corner of the internet.
              </p>

              <h2 className="mt-7 text-[20px] font-bold text-neutral-800 dark:text-neutral-100">
                Favourites
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {favourites.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => f.url && openShortcut(f.url)}
                    className="flex flex-col items-center gap-2.5 rounded-2xl bg-white p-4 shadow-sm transition-transform active:scale-95 dark:bg-neutral-800"
                  >
                    <span
                      // brand colours are picked for a white card; GitHub's near-black
                      // vanishes on the dark tile, so give every chip a hairline in dark
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white dark:ring-1 dark:ring-inset dark:ring-white/20"
                      style={{ backgroundColor: f.color }}
                    >
                      {f.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-full truncate text-[15px] font-medium text-neutral-700 dark:text-neutral-200">
                      {f.label}
                    </span>
                  </button>
                ))}
                <a
                  href={`mailto:${profile.email}`}
                  onClick={() => playClick()}
                  className="flex flex-col items-center gap-2.5 rounded-2xl bg-white p-4 shadow-sm transition-transform active:scale-95 dark:bg-neutral-800"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white dark:ring-1 dark:ring-inset dark:ring-white/20"
                    style={{ backgroundColor: brandColor("email") }}
                  >
                    @
                  </span>
                  <span className="max-w-full truncate text-[15px] font-medium text-neutral-700 dark:text-neutral-200">
                    Email me
                  </span>
                </a>
                {projectTiles.map((p) =>
                  p.url ? (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => openShortcut(p.url!)}
                      className="flex flex-col items-center gap-2.5 rounded-2xl bg-white p-4 shadow-sm transition-transform active:scale-95 dark:bg-neutral-800"
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-semibold text-white ${p.gradient}`}
                      >
                        {p.label.charAt(0).toUpperCase()}
                      </span>
                      <span className="max-w-full truncate text-[15px] font-medium text-neutral-700 dark:text-neutral-200">
                        {p.label}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={p.key}
                      className="flex cursor-default flex-col items-center gap-2.5 rounded-2xl bg-white p-4 opacity-45 shadow-sm dark:bg-neutral-800"
                      title="No public link yet"
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-semibold text-white ${p.gradient}`}
                      >
                        {p.label.charAt(0).toUpperCase()}
                      </span>
                      <span className="max-w-full truncate text-[15px] font-medium text-neutral-700 dark:text-neutral-200">
                        {p.label}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="mt-7 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-800">
                <h3 className="text-[15px] font-semibold text-neutral-700 dark:text-neutral-200">
                  Privacy Report
                </h3>
                <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
                  Safari blocked 0 trackers. This portfolio doesn&apos;t track you 🎉
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-neutral-900">
            {!bannerDismissed && (
              <div className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#fffbe6] px-3 py-1.5 text-[12px] text-neutral-600 dark:border-white/10 dark:bg-yellow-900/30 dark:text-neutral-300">
                <span className="min-w-0 flex-1 truncate">
                  Rendered via proxy — some sites may look off or need ↗ for the real thing
                </span>
                <button
                  type="button"
                  aria-label="Open in a new tab"
                  onClick={() => {
                    playClick();
                    window.open(current.url, "_blank", "noopener");
                  }}
                  className="shrink-0 rounded px-2 py-1 font-semibold text-blue-600 transition-colors active:bg-black/[0.06] dark:text-blue-400 dark:active:bg-white/[0.08]"
                >
                  ↗
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => {
                    playClick();
                    setBannerDismissed(true);
                  }}
                  className="shrink-0 rounded px-2 py-1 text-neutral-500 transition-colors active:bg-black/[0.06] dark:text-neutral-400 dark:active:bg-white/[0.08]"
                >
                  ✕
                </button>
              </div>
            )}
            <iframe
              key={frameKey}
              // proxied server-side so frame-blocking headers are stripped
              src={`/api/proxy?url=${encodeURIComponent(current.url)}`}
              title={current.url}
              className="h-full min-h-0 w-full flex-1"
              sandbox="allow-scripts allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* ── iOS bottom bar: back/forward + address pill ── */}
        <div className="shrink-0 border-t border-black/10 bg-[#f5f5f7]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md dark:border-white/10 dark:bg-neutral-800/95">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Back"
              disabled={!canBack}
              onClick={() => canBack && goTo(index - 1)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                canBack
                  ? "text-[#0b84fe] active:bg-black/[0.06] dark:active:bg-white/[0.08]"
                  : "cursor-default text-neutral-300 dark:text-neutral-600"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10.5 3 5.5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Forward"
              disabled={!canForward}
              onClick={() => canForward && goTo(index + 1)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                canForward
                  ? "text-[#0b84fe] active:bg-black/[0.06] dark:active:bg-white/[0.08]"
                  : "cursor-default text-neutral-300 dark:text-neutral-600"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Address pill */}
            <div className="ml-1 flex h-11 min-w-0 flex-1 items-center rounded-full bg-white pl-4 pr-1.5 shadow-sm ring-1 ring-black/[0.07] dark:bg-neutral-700 dark:ring-white/10">
              <input
                type="text"
                value={editingAddress || current.kind === "start" ? input : domainOf(current.url)}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setEditingAddress(true)}
                onBlur={() => setEditingAddress(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitAddress();
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Search or enter website"
                spellCheck={false}
                autoComplete="off"
                className="h-full w-full min-w-0 bg-transparent text-center text-[15px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
              />
              {current.kind === "web" && !editingAddress && (
                <button
                  type="button"
                  aria-label="Reload"
                  onClick={reload}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors active:bg-black/[0.06] dark:text-neutral-300 dark:active:bg-white/[0.08]"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={spinning ? "animate-[spin_0.7s_ease-in-out]" : undefined}
                  >
                    <path
                      d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path d="M13.7 1.8v2.7h-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#f5f5f7] px-3 py-2 dark:border-white/10 dark:bg-neutral-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Back"
            disabled={!canBack}
            onClick={() => canBack && goTo(index - 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              canBack
                ? "text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                : "cursor-default text-neutral-300 dark:text-neutral-600"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10.5 3 5.5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Forward"
            disabled={!canForward}
            onClick={() => canForward && goTo(index + 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              canForward
                ? "text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                : "cursor-default text-neutral-300 dark:text-neutral-600"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Reload"
            onClick={reload}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={spinning ? "animate-[spin_0.7s_ease-in-out]" : undefined}
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path d="M13.7 1.8v2.7h-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Address bar */}
        <div className="mx-auto flex w-full max-w-md items-center gap-1.5 rounded-lg bg-black/[0.06] px-2.5 py-1 dark:bg-white/[0.08]">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-neutral-500 dark:text-neutral-400">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAddress();
            }}
            placeholder="Search or enter website name"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent text-center text-[12px] text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-200"
          />
        </div>

        {/* Spacer to balance the nav cluster so the pill stays centered */}
        <div className="w-[92px] shrink-0" aria-hidden="true" />
      </div>

      {/* ── Bookmarks bar ── */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 bg-[#f5f5f7] px-3 py-1 dark:border-white/10 dark:bg-neutral-800">
        {profile.socials.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => openShortcut(s.url)}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          >
            <span className="h-2 w-2 rounded-full dark:ring-1 dark:ring-white/25" style={{ backgroundColor: brandColor(s.label) }} />
            {s.label}
          </button>
        ))}
        <a
          href={`mailto:${profile.email}`}
          onClick={() => playClick()}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
        >
          <span className="h-2 w-2 rounded-full dark:ring-1 dark:ring-white/25" style={{ backgroundColor: brandColor("email") }} />
          Email me
        </a>
      </div>

      {/* ── Content ── */}
      {current.kind === "start" ? (
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#fafafa] to-[#eef0f4] dark:from-neutral-900 dark:to-neutral-950">
          <div className="mx-auto w-full max-w-2xl px-6 py-8">
            <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">
              {greeting}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Welcome to {profile.name}&apos;s corner of the internet.
            </p>

            <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Favourites
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {favourites.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => f.url && openShortcut(f.url)}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow dark:bg-neutral-800"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold text-white dark:ring-1 dark:ring-inset dark:ring-white/20"
                    style={{ backgroundColor: f.color }}
                  >
                    {f.label.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-full truncate text-[11px] text-neutral-600 dark:text-neutral-300">{f.label}</span>
                </button>
              ))}
              {projectTiles.map((p) =>
                p.url ? (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => openShortcut(p.url!)}
                    className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow dark:bg-neutral-800"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold text-white ${p.gradient}`}
                    >
                      {p.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-full truncate text-[11px] text-neutral-600 dark:text-neutral-300">{p.label}</span>
                  </button>
                ) : (
                  <div
                    key={p.key}
                    className="flex cursor-default flex-col items-center gap-2 rounded-xl bg-white p-3 opacity-45 shadow-sm dark:bg-neutral-800"
                    title="No public link yet"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold text-white ${p.gradient}`}
                    >
                      {p.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-full truncate text-[11px] text-neutral-600 dark:text-neutral-300">{p.label}</span>
                  </div>
                )
              )}
            </div>

            <div className="mt-8 rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
              <h3 className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">Privacy Report</h3>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                Safari blocked 0 trackers. This portfolio doesn&apos;t track you 🎉
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-neutral-900">
          {!bannerDismissed && (
            <div className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#fffbe6] px-3 py-1 text-[11px] text-neutral-600 dark:border-white/10 dark:bg-yellow-900/30 dark:text-neutral-300">
              <span className="min-w-0 flex-1 truncate">
                Rendered via proxy — some sites may look off or need ↗ for the real thing
              </span>
              <button
                type="button"
                aria-label="Open in a new tab"
                onClick={() => {
                  playClick();
                  window.open(current.url, "_blank", "noopener");
                }}
                className="shrink-0 rounded px-1.5 py-0.5 font-semibold text-blue-600 transition-colors hover:bg-black/[0.06] dark:text-blue-400 dark:hover:bg-white/[0.08]"
              >
                ↗
              </button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  playClick();
                  setBannerDismissed(true);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 transition-colors hover:bg-black/[0.06] dark:text-neutral-400 dark:hover:bg-white/[0.08]"
              >
                ✕
              </button>
            </div>
          )}
          <iframe
            key={frameKey}
            // proxied server-side so frame-blocking headers are stripped
            src={`/api/proxy?url=${encodeURIComponent(current.url)}`}
            title={current.url}
            className="h-full min-h-0 w-full flex-1"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
