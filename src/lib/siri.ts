import type { AppId } from "@/components/AppIcon";
import type { WallpaperId } from "@/lib/wallpaper";
import type { Theme } from "@/lib/theme";
import type { AccentId } from "@/lib/accent";
import { linkApps, pictures, profile, projects } from "@/data/portfolio";
import { APP_META } from "@/components/apps/app-meta";

// Siri's brain: pure text → intent. No side effects here — the panel (or any
// other caller) executes the returned action. Terminal shares the alias tables.

/** Display names come from app-meta — the one place apps are declared. */
export const APP_NAMES = Object.fromEntries(
  APP_META.map((a) => [a.id, a.name]),
) as Record<AppId, string>;

/** Every app answers to its own name, lowercased ("photo booth" → photobooth). */
const NAME_ALIASES = Object.fromEntries(
  APP_META.map((a) => [a.name.toLowerCase(), a.id]),
) as Record<string, AppId>;

/** Extra natural-language ways to say each app — layered on top of the names
 *  above, never restating them. Shared with the Terminal, so these stay strict
 *  enough to be valid commands (Siri-only fuzz lives in SIRI_ALIASES). */
const EXTRA_ALIASES: Record<string, AppId> = {
  myfolder: "myfolder", "my folder": "myfolder", "my-folder": "myfolder", files: "myfolder",
  note: "about", about: "about", "about me": "about", "about-me.txt": "about", "about-me": "about",
  project: "projects", work: "projects", portfolio: "projects",
  photos: "pictures", gallery: "pictures", "photo library": "pictures",
  "resume.pdf": "resume", cv: "resume",
  "contact.mail": "contact", mail: "contact", contacts: "contact", email: "contact",
  spotify: "music", "apple music": "music", songs: "music", song: "music",
  pacman: "game-pacman", "pac man": "game-pacman",
  mines: "game-mines", minesweep: "game-mines",
  bricks: "game-breakout",
  dino: "game-dino", dinosaur: "game-dino",
  vault: "game-vault", "the vault": "game-vault", passphrase: "game-vault", guardian: "game-vault",
  quest: "game-quest", "tiny quest": "game-quest", rpg: "game-quest", adventure: "game-quest",
  cal: "calendar", schedule: "calendar",
  preferences: "settings", "system settings": "settings", prefs: "settings",
  shell: "terminal", console: "terminal",
  imessage: "messages", chat: "messages", message: "messages",
  vscode: "code", editor: "code", "source code": "code", "vs code": "code",
  photobooth: "photobooth", camera: "photobooth", selfie: "photobooth",
  activity: "activity", top: "activity", "task manager": "activity",
  forecast: "weather",
  browser: "safari", web: "safari", internet: "safari",
};

export const ALIASES: Record<string, AppId> = { ...NAME_ALIASES, ...EXTRA_ALIASES };

/** Finder sidebar destinations Siri can jump to. */
const LOCATIONS: Record<string, { loc: string; name: string }> = {
  downloads: { loc: "downloads", name: "Downloads" },
  documents: { loc: "documents", name: "Documents" },
  desktop: { loc: "desktop", name: "Desktop" },
  recents: { loc: "recents", name: "Recents" },
  recent: { loc: "recents", name: "Recents" },
  applications: { loc: "applications", name: "Applications" },
  apps: { loc: "applications", name: "Applications" },
  trash: { loc: "trash", name: "Bin" },
  bin: { loc: "trash", name: "Bin" },
  games: { loc: "games", name: "Games" },
  arcade: { loc: "games", name: "Games" },
  "macintosh hd": { loc: "macintoshhd", name: "Macintosh HD" },
  storage: { loc: "macintoshhd", name: "Macintosh HD" },
};

/** Loose words Siri alone accepts — kept out of ALIASES so `open built` stays
 *  invalid in the Terminal, which is a strict command line. */
const SIRI_ALIASES: Record<string, AppId> = {
  built: "projects", made: "projects", showcase: "projects", "case study": "projects",
  "your work": "projects", stuff: "projects",
  "who you are": "about", bio: "about",
  hire: "resume", experience: "resume", background: "resume",
  "reach you": "contact", "get in touch": "contact", "hit you up": "contact",
  tunes: "music", playlist: "music",
};

export type SettingsPane = "general" | "appearance" | "wallpaper" | "display" | "dock" | "sound";

