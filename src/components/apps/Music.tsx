"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { playClick } from "@/lib/sounds";
import { consumePendingView, subscribeViewNav } from "@/lib/view-nav";
import {
  getState,
  play,
  next as playerNext,
  prev as playerPrev,
  setQueue,
  setRepeat,
  setShuffle,
  setVolume,
  subscribe,
  toggle,
  usePlayerState,
  type Track,
} from "@/lib/music-player";

// Apple-Music-style player backed by the Spotify Web API for metadata,
// with 30s previews resolved via Apple's iTunes Search API. Playback lives
// in the @/lib/music-player singleton so audio survives window unmounts.

type View = "search" | "home" | "songs" | "favourites";

const LIKES_KEY = "portfolio-music-likes";
const MY_SONGS_KEY = "portfolio-music-mysongs-v2";
const STALE_KEYS = [
  "portfolio-music-recent",
  "portfolio-music-seeded-v1",
  "portfolio-music-mysongs", // v1 cached the resolved tracks with no way to invalidate
];
const ACCENT = "#fa2c55";

const MY_SONGS_QUERIES = [
  "9 Drake",
  "Borderline Tame Impala",
  "5-7 Karan Aujla",
  "Eye of the Tiger Survivor",
  "Flashing Lights Kanye West",
  "The Less I Know The Better Tame Impala",
  "Sade Smooth Operator",
  "Blinding Lights The Weeknd",
];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ---------- Inline SVG icons ---------- */

function Icon({ d, className = "h-4 w-4", filled = false }: { d: string; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.35-4.35",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z",
  note: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  play: "M8 5.14v13.72a.5.5 0 0 0 .76.43l11.2-6.86a.5.5 0 0 0 0-.86L8.76 4.71a.5.5 0 0 0-.76.43z",
  pause: "M7 4h3.5v16H7V4zm6.5 0H17v16h-3.5V4z",
  prev: "M6 5h2v14H6V5zm12.5.66a.5.5 0 0 1 .5.43v11.82a.5.5 0 0 1-.78.41L9.6 12.41a.5.5 0 0 1 0-.82l8.62-5.91a.5.5 0 0 1 .28-.02z",
  next: "M16 5h2v14h-2V5zM5.5 5.66a.5.5 0 0 0-.5.43v11.82a.5.5 0 0 0 .78.41l8.62-5.91a.5.5 0 0 0 0-.82L5.78 5.68a.5.5 0 0 0-.28-.02z",
  shuffle: "M16 4h5v5m0-5-6.5 6.5M3 20l6-6m7 6h5v-5m0 5-6.5-6.5M3 4l4 4",
  repeat: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4m14-3v2a4 4 0 0 1-4 4H3",
  heart: "M12 21s-7.5-4.7-10-9.3C.5 8.6 2.4 5 6 5c2 0 3.4 1.1 4 2.2h4C14.6 6.1 16 5 18 5c3.6 0 5.5 3.6 4 6.7C21.5 16.3 12 21 12 21z",
  heartFilled: "M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  back: "M15 18l-6-6 6-6",
  volume: "M11 5 6 9H2v6h4l5 4V5zm5.5 3.5a5 5 0 0 1 0 7",
};

/* ---------- Animated playing bars ---------- */

/* ---------- Loading skeleton (pulsing placeholder rows) ---------- */

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-label="Loading songs" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg px-2 py-2">
          <div className="h-10 w-10 shrink-0 rounded bg-black/10 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-2.5 w-1/5 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
          </div>
          <div className="h-2.5 w-8 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        </div>
      ))}
      <div className="flex items-center gap-2 px-2 pt-2 text-[12px] text-neutral-400">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-[#fa2c55] dark:border-neutral-600" />
        Fetching songs…
      </div>
    </div>
  );
}

