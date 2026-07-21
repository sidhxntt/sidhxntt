"use client";

import { useEffect, useRef, useState } from "react";
import { seedNotes as SEED_NOTES } from "@/data/notes";
import { NoteEditor, type NoteEditorHandle } from "./NoteEditor";
import { mdToPlain } from "@/lib/markdown";
import { playClick } from "@/lib/sounds";
import { consumePendingNote, subscribeNoteNav } from "@/lib/note-nav";
import { useIsMobile } from "@/lib/useIsMobile";

// Apple-Notes-style app (light UI): folders sidebar, note list, editable editor.
// Notes persist in localStorage.

type FontSize = "sm" | "md" | "lg";
type Note = { id: string; title: string; body: string; updated: number; folderId: string; fontSize?: FontSize };
type Folder = { id: string; name: string };

// v3 = notes hold markdown and render formatted. Older keys stored flat text
// that would show as one grey blob here, so they're abandoned, not migrated.
const STORAGE_KEY = "portfolio-notes-v3";

/**
 * Bump whenever the seed copy in src/data/notes.ts changes.
 *
 * Stored notes otherwise shadow the seeds forever: a visitor who opened the app
 * once keeps their snapshot, and edits to the portfolio content never surface.
 * On a bump the seeded notes are rewritten from source (and retired ones like
 * "products" disappear); notes the visitor wrote themselves are left alone.
 */
const SEED_VERSION = 4;

function seedFolders(): Folder[] {
  return [{ id: "notes", name: "Notes" }];
}

const DAY = 1000 * 60 * 60 * 24;

function seedNotes(): Note[] {
  const now = Date.now();
  return [
    // one note per section of the portfolio — see src/data/notes.ts
    ...SEED_NOTES.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      updated: now - n.daysAgo * DAY,
      folderId: "notes",
    })),
  ];
}

/**
 * Seed notes that used to ship and shouldn't come back. Purged on every load,
 * not just on a version bump — a visitor whose storage was already stamped with
 * the current version would otherwise keep them forever.
 */
const RETIRED_SEED_IDS = new Set(["hello", "about", "products"]);

/** Adds any seed note written since the visitor's copy was stored. */
function withMissingSeeds(stored: Note[]): Note[] {
  const have = new Set(stored.map((n) => n.id));
  return [...stored, ...seedNotes().filter((n) => !have.has(n.id))];
}

/** Rewrites the seeded notes from source, keeping anything the visitor wrote. */
function resyncSeeds(stored: Note[]): Note[] {
  const seedIds = new Set(SEED_NOTES.map((n) => n.id));
  return [...seedNotes(), ...stored.filter((n) => !seedIds.has(n.id))];
}

function loadState(): { notes: Note[]; folders: Folder[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { notes?: Note[]; folders?: Folder[]; seedVersion?: number };
      if (Array.isArray(parsed.notes) && parsed.notes.length && Array.isArray(parsed.folders) && parsed.folders.length) {
        // folder creation was removed — collapse everything back into the one "Notes" folder
        const stored = parsed.notes
          .filter((n) => !RETIRED_SEED_IDS.has(n.id))
          .map((n) => ({ ...n, folderId: "notes" }));
        return {
          notes:
            parsed.seedVersion === SEED_VERSION ? withMissingSeeds(stored) : resyncSeeds(stored),
          folders: seedFolders(),
        };
      }
    }
  } catch {
    // corrupted storage → reseed
  }
  return { notes: seedNotes(), folders: seedFolders() };
}

/** The paragraph-style menu. `list` entries toggle a list instead of a block. */
const BLOCK_STYLES: { label: string; tag?: string; list?: boolean; className: string }[] = [
  { label: "Title", tag: "h1", className: "text-[15px] font-bold" },
  { label: "Heading", tag: "h2", className: "text-[14px] font-bold" },
  { label: "Subheading", tag: "h3", className: "text-[13px] font-semibold" },
  { label: "Body", tag: "p", className: "" },
  { label: "Quote", tag: "blockquote", className: "italic" },
  { label: "Bulleted list", list: false, className: "" },
  { label: "Numbered list", list: true, className: "" },
];

/** Longest edge an embedded image is allowed, in px. */
const MAX_IMAGE_EDGE = 1200;

