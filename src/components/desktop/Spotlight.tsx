"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon, FolderIcon, type AppId } from "@/components/AppIcon";
import { APP_META } from "@/components/apps/app-meta";
import { DESKTOP_ITEMS, type DesktopItem } from "@/data/desktop-items";
import { useWindowManager } from "@/components/window/WindowManager";
import { playClick } from "@/lib/sounds";

type ResultKind = "Application" | "File" | "Folder";

type SpotlightItem = {
  /** app to open when activated */
  id: AppId;
  /** display name in the results list */
  name: string;
  type: ResultKind;
  /** unique key (an app and a file can map to the same AppId) */
  key: string;
};

/** Desktop items are indexed too — names come from the shared declaration.
 *  An item without a spotlightAppId is deliberately not searchable. */
function toSpotlightItem(item: DesktopItem & { spotlightAppId: AppId }): SpotlightItem {
  return {
    id: item.spotlightAppId,
    name: item.label,
    type: item.kind === "file" ? "File" : "Folder",
    key: `${item.kind}-${item.key}`,
  };
}

const indexed = DESKTOP_ITEMS.filter(
  (i): i is DesktopItem & { spotlightAppId: AppId } => i.spotlightAppId !== undefined,
);

// files before folders, each keeping its desktop order
const FILE_ITEMS: SpotlightItem[] = [
  ...indexed.filter((i) => i.kind === "file").map(toSpotlightItem),
  ...indexed.filter((i) => i.kind === "folder").map(toSpotlightItem),
];

const CORPUS: SpotlightItem[] = [
  ...APP_META.map<SpotlightItem>((a) => ({ id: a.id, name: a.name, type: "Application", key: `app-${a.id}` })),
  ...FILE_ITEMS,
];

/** Rank a candidate: 0 startsWith, 1 includes, 2 subsequence, -1 no match. */
function rank(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (n.includes(q)) return 1;
  // subsequence match
  let i = 0;
  for (const ch of n) {
    if (ch === q[i]) i++;
    if (i === q.length) return 2;
  }
  return -1;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
}

/** Simple grey document glyph for File results. */
function DocIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <path
        d="M 28 12 h 32 l 16 16 v 60 a 5 5 0 0 1 -5 5 H 28 a 5 5 0 0 1 -5 -5 V 17 a 5 5 0 0 1 5 -5 Z"
        fill="#f4f4f6"
      />
      <path d="M 60 12 l 16 16 h -16 Z" fill="#c9c9d1" />
      <g stroke="#b5b5bf" strokeWidth="4" strokeLinecap="round">
        <line x1="34" y1="46" x2="66" y2="46" />
        <line x1="34" y1="58" x2="66" y2="58" />
        <line x1="34" y1="70" x2="54" y2="70" />
      </g>
    </svg>
  );
}

function ResultIcon({ item }: { item: SpotlightItem }) {
  if (item.type === "Application") return <AppIcon id={item.id} size={28} variant="dock" />;
  if (item.type === "Folder") return <FolderIcon size={28} />;
  return <DocIcon size={28} />;
}

export function Spotlight() {
  const { openApp } = useWindowManager();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return CORPUS.map((item) => ({ item, score: rank(item.name, q) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((r) => r.item);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  const activate = useCallback(
    (item: SpotlightItem) => {
      playClick();
      openApp(item.id);
      close();
    },
    [openApp, close],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTrigger = e.code === "Space" && (e.metaKey || e.ctrlKey);
      if (isTrigger) {
        // Ignore while typing elsewhere (but allow toggling from Spotlight's own input)
        if (!open && isEditableTarget(e.target)) return;
        e.preventDefault();
        if (open) close();
        else setOpen(true);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // menu-bar magnifier dispatches this
  useEffect(() => {
    const onToggle = () => {
      if (open) close();
      else setOpen(true);
    };
    window.addEventListener("portfolio-spotlight", onToggle);
    return () => window.removeEventListener("portfolio-spotlight", onToggle);
  }, [open, close]);

  // Clamp/reset the highlight when results change
  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[selected];
      if (item) activate(item);
    }
  };

  return (
    <div className="fixed inset-0 z-[300]" onMouseDown={close}>
      <div
        className="absolute left-1/2 top-[28%] w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
        style={{
          backgroundColor: "rgba(44,44,50,0.6)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-white/60">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
            <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Spotlight Search"
            spellCheck={false}
            className="w-full bg-transparent text-xl text-white placeholder:text-white/40 outline-none"
          />
        </div>

        {results.length > 0 && (
          <ul className="border-t border-white/10 px-1.5 py-1.5">
            {results.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => activate(item)}
                  onMouseEnter={() => setSelected(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left ${
                    i === selected ? "bg-(--accent)" : ""
                  }`}
                >
                  <span className="shrink-0">
                    <ResultIcon item={item} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{item.name}</span>
                  <span className={`shrink-0 text-xs ${i === selected ? "text-white/80" : "text-white/40"}`}>
                    {item.type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