/** words that point at one System Settings pane */
const PANE_WORDS: { pane: SettingsPane; name: string; words: string[] }[] = [
  { pane: "appearance", name: "Appearance", words: ["appearance", "theme", "dark mode", "light mode", "accent"] },
  { pane: "wallpaper", name: "Wallpaper", words: ["wallpaper", "background", "desktop picture"] },
  { pane: "display", name: "Display", words: ["display", "bright", "screen", "resolution"] },
  { pane: "dock", name: "Dock", words: ["dock", "magnification", "taskbar"] },
  { pane: "sound", name: "Sound", words: ["sound", "volume", "audio", "chime", "mute"] },
  { pane: "general", name: "General", words: ["general", "about this mac", "storage", "account", "software"] },
];

/** the loose files on the desktop, each backed by the app that opens it */
const FILE_WORDS: { words: string[]; app: AppId; name: string }[] = [
  { words: ["about-me.txt", "about me", "about-me", "readme", "txt file"], app: "about", name: "about-me.txt" },
  { words: ["resume.pdf", "the pdf", "my resume", "your resume"], app: "resume", name: "resume.pdf" },
  { words: ["contact.mail", "contact card", "mail file"], app: "contact", name: "contact.mail" },
];

export type SiriAction =
  | { kind: "open"; app: AppId }
  | { kind: "close"; app: AppId }
  | { kind: "minimize"; app: AppId }
  | { kind: "finder"; loc: string }
  | { kind: "spotlight" }
  | { kind: "browse"; url: string }
  | { kind: "play"; query: string }
  | { kind: "player"; op: "pause" | "resume" | "next" | "prev" | "now" }
  | { kind: "volume"; value?: number; delta?: number }
  | { kind: "mute"; on: boolean }
  | { kind: "brightness"; value?: number; delta?: number }
  | { kind: "wallpaper"; id: WallpaperId }
  | { kind: "theme"; theme: Theme }
  | { kind: "accent"; id: AccentId }
  | { kind: "weather" }
  | { kind: "time" }
  | { kind: "date" }
  | { kind: "power"; op: "restart" | "shutdown" }
  | { kind: "settings"; pane: SettingsPane }
  | { kind: "project"; id: string }
  | { kind: "photo"; query: string }
  | { kind: "note"; query: string }
  | { kind: "view"; app: AppId; view: string; label: string };

export type SiriReply = {
  /** what Siri says back — the panel may replace it for async intents */
  text: string;
  action?: SiriAction;
};

const WALLPAPER_WORDS: Record<string, WallpaperId> = {
  bloom: "abstract-orange", orange: "abstract-orange",
  ember: "abstract-red", red: "abstract-red",
  jade: "abstract-teal", teal: "abstract-teal",
  glass: "abstract-blue", blue: "abstract-blue",
  ripple: "waves-purple", purple: "waves-purple",
  canyon: "canyon",
  alpenglow: "alpenglow-peaks", mountain: "alpenglow-peaks", mountains: "alpenglow-peaks",
  meadow: "green-field", field: "green-field", green: "green-field",
  shoreline: "turquoise-coast", coast: "turquoise-coast", beach: "turquoise-coast",
  tide: "teal-coast", live: "teal-coast", ocean: "teal-coast",
};

const ACCENT_WORDS: AccentId[] = ["blue", "purple", "pink", "red", "orange", "green", "graphite"];


// ——————————————————————————————————————————————————————————————
// Keyword engine. There is no command syntax: the user writes whatever they
// want, we score every intent by the keywords present, and the loudest wins.
// ——————————————————————————————————————————————————————————————