function PlayingBars() {
  return (
    <span className="flex h-3 items-end gap-[2px]" style={{ color: ACCENT }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-current"
          style={{
            animation: `music-bar 0.9s ease-in-out ${i * 0.18}s infinite alternate`,
            height: "40%",
          }}
        />
      ))}
      <style>{`@keyframes music-bar { from { height: 25%; } to { height: 100%; } }`}</style>
    </span>
  );
}

/* ---------- Progress-driven bits (isolated so ~4x/sec ticks
   only re-render these tiny components, not the track lists) ---------- */

function ProgressBar({ className = "" }: { className?: string }) {
  const { progress } = useSyncExternalStore(subscribe, getState, getState);
  const pct = progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0;
  return (
    <div className={`h-[3px] w-full bg-black/10 dark:bg-white/10 ${className}`}>
      <div className="h-full bg-[#fa2c55] transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TimeReadout() {
  const { progress } = useSyncExternalStore(subscribe, getState, getState);
  return (
    <span className="ml-auto hidden text-[11px] tabular-nums text-neutral-400 sm:block">
      {fmt(progress.time * 1000)} / {fmt(progress.duration * 1000)}
    </span>
  );
}

/* ---------- Shared track row ---------- */

function TrackRow({
  t,
  queue,
  currentId,
  playing,
  loadingTrackId,
  noPreviewId,
  liked,
  onToggleLike,
  onPlay,
}: {
  t: Track;
  queue: Track[];
  currentId: string | null;
  playing: boolean;
  loadingTrackId: string | null;
  noPreviewId: string | null;
  liked: boolean;
  onToggleLike: (t: Track) => void;
  onPlay: (t: Track, queue: Track[]) => void;
}) {
  const active = currentId === t.id;
  const loading = loadingTrackId === t.id;
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] max-md:px-1 ${active ? "bg-black/[0.04] dark:bg-white/[0.06]" : ""}`}
    >
      {t.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover max-md:h-12 max-md:w-12 max-md:rounded-md" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-black/10 text-neutral-400 dark:bg-white/10 max-md:h-12 max-md:w-12 max-md:rounded-md">
          <Icon d={ICONS.note} className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {active && playing && <PlayingBars />}
          <p className={`truncate text-sm font-medium ${active ? "text-[#fa2c55]" : "text-neutral-800 dark:text-neutral-100"}`}>{t.name}</p>
        </div>
        <p className="truncate text-xs text-neutral-400">{t.artists}</p>
        {noPreviewId === t.id && (
          <p className="text-[10px] text-neutral-400">No preview available</p>
        )}
      </div>
      <span className="text-xs tabular-nums text-neutral-400 max-md:hidden">{fmt(t.durationMs)}</span>
      <button
        aria-label={active && playing ? "Pause" : "Play preview"}
        onClick={() => onPlay(t, queue)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/[0.06] hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100 max-md:h-11 max-md:w-11"
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-neutral-700 dark:border-white/20 dark:border-t-neutral-200" />
        ) : (
          <Icon d={active && playing ? ICONS.pause : ICONS.play} className="h-4 w-4" filled />
        )}
      </button>
      <button
        aria-label={liked ? "Remove from library" : "Add to library"}
        onClick={() => onToggleLike(t)}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/[0.06] dark:hover:bg-white/[0.08] max-md:h-11 max-md:w-11 ${
          liked ? "text-[#fa2c55]" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        }`}
      >
        <Icon d={liked ? ICONS.heartFilled : ICONS.heart} className="h-4 w-4" filled={liked} />
      </button>
    </div>
  );
}

/* ---------- Sidebar row (desktop) ---------- */

