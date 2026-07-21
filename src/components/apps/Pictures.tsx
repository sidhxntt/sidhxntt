"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { pictures, type Picture } from "@/data/portfolio";
import { consumePendingPhoto, subscribePhotoNav } from "@/lib/photo-nav";
import { playClick } from "@/lib/sounds";

// Photos-style gallery over the real media in /public/library. Videos share the
// grid with stills — their tile renders the first frame and plays on open.

// Resolves free text ("mountains") or an id ("p2") to a picture:
// exact id first, then caption containing the query, then a caption whose
// own significant words (4+ letters) show up inside the query.
function resolvePhoto(query: string): Picture | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  const byId = pictures.find((p) => p.id.toLowerCase() === q);
  if (byId) return byId;

  const byCaption = pictures.find((p) => p.caption.toLowerCase().includes(q));
  if (byCaption) return byCaption;

  return pictures.find((p) =>
    p.caption
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => word.length >= 4 && q.includes(word)),
  );
}

const photoCount = pictures.filter((p) => p.kind === "photo").length;
const videoCount = pictures.length - photoCount;

export function Pictures() {
  const [selected, setSelected] = useState<Picture | null>(null);

  // Other apps deep-link straight to a single photo
  useEffect(() => {
    const jump = (query: string) => {
      const pic = resolvePhoto(query);
      if (pic) setSelected(pic);
    };
    const pending = consumePendingPhoto();
    if (pending) jump(pending);
    return subscribePhotoNav(jump);
  }, []);

  const index = selected ? pictures.findIndex((p) => p.id === selected.id) : -1;
  const step = (d: number) => {
    playClick();
    setSelected(pictures[(index + d + pictures.length) % pictures.length]);
  };

  // ← → flip through, Esc backs out — only while a photo is open
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const i = pictures.findIndex((p) => p.id === selected.id);
        playClick();
        setSelected(pictures[(i + (e.key === "ArrowRight" ? 1 : -1) + pictures.length) % pictures.length]);
      } else if (e.key === "Escape") {
        playClick();
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (selected) {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
        <div className="relative min-h-0 flex-1">
          {selected.kind === "video" ? (
            <video
              key={selected.src}
              src={selected.src}
              poster={selected.poster}
              className="absolute inset-0 h-full w-full object-contain"
              controls
              autoPlay
              loop
              playsInline
            />
          ) : (
            <Image
              src={selected.src}
              alt={selected.caption}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          )}
          <button
            aria-label="Previous photo"
            onClick={() => step(-1)}
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 active:opacity-70"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 12 4.5 L 6.5 10 l 5.5 5.5" />
            </svg>
          </button>
          <button
            aria-label="Next photo"
            onClick={() => step(1)}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 active:opacity-70"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 8 4.5 L 13.5 10 L 8 15.5" />
            </svg>
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 max-md:py-4">
          <p className="min-w-0 truncate text-sm text-neutral-700 dark:text-white/80">
            {selected.caption}
            <span className="text-neutral-400 dark:text-white/40"> · {index + 1} of {pictures.length}</span>
          </p>
          <button
            onClick={() => {
              playClick();
              setSelected(null);
            }}
            className="shrink-0 rounded-md bg-black/[0.07] px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-black/[0.12] dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
          >
            All Photos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-md:p-0 max-md:pb-4">
      {/* iOS-style large title (phones only) */}
      <h1 className="hidden max-md:block max-md:px-4 max-md:pb-1 max-md:pt-4 max-md:text-[34px] max-md:font-bold max-md:leading-tight max-md:tracking-tight max-md:text-neutral-900 dark:max-md:text-neutral-100">
        Photos
      </h1>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 max-md:mb-2 max-md:px-4 max-md:normal-case max-md:text-[13px] max-md:font-normal max-md:tracking-normal max-md:text-neutral-500 dark:max-md:text-neutral-400">
        Library · {photoCount} photos · {videoCount} videos
      </p>
      <div className="grid grid-cols-3 gap-1.5 max-md:gap-0.5">
        {pictures.map((pic) => (
          <button
            key={pic.id}
            onClick={() => {
              playClick();
              setSelected(pic);
            }}
            className="relative aspect-square overflow-hidden rounded-md bg-neutral-200 transition hover:opacity-85 max-md:rounded-none dark:bg-neutral-800"
            aria-label={pic.caption}
          >
            {/* Videos show a pre-rendered poster still — the clip itself is only
                fetched once opened, so the grid never pulls 19 movie files. */}
            <Image
              src={pic.kind === "video" ? pic.poster! : pic.src}
              alt={pic.caption}
              fill
              sizes="(max-width: 768px) 33vw, 240px"
              loading="lazy"
              className="object-cover"
            />
            {pic.kind === "video" && (
              <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 text-[10px] font-medium text-white">
                ▶
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
