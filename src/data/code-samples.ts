/**
 * Hand-authored sample sources shown inside the in-simulation "Code" app.
 *
 * These are illustrative snippets, not the running application's source. They
 * are bundled as plain data so the editor never touches the filesystem and
 * never needs a network round-trip.
 *
 * This array is the single source of truth: the explorer tree is derived from
 * it (see CODE_TREE below), so adding a file here is all that is required.
 */

export type CodeLanguage = "tsx" | "ts" | "css";

export type CodeSample = {
  /** Unique id, also used as the tab label. */
  key: string;
  /** Display name in the explorer. */
  name: string;
  /** Folder the file is grouped under, e.g. "components/window/". */
  folder: string;
  language: CodeLanguage;
  content: string;
};

const MAC_EXPERIENCE = `import { useState } from "react";
import { WindowManager } from "./window/WindowManager";
import { Desktop } from "./desktop/Desktop";
import { Dock } from "./desktop/Dock";
import { MenuBar } from "./desktop/MenuBar";
import { APPS } from "./apps/registry";

export type SessionState = "booting" | "ready";

/**
 * Top-level shell. Owns the boot handshake and hands everything else
 * off to the window manager.
 */
export function MacExperience() {
  const [session, setSession] = useState<SessionState>("booting");
  const [wallpaper, setWallpaper] = useState("sonoma-dawn");

  if (session === "booting") {
    return <BootScreen onFinished={() => setSession("ready")} />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Desktop wallpaper={wallpaper} onWallpaperChange={setWallpaper} />
      <MenuBar />
      <WindowManager apps={APPS} />
      <Dock apps={APPS} />
    </div>
  );
}

function BootScreen({ onFinished }: { onFinished: () => void }) {
  return (
    <button className="grid h-dvh w-full place-items-center" onClick={onFinished}>
      <span className="text-sm tracking-widest opacity-60">click to start</span>
    </button>
  );
}
`;

const WINDOW_MANAGER = `import { useCallback, useState } from "react";
import { Window } from "./Window";
import type { AppDefinition } from "../apps/registry";

export type OpenWindow = {
  id: string;
  appId: string;
  zIndex: number;
  minimized: boolean;
};

let nextZ = 10;

/**
 * Keeps the list of open windows and decides which one is on top.
 * Stacking is a plain counter: focusing a window bumps it to the front.
 */
export function WindowManager({ apps }: { apps: AppDefinition[] }) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);

  const focus = useCallback((id: string) => {
    nextZ += 1;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: nextZ, minimized: false } : w))
    );
  }, []);

  const close = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return (
    <>
      {windows.map((win) => {
        const app = apps.find((a) => a.id === win.appId);
        if (!app) return null;
        return (
          <Window
            key={win.id}
            title={app.title}
            zIndex={win.zIndex}
            hidden={win.minimized}
            onFocus={() => focus(win.id)}
            onClose={() => close(win.id)}
          >
            <app.Component />
          </Window>
        );
      })}
    </>
  );
}
`;

const WINDOW = `import { useRef, useState } from "react";
import type { ReactNode } from "react";

type Point = { x: number; y: number };

type WindowProps = {
  title: string;
  zIndex: number;
  hidden?: boolean;
  children: ReactNode;
  onFocus: () => void;
  onClose: () => void;
};

/**
 * A draggable frame with the traffic-light controls. Dragging is done with
 * pointer capture so the window keeps following the cursor even when it
 * moves faster than the browser repaints.
 */
export function Window(props: WindowProps) {
  const { title, zIndex, hidden, children, onFocus, onClose } = props;
  const [pos, setPos] = useState<Point>({ x: 120, y: 80 });
  const offset = useRef<Point>({ x: 0, y: 0 });

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    onFocus();
    offset.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setPos({
      x: event.clientX - offset.current.x,
      y: Math.max(28, event.clientY - offset.current.y),
    });
  }

  if (hidden) return null;

  return (
    <section
      className="window-frame absolute flex flex-col rounded-xl shadow-2xl"
      style={{ left: pos.x, top: pos.y, zIndex }}
      onPointerDown={onFocus}
    >
      <div className="window-titlebar" onPointerDown={startDrag} onPointerMove={onDrag}>
        <button className="light light-close" onClick={onClose} aria-label="Close" />
        <span className="truncate text-xs font-medium">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
`;

const DOCK = `import { useState } from "react";
import type { AppDefinition } from "../apps/registry";

const MAX_SCALE = 1.6;
const FALLOFF = 90;

/**
 * Classic dock magnification: each icon scales by its distance from the
 * cursor along the x axis, tapering off after FALLOFF pixels.
 */
export function Dock({ apps }: { apps: AppDefinition[] }) {
  const [cursorX, setCursorX] = useState<number | null>(null);

  function scaleFor(center: number) {
    if (cursorX === null) return 1;
    const distance = Math.abs(cursorX - center);
    if (distance > FALLOFF) return 1;
    const t = 1 - distance / FALLOFF;
    return 1 + (MAX_SCALE - 1) * t * t;
  }

  return (
    <nav
      className="dock"
      onPointerMove={(event) => setCursorX(event.clientX)}
      onPointerLeave={() => setCursorX(null)}
    >
      {apps.map((app, index) => (
        <button
          key={app.id}
          className="dock-item"
          title={app.title}
          style={{ transform: "scale(" + scaleFor(index * 64 + 32).toFixed(3) + ")" }}
        >
          <img src={app.icon} alt="" width={44} height={44} draggable={false} />
        </button>
      ))}
    </nav>
  );
}
`;

