"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AppIcon, FolderIcon, type AppId } from "@/components/AppIcon";
import { Draggable } from "@/components/desktop/Draggable";
import { ViewToggle } from "@/components/ViewToggle";
import { useIsMobile } from "@/lib/useIsMobile";
import { useWindowManager } from "@/components/window/WindowManager";
import { playClick } from "@/lib/sounds";
import { getRecents, subscribeRecents, type RecentEntry } from "@/lib/recents";
import { consumePendingFinderLocation, subscribeFinderNav } from "@/lib/finder-nav";
import { requestProject } from "@/lib/project-nav";
import { requestPhoto } from "@/lib/photo-nav";
import { fileDate, fileDay, fileStamp, PENDING_DATE } from "@/lib/file-dates";
import { linkApps, pictures, projects, type Picture } from "@/data/portfolio";
import { openExternal } from "@/lib/browser";
import { APP_META } from "./app-meta";

// Finder-style window: sidebar, back/forward navigation, grid/list views.
// Projects and Pictures are folders you can navigate into; the rest are files
// that open their app window on double-click. Recents shows what you actually
// opened this session; Applications lists every app.

type Loc =
  | "projects"
  | "pictures"
  | "recents"
  | "applications"
  | "desktop"
  | "documents"
  | "downloads"
  | "macintoshhd"
  | "games"
  | "trash";

const LOC_TITLE: Record<Loc, string> = {
  projects: "Projects",
  pictures: "Pictures",
  recents: "Recents",
  applications: "Applications",
  desktop: "Desktop",
  documents: "Documents",
  downloads: "Downloads",
  macintoshhd: "Macintosh HD",
  games: "Games",
  trash: "Bin",
};

// 20 pieces of perfectly good junk. `daysAgo` replaces a literal date so the
// Bin ages with the visitor's calendar instead of drifting out of date; a few
// names embed their own timestamp, so those are built from the same offset.
type TrashItem = {
  name: string | ((d: Date) => string);
  kind: string;
  size: string;
  daysAgo: number;
  label: string;
};

const TRASH_ITEMS: TrashItem[] = [
  { name: (d) => `Screenshot ${isoDay(d)} at 3.14.15 AM.png`, kind: "PNG image", size: "2.4 MB", daysAgo: 258, label: "PNG" },
  { name: (d) => `Screenshot ${isoDay(d)} at 3.14.16 AM.png`, kind: "PNG image", size: "2.4 MB", daysAgo: 258, label: "PNG" },
  { name: "Zoom_installer_old.dmg", kind: "Disk Image", size: "84.2 MB", daysAgo: 211, label: "DMG" },
  { name: "chrome-canary.dmg", kind: "Disk Image", size: "228.6 MB", daysAgo: 196, label: "DMG" },
  { name: "old_portfolio_v1", kind: "Folder", size: "--", daysAgo: 160, label: "DIR" },
  { name: (d) => `node_modules (from ${d.getFullYear()})`, kind: "Folder", size: "9.4 GB", daysAgo: 1235, label: "DIR" },
  { name: "untitled folder", kind: "Folder", size: "--", daysAgo: 126, label: "DIR" },
  { name: "untitled folder 2", kind: "Folder", size: "--", daysAgo: 126, label: "DIR" },
  { name: "resume-draft-v1.docx", kind: "Word Document", size: "84 KB", daysAgo: 107, label: "DOC" },
  { name: "resume-draft-v2-FINAL(wrong).docx", kind: "Word Document", size: "86 KB", daysAgo: 106, label: "DOC" },
  { name: "meme-collection.zip", kind: "ZIP Archive", size: "1.2 GB", daysAgo: 98, label: "ZIP" },
  { name: "IMG_4021 (blurry).heic", kind: "HEIC image", size: "3.8 MB", daysAgo: 83, label: "PIC" },
  { name: "gym-plan-january.pdf", kind: "PDF Document", size: "412 KB", daysAgo: 77, label: "PDF" },
  { name: (d) => `crash-report-${isoDay(d)}.log`, kind: "Log File", size: "18 KB", daysAgo: 60, label: "LOG" },
  { name: "backup-of-backup.tar.gz", kind: "Archive", size: "4.7 GB", daysAgo: 51, label: "TAR" },
  { name: "side-project-idea-#47.txt", kind: "Plain Text", size: "1 KB", daysAgo: 42, label: "TXT" },
  { name: "definitely-final-mix-v9.mp3", kind: "MP3 audio", size: "9.1 MB", daysAgo: 30, label: "MP3" },
  { name: "vacation-video-unedited.mov", kind: "QuickTime Movie", size: "3.2 GB", daysAgo: 18, label: "MOV" },
  { name: "lorem-ipsum-notes.rtf", kind: "Rich Text", size: "6 KB", daysAgo: 10, label: "RTF" },
  { name: "free-RAM-download.dmg", kind: "Disk Image", size: "666 KB", daysAgo: 2, label: "DMG" },
];

