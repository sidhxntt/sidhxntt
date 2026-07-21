"use client";

import { playClick } from "@/lib/sounds";

// Finder-style grid/list segmented control, shared by all folder-like views.

export function ViewToggle({
  view,
  setView,
}: {
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
}) {
  const base = "flex h-6 w-8 items-center justify-center transition";
  return (
    <div className="flex overflow-hidden rounded-md border border-black/10 bg-black/[0.04]">
      <button
        aria-label="Icon view"
        onClick={() => {
          playClick();
          setView("grid");
        }}
        className={`${base} ${view === "grid" ? "bg-black/10 text-neutral-800" : "text-neutral-400 hover:text-neutral-600"}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <div className="w-px bg-black/10" />
      <button
        aria-label="List view"
        onClick={() => {
          playClick();
          setView("list");
        }}
        className={`${base} ${view === "list" ? "bg-black/10 text-neutral-800" : "text-neutral-400 hover:text-neutral-600"}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <rect x="1" y="2" width="2" height="2" rx="0.5" />
          <rect x="5" y="2" width="10" height="2" rx="0.5" />
          <rect x="1" y="7" width="2" height="2" rx="0.5" />
          <rect x="5" y="7" width="10" height="2" rx="0.5" />
          <rect x="1" y="12" width="2" height="2" rx="0.5" />
          <rect x="5" y="12" width="10" height="2" rx="0.5" />
        </svg>
      </button>
    </div>
  );
}