const TERMINAL = `import { useState } from "react";

type Line = { kind: "input" | "output"; text: string };

const HELP = ["help", "about", "projects", "clear"].join(", ");

const COMMANDS: Record<string, () => string> = {
  help: () => "available commands: " + HELP,
  about: () => "Frontend engineer. Builds interfaces that feel like software.",
  projects: () => "1. portfolio-os  2. tide-charts  3. inkwell",
  whoami: () => "guest",
};

export function Terminal() {
  const [lines, setLines] = useState<Line[]>([{ kind: "output", text: "type 'help'" }]);
  const [draft, setDraft] = useState("");

  function run(raw: string) {
    const command = raw.trim();
    if (command === "clear") {
      setLines([]);
      return;
    }
    const handler = COMMANDS[command];
    const output = handler ? handler() : "command not found: " + command;
    setLines((prev) => [...prev, { kind: "input", text: command }, { kind: "output", text: output }]);
  }

  return (
    <div className="terminal" onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
      {lines.map((line, i) => (
        <div key={i}>{line.kind === "input" ? "$ " + line.text : line.text}</div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(draft);
          setDraft("");
        }}
      >
        <span>$ </span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
      </form>
    </div>
  );
}
`;

const SOUNDS = `type SoundName = "click" | "open" | "trash";

const SOURCES: Record<SoundName, string> = {
  click: "/sounds/click.mp3",
  open: "/sounds/open.mp3",
  trash: "/sounds/trash.mp3",
};

const cache = new Map<SoundName, HTMLAudioElement>();

let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

/**
 * Plays a UI sound. Elements are cached and rewound rather than recreated,
 * which keeps rapid clicks from spawning dozens of decoders.
 */
export function play(name: SoundName, volume = 0.25) {
  if (!enabled || typeof window === "undefined") return;

  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(SOURCES[name]);
    audio.preload = "auto";
    cache.set(name, audio);
  }

  audio.volume = volume;
  audio.currentTime = 0;
  // Autoplay can be rejected before the first user gesture; that is fine.
  void audio.play().catch(() => undefined);
}

export const playClick = () => play("click");
export const playOpen = () => play("open", 0.35);
`;

const DESKTOP_CSS = `:root {
  --titlebar-height: 28px;
  --window-radius: 12px;
  --surface: rgba(246, 246, 248, 0.82);
  --surface-border: rgba(0, 0, 0, 0.14);
  --text: #1c1c1e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: rgba(30, 30, 32, 0.78);
    --surface-border: rgba(255, 255, 255, 0.12);
    --text: #f2f2f7;
  }
}

.window-frame {
  min-width: 320px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--window-radius);
  backdrop-filter: blur(24px) saturate(180%);
}

.window-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--titlebar-height);
  padding: 0 10px;
  cursor: grab;
  user-select: none;
}

.light {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.light-close {
  background: #ff5f57;
}

.dock-item {
  transition: transform 120ms ease-out;
  transform-origin: bottom center;
}
`;

export const CODE_SAMPLES: CodeSample[] = [
  {
    key: "MacExperience.tsx",
    name: "MacExperience.tsx",
    folder: "components/",
    language: "tsx",
    content: MAC_EXPERIENCE,
  },
  {
    key: "WindowManager.tsx",
    name: "WindowManager.tsx",
    folder: "components/window/",
    language: "tsx",
    content: WINDOW_MANAGER,
  },
  {
    key: "Window.tsx",
    name: "Window.tsx",
    folder: "components/window/",
    language: "tsx",
    content: WINDOW,
  },
  {
    key: "Dock.tsx",
    name: "Dock.tsx",
    folder: "components/desktop/",
    language: "tsx",
    content: DOCK,
  },
  {
    key: "Terminal.tsx",
    name: "Terminal.tsx",
    folder: "components/apps/",
    language: "tsx",
    content: TERMINAL,
  },
  {
    key: "sounds.ts",
    name: "sounds.ts",
    folder: "lib/",
    language: "ts",
    content: SOUNDS,
  },
  {
    key: "desktop.css",
    name: "desktop.css",
    folder: "styles/",
    language: "css",
    content: DESKTOP_CSS,
  },
];

/** The entry the editor opens on first paint. */
export const DEFAULT_CODE_FILE = CODE_SAMPLES[0].key;

export type CodeFolderGroup = { folder: string; files: CodeSample[] };

/** Explorer tree, derived from CODE_SAMPLES so the two can never drift apart. */
export const CODE_TREE: CodeFolderGroup[] = CODE_SAMPLES.reduce<CodeFolderGroup[]>(
  (groups, file) => {
    const existing = groups.find((g) => g.folder === file.folder);
    if (existing) existing.files.push(file);
    else groups.push({ folder: file.folder, files: [file] });
    return groups;
  },
  []
);

const BY_KEY = new Map(CODE_SAMPLES.map((file) => [file.key, file]));

export function getCodeSample(key: string): CodeSample | undefined {
  return BY_KEY.get(key);
}