/** lowercase, drop punctuation, wake words and politeness so scoring sees only content */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9.:/\- ]+/g, " ")
    .replace(/\b(hey|ok|okay)\s+siri\b/g, " ")
    .replace(/\b(please|kindly|for me|would you|could you|can you|will you|i want to|i need to|i wanna|lets|let us)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** how many of these stems appear — prefix match, so "bright" also counts "brighter"/"brightness" */
function hits(t: string, stems: readonly string[]): number {
  return stems.reduce((n, k) => n + (new RegExp(`\\b${k}`).test(t) ? 1 : 0), 0);
}

function matchApp(text: string): { id: AppId; alias: string } | null {
  const table = { ...ALIASES, ...SIRI_ALIASES };
  const exact = table[text.trim()];
  if (exact) return { id: exact, alias: text.trim() };
  // longest alias contained in the phrase wins ("fire up the music app" → music)
  let best: { id: AppId; alias: string } | null = null;
  for (const [alias, id] of Object.entries(table)) {
    if (new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`).test(text)) {
      if (!best || alias.length > best.alias.length) best = { id, alias };
    }
  }
  return best;
}

/** Is the sentence essentially just this name? "resume" / "the resume app" → yes.
 *  A lone noun is a request to open the thing, never a verb like playback resume. */
function isBareMention(t: string, phrase: string): boolean {
  return (
    t
      .replace(new RegExp(phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), " ")
      .replace(/\b(app|application|window|the|my|your|open|show|see|it|one)\b/g, " ")
      .replace(/[^a-z0-9]/g, "").length === 0
  );
}

function matchLocation(text: string): { loc: string; name: string; word: string } | null {
  let best: { loc: string; name: string; word: string } | null = null;
  for (const [word, val] of Object.entries(LOCATIONS)) {
    if (new RegExp(`\\b${word}\\b`).test(text) && (!best || word.length > best.word.length)) {
      best = { ...val, word };
    }
  }
  return best;
}

function percent(text: string): number | null {
  const m = text.match(/\b(\d{1,3})\s*(?:%|percent)?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 100 ? n : null;
}

// keyword vocabularies — every intent scores off these
const K = {
  open: ["open", "launch", "start", "run", "show", "display", "bring up", "pull up", "load", "fire up", "boot", "go to", "take me", "give me", "gimme", "get me", "lemme", "let me see", "wanna", "want", "need", "play with", "check out", "see"],
  close: ["close", "quit", "exit", "kill", "get rid", "dismiss"],
  minimize: ["minimi", "hide", "tuck", "stash", "out of the way"],
  playVerb: ["play", "put on", "queue", "blast", "bump", "listen", "hear", "throw on", "spin"],
  pause: ["pause", "stop", "shut", "shush", "quiet down", "enough", "kill the"],
  resume: ["resume", "unpause", "keep going", "continue", "carry on", "back on"],
  next: ["next", "skip", "another one", "change the song", "different song"],
  prev: ["previous", "prev", "go back", "rewind", "last song", "last track", "again"],
  nowPlaying: ["whats playing", "what is playing", "now playing", "current song", "current track", "what song", "which song", "what am i listening"],
  music: ["music", "song", "track", "tune", "audio", "playback"],
  weather: ["weather", "forecast", "temperature", "temp", "hot", "cold", "rain", "sunny", "cloudy", "snow", "humid", "outside", "degrees"],
  time: ["time", "clock", "oclock", "what hour"],
  date: ["date", "today", "what day", "day is it"],
  volume: ["volume", "loud", "quiet", "sound", "audio", "mute", "unmute", "silen", "vol"],
  brightness: ["bright", "dim", "dark screen", "screen light", "washed out"],
  theme: ["dark mode", "light mode", "night mode", "day mode", "appearance", "dark theme", "light theme"],
  wallpaper: ["wallpaper", "background", "desktop picture", "desktop photo"],
  accent: ["accent", "highlight colour", "highlight color", "tint"],
  search: ["search", "google", "look up", "find out", "whats the deal", "look for"],
  browse: ["browse", "website", "site", "web", "internet", "url", "surf"],
  spotlight: ["spotlight", "search my mac", "search the mac"],
  power: ["restart", "reboot", "shut down", "shutdown", "power off", "turn off the mac", "log out", "sleep"],
  finder: ["folder", "file", "directory", "finder"],
  greeting: ["hi", "hello", "hey", "yo", "sup", "whats up", "good morning", "good evening"],
  thanks: ["thanks", "thank you", "cheers", "ty", "nice one", "youre the best"],
  identity: ["who are you", "your name", "are you real", "are you siri", "what are you"],
  up: ["up", "louder", "brighter", "raise", "increase", "more", "boost", "higher"],
  down: ["down", "quieter", "softer", "dimmer", "lower", "reduce", "decrease", "less", "too loud", "too bright"],
  off: ["off", "mute", "silence", "shut up", "stop"],
  on: ["on", "unmute", "back"],
} as const;

// ——— Siddhant's links — words layered on the labels; URLs always come from
// the data file, so the fallback can never send someone to a guessed profile.
const LINK_WORDS: Record<string, string[]> = {
  github: ["github", "git hub", "repos"],
  linkedin: ["linkedin", "linked in"],
  "twitter x": ["twitter", "tweet"],
  producthunt: ["producthunt", "product hunt"],
  peerlist: ["peerlist", "peer list"],
  substack: ["substack", "newsletter"],
  buymeacoffee: ["buymeacoffee", "buy me a coffee"],
  "book a call": ["book a call", "book call", "schedule a call", "cal com"],
  medium: ["medium", "blog"],
  notion: ["notion"],
};

const SOCIAL_LINKS = [
  ...profile.socials.map((s) => ({ label: s.label, url: s.url })),
  ...linkApps.map((l) => ({ label: l.name, url: l.url })),
].map((e) => {
  const key = e.label.toLowerCase().replace(/[^a-z ]+/g, "").replace(/\s+/g, " ").trim();
  return { ...e, words: LINK_WORDS[key] ?? [key] };
});

export const SIRI_SUGGESTIONS = [
  "Open Snake",
  "Play Blinding Lights",
  "Is it raining?",
  "Make it dark in here",
  "Show my projects",
  "Screen's too bright",
];

type Candidate = { score: number; reply: SiriReply };

export function askSiri(raw: string): SiriReply {
  const t = normalize(raw);
  if (!t) return { text: "I'm listening." };

  const appHit = matchApp(t);
  const app = appHit?.id ?? null;
  const loc = matchLocation(t);
  // a lone name outranks every verb reading of the same word ("resume", "play")
  const bareApp = appHit ? isBareMention(t, appHit.alias) : false;
  const bareLoc = loc ? isBareMention(t, loc.word) : false;
  const pct = percent(t);
  const urlHit = t.match(/\b((?:https?:\/\/)?[a-z0-9-]+\.(?:com|org|net|io|dev|ai|co|app|gg|edu|gov|in|uk)(?:\/\S*)?)\b/);
  const isGame = !!app && app.startsWith("game-");
  const c: Candidate[] = [];
  const add = (score: number, reply: SiriReply) => score > 0 && c.push({ score, reply });

  // ——— small talk ———
  add(hits(t, K.identity) * 4, {
    text: "Siri, running on Portfolio OS. Tell me what you want and I'll go do it.",
  });
  if (t.split(" ").length <= 3) {
    add(hits(t, K.greeting) * 2, { text: "Hey. What do you need?" });
    add(hits(t, K.thanks) * 3, { text: "Anytime." });
  }

  // ——— power ———
  const sleepy = hits(t, K.power);
  if (sleepy) {
    const restart = /\b(restart|reboot)\b/.test(t);
    add(sleepy * 5, {
      text: restart ? "Restarting…" : "Shutting down…",
      action: { kind: "power", op: restart ? "restart" : "shutdown" },
    });
  }

  // ——— playback ———
  add(hits(t, K.nowPlaying) * 6, { text: "", action: { kind: "player", op: "now" } });
  const musicish = hits(t, K.music) > 0;
  add(hits(t, K.next) * 3 + (musicish ? 2 : 0), { text: "Skipping ahead.", action: { kind: "player", op: "next" } });
  add(hits(t, K.prev) * 3 + (musicish ? 2 : 0), { text: "Going back.", action: { kind: "player", op: "prev" } });
  add(hits(t, K.resume) * 3 + (musicish ? 2 : 0), { text: "Back on.", action: { kind: "player", op: "resume" } });
  // "pause" alone is playback; "turn the music off" too — but not "turn the volume off"
  const volWords = hits(t, K.volume);
  add(hits(t, K.pause) * 3 + (musicish ? 2 : 0) - (volWords ? 2 : 0), {
    text: "Paused.",
    action: { kind: "player", op: "pause" },
  });

  // song request: everything after the play verb that isn't an app
  const playVerb = hits(t, K.playVerb);
  if (playVerb && !isGame) {
    const stripped = t.replace(/.*\b(play|put on|throw on|queue|blast|bump|spin|listen to|listen|hear)\b/, "");
    const q = (stripped === t ? "" : stripped)
      .replace(/\b(some|the|a|me|song|track|music|by)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (q.length > 1) add(playVerb * 4 + 2, { text: `Looking for “${q}”…`, action: { kind: "play", query: q } });
    else add(playVerb * 2, { text: "Back on.", action: { kind: "player", op: "resume" } });
  }

  // ——— sound ———
  if (volWords) {
    const mute =
      (hits(t, ["mute", "silen", "shut up"]) > 0 || /\b(sound|volume|audio)\b.*\boff\b|\boff\b.*\b(sound|volume|audio)\b/.test(t)) &&
      !/\bunmute\b/.test(t);
    const unmute = /\bunmute\b/.test(t) || (volWords > 0 && hits(t, K.on) > 0 && /\bsound\b/.test(t));
    if (mute) add(volWords * 4, { text: "Muted.", action: { kind: "mute", on: true } });
    else if (unmute) add(volWords * 4, { text: "Sound's back.", action: { kind: "mute", on: false } });
    else if (pct !== null) add(volWords * 3 + 2, { text: `Volume at ${pct}%.`, action: { kind: "volume", value: pct / 100 } });
    else {
      const up = hits(t, K.up) > hits(t, K.down);
      add(volWords * 3, {
        text: up ? "Turning it up." : "Turning it down.",
        action: { kind: "volume", delta: up ? 0.15 : -0.15 },
      });
    }
  }

  // ——— display ———
  const brightWords = hits(t, K.brightness);
  if (brightWords) {
    if (pct !== null) add(brightWords * 3 + 2, { text: `Brightness at ${pct}%.`, action: { kind: "brightness", value: pct / 100 } });
    else {
      const up = hits(t, ["bright", "up", "raise", "increase", "more", "higher"]) > hits(t, ["dim", "down", "lower", "less", "reduce", "too bright"]);
      add(brightWords * 3, {
        text: up ? "Brightening the screen." : "Dimming the screen.",
        action: { kind: "brightness", delta: up ? 0.15 : -0.15 },
      });
    }
  }

  // bare "make it dark" / "go light" counts as appearance, unless they meant the
  // screen backlight or the wallpaper
  const bareTheme =
    /\b(dark|darker|light|lighter)\b/.test(t) &&
    hits(t, ["make", "turn", "switch", "go", "set"]) > 0 &&
    hits(t, K.brightness) === 0 &&
    hits(t, K.wallpaper) === 0;
  const themeWords = hits(t, K.theme) + (bareTheme ? 1 : 0);
  if (themeWords) {
    const toDark = /\b(dark|night)\b/.test(t);
    add(themeWords * 5, { text: toDark ? "Dark mode on." : "Light mode on.", action: { kind: "theme", theme: toDark ? "dark" : "light" } });
  }

  const wallWords = hits(t, K.wallpaper);
  if (wallWords) {
    const found = Object.entries(WALLPAPER_WORDS).find(([w]) => new RegExp(`\\b${w}\\b`).test(t));
    add(wallWords * 4 + (found ? 2 : 0), found
      ? { text: `Wallpaper set to ${found[1]}.`, action: { kind: "wallpaper", id: found[1] } }
      : { text: "Sure — aurora, night, sequoia or graphite?" });
  }

  const accentWords = hits(t, K.accent);
  if (accentWords) {
    const found = ACCENT_WORDS.find((a) => new RegExp(`\\b${a}\\b`).test(t));
    add(accentWords * 4 + (found ? 2 : 0), found
      ? { text: `Accent is ${found} now.`, action: { kind: "accent", id: found } }
      : { text: `Which one — ${ACCENT_WORDS.join(", ")}?` });
  }

  // ——— info ———
  add(hits(t, K.weather) * 3, { text: "", action: { kind: "weather" } });
  add(hits(t, K.time) * 3, { text: "", action: { kind: "time" } });
  add(hits(t, K.date) * 3, { text: "", action: { kind: "date" } });

  // ——— Siddhant's links — always his real profiles, opened in-app ———
  for (const { words, label, url } of SOCIAL_LINKS) {
    const w = hits(t, words);
    if (w) add(w * 5 + hits(t, K.open), { text: `Opening ${label} in Safari.`, action: { kind: "browse", url } });
  }

  // ——— web ———
  if (urlHit) {
    const u = urlHit[1].startsWith("http") ? urlHit[1] : `https://${urlHit[1]}`;
    add(5 + hits(t, K.browse), { text: `Opening ${urlHit[1]} in Safari.`, action: { kind: "browse", url: u } });
  }
  const searchWords = hits(t, K.search);
  if (searchWords) {
    const q = t
      .replace(/.*\b(search for|search|google|look up|look for|find out about|find out)\b/, "")
      .replace(/\b(on the web|online|for me)\b/g, " ")
      .trim();
    if (q.length > 1)
      add(searchWords * 4, {
        text: `Here's what I found for “${q}”.`,
        action: { kind: "browse", url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` },
      });
  }
  add(hits(t, K.spotlight) * 5, { text: "Spotlight's open.", action: { kind: "spotlight" } });

  // ——— windows ———
  if (app) {
    add(hits(t, K.close) * 4 + 2, { text: `Closing ${APP_NAMES[app]}.`, action: { kind: "close", app } });
    add(hits(t, K.minimize) * 4 + 2, { text: `${APP_NAMES[app]} is in the dock.`, action: { kind: "minimize", app } });
    // a bare app name is enough — "snake", "photo booth", "resume"
    add(hits(t, K.open) * 2 + 3 + (bareApp ? 8 : 0), {
      text: `Opening ${APP_NAMES[app]}.`,
      action: { kind: "open", app },
    });
    if (isGame && playVerb) add(playVerb * 3 + 3, { text: `Launching ${APP_NAMES[app]}.`, action: { kind: "open", app } });
  }

  // ——— Finder places ———
  if (loc)
    add(hits(t, K.open) * 2 + hits(t, K.finder) + 3 + (bareLoc ? 8 : 0), {
      text: `Here's ${loc.name}.`,
      action: { kind: "finder", loc: loc.loc },
    });

  // ——— System Settings, whole app or one pane ———
  const settingsWords = hits(t, ["settings", "preferences", "system settings", "control panel", "configure"]);
  if (settingsWords) {
    const pane = PANE_WORDS.find((p) => hits(t, p.words) > 0);
    add(settingsWords * 5 + (pane ? 3 : 0), pane
      ? { text: `Opening ${pane.name} settings.`, action: { kind: "settings", pane: pane.pane } }
      : { text: "Opening System Settings.", action: { kind: "open", app: "settings" } });
  }

  // ——— a loose file on the desktop ———
  const file = FILE_WORDS.find((f) => hits(t, f.words) > 0);
  if (file) add(hits(t, K.open) * 2 + 4, { text: `Opening ${file.name}.`, action: { kind: "open", app: file.app } });

  // ——— "the projects folder" means Finder, not the app ———
  if (app && /\b(folder|directory)\b/.test(t) && ["projects", "pictures"].includes(app))
    add(6, { text: `Here's the ${APP_NAMES[app]} folder.`, action: { kind: "finder", loc: app } });

  // ——— one specific project ———
  const project = projects.find((p) => t.includes(p.name.toLowerCase()) || t.includes(p.id.replace(/-/g, " ")));
  if (project)
    add(hits(t, K.open) * 2 + 5, { text: `Opening ${project.name}.`, action: { kind: "project", id: project.id } });

  // ——— one specific photo, by anything memorable in its caption ———
  const photo = pictures.find((p) =>
    p.caption
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((w) => w.length >= 4 && new RegExp(`\\b${w}`).test(t)),
  );
  if (photo)
    add(hits(t, ["photo", "picture", "pic", "image", "shot"]) * 3 + 2, {
      text: `Here's “${photo.caption}”.`,
      action: { kind: "photo", query: photo.id },
    });

  // ——— an app's internal view: Music sections, Calendar spans ———
  const MUSIC_VIEWS = [
    { view: "songs", label: "My Songs", words: ["my songs", "your songs", "song list", "library"] },
    { view: "favourites", label: "Favourites", words: ["favourite", "favorite", "liked", "loved"] },
    { view: "search", label: "Search", words: ["search music", "find a song", "search songs"] },
    { view: "home", label: "Home", words: ["trending", "whats hot", "new music", "music home"] },
  ];
  const musicView = MUSIC_VIEWS.find((v) => hits(t, v.words) > 0);
  if (musicView)
    add(4 + (musicish ? 2 : 0), {
      text: `Here's ${musicView.label}.`,
      action: { kind: "view", app: "music", view: musicView.view, label: musicView.label },
    });

  const CAL_VIEWS = ["day", "week", "month", "year"];
  const calView = CAL_VIEWS.find((v) => new RegExp(`\\b(this |the |by )?${v}\\b`).test(t));
  if (calView && hits(t, ["calendar", "schedule", "agenda"]) > 0)
    add(6, {
      text: `Calendar, ${calView} view.`,
      action: { kind: "view", app: "calendar", view: calView, label: calView },
    });

  // ——— one specific note ———
  const noteWords = hits(t, ["note", "notes"]);
  if (noteWords) {
    const q = t
      .replace(/\b(note|notes|open|show|find|read|pull|up|me|my|your|the|a|an|called|titled|named|in|from)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (q.length > 2) add(noteWords * 3 + 3, { text: `Opening your “${q}” note.`, action: { kind: "note", query: q } });
  }

  if (!c.length)
    return {
      text: `I'm not sure what to do with “${raw.trim()}”. I can open apps, play songs, look things up, or change how this Mac looks.`,
    };

  return c.reduce((a, b) => (b.score > a.score ? b : a)).reply;
}
