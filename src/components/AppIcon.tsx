// Squircle app icons drawn as inline SVG — macOS-style, no Apple assets.

"use client";

import { useEffect, useState } from "react";

export type AppId =
  | "about"
  | "projects"
  | "resume"
  | "contact"
  | "pictures"
  | "music"
  | "myfolder"
  | "calendar"
  | "settings"
  | "terminal"
  | "messages"
  | "code"
  | "photobooth"
  | "activity"
  | "weather"
  | "safari"
  | "game-snake"
  | "game-pacman"
  | "game-2048"
  | "game-mines"
  | "game-breakout"
  | "game-dino"
  | "game-vault"
  | "game-quest";

/** Link-only "apps" — an icon and a URL, no window of their own. */
export type LinkAppId = "medium" | "notion";

const SQUIRCLE =
  "M 50,0 C 11,0 0,11 0,50 C 0,89 11,100 50,100 C 89,100 100,89 100,50 C 100,11 89,0 50,0 Z";

type IconDef = {
  gradient: [string, string];
  glyph: React.ReactNode;
};

const ICONS: Record<Exclude<AppId, "myfolder" | "calendar"> | LinkAppId, IconDef> = {
  medium: {
    // Medium: the two-circles-and-a-bar wordmark glyph, white on black
    gradient: ["#2b2b2b", "#000000"],
    glyph: (
      <g fill="#ffffff">
        <ellipse cx="34" cy="50" rx="16" ry="17" />
        <ellipse cx="63" cy="50" rx="6.5" ry="17" />
        <rect x="76" y="34" width="4" height="32" rx="2" />
      </g>
    ),
  },
  notion: {
    // Notion: black "N" on white paper
    gradient: ["#ffffff", "#f1f1f4"],
    glyph: (
      <g fill="none" stroke="#111827" strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M 35 71 V 29 l 30 42 V 29" />
      </g>
    ),
  },
  messages: {
    // standard Messages: white speech bubble on green gradient
    gradient: ["#6ee86f", "#0bc228"],
    glyph: (
      <path
        d="M 50 22 c -17 0 -30 11 -30 25 c 0 8 4.5 15 12 19.5 c -0.8 4.5 -3.4 8.4 -6.6 11 c 5.8 0.4 11.6 -1.6 15.8 -4.6 c 2.8 0.7 5.8 1.1 8.8 1.1 c 17 0 30 -11 30 -26 S 67 22 50 22 Z"
        fill="#ffffff"
      />
    ),
  },
  safari: {
    // standard Safari: compass on white/blue
    gradient: ["#ffffff", "#f1f1f4"],
    glyph: (
      <>
        <defs>
          <linearGradient id="safari-dial" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3bd0f8" />
            <stop offset="100%" stopColor="#1d6ff2" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="34" fill="url(#safari-dial)" />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="19"
            x2="50"
            y2={i % 3 === 0 ? "25" : "22.5"}
            stroke="#ffffff"
            strokeWidth="1.6"
            opacity="0.85"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <path d="M 68 32 L 55 45 l -10 10 -13 13 13 -10 10 -10 Z" fill="#fbfbfd" />
        <path d="M 68 32 L 45 55 l 10 -10 Z" fill="#fd4438" />
      </>
    ),
  },
  code: {
    // VS-Code-ish: angle brackets on blue
    gradient: ["#3ea7f2", "#1565d8"],
    glyph: (
      <g stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 38 32 L 20 50 l 18 18" />
        <path d="M 62 32 L 80 50 l -18 18" />
      </g>
    ),
  },
  photobooth: {
    // Photo Booth: camera on warm gradient
    gradient: ["#fbbf24", "#ea580c"],
    glyph: (
      <>
        <rect x="20" y="34" width="60" height="42" rx="8" fill="#fff7ed" />
        <path d="M 38 34 l 4 -8 h 16 l 4 8 Z" fill="#fff7ed" />
        <circle cx="50" cy="55" r="13" fill="#ea580c" />
        <circle cx="50" cy="55" r="8" fill="#7c2d12" />
        <circle cx="47" cy="52" r="2.5" fill="#fff" opacity="0.8" />
        <circle cx="70" cy="42" r="3" fill="#fbbf24" />
      </>
    ),
  },
  activity: {
    // Activity Monitor: heartbeat trace
    gradient: ["#e5e7eb", "#9ca3af"],
    glyph: (
      <>
        <circle cx="50" cy="50" r="30" fill="#111827" />
        <path
          d="M 26 50 h 12 l 5 -14 8 28 6 -20 4 6 h 13"
          fill="none"
          stroke="#34d399"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  weather: {
    // Weather: sun + cloud on sky
    gradient: ["#4aa8f5", "#1d6ff2"],
    glyph: (
      <>
        <circle cx="40" cy="40" r="13" fill="#fcd34d" />
        <path
          d="M 36 70 a 10 10 0 0 1 2 -19.8 a 13 13 0 0 1 25 -2.8 a 9.5 9.5 0 0 1 3 18.6 a 8 8 0 0 1 -4 4 Z"
          fill="#ffffff"
        />
      </>
    ),
  },
  terminal: {
    // standard macOS Terminal: dark window with prompt
    gradient: ["#3a3a3e", "#1d1d21"],
    glyph: (
      <>
        <text x="22" y="46" fontSize="26" fontWeight="700" fill="#e5e7eb" fontFamily="Menlo, monospace">
          &gt;_
        </text>
        <rect x="22" y="60" width="30" height="4" rx="2" fill="#9ca3af" opacity="0.6" />
      </>
    ),
  },
  settings: {
    // standard System Settings: metallic gear on gray
    gradient: ["#8e939b", "#5b6069"],
    glyph: (
      <g>
        <defs>
          <linearGradient id="gear-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5f6f8" />
            <stop offset="55%" stopColor="#c9cdd4" />
            <stop offset="100%" stopColor="#9aa0a9" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x="45.5"
            y="13"
            width="9"
            height="14"
            rx="3"
            fill="url(#gear-metal)"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="27" fill="url(#gear-metal)" />
        <circle cx="50" cy="50" r="13" fill="#40454d" />
        <circle cx="50" cy="50" r="13" fill="none" stroke="#2c3037" strokeWidth="1.5" />
        <path d="M 32 36 A 23 23 0 0 1 62 31" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      </g>
    ),
  },
  about: {
    // standard Notes: yellow header strip over white paper
    gradient: ["#ffffff", "#f2f2f5"],
    glyph: (
      <g clipPath="url(#grad-about-clip)">
        <rect x="0" y="0" width="100" height="26" fill="#fcc418" />
        {Array.from({ length: 7 }, (_, i) => (
          <circle key={i} cx={18 + i * 11} cy="13" r="2.2" fill="#ffffff" opacity="0.85" />
        ))}
        <line x1="16" y1="44" x2="84" y2="44" stroke="#d7d7dc" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="16" y1="58" x2="84" y2="58" stroke="#d7d7dc" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="16" y1="72" x2="62" y2="72" stroke="#d7d7dc" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    ),
  },
  projects: {
    gradient: ["#60a5fa", "#2563eb"],
    glyph: (
      <>
        <path d="M 20 34 h 22 l 6 8 h 32 a 4 4 0 0 1 4 4 v 26 a 6 6 0 0 1 -6 6 H 22 a 6 6 0 0 1 -6 -6 V 38 a 4 4 0 0 1 4 -4 Z" fill="#dbeafe" />
        <path d="M 16 46 h 68 v 26 a 6 6 0 0 1 -6 6 H 22 a 6 6 0 0 1 -6 -6 Z" fill="#eff6ff" />
      </>
    ),
  },
  resume: {
    gradient: ["#f87171", "#dc2626"],
    glyph: (
      <>
        <path d="M 30 16 h 28 l 14 14 v 52 a 4 4 0 0 1 -4 4 H 30 a 4 4 0 0 1 -4 -4 V 20 a 4 4 0 0 1 4 -4 Z" fill="#fef2f2" />
        <path d="M 58 16 l 14 14 h -14 Z" fill="#fecaca" />
        <text x="50" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="#dc2626" fontFamily="system-ui">CV</text>
      </>
    ),
  },
  contact: {
    // Contacts-style: silhouette card with spectrum strip
    gradient: ["#ffffff", "#e8e8ec"],
    glyph: (
      <>
        <circle cx="50" cy="40" r="14" fill="#9ca3af" />
        <path d="M 24 78 a 26 20 0 0 1 52 0 Z" fill="#9ca3af" />
        <g>
          {["#f43f5e", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"].map((c, i) => (
            <rect key={c} x={26 + i * 8} y="84" width="8" height="6" fill={c} />
          ))}
        </g>
      </>
    ),
  },
  pictures: {
    // standard Photos: rainbow pinwheel on white
    gradient: ["#ffffff", "#f1f1f4"],
    glyph: (
      <g>
        {["#f5b81c", "#f5821c", "#ef4136", "#d4489b", "#7f58c8", "#3c7ede", "#38a8dd", "#65b74e"].map((c, i) => {
          const angle = (i / 8) * 360;
          return (
            <ellipse
              key={c}
              cx="50"
              cy="30.5"
              rx="8.5"
              ry="16"
              fill={c}
              opacity="0.82"
              transform={`rotate(${angle} 50 50)`}
            />
          );
        })}
      </g>
    ),
  },
  music: {
    // standard Apple Music: white note on red-pink gradient
    gradient: ["#fb5c74", "#fa233b"],
    glyph: (
      <path
        d="M 64 20 v 36 a 10.5 8.5 0 1 1 -4.5 -7 V 33 l -22 5.5 v 26 a 10.5 8.5 0 1 1 -4.5 -7 V 29 Z"
        fill="#ffffff"
        transform="translate(-1,2)"
      />
    ),
  },
  "game-snake": {
    gradient: ["#34d399", "#059669"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🐍</text>
    ),
  },
  "game-pacman": {
    gradient: ["#fde047", "#f59e0b"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🟡</text>
    ),
  },
  "game-2048": {
    gradient: ["#edcf72", "#8f7a66"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🔢</text>
    ),
  },
  "game-mines": {
    gradient: ["#cbd5e1", "#64748b"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">💣</text>
    ),
  },
  "game-breakout": {
    gradient: ["#fb923c", "#ea580c"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🧱</text>
    ),
  },
  "game-dino": {
    gradient: ["#e7e5e4", "#a8a29e"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🦖</text>
    ),
  },
  "game-vault": {
    gradient: ["#fbbf24", "#b45309"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🔒</text>
    ),
  },
  "game-quest": {
    gradient: ["#4ade80", "#15803d"],
    glyph: (
      <text x="50" y="62" textAnchor="middle" fontSize="44">🗺️</text>
    ),
  },
};

/** macOS-style blue folder — drawn without the squircle background. */
export function FolderIcon({ size = 48 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id="folder-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7cc7fa" />
          <stop offset="100%" stopColor="#3b9be8" />
        </linearGradient>
        <linearGradient id="folder-tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5eb6f5" />
          <stop offset="100%" stopColor="#4aa7ee" />
        </linearGradient>
      </defs>
      <path
        d="M 8 30 a 6 6 0 0 1 6 -6 h 22 l 8 8 h 42 a 6 6 0 0 1 6 6 v 4 H 8 Z"
        fill="url(#folder-tab)"
      />
      <rect x="8" y="36" width="84" height="46" rx="7" fill="url(#folder-grad)" />
      <rect x="8" y="36" width="84" height="8" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}

/** Classic Finder face — two-tone squircle with the smile. */
export function FinderIcon({ size = 48 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id="finder-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4fb7f5" />
          <stop offset="100%" stopColor="#1e7fe0" />
        </linearGradient>
        <linearGradient id="finder-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf6fe" />
          <stop offset="100%" stopColor="#c8e6fa" />
        </linearGradient>
        <clipPath id="finder-clip">
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
      <g clipPath="url(#finder-clip)">
        <rect x="0" y="0" width="100" height="100" fill="url(#finder-blue)" />
        <path d="M 0 0 H 55 C 48 30 48 70 55 100 H 0 Z" fill="url(#finder-light)" />
        {/* eyes */}
        <path d="M 30 32 v 14" stroke="#1e3a5f" strokeWidth="6" strokeLinecap="round" />
        <path d="M 70 32 v 14" stroke="#0d2b52" strokeWidth="6" strokeLinecap="round" />
        {/* smile */}
        <path d="M 22 62 Q 50 78 78 62" stroke="#0d2b52" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <path d={SQUIRCLE} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
    </svg>
  );
}

/** Calendar app icon showing the real current date. */
export function CalendarLiveIcon({ size = 48 }: { size?: number | string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const weekday = now?.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() ?? "";
  const day = now?.getDate() ?? "";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id="cal-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eeeef1" />
        </linearGradient>
      </defs>
      <path d={SQUIRCLE} fill="url(#cal-bg)" />
      <text x="50" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill="#f43f5e" fontFamily="system-ui" letterSpacing="1">
        {weekday}
      </text>
      <text x="50" y="76" textAnchor="middle" fontSize="42" fontWeight="300" fill="#1f2937" fontFamily="system-ui">
        {day}
      </text>
      <path d={SQUIRCLE} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
    </svg>
  );
}

export function AppIcon({
  id,
  size = 48,
  variant,
}: {
  id: AppId | LinkAppId;
  size?: number | string;
  /** "dock" renders Finder's face for My Folder instead of the blue folder */
  variant?: "dock";
}) {
  if (id === "myfolder") return variant === "dock" ? <FinderIcon size={size} /> : <FolderIcon size={size} />;
  if (id === "calendar") return <CalendarLiveIcon size={size} />;
  const def = ICONS[id];
  const gid = `grad-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={def.gradient[0]} />
          <stop offset="100%" stopColor={def.gradient[1]} />
        </linearGradient>
        <linearGradient id={`${gid}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${gid}-clip`}>
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${gid})`} />
      {def.glyph}
      {/* top gloss + inner rim, clipped to the squircle */}
      <g clipPath={`url(#${gid}-clip)`}>
        <rect x="0" y="0" width="100" height="48" fill={`url(#${gid}-gloss)`} />
      </g>
      <path d={SQUIRCLE} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
    </svg>
  );
}