/** yyyy-mm-dd, the way a screenshot or a crash log names itself. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TRASH_COLORS: Record<string, string> = {
  PNG: "#059669", DMG: "#6366f1", DOC: "#2563eb", ZIP: "#a16207", PIC: "#0891b2",
  PDF: "#dc2626", LOG: "#525252", TAR: "#7c3aed", TXT: "#f59e0b", MP3: "#db2777",
  MOV: "#ea580c", RTF: "#64748b",
};

// ── File icons ────────────────────────────────────────────────────────

export function FileIcon({ label, color, size = 52 }: { label: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <path
        d="M 26 8 h 34 l 16 16 v 66 a 4 4 0 0 1 -4 4 H 26 a 4 4 0 0 1 -4 -4 V 12 a 4 4 0 0 1 4 -4 Z"
        fill="#ffffff"
        stroke="#d4d4d8"
        strokeWidth="2"
      />
      <path d="M 60 8 l 16 16 H 62 a 2 2 0 0 1 -2 -2 Z" fill="#e4e4e7" />
      <line x1="32" y1="38" x2="68" y2="38" stroke="#d4d4d8" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="48" x2="68" y2="48" stroke="#e4e4e7" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="58" x2="56" y2="58" stroke="#e4e4e7" strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="66" width="44" height="18" rx="4" fill={color} />
      <text x="50" y="79" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="system-ui">
        {label}
      </text>
    </svg>
  );
}

function PictureThumb({ pic, size = 52 }: { pic: Picture; size?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-md bg-neutral-200 ring-1 ring-black/10 dark:bg-neutral-700 dark:ring-white/15"
      style={{ width: size, height: size * 0.78 }}
    >
      {/* poster still for videos — Finder thumbnails never fetch the clip */}
      <Image
        src={pic.kind === "video" ? pic.poster! : pic.src}
        alt={pic.caption}
        fill
        sizes="80px"
        loading="lazy"
        className="object-cover"
      />
    </div>
  );
}

// ── Item model ────────────────────────────────────────────────────────

type Item = {
  id: string;
  name: string;
  kind: string;
  size: string;
  modified: string;
  icon: (px: number) => React.ReactNode;
  onOpen: () => void;
};