/** Reads a picked file and returns a downscaled JPEG data URL. */
function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("unreadable"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("not an image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function groupLabel(updated: number): string {
  const days = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (days < 1) return "Today";
  if (days < 7) return "Previous 7 Days";
  return "Previous 30 Days";
}

function fmtFull(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function ToolbarButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`rounded-md p-1.5 text-neutral-500 transition dark:text-neutral-400 ${onClick ? "hover:bg-black/[0.06] hover:text-neutral-800 dark:hover:bg-white/[0.08] dark:hover:text-neutral-200" : "cursor-default opacity-50"}`}
    >
      {children}
    </button>
  );
}

export function About() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>("notes");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  // iOS-only: whether the full-screen editor is pushed over the notes list
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const isMobile = useIsMobile();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<NoteEditorHandle>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadState();
    setNotes(loaded.notes);
    setFolders(loaded.folders);
    setSelectedId([...loaded.notes].sort((a, b) => b.updated - a.updated)[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (notes && folders)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, folders, seedVersion: SEED_VERSION }));
  }, [notes, folders]);

  // Siri & Spotlight deep-link to one note — waits for the notes to hydrate so a
  // request that lands before load still resolves
  useEffect(() => {
    if (!notes) return;
    const jump = (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return;
      const hit =
        notes.find((n) => n.title.toLowerCase() === q) ??
        notes.find((n) => n.title.toLowerCase().includes(q)) ??
        notes.find((n) => n.body.toLowerCase().includes(q));
      if (!hit) return;
      setActiveFolderId(hit.folderId);
      setSelectedId(hit.id);
      // on phones a deep-link should land inside the editor, not the list
      setMobileEditorOpen(true);
    };
    const pending = consumePendingNote();
    if (pending) jump(pending);
    return subscribeNoteNav(jump);
  }, [notes]);

  useEffect(() => {
    if (!fontMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!fontMenuRef.current?.contains(e.target as Node)) setFontMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [fontMenuOpen]);

  useEffect(() => {
    if (!blockMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!blockMenuRef.current?.contains(e.target as Node)) setBlockMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [blockMenuOpen]);

  // The hydration placeholder must match whichever layout is about to mount, or
  // the phone flashes the macOS paper colour before settling on the iOS black.
  if (!notes || !folders || isMobile === null)
    return <div className="h-full bg-[#f7f6f2] dark:bg-neutral-900 max-md:dark:bg-black" />;

  const inFolder = (n: Note) => activeFolderId === null || n.folderId === activeFolderId;
  const folderNotes = notes.filter(inFolder);
  const q = query.trim().toLowerCase();
  const visible = q
    ? folderNotes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    : folderNotes;
  const sorted = [...visible].sort((a, b) => b.updated - a.updated);
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const activeFolder = activeFolderId === null ? null : (folders.find((f) => f.id === activeFolderId) ?? null);
  const listTitle = activeFolderId === null ? "Quick Notes" : (activeFolder?.name ?? "Notes");

  const updateSelected = (patch: Partial<Note>) => {
    if (!selected) return;
    setNotes((ns) => ns!.map((n) => (n.id === selected.id ? { ...n, ...patch, updated: Date.now() } : n)));
  };

  const addNote = () => {
    playClick();
    const fresh: Note = {
      id: `n-${Date.now()}`,
      title: "",
      body: "",
      updated: Date.now(),
      folderId: activeFolderId ?? "notes",
    };
    setNotes((ns) => [fresh, ...ns!]);
    setSelectedId(fresh.id);
    setMobileEditorOpen(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const deleteSelected = () => {
    if (!selected) return;
    playClick();
    setNotes((ns) => {
      const rest = ns!.filter((n) => n.id !== selected.id);
      const next = rest.length ? rest : seedNotes().slice(0, 1);
      const nextVisible = next.filter((n) => activeFolderId === null || n.folderId === activeFolderId);
      setSelectedId([...nextVisible].sort((a, b) => b.updated - a.updated)[0]?.id ?? null);
      return next;
    });
  };

  const selectFolder = (folderId: string | null) => {
    playClick();
    setActiveFolderId(folderId);
    const pool = notes.filter((n) => folderId === null || n.folderId === folderId);
    setSelectedId([...pool].sort((a, b) => b.updated - a.updated)[0]?.id ?? null);
  };

  const toggleSearch = () => {
    playClick();
    if (searchOpen) {
      setSearchOpen(false);
      setQuery("");
    } else {
      setSearchOpen(true);
    }
  };

  const toggleSidebar = () => {
    playClick();
    setSidebarVisible((v) => !v);
  };

  const setFontSize = (size: FontSize) => {
    playClick();
    if (selected) {
      // don't bump `updated` for a style tweak — keep list order stable
      setNotes((ns) => ns!.map((n) => (n.id === selected.id ? { ...n, fontSize: size } : n)));
    }
    setFontMenuOpen(false);
  };

  const applyFormat = (command: string) => {
    if (!selected) return;
    playClick();
    bodyRef.current?.format(command);
  };

  const insertChecklist = () => {
    if (!selected) return;
    playClick();
    bodyRef.current?.insertChecklist();
  };

  const insertTable = () => {
    if (!selected) return;
    playClick();
    bodyRef.current?.insertTable();
  };

  const applyBlock = (tag: string) => {
    if (!selected) return;
    playClick();
    bodyRef.current?.formatBlock(tag);
    setBlockMenuOpen(false);
  };

  const applyList = (ordered: boolean) => {
    if (!selected) return;
    playClick();
    bodyRef.current?.insertList(ordered);
    setBlockMenuOpen(false);
  };

  const insertRule = () => {
    if (!selected) return;
    playClick();
    bodyRef.current?.insertRule();
    setBlockMenuOpen(false);
  };

  const openLinkBox = () => {
    if (!selected) return;
    playClick();
    setLinkUrl("https://");
    setLinkOpen(true);
  };

  const commitLink = () => {
    playClick();
    const url = linkUrl.trim();
    bodyRef.current?.insertLink(url === "https://" ? "" : url);
    setLinkOpen(false);
  };

  /**
   * Images embed as data URLs so a note survives a refresh with no server.
   * They're downscaled first — a phone photo would blow the localStorage quota
   * and take the whole notes store down with it.
   */
  const pickImage = () => {
    if (!selected) return;
    playClick();
    fileRef.current?.click();
  };

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked twice
    if (!file) return;
    try {
      const src = await downscaleToDataUrl(file);
      bodyRef.current?.insertImage(src, file.name.replace(/\.[^.]+$/, ""));
    } catch {
      // unreadable or unsupported image — leave the note untouched
    }
  };

  const bodyFontClass =
    selected?.fontSize === "sm" ? "text-[12px]" : selected?.fontSize === "lg" ? "text-[17px]" : "text-[14px]";

  const folderCount = (folderId: string) => notes.filter((n) => n.folderId === folderId).length;

  // group the sorted list for section headers
  const groups: { label: string; items: Note[] }[] = [];
  for (const n of sorted) {
    const label = groupLabel(n.updated);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(n);
    else groups.push({ label, items: [n] });
  }

  // ——— iOS Notes (phones only, <768px) ———
  if (isMobile) {
    if (mobileEditorOpen && selected) {
      return (
        <div className="flex h-full flex-col bg-[#f7f6f2] text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {/* Nav bar: back + editor actions */}
          <div className="flex shrink-0 items-center justify-between px-1.5 py-1.5">
            <button
              onClick={() => {
                playClick();
                setMobileEditorOpen(false);
              }}
              className="flex items-center gap-0.5 rounded-md px-1.5 py-1.5 text-[17px] text-yellow-600 active:opacity-50 dark:text-yellow-500"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 12.5 4 L 6.5 10 l 6 6" />
              </svg>
              About Me
            </button>
            <div className="flex items-center gap-1 pr-1 text-yellow-600 dark:text-yellow-500">
              <div className="relative" ref={fontMenuRef}>
                <button
                  aria-label="Text styles"
                  onClick={() => {
                    playClick();
                    setFontMenuOpen((o) => !o);
                  }}
                  className="rounded-md p-2 active:opacity-50"
                >
                  <span className="text-[15px]">Aa</span>
                </button>
                {fontMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800">
                    {(
                      [
                        { size: "sm", label: "Small" },
                        { size: "md", label: "Default" },
                        { size: "lg", label: "Large" },
                      ] as { size: FontSize; label: string }[]
                    ).map((opt) => {
                      const current = (selected.fontSize ?? "md") === opt.size;
                      return (
                        <button
                          key={opt.size}
                          onClick={() => setFontSize(opt.size)}
                          className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[15px] text-neutral-700 active:bg-black/[0.05] dark:text-neutral-200 dark:active:bg-white/[0.08] ${
                            current ? "bg-black/[0.08] dark:bg-white/[0.12]" : ""
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button aria-label="Bold" onClick={() => applyFormat("bold")} className="rounded-md px-2 py-2 text-[15px] font-bold active:opacity-50">
                B
              </button>
              <button aria-label="Italic" onClick={() => applyFormat("italic")} className="rounded-md px-2 py-2 font-serif text-[15px] italic active:opacity-50">
                I
              </button>
              <button aria-label="Underline" onClick={() => applyFormat("underline")} className="rounded-md px-2 py-2 text-[15px] underline underline-offset-2 active:opacity-50">
                U
              </button>
              <button aria-label="Checklist" onClick={insertChecklist} className="rounded-md p-2 active:opacity-50">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="5" cy="6" r="2" />
                  <circle cx="5" cy="14" r="2" />
                  <path d="M 10 6 h 7 M 10 14 h 7" />
                </svg>
              </button>
              <button aria-label="Table" onClick={insertTable} className="rounded-md p-2 active:opacity-50">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="14" height="12" rx="1.5" />
                  <path d="M 3 9 h 14 M 10 4 v 12" />
                </svg>
              </button>
              <button aria-label="Add link" onClick={openLinkBox} className="rounded-md p-2 active:opacity-50">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M 8.5 11.5 a 3 3 0 0 0 4.2 0 l 2.6 -2.6 a 3 3 0 0 0 -4.2 -4.2 l -1 1" />
                  <path d="M 11.5 8.5 a 3 3 0 0 0 -4.2 0 l -2.6 2.6 a 3 3 0 0 0 4.2 4.2 l 1 -1" />
                </svg>
              </button>
              <button aria-label="Insert image" onClick={pickImage} className="rounded-md p-2 active:opacity-50">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="14" height="12" rx="2" />
                  <circle cx="7.5" cy="8" r="1.2" />
                  <path d="M 4 14 l 4 -4 3 3 2 -2 3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                aria-label="Delete note"
                onClick={() => {
                  deleteSelected();
                  setMobileEditorOpen(false);
                }}
                className="rounded-md p-2 active:opacity-50"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M 4 6 h 12 M 8 6 V 4.5 A 1 1 0 0 1 9 3.5 h 2 a 1 1 0 0 1 1 1 V 6 m 3 0 l -0.8 9.5 a 1.5 1.5 0 0 1 -1.5 1.4 h -5.4 a 1.5 1.5 0 0 1 -1.5 -1.4 L 5 6" />
                </svg>
              </button>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onImageChosen}
            className="hidden"
            aria-hidden
          />
          {linkOpen && (
            <div className="mx-3 mb-2 flex items-center gap-1 rounded-xl bg-black/[0.06] p-1 dark:bg-white/[0.1]">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLink();
                  if (e.key === "Escape") setLinkOpen(false);
                }}
                placeholder="https://…"
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[15px] text-neutral-800 outline-none dark:text-neutral-100"
              />
              <button
                onClick={commitLink}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white active:opacity-70"
              >
                Link
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-1">
            <p className="pb-3 text-center text-[12px] text-neutral-400">{fmtFull(selected.updated)}</p>
            <input
              ref={titleRef}
              value={selected.title}
              onChange={(e) => updateSelected({ title: e.target.value })}
              placeholder="Title"
              className="bg-transparent text-[26px] font-bold text-neutral-900 outline-none placeholder:text-neutral-300 dark:text-neutral-50 dark:placeholder:text-neutral-600"
            />
            <NoteEditor
              ref={bodyRef}
              noteId={selected.id}
              markdown={selected.body}
              onChange={(body) => updateSelected({ body })}
              placeholder="Start writing…"
              className={`mt-2 min-h-0 flex-1 overflow-y-auto bg-transparent ${bodyFontClass} leading-relaxed text-neutral-700 outline-none dark:text-neutral-300`}
            />
          </div>
        </div>
      );
    }

    // Root: notes list
    return (
      <div className="relative flex h-full flex-col bg-[#f2f2f7] text-neutral-800 dark:bg-black dark:text-neutral-200">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 pt-4">
          <h1 className="text-[34px] font-bold tracking-tight text-yellow-600 dark:text-yellow-500">About Me</h1>
          <div className="mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-[10px] bg-black/[0.07] px-3 py-2 text-[17px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:bg-white/[0.12] dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </div>
          {groups.map((g) => (
            <div key={g.label} className="mt-5">
              <p className="px-1 pb-2 text-[20px] font-bold text-neutral-900 dark:text-neutral-50">{g.label}</p>
              <div className="overflow-hidden rounded-[12px] bg-white dark:bg-neutral-900">
                {g.items.map((n, i) => {
                  const preview = mdToPlain(n.body) || "No additional text";
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        playClick();
                        setSelectedId(n.id);
                        setMobileEditorOpen(true);
                      }}
                      className={`block w-full px-4 py-3 text-left active:bg-black/[0.05] dark:active:bg-white/[0.08] ${
                        i > 0 ? "border-t border-black/[0.06] dark:border-white/[0.08]" : ""
                      }`}
                    >
                      <p className="truncate text-[16px] font-semibold text-neutral-900 dark:text-neutral-50">
                        {n.title || "New Note"}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] text-neutral-500 dark:text-neutral-400">
                        {new Date(n.updated).toLocaleDateString(undefined, { weekday: "long" })}
                        <span className="ml-2 text-neutral-400 dark:text-neutral-500">{preview}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="pt-10 text-center text-[15px] text-neutral-400">{q ? "No results" : "No notes"}</p>
          )}
        </div>

        {/* Bottom bar: note count + compose */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center border-t border-black/[0.06] bg-[#f2f2f7]/90 px-4 py-2.5 backdrop-blur dark:border-white/[0.08] dark:bg-black/80">
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
            {folderNotes.length} Note{folderNotes.length === 1 ? "" : "s"}
          </p>
          <button
            aria-label="New note"
            onClick={addNote}
            className="absolute right-3 rounded-md p-2 text-yellow-600 active:opacity-50 dark:text-yellow-500"
          >
            <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="14" height="14" rx="3" />
              <path d="M 13.5 6.5 l -5 5 L 8 13 l 1.5 -0.5 5 -5 a 1 1 0 0 0 -1 -1 Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#f7f6f2] text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      {/* Folders sidebar */}
      {sidebarVisible && (
        <div className="flex w-44 shrink-0 flex-col border-r border-black/10 bg-[#efeee9] px-2 py-3 dark:border-white/10 dark:bg-neutral-950/50">
          <button
            onClick={() => selectFolder(null)}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
              activeFolderId === null
                ? "bg-black/[0.08] font-medium dark:bg-white/[0.1]"
                : "text-neutral-600 hover:bg-black/[0.05] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
            }`}
          >
            <span className="text-yellow-500">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2.5" y="4" width="15" height="12" rx="2" />
                <path d="M 6 11 q 2 -3 4 0 t 4 0" strokeLinecap="round" />
              </svg>
            </span>
            <span className={`flex-1 text-left ${activeFolderId === null ? "text-neutral-800 dark:text-neutral-100" : ""}`}>Quick Notes</span>
            <span className="text-[12px] text-neutral-400">{notes.length}</span>
          </button>
          <p className="mb-1 mt-4 px-2 text-[11px] font-semibold text-neutral-400">On My Mac</p>
          {folders.map((f) => {
            const isActive = f.id === activeFolderId;
            return (
              <button
                key={f.id}
                onClick={() => selectFolder(f.id)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                  isActive
                    ? "bg-black/[0.08] font-medium dark:bg-white/[0.1]"
                    : "text-neutral-600 hover:bg-black/[0.05] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                }`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-yellow-500" fill="currentColor">
                  <path d="M 2 6 a 1.5 1.5 0 0 1 1.5 -1.5 h 4 l 2 2 h 7 A 1.5 1.5 0 0 1 18 8 v 7 a 1.5 1.5 0 0 1 -1.5 1.5 h -13 A 1.5 1.5 0 0 1 2 15 Z" />
                </svg>
                <span className={`flex-1 truncate text-left ${isActive ? "text-neutral-800 dark:text-neutral-100" : ""}`}>{f.name}</span>
                <span className="text-[12px] text-neutral-400">{folderCount(f.id)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Note list */}
      <div className="flex w-56 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <div className="flex items-center gap-1.5">
            <ToolbarButton label="Toggle sidebar" onClick={toggleSidebar}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                <path d="M 7.5 4.5 v 11" />
                <rect x="4.25" y="6.25" width="1.75" height="7.5" rx="0.5" fill="currentColor" stroke="none" />
              </svg>
            </ToolbarButton>
            <div>
              <p className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100">{listTitle}</p>
              <p className="text-[11px] text-neutral-400">
                {folderNotes.length} note{folderNotes.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ToolbarButton label="Delete note" onClick={deleteSelected}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M 4 6 h 12 M 8 6 V 4.5 A 1 1 0 0 1 9 3.5 h 2 a 1 1 0 0 1 1 1 V 6 m 3 0 l -0.8 9.5 a 1.5 1.5 0 0 1 -1.5 1.4 h -5.4 a 1.5 1.5 0 0 1 -1.5 -1.4 L 5 6" />
            </svg>
          </ToolbarButton>
        </div>
        {searchOpen && (
          <div className="px-3 pb-1 pt-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  setSearchOpen(false);
                }
              }}
              placeholder="Search"
              className="w-full bg-black/[0.06] rounded-md px-2 py-1 text-[12px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:bg-white/[0.08] dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </div>
        )}
        <div className="flex-1 overflow-auto px-2 pb-2">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-1 pt-3 text-[13px] font-bold text-neutral-600 dark:text-neutral-300">{g.label}</p>
              {g.items.map((n) => {
                const isSel = n.id === selectedId;
                const preview = mdToPlain(n.body) || "No additional text";
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      playClick();
                      setSelectedId(n.id);
                    }}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left ${
                      isSel ? "bg-[#f7d64b]/80 dark:bg-yellow-500/20" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <p className={`truncate text-[13px] font-bold ${isSel ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-800 dark:text-neutral-200"}`}>
                      {n.title || "New Note"}
                    </p>
                    <p className={`truncate text-[12px] ${isSel ? "text-neutral-700/80 dark:text-neutral-300/80" : "text-neutral-400"}`}>
                      {new Date(n.updated).toLocaleDateString(undefined, { weekday: "long" })}{" "}
                      <span className="ml-1">{preview}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="px-2 pt-6 text-center text-[12px] text-neutral-400">{q ? "No results" : "No notes"}</p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onImageChosen}
          className="hidden"
          aria-hidden
        />
        <div className="flex items-center gap-1 border-b border-black/5 px-3 py-2 dark:border-white/10">
          <ToolbarButton label="New note" onClick={addNote}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="14" height="14" rx="3" />
              <path d="M 13.5 6.5 l -5 5 L 8 13 l 1.5 -0.5 5 -5 a 1 1 0 0 0 -1 -1 Z" />
            </svg>
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/15" />
          <div className="relative" ref={fontMenuRef}>
            <ToolbarButton
              label="Text styles"
              onClick={() => {
                playClick();
                setFontMenuOpen((o) => !o);
              }}
            >
              <span className="text-[13px]">Aa</span>
            </ToolbarButton>
            {fontMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800">
                {(
                  [
                    { size: "sm", label: "Small" },
                    { size: "md", label: "Default" },
                    { size: "lg", label: "Large" },
                  ] as { size: FontSize; label: string }[]
                ).map((opt) => {
                  const current = (selected?.fontSize ?? "md") === opt.size;
                  return (
                    <button
                      key={opt.size}
                      onClick={() => setFontSize(opt.size)}
                      className={`flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-neutral-700 hover:bg-black/[0.05] dark:text-neutral-200 dark:hover:bg-white/[0.08] ${
                        current ? "bg-black/[0.08] dark:bg-white/[0.12]" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Block style menu — headings, quote, lists, divider */}
          <div className="relative" ref={blockMenuRef}>
            <ToolbarButton
              label="Paragraph style"
              onClick={() => {
                playClick();
                setBlockMenuOpen((o) => !o);
              }}
            >
              <span className="text-[13px] font-semibold">¶</span>
            </ToolbarButton>
            {blockMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800">
                {BLOCK_STYLES.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => (opt.list !== undefined ? applyList(opt.list) : applyBlock(opt.tag!))}
                    className="flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-neutral-700 hover:bg-black/[0.05] dark:text-neutral-200 dark:hover:bg-white/[0.08]"
                  >
                    <span className={opt.className}>{opt.label}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                <button
                  onClick={insertRule}
                  className="flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-neutral-700 hover:bg-black/[0.05] dark:text-neutral-200 dark:hover:bg-white/[0.08]"
                >
                  Divider
                </button>
              </div>
            )}
          </div>
          <ToolbarButton label="Bold" onClick={() => applyFormat("bold")}>
            <span className="px-0.5 text-[13px] font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => applyFormat("italic")}>
            <span className="px-0.5 font-serif text-[13px] italic">I</span>
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => applyFormat("underline")}>
            <span className="px-0.5 text-[13px] underline underline-offset-2">U</span>
          </ToolbarButton>
          <ToolbarButton label="Checklist" onClick={insertChecklist}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="5" cy="6" r="2" />
              <circle cx="5" cy="14" r="2" />
              <path d="M 10 6 h 7 M 10 14 h 7" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Table" onClick={insertTable}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="14" height="12" rx="1.5" />
              <path d="M 3 9 h 14 M 10 4 v 12" />
            </svg>
          </ToolbarButton>
          {/* Link — the URL box replaces the toolbar row while it's open */}
          <div className="relative">
            <ToolbarButton label="Add link" onClick={openLinkBox}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M 8.5 11.5 a 3 3 0 0 0 4.2 0 l 2.6 -2.6 a 3 3 0 0 0 -4.2 -4.2 l -1 1" />
                <path d="M 11.5 8.5 a 3 3 0 0 0 -4.2 0 l -2.6 2.6 a 3 3 0 0 0 4.2 4.2 l 1 -1" />
              </svg>
            </ToolbarButton>
            {linkOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 flex w-64 items-center gap-1 rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800">
                <input
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitLink();
                    if (e.key === "Escape") setLinkOpen(false);
                  }}
                  placeholder="https://…"
                  className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[13px] text-neutral-800 outline-none dark:text-neutral-100"
                />
                <button
                  onClick={commitLink}
                  className="rounded-md bg-blue-600 px-2 py-1 text-[12px] font-semibold text-white hover:bg-blue-700"
                >
                  Link
                </button>
              </div>
            )}
          </div>
          <ToolbarButton label="Insert image" onClick={pickImage}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="14" height="12" rx="2" />
              <circle cx="7.5" cy="8" r="1.2" />
              <path d="M 4 14 l 4 -4 3 3 2 -2 3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <div className="ml-auto">
            <ToolbarButton label="Search" onClick={toggleSearch}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="9" cy="9" r="5.5" />
                <path d="M 13.5 13.5 L 17 17" />
              </svg>
            </ToolbarButton>
          </div>
        </div>

        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col px-6 py-3">
            <p className="pb-3 text-center text-[11px] text-neutral-400">{fmtFull(selected.updated)}</p>
            <input
              ref={titleRef}
              value={selected.title}
              onChange={(e) => updateSelected({ title: e.target.value })}
              placeholder="Title"
              className="bg-transparent text-[22px] font-bold text-neutral-900 outline-none placeholder:text-neutral-300 dark:text-neutral-50 dark:placeholder:text-neutral-600"
            />
            <NoteEditor
              ref={bodyRef}
              noteId={selected.id}
              markdown={selected.body}
              onChange={(body) => updateSelected({ body })}
              placeholder="Start writing…"
              className={`mt-2 min-h-0 flex-1 overflow-y-auto bg-transparent ${bodyFontClass} leading-relaxed text-neutral-700 outline-none dark:text-neutral-300`}
            />
          </div>
        ) : (
          <div className="m-auto text-sm text-neutral-400">Select a note</div>
        )}
      </div>
    </div>
  );
}