function NavRow({
  v,
  icon,
  label,
  view,
  setView,
}: {
  v: View;
  icon: string;
  label: string;
  view: View;
  setView: (v: View) => void;
}) {
  return (
    <button
      onClick={() => {
        playClick();
        setView(v);
      }}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
        view === v
          ? "bg-black/[0.06] text-[#fa2c55] dark:bg-white/[0.08]"
          : "text-neutral-600 hover:bg-black/[0.05] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
      }`}
    >
      <Icon d={icon} className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

/* ---------- iOS bottom tab bar item (phones only) ---------- */

function MobileTab({
  v,
  icon,
  label,
  view,
  setView,
}: {
  v: View;
  icon: string;
  label: string;
  view: View;
  setView: (v: View) => void;
}) {
  return (
    <button
      onClick={() => {
        playClick();
        setView(v);
      }}
      aria-label={label}
      aria-current={view === v ? "page" : undefined}
      className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
        view === v ? "text-[#fa2c55]" : "text-neutral-500 dark:text-neutral-400"
      }`}
    >
      <Icon d={icon} className="h-6 w-6" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

/* ---------- Main component ---------- */

export function Music() {
  const [view, setView] = useState<View>("home");

  // Siri can ask for a specific section ("open my songs", "show favourites")
  useEffect(() => {
    const jump = (v: string) => {
      if (v === "home" || v === "search" || v === "songs" || v === "favourites") setView(v);
    };
    const pending = consumePendingView("music");
    if (pending) jump(pending);
    return subscribeViewNav((app, v) => app === "music" && jump(v));
  }, []);

  // Global playback state (singleton store — survives window unmounts).
  // Progress ticks are excluded here; ProgressBar/TimeReadout subscribe on their own.
  const player = usePlayerState();
  const { current, playing, volume, shuffle, repeat, loadingTrackId, noPreviewId } = player;

  // Home
  const [trending, setTrending] = useState<Track[]>([]);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Library
  const [likes, setLikes] = useState<Track[]>([]);
  const [likesLoaded, setLikesLoaded] = useState(false);
  const [mySongs, setMySongs] = useState<Track[]>([]);
  const [mySongsLoading, setMySongsLoading] = useState(true);

  /* ----- persistence ----- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      if (raw) setLikes(JSON.parse(raw) as Track[]);
    } catch {
      /* ignore corrupt storage */
    }
    setLikesLoaded(true);
    // Clean up storage keys from the old recently-played implementation.
    try {
      STALE_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  /* ----- My Songs: resolved once, then cached against the query list -----
     The cache stores the queries it was built from, so editing
     MY_SONGS_QUERIES re-resolves instead of serving a stale list forever. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_SONGS_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { queries: string[]; tracks: Track[] };
        const sameQueries =
          Array.isArray(cached?.queries) &&
          cached.queries.length === MY_SONGS_QUERIES.length &&
          cached.queries.every((q, i) => q === MY_SONGS_QUERIES[i]);
        if (sameQueries && Array.isArray(cached.tracks) && cached.tracks.length > 0) {
          setMySongs(cached.tracks);
          setMySongsLoading(false);
          return;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    let cancelled = false;
    Promise.all(
      MY_SONGS_QUERIES.map((q) =>
        fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((d: { tracks: Track[] }) => d.tracks?.[0] ?? null)
          .catch(() => null)
      )
    ).then((found) => {
      if (cancelled) return;
      const songs = found.filter((t): t is Track => t !== null);
      setMySongs(songs);
      setMySongsLoading(false);
      if (songs.length > 0) {
        try {
          localStorage.setItem(MY_SONGS_KEY, JSON.stringify({ queries: MY_SONGS_QUERIES, tracks: songs }));
        } catch {
          /* storage full — ignore */
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLike = (t: Track) => {
    playClick();
    setLikes((prev) => {
      const next = prev.some((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t];
      try {
        localStorage.setItem(LIKES_KEY, JSON.stringify(next));
      } catch {
        /* storage full — ignore */
      }
      return next;
    });
  };
  const isLiked = (id: string) => likes.some((x) => x.id === id);

  /* ----- trending ----- */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/spotify/trending")
      .then((r) => r.json())
      .then((d: { tracks: Track[]; error?: string }) => {
        if (cancelled) return;
        setTrending(d.tracks ?? []);
        if (d.error) setTrendingError(d.error);
      })
      .catch(() => !cancelled && setTrendingError("Could not load trending tracks."));
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----- search (debounced) ----- */
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    // Abort any in-flight request on cleanup so a stale response can never
    // overwrite a newer one's results or clear its spinner.
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { tracks: Track[] }) => {
          if (controller.signal.aborted) return;
          setResults(d.tracks ?? []);
          setSearched(true);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setSearching(false);
        });
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  /* ----- playback (delegates to the singleton store) ----- */
  const playTrack = (t: Track, queue: Track[]) => {
    playClick();
    play(t, queue);
  };

  const togglePlay = () => {
    playClick();
    toggle();
  };

  const stepTrack = (dir: 1 | -1) => {
    playClick();
    if (dir === 1) playerNext();
    else playerPrev();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f7f7fa] text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-black/10 bg-[#efeff2] p-3 dark:border-white/10 dark:bg-neutral-950/40 max-md:hidden">
          <NavRow v="search" icon={ICONS.search} label="Search" view={view} setView={setView} />
          <NavRow v="home" icon={ICONS.home} label="Home" view={view} setView={setView} />
          <p className="mt-4 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Library</p>
          <NavRow v="songs" icon={ICONS.note} label="My Songs" view={view} setView={setView} />
          <NavRow v="favourites" icon={ICONS.heart} label="Favourites" view={view} setView={setView} />
        </aside>

        {/* Main view */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5 max-md:px-4 max-md:pb-4 max-md:pt-6">
          {view === "home" && (
            <div>
              <h1 className="text-2xl font-bold max-md:text-[32px] max-md:tracking-tight">Home</h1>
              <div className="mt-4 rounded-xl bg-gradient-to-br from-[#fa2c55] to-[#b3123c] p-6 text-white shadow-lg">
                <p className="text-lg font-semibold">Trending now.</p>
                <p className="text-sm text-white/80">The songs everyone&apos;s playing.</p>
              </div>
              <h2 className="mt-6 mb-3 text-lg font-semibold">Trending</h2>
              {trendingError && <p className="text-sm text-neutral-400">{trendingError}</p>}
              {trending.length === 0 && !trendingError && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-5" aria-label="Loading trending" role="status">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-square rounded-lg bg-black/10 dark:bg-white/10" />
                      <div className="mt-2 h-3 w-3/4 rounded bg-black/10 dark:bg-white/10" />
                      <div className="mt-1.5 h-2.5 w-1/2 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-5">
                {trending.map((t) => {
                  const active = current?.id === t.id;
                  const loading = loadingTrackId === t.id;
                  return (
                    <div key={t.id} className="group relative">
                      <button
                        onClick={() => playTrack(t, trending)}
                        aria-label={active && playing ? `Pause ${t.name}` : `Play ${t.name}`}
                        className="block w-full text-left"
                      >
                        <div className="relative">
                          {t.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.image}
                              alt={t.name}
                              className="aspect-square w-full rounded-lg object-cover shadow-md transition group-hover:opacity-90"
                            />
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-black/10 dark:bg-white/10">
                              <Icon d={ICONS.note} className="h-6 w-6 text-neutral-400" />
                            </div>
                          )}
                          {loading && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            </span>
                          )}
                          {active && playing && !loading && (
                            <span className="absolute bottom-1.5 left-1.5 rounded bg-white/85 p-1 shadow dark:bg-neutral-800/85">
                              <PlayingBars />
                            </span>
                          )}
                        </div>
                        <p className={`mt-1.5 truncate text-[13px] font-medium ${active ? "text-[#fa2c55]" : "text-neutral-800 dark:text-neutral-100"}`}>
                          {t.name}
                        </p>
                        <p className="truncate text-xs text-neutral-400">{t.artists}</p>
                        {noPreviewId === t.id && <p className="text-[10px] text-neutral-400">No preview available</p>}
                      </button>
                      <button
                        aria-label={isLiked(t.id) ? "Remove from library" : "Add to library"}
                        onClick={() => toggleLike(t)}
                        className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 shadow transition dark:bg-neutral-800/85 max-md:h-9 max-md:w-9 ${
                          isLiked(t.id)
                            ? "text-[#fa2c55]"
                            : "text-neutral-500 opacity-0 hover:text-neutral-700 group-hover:opacity-100 dark:text-neutral-300 dark:hover:text-neutral-100 max-md:opacity-100"
                        }`}
                      >
                        <Icon d={isLiked(t.id) ? ICONS.heartFilled : ICONS.heart} className="h-3.5 w-3.5" filled={isLiked(t.id)} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "search" && (
            <div>
              <h1 className="mb-4 text-2xl font-bold max-md:text-[32px] max-md:tracking-tight">Search</h1>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Artists, songs…"
                className="w-full rounded-lg border border-black/10 bg-black/[0.06] px-4 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition focus:border-[#fa2c55]/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-neutral-100"
              />
              <div className="mt-4 space-y-0.5">
                {searching && <p className="text-sm text-neutral-400">Searching…</p>}
                {!searching && searched && results.length === 0 && (
                  <p className="text-sm text-neutral-400">No results for “{query.trim()}”.</p>
                )}
                {results.map((t) => (
                  <TrackRow
                    key={t.id}
                    t={t}
                    queue={results}
                    currentId={current?.id ?? null}
                    playing={playing}
                    loadingTrackId={loadingTrackId}
                    noPreviewId={noPreviewId}
                    liked={isLiked(t.id)}
                    onToggleLike={toggleLike}
                    onPlay={playTrack}
                  />
                ))}
              </div>
            </div>
          )}

          {view === "songs" && (
            <div>
              <h1 className="mb-4 text-2xl font-bold max-md:text-[32px] max-md:tracking-tight">My Songs</h1>
              {mySongsLoading ? (
                <ListSkeleton />
              ) : mySongs.length === 0 ? (
                <p className="text-sm text-neutral-400">Couldn&rsquo;t load songs. Try again later.</p>
              ) : (
                <div className="space-y-0.5">
                  {mySongs.map((t) => (
                    <TrackRow
                      key={t.id}
                      t={t}
                      queue={mySongs}
                      currentId={current?.id ?? null}
                      playing={playing}
                      loadingTrackId={loadingTrackId}
                      noPreviewId={noPreviewId}
                      liked={isLiked(t.id)}
                      onToggleLike={toggleLike}
                      onPlay={playTrack}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "favourites" && (
            <div>
              <h1 className="mb-4 text-2xl font-bold max-md:text-[32px] max-md:tracking-tight">Favourites</h1>
              {!likesLoaded ? (
                <ListSkeleton rows={3} />
              ) : likes.length === 0 ? (
                <p className="text-sm text-neutral-400">Tap the &hearts; on any song to keep it here.</p>
              ) : (
                <div className="space-y-0.5">
                  {likes.map((t) => (
                    <TrackRow
                      key={t.id}
                      t={t}
                      queue={likes}
                      currentId={current?.id ?? null}
                      playing={playing}
                      loadingTrackId={loadingTrackId}
                      noPreviewId={noPreviewId}
                      liked={isLiked(t.id)}
                      onToggleLike={toggleLike}
                      onPlay={playTrack}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Progress bar (desktop) */}
      <ProgressBar className="max-md:hidden" />

      {/* Player bar (desktop) */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-t border-black/10 bg-white/80 px-4 max-md:hidden dark:border-white/10 dark:bg-neutral-800/80">
        <div className="flex items-center gap-1">
          <button
            aria-label="Shuffle"
            onClick={() => {
              playClick();
              setShuffle(!shuffle);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/[0.06] dark:hover:bg-white/[0.08] ${shuffle ? "text-[#fa2c55]" : "text-neutral-600 dark:text-neutral-300"}`}
          >
            <Icon d={ICONS.shuffle} className="h-4 w-4" />
          </button>
          <button
            aria-label="Previous"
            onClick={() => stepTrack(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          >
            <Icon d={ICONS.prev} className="h-4 w-4" filled />
          </button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition hover:bg-black/[0.06] disabled:opacity-40 dark:text-neutral-100 dark:hover:bg-white/[0.08]"
            disabled={!current}
          >
            <Icon d={playing ? ICONS.pause : ICONS.play} className="h-5 w-5" filled />
          </button>
          <button
            aria-label="Next"
            onClick={() => stepTrack(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          >
            <Icon d={ICONS.next} className="h-4 w-4" filled />
          </button>
          <button
            aria-label="Repeat"
            onClick={() => {
              playClick();
              setRepeat(!repeat);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/[0.06] dark:hover:bg-white/[0.08] ${repeat ? "text-[#fa2c55]" : "text-neutral-600 dark:text-neutral-300"}`}
          >
            <Icon d={ICONS.repeat} className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {current ? (
            <>
              {current.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.image} alt="" className="h-10 w-10 rounded object-cover" />
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-100">{current.name}</p>
                <p className="truncate text-xs text-neutral-400">{current.artists}</p>
              </div>
              <TimeReadout />
            </>
          ) : (
            <p className="text-xs text-neutral-400">Not playing</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Icon d={ICONS.volume} className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer accent-[#fa2c55]"
          />
        </div>
      </div>

      {/* iOS bottom chrome: floating mini-player + tab bar (phones only) */}
      <div className="shrink-0 md:hidden">
        <div className="px-2 pb-2">
          <div className="overflow-hidden rounded-[14px] bg-white/95 shadow-[0_4px_24px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] backdrop-blur dark:bg-neutral-800/95 dark:ring-white/10">
            <ProgressBar />
            <div className="flex h-14 items-center gap-3 px-3">
              {current?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover shadow" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-neutral-400 dark:bg-white/10">
                  <Icon d={ICONS.note} className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-neutral-800 dark:text-neutral-100">
                  {current ? current.name : "Not Playing"}
                </p>
                {current && <p className="truncate text-xs text-neutral-400">{current.artists}</p>}
              </div>
              <button
                aria-label={playing ? "Pause" : "Play"}
                onClick={togglePlay}
                disabled={!current}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-800 transition active:bg-black/[0.06] disabled:opacity-40 dark:text-neutral-100 dark:active:bg-white/[0.08]"
              >
                <Icon d={playing ? ICONS.pause : ICONS.play} className="h-6 w-6" filled />
              </button>
              <button
                aria-label="Next"
                onClick={() => stepTrack(1)}
                disabled={!current}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-800 transition active:bg-black/[0.06] disabled:opacity-40 dark:text-neutral-100 dark:active:bg-white/[0.08]"
              >
                <Icon d={ICONS.next} className="h-5 w-5" filled />
              </button>
            </div>
          </div>
        </div>
        <nav
          aria-label="Music sections"
          className="flex items-stretch border-t border-black/10 bg-[#f7f7fa]/95 px-1 pb-1 pt-0.5 backdrop-blur dark:border-white/10 dark:bg-neutral-900/95"
        >
          <MobileTab v="home" icon={ICONS.home} label="Home" view={view} setView={setView} />
          <MobileTab v="search" icon={ICONS.search} label="Search" view={view} setView={setView} />
          <MobileTab v="songs" icon={ICONS.note} label="My Songs" view={view} setView={setView} />
          <MobileTab v="favourites" icon={ICONS.heart} label="Favourites" view={view} setView={setView} />
        </nav>
      </div>
    </div>
  );
}