function relTime(ts: number, now: number | null): string {
  if (now === null) return PENDING_DATE;
  const mins = Math.floor((now - ts) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// `now` is null until the client mounts (see MyFolder) — every simulated
// timestamp below is derived from it rather than written out as a literal.
function useItems(loc: Loc, navigate: (l: Loc) => void, recents: RecentEntry[], now: number | null): Item[] {
  const { openApp } = useWindowManager();

  if (loc === "recents") {
    // old localStorage entries may reference removed apps — drop them
    return recents.filter((r) => APP_META.some((a) => a.id === r.appId)).map((r) => {
      const app = APP_META.find((a) => a.id === r.appId);
      return {
        id: `recent-${r.appId}`,
        name: app?.name ?? r.appId,
        kind: "Application",
        size: "--",
        modified: relTime(r.at, now),
        icon: (px: number) => <AppIcon id={r.appId} size={px} variant="dock" />,
        onOpen: () => openApp(r.appId),
      };
    });
  }

  if (loc === "games") {
    const gameIds: AppId[] = ["game-snake", "game-pacman", "game-2048", "game-mines", "game-breakout", "game-dino", "game-vault", "game-quest"];
    return gameIds.map((id) => {
      const app = APP_META.find((a) => a.id === id);
      return {
        id: `game-${id}`,
        name: app?.name ?? id,
        kind: "Application",
        size: "--",
        modified: "--",
        icon: (px: number) => <AppIcon id={id} size={px} variant="dock" />,
        onOpen: () => openApp(id),
      };
    });
  }

  if (loc === "applications") {
    // Projects/Resume live as folder/file items; games appear individually
    // (the Arcade hub app is hidden here in their favour)
    const windowed = APP_META.filter(
      (a) => a.id !== "myfolder" && a.id !== "projects" && a.id !== "resume",
    ).map((app) => ({
      id: `app-${app.id}`,
      name: app.name,
      kind: "Application",
      size: "--",
      modified: "--",
      icon: (px: number) => <AppIcon id={app.id} size={px} variant="dock" />,
      onOpen: () => openApp(app.id),
    }));

    // Link-only apps sit alongside the real ones but leave for a browser tab
    const links = linkApps.map((app) => ({
      id: `app-${app.id}`,
      name: app.name,
      kind: "Application",
      size: "--",
      modified: "--",
      icon: (px: number) => <AppIcon id={app.id} size={px} variant="dock" />,
      onOpen: () => openExternal(app.url),
    }));

    return [...windowed, ...links].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (loc === "trash") {
    return TRASH_ITEMS.map(({ name, kind, size, daysAgo, label }) => {
      // Names that quote their own date can only be built once we know "now";
      // before mount, fall back to the plain-string form.
      const resolved =
        typeof name === "string" ? name : now === null ? PENDING_DATE : name(fileDate(now, daysAgo));
      return {
      id: `trash-${typeof name === "string" ? name : label + daysAgo}`,
      name: resolved,
      kind,
      size,
      modified: fileDay(now, daysAgo),
      icon: (px: number) =>
        label === "DIR" ? (
          <FolderIcon size={px} />
        ) : (
          <FileIcon label={label} color={TRASH_COLORS[label] ?? "#525252"} size={px} />
        ),
      onOpen: () => playClick(),
      };
    });
  }


  if (loc === "downloads") {
    // [name, kind, size, daysAgo, hour, minute, label]
    const files: [string, string, string, number, number, number, string][] = [
      ["chatgpt.dmg", "Disk Image", "412.7 MB", 0, 13, 12, "DMG"],
      ["node-v22.11.0.pkg", "Installer Package", "82.3 MB", 1, 21, 2, "PKG"],
      ["wallpaper-4k-final.jpg", "JPEG image", "8.1 MB", 1, 15, 44, "JPG"],
      ["resume-final-FINAL-v7.pdf", "PDF Document", "128 KB", 4, 14, 20, "PDF"],
      ["definitely-not-a-virus.exe", "MS-DOS Application", "666 KB", 6, 23, 11, "EXE"],
    ];
    const colors: Record<string, string> = { DMG: "#6366f1", PKG: "#b45309", JPG: "#059669", PDF: "#dc2626", EXE: "#525252" };
    return files.map(([name, kind, size, daysAgo, hour, minute, label]) => ({
      id: `dl-${name}`,
      name,
      kind,
      size,
      modified: fileStamp(now, daysAgo, hour, minute),
      icon: (px: number) => <FileIcon label={label} color={colors[label]} size={px} />,
      onOpen: () => playClick(),
    }));
  }

  if (loc === "projects") {
    return projects.map((p, i) => ({
      id: p.id,
      name: p.name,
      kind: "Folder",
      size: "--",
      // newest project on top touched today, the rest a month or so back and
      // creeping more recent down the list (offsets keyed off the array length
      // so the spread holds however many projects there are)
      modified:
        i === 0
          ? fileStamp(now, 0, 14, 10)
          : fileStamp(now, 27 + 3 * (projects.length - 1 - i), 11, i % 10),
      icon: (px: number) => <FolderIcon size={px} />,
      onOpen: () => {
        // jump straight to this project's detail view
        requestProject(p.id);
        openApp("projects");
      },
    }));
  }

  if (loc === "pictures") {
    return pictures.map((pic, i) => ({
      id: pic.id,
      name: pic.src.split("/").pop()!,
      kind: pic.kind === "video" ? "QuickTime movie" : "JPEG image",
      size: `${(1.2 + i * 0.7).toFixed(1)} MB`,
      // a fortnight-ish old, each shot a day newer than the last
      modified: fileStamp(now, 10 + (pictures.length - 1 - i), 13 + (i % 8), 20 + (i % 10)),
      icon: (px: number) => <PictureThumb pic={pic} size={px} />,
      onOpen: () => {
        // deep-link the Photos app straight to this shot's full view
        requestPhoto(pic.id);
        openApp("pictures");
      },
    }));
  }

  const docFiles: Item[] = [
    {
      id: "about",
      name: "about-me.txt",
      kind: "Plain Text",
      size: "4 KB",
      modified: fileStamp(now, 1, 16, 44),
      icon: (px: number) => <FileIcon label="TXT" color="#f59e0b" size={px} />,
      onOpen: () => openApp("about"),
    },
    {
      id: "resume",
      name: "resume.pdf",
      kind: "PDF Document",
      size: "128 KB",
      modified: fileStamp(now, 2, 16, 12),
      icon: (px: number) => <FileIcon label="PDF" color="#dc2626" size={px} />,
      onOpen: () => openApp("resume"),
    },
    {
      id: "contact",
      name: "contact.mail",
      kind: "Mail Message",
      size: "2 KB",
      modified: fileStamp(now, 4, 9, 31),
      icon: (px: number) => <FileIcon label="@" color="#0284c7" size={px} />,
      onOpen: () => openApp("contact"),
    },
  ];

  if (loc === "documents") return docFiles;

  return [
    {
      id: "projects-folder",
      name: "Projects",
      kind: "Folder",
      size: "--",
      modified: fileStamp(now, 0, 18, 16),
      icon: (px: number) => <FolderIcon size={px} />,
      onOpen: () => navigate("projects"),
    },
    {
      id: "pictures-folder",
      name: "Pictures",
      kind: "Folder",
      size: "--",
      modified: fileStamp(now, 1, 16, 45),
      icon: (px: number) => <FolderIcon size={px} />,
      onOpen: () => navigate("pictures"),
    },
    {
      id: "games-folder",
      name: "Games",
      kind: "Folder",
      size: "--",
      modified: fileStamp(now, 0, 17, 55),
      icon: (px: number) => <FolderIcon size={px} />,
      onOpen: () => navigate("games"),
    },
    ...docFiles,
  ];
}

// ── Macintosh HD storage view ─────────────────────────────────────────

const STORAGE_SEGMENTS = [
  { label: "Documents", gb: 38.81, color: "#ef4444" },
  { label: "Applications", gb: 36.75, color: "#f97316" },
  { label: "Developer", gb: 8.47, color: "#eab308" },
  { label: "System Data", gb: 156.2, color: "#9ca3af" },
  { label: "macOS", gb: 24.68, color: "#d1d5db" },
];
const STORAGE_TOTAL = 994.61;
const STORAGE_USED = STORAGE_SEGMENTS.reduce((s, x) => s + x.gb, 0);

const STORAGE_CATEGORIES = [
  { label: "Applications", size: "36.75 GB", emoji: "🅰️" },
  { label: "Bin", size: "3.5 MB", emoji: "🗑️" },
  { label: "Developer", size: "8.47 GB", emoji: "🔨" },
  { label: "Documents", size: "38.81 GB", emoji: "📄" },
  { label: "macOS", size: "24.68 GB", emoji: "💻" },
  { label: "System Data", size: "156.2 GB", emoji: "⚙️" },
];

export function StorageView() {
  return (
    <div className="flex-1 space-y-4 overflow-auto bg-neutral-100/70 p-4 dark:bg-neutral-800/60">
      {/* usage bar */}
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-100">Macintosh HD</p>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
            {STORAGE_USED.toFixed(2)} GB of {STORAGE_TOTAL} GB used
          </p>
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-md">
          {STORAGE_SEGMENTS.map((seg) => (
            <div
              key={seg.label}
              style={{ width: `${(seg.gb / STORAGE_TOTAL) * 100}%`, backgroundColor: seg.color }}
              title={`${seg.label} — ${seg.gb} GB`}
            />
          ))}
          <div className="flex flex-1 items-center justify-center bg-neutral-300 text-[11px] font-medium text-neutral-600 dark:bg-neutral-600 dark:text-neutral-200">
            {(STORAGE_TOTAL - STORAGE_USED).toFixed(2)} GB free
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {STORAGE_SEGMENTS.map((seg) => (
            <span key={seg.label} className="flex items-center gap-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
          ))}
        </div>
      </div>

      {/* recommendations */}
      <div>
        <p className="mb-2 text-[15px] font-bold text-neutral-800 dark:text-neutral-100">Recommendations</p>
        <div className="space-y-px overflow-hidden rounded-xl bg-white shadow-sm dark:bg-neutral-800">
          {[
            {
              emoji: "☁️",
              title: "Store in iCloud",
              desc: "Store all files, photos and messages in iCloud and save space by keeping only recent files on this Mac.",
              button: "Store in iCloud…",
            },
            {
              emoji: "🍿",
              title: "Optimise Storage",
              desc: "Save space by automatically removing movies and TV shows you've already watched from this Mac.",
              button: "Optimise…",
            },
          ].map((rec) => (
            <div key={rec.title} className="flex items-start gap-3 border-b border-neutral-100 p-4 last:border-0 dark:border-neutral-700">
              <span className="text-2xl">{rec.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">{rec.title}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">{rec.desc}</p>
              </div>
              <button
                onClick={() => playClick()}
                className="shrink-0 rounded-lg bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
              >
                {rec.button}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* categories */}
      <div className="space-y-px overflow-hidden rounded-xl bg-white shadow-sm dark:bg-neutral-800">
        {STORAGE_CATEGORIES.map((cat) => (
          <div key={cat.label} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-base dark:bg-neutral-700">
              {cat.emoji}
            </span>
            <span className="flex-1 text-[13px] font-medium text-neutral-800 dark:text-neutral-100">{cat.label}</span>
            <span className="text-[13px] text-neutral-500 dark:text-neutral-400">{cat.size}</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[9px] text-neutral-400 dark:border-neutral-600">
              i
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Toolbar pieces ────────────────────────────────────────────────────

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "left" ? <path d="M 10 3 L 5 8 l 5 5" /> : <path d="M 6 3 l 5 5 -5 5" />}
    </svg>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────

const SIDEBAR: { section: string; items: { label: string; loc?: Loc }[] }[] = [
  {
    section: "Favourites",
    items: [
      { label: "Recents", loc: "recents" },
      { label: "Applications", loc: "applications" },
      { label: "Desktop", loc: "desktop" },
      { label: "Documents", loc: "documents" },
      { label: "Downloads", loc: "downloads" },
    ],
  },
  { section: "Locations", items: [{ label: "Macintosh HD", loc: "macintoshhd" }] },
];

function Sidebar({ current, onNav }: { current: Loc; onNav: (l: Loc) => void }) {
  return (
    <div className="w-40 shrink-0 space-y-3 overflow-auto border-r border-black/5 bg-white/30 px-2 py-3 dark:border-white/10 dark:bg-neutral-900/40">
      {SIDEBAR.map((group) => (
        <div key={group.section}>
          <p className="mb-1 px-2 text-[10px] font-semibold text-neutral-400">{group.section}</p>
          {group.items.map((item) => {
            const active = item.loc !== undefined && item.loc === current;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.loc !== undefined) onNav(item.loc);
                }}
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] font-medium ${
                  active
                    ? "bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                    : "text-neutral-500 hover:bg-black/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                }`}
              >
                <span className={active ? "text-blue-500" : "text-blue-400"}>
                  <FolderIcon size={14} />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── iOS Files (mobile <768px) ─────────────────────────────────────────
// Below 768px the window chrome is gone (full-screen iOS shell), so the
// Finder reshapes into the Files app: a root "Browse" list of locations,
// each pushing a full-screen view with a back button. Desktop rendering
// (≥768px) is untouched — MyFolder returns early with this layout only
// when useIsMobile() reports true.

// Applications and storage moved into the mobile Settings app; recents,
// desktop, games and bin are desktop concepts.
const BROWSE_GROUPS: { section: string; locs: Loc[] }[] = [
  { section: "Favourites", locs: ["documents", "downloads", "projects", "pictures"] },
];

/** Filled folder glyph in iOS system blue, SF-symbol flavoured. */
function IOSFolderGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h4.09c.71 0 1.38.3 1.85.82l.86.95c.29.31.69.48 1.11.48h7.09A2.5 2.5 0 0 1 22 8.75v8.75A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Z" />
    </svg>
  );
}

/** Grid/list switch with 44px touch targets (ViewToggle is desktop-sized). */
function MobileViewToggle({ view, setView }: { view: "grid" | "list"; setView: (v: "grid" | "list") => void }) {
  const btn = (v: "grid" | "list", label: string, icon: React.ReactNode) => (
    <button
      aria-label={label}
      onClick={() => {
        playClick();
        setView(v);
      }}
      className={`flex h-11 w-11 items-center justify-center ${view === v ? "text-[#007aff]" : "text-neutral-400 dark:text-neutral-500"}`}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex items-center">
      {btn(
        "grid",
        "Icon view",
        <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>,
      )}
      {btn(
        "list",
        "List view",
        <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
          <rect x="1" y="2" width="2" height="2" rx="0.5" />
          <rect x="5" y="2" width="10" height="2" rx="0.5" />
          <rect x="1" y="7" width="2" height="2" rx="0.5" />
          <rect x="5" y="7" width="10" height="2" rx="0.5" />
          <rect x="1" y="12" width="2" height="2" rx="0.5" />
          <rect x="5" y="12" width="10" height="2" rx="0.5" />
        </svg>,
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

export function MyFolder() {
  const isMobile = useIsMobile();
  const [history, setHistory] = useState<Loc[]>(["desktop"]);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  // Phones start on the Files-style "Browse" root instead of a location;
  // any navigation (tap or deep-link) drops into the location view.
  const [mobileAtRoot, setMobileAtRoot] = useState(true);
  // Simulated file dates are relative to the real clock, but reading it during
  // render would make the prerendered HTML disagree with the client. Stay null
  // through the first paint and fill in on mount, same as MenuBar's Clock.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setRecents(getRecents());
    return subscribeRecents(setRecents);
  }, []);

  const loc = history[idx];

  // dock trash (and future outside callers) can steer Finder to a location
  const navRef = useRef<(l: Loc) => void>(() => {});
  useEffect(() => {
    const pending = consumePendingFinderLocation();
    if (pending && pending in LOC_TITLE) navRef.current(pending as Loc);
    return subscribeFinderNav((l) => {
      if (l in LOC_TITLE) navRef.current(l as Loc);
    });
  }, []);

  const navigate = (l: Loc) => {
    // Leave the mobile Browse root even when already "at" the target, so
    // deep-links to the current location still land inside it.
    setMobileAtRoot(false);
    if (l === loc) return;
    playClick();
    if (isMobile) {
      // phones keep a fresh stack per location — back always returns to Browse
      setHistory([l]);
      setIdx(0);
    } else {
      setHistory((h) => [...h.slice(0, idx + 1), l]);
      setIdx((i) => i + 1);
    }
    setSelected(null);
    // Applications reads best as a list, like real Finder defaults
    if (l === "applications") setView("list");
  };
  navRef.current = navigate;
  const goBack = () => {
    if (idx === 0) return;
    playClick();
    setIdx((i) => i - 1);
    setSelected(null);
  };
  const goForward = () => {
    if (idx >= history.length - 1) return;
    playClick();
    setIdx((i) => i + 1);
    setSelected(null);
  };

  const items = useItems(loc, navigate, recents, now);

  // ── iOS Files layout (phones only; desktop falls through untouched) ──
  if (isMobile) {
    if (mobileAtRoot) {
      return (
        <div className="h-full overflow-y-auto overflow-x-hidden bg-[#f2f2f7] px-4 pb-8 dark:bg-black">
          <h1 className="pb-4 pt-3 text-[34px] font-bold tracking-tight text-neutral-900 dark:text-white">Browse</h1>
          {BROWSE_GROUPS.map((group) => (
            <div key={group.section} className="mb-6">
              <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {group.section}
              </p>
              <div className="divide-y divide-black/[0.07] overflow-hidden rounded-xl bg-white dark:divide-white/10 dark:bg-neutral-800">
                {group.locs.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      playClick();
                      // fresh stack per visit — back from any location returns to Browse
                      setMobileAtRoot(false);
                      setHistory([l]);
                      setIdx(0);
                      setSelected(null);
                      if (l === "applications") setView("list");
                    }}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left active:bg-black/[0.05] dark:active:bg-white/[0.07]"
                  >
                    <span className="shrink-0 text-[#007aff]">
                      <IOSFolderGlyph />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[17px] text-neutral-900 dark:text-white">
                      {LOC_TITLE[l]}
                    </span>
                    <span className="shrink-0 text-neutral-300 dark:text-neutral-600">
                      <Chevron dir="right" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const backLabel = idx > 0 ? LOC_TITLE[history[idx - 1]] : "Browse";
    const mobileBack = () => {
      if (idx > 0) goBack();
      else {
        playClick();
        setMobileAtRoot(true);
      }
    };

    return (
      <div className="flex h-full flex-col overflow-x-hidden bg-[#f2f2f7] dark:bg-black">
        {/* nav bar: back on the left, centred title, view switch on the right */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-black/10 bg-[#f2f2f7]/95 px-1 backdrop-blur dark:border-white/10 dark:bg-black/80">
          <button
            onClick={mobileBack}
            className="flex min-h-[44px] max-w-[36%] items-center pl-1 pr-2 text-[17px] text-[#007aff] active:opacity-60"
          >
            <svg viewBox="0 0 16 16" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M 10 3 L 5 8 l 5 5" />
            </svg>
            <span className="truncate">{backLabel}</span>
          </button>
          <span className="pointer-events-none absolute left-1/2 top-1/2 max-w-[42%] -translate-x-1/2 -translate-y-1/2 truncate text-[17px] font-semibold text-neutral-900 dark:text-white">
            {LOC_TITLE[loc]}
          </span>
          <div className="flex min-h-[44px] items-center">
            {loc !== "macintoshhd" && <MobileViewToggle view={view} setView={setView} />}
          </div>
        </div>

        {/* content — single tap opens, the iOS way */}
        {loc === "macintoshhd" ? (
          <StorageView />
        ) : items.length === 0 ? (
          <div className="m-auto text-sm text-neutral-400">
            {loc === "recents" ? "Nothing opened yet — go click something fun" : "Empty"}
          </div>
        ) : view === "grid" ? (
          <div className="grid flex-1 auto-rows-min grid-cols-3 content-start gap-x-2 gap-y-5 overflow-y-auto px-3 py-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={item.onOpen}
                className="flex w-full flex-col items-center gap-1.5 rounded-lg p-1 active:opacity-60"
                aria-label={item.name}
              >
                {item.icon(64)}
                <span className="line-clamp-2 w-full break-words text-center text-[12px] font-medium leading-tight text-neutral-800 dark:text-neutral-100">
                  {item.name}
                </span>
              </button>
            ))}
            <p className="col-span-3 pb-2 pt-4 text-center text-[13px] text-neutral-400">{items.length} items</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-4 my-3 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/10 dark:bg-neutral-800">
              {items.map((item) => {
                const sub = [item.modified, item.size].filter((v) => v !== "--").join(" · ") || item.kind;
                return (
                  <button
                    key={item.id}
                    onClick={item.onOpen}
                    className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                    aria-label={item.name}
                  >
                    <span className="shrink-0">{item.icon(34)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-neutral-900 dark:text-white">{item.name}</span>
                      <span className="block truncate text-[13px] text-neutral-500 dark:text-neutral-400">{sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="pb-4 text-center text-[13px] text-neutral-400">{items.length} items</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full" onClick={() => setSelected(null)}>
      <Sidebar current={loc} onNav={navigate} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-neutral-800/50">
          <button
            aria-label="Back"
            onClick={goBack}
            disabled={idx === 0}
            className="rounded p-1 text-neutral-600 enabled:hover:bg-black/[0.06] disabled:text-neutral-300 dark:text-neutral-300 dark:enabled:hover:bg-white/[0.08] dark:disabled:text-neutral-600"
          >
            <Chevron dir="left" />
          </button>
          <button
            aria-label="Forward"
            onClick={goForward}
            disabled={idx >= history.length - 1}
            className="rounded p-1 text-neutral-600 enabled:hover:bg-black/[0.06] disabled:text-neutral-300 dark:text-neutral-300 dark:enabled:hover:bg-white/[0.08] dark:disabled:text-neutral-600"
          >
            <Chevron dir="right" />
          </button>
          <span className="ml-1 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{LOC_TITLE[loc]}</span>
          <div className="ml-auto flex items-center gap-2">
            {loc !== "macintoshhd" && (
              <>
                <ViewToggle view={view} setView={setView} />
                <span className="text-xs text-neutral-400">{items.length} items</span>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {loc === "macintoshhd" ? (
          <StorageView />
        ) : items.length === 0 ? (
          <div className="m-auto text-sm text-neutral-400">
            {loc === "recents" ? "Nothing opened yet — go click something fun" : "Empty"}
          </div>
        ) : view === "grid" ? (
          <div className="grid flex-1 auto-rows-min grid-cols-4 content-start gap-2 overflow-auto p-4">
            {items.map((item) => (
              <Draggable key={item.id}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playClick();
                    setSelected(item.id);
                  }}
                  onDoubleClick={item.onOpen}
                  className="flex w-full flex-col items-center gap-1.5 rounded-lg p-3"
                  aria-label={item.name}
                >
                  <div className={`rounded-lg p-1 ${selected === item.id ? "bg-blue-500/15 ring-1 ring-blue-400/40" : ""}`}>
                    {item.icon(52)}
                  </div>
                  <span
                    className={`max-w-full truncate rounded px-1 text-xs font-medium ${
                      selected === item.id ? "bg-blue-500 text-white" : "text-neutral-700 dark:text-neutral-200"
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
              </Draggable>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-auto py-1">
            <div className="mb-0.5 flex items-center gap-2 border-b border-black/5 px-4 pb-1 text-[11px] font-semibold text-neutral-400 dark:border-white/10">
              <span className="flex-1">Name</span>
              <span className="w-36">{loc === "recents" ? "Last Opened" : "Date Modified"}</span>
              <span className="w-14 text-right">Size</span>
              <span className="w-24">Kind</span>
            </div>
            {items.map((item, i) => {
              const isSel = selected === item.id;
              return (
                <button
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    playClick();
                    setSelected(item.id);
                  }}
                  onDoubleClick={item.onOpen}
                  className={`flex w-full items-center gap-2 px-4 py-[5px] text-left transition ${
                    isSel ? "bg-blue-500 text-white" : i % 2 ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""
                  }`}
                  aria-label={item.name}
                >
                  <span className="shrink-0">{item.icon(18)}</span>
                  <span className={`flex-1 truncate text-[13px] font-medium ${isSel ? "text-white" : "text-neutral-700 dark:text-neutral-200"}`}>
                    {item.name}
                  </span>
                  <span className={`w-36 truncate text-[12px] ${isSel ? "text-white/80" : "text-neutral-400"}`}>
                    {item.modified}
                  </span>
                  <span className={`w-14 text-right text-[12px] ${isSel ? "text-white/80" : "text-neutral-400"}`}>
                    {item.size}
                  </span>
                  <span className={`w-24 truncate text-[12px] ${isSel ? "text-white/80" : "text-neutral-400"}`}>
                    {item.kind}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
