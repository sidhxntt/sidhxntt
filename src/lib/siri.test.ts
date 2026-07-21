import { describe, expect, it } from "vitest";
import { askSiri, ALIASES, APP_NAMES, SIRI_SUGGESTIONS, type SiriAction } from "@/lib/siri";
import { APP_META } from "@/components/apps/app-meta";

/** Convenience: run a phrase and return the action (undefined for chat-only replies). */
const act = (phrase: string): SiriAction | undefined => askSiri(phrase).action;

describe("askSiri — app opens", () => {
  it.each([
    ["fire up snake", "game-snake"],
    ["open snake", "game-snake"],
    ["launch pacman", "game-pacman"],
    ["open minesweeper", "game-mines"],
    ["start dino", "game-dino"],
    ["open the terminal", "terminal"],
    ["show me photo booth", "photobooth"],
    ["bring up the task manager", "activity"],
    ["open vscode", "code"],
    ["launch imessage", "messages"],
    ["open spotify", "music"],
    ["open my cv", "resume"],
  ] as const)("%s → open %s", (phrase, app) => {
    expect(act(phrase)).toEqual({ kind: "open", app });
  });

  it('bare "resume" opens the Resume app, not playback resume', () => {
    expect(act("resume")).toEqual({ kind: "open", app: "resume" });
  });

  it('bare "weather" opens the Weather app, not the forecast intent', () => {
    expect(act("weather")).toEqual({ kind: "open", app: "weather" });
  });

  it("a bare app name with articles still counts as bare", () => {
    expect(act("the resume app")).toEqual({ kind: "open", app: "resume" });
  });

  it("strips wake words, punctuation and politeness", () => {
    expect(act("Hey Siri, open Snake please!")).toEqual({ kind: "open", app: "game-snake" });
  });

  it("is case-insensitive", () => {
    expect(act("OPEN SNAKE")).toEqual({ kind: "open", app: "game-snake" });
  });

  it("longest alias wins inside a longer phrase", () => {
    expect(act("fire up the photo booth app")).toEqual({ kind: "open", app: "photobooth" });
  });

  it("Siri-only fuzzy aliases resolve (hire → resume, built → projects)", () => {
    expect(act("how can i hire you")).toEqual({ kind: "open", app: "resume" });
    expect(act("what have you built")).toEqual({ kind: "open", app: "projects" });
  });

  it("Siri-only fuzz stays out of the shared Terminal ALIASES table", () => {
    expect(ALIASES["built"]).toBeUndefined();
    expect(ALIASES["hire"]).toBeUndefined();
    expect(ALIASES["stuff"]).toBeUndefined();
  });

  it("reply text names the app", () => {
    expect(askSiri("open snake").text).toContain("Snake");
  });
});

describe("askSiri — close / minimize", () => {
  it.each([
    ["close the music app", { kind: "close", app: "music" }],
    ["quit terminal", { kind: "close", app: "terminal" }],
    ["get rid of messages", { kind: "close", app: "messages" }],
    ["minimize terminal", { kind: "minimize", app: "terminal" }],
    ["hide safari", { kind: "minimize", app: "safari" }],
  ] as const)("%s", (phrase, expected) => {
    expect(act(phrase)).toEqual(expected);
  });
});

describe("askSiri — Finder locations", () => {
  it.each([
    ["whats in the trash", "trash"],
    ["open the trash", "trash"],
    ["open the bin", "trash"],
    ["open the games folder", "games"],
    ["take me to downloads", "downloads"],
    ["open documents", "documents"],
    ["show me the applications folder", "applications"],
    ["open macintosh hd", "macintoshhd"],
  ] as const)("%s → finder %s", (phrase, loc) => {
    expect(act(phrase)).toEqual({ kind: "finder", loc });
  });

  it('"open the projects folder" goes to Finder, not the Projects app', () => {
    expect(act("open the projects folder")).toEqual({ kind: "finder", loc: "projects" });
  });

  it('"open projects" (no folder word) opens the app', () => {
    expect(act("open projects")).toEqual({ kind: "open", app: "projects" });
  });

  it('"open the pictures folder" goes to Finder', () => {
    expect(act("open the pictures folder")).toEqual({ kind: "finder", loc: "pictures" });
  });
});

describe("askSiri — playback", () => {
  it("play <song> becomes a play query", () => {
    expect(act("play blinding lights")).toEqual({ kind: "play", query: "blinding lights" });
  });

  it("put on <song> works and strips filler", () => {
    expect(act("put on some jazz")).toEqual({ kind: "play", query: "jazz" });
  });

  it("listen to <song> works", () => {
    expect(act("listen to drivers license")).toEqual({ kind: "play", query: "drivers license" });
  });

  it('"play snake" launches the game, not a song', () => {
    expect(act("play snake")).toEqual({ kind: "open", app: "game-snake" });
  });

  it.each([
    ["pause", { kind: "player", op: "pause" }],
    ["pause the music", { kind: "player", op: "pause" }],
    ["next song", { kind: "player", op: "next" }],
    ["skip this track", { kind: "player", op: "next" }],
    ["previous track", { kind: "player", op: "prev" }],
    ["whats playing", { kind: "player", op: "now" }],
    ["what song is this", { kind: "player", op: "now" }],
  ] as const)("%s", (phrase, expected) => {
    expect(act(phrase)).toEqual(expected);
  });

  it('"resume the music" resumes playback (music context beats the Resume app)', () => {
    expect(act("resume the music")).toEqual({ kind: "player", op: "resume" });
  });

  it('"resume playing" resumes playback, not a search or the Resume app', () => {
    expect(act("resume playing")).toEqual({ kind: "player", op: "resume" });
  });

  it("a bare play verb with no song resumes", () => {
    expect(act("keep going with the song")).toEqual({ kind: "player", op: "resume" });
  });
});

describe("askSiri — volume & mute", () => {
  it("absolute percent", () => {
    expect(act("set volume to 40%")).toEqual({ kind: "volume", value: 0.4 });
    expect(act("volume 50")).toEqual({ kind: "volume", value: 0.5 });
    expect(act("crank the volume to 80 percent")).toEqual({ kind: "volume", value: 0.8 });
  });

  it("relative up/down", () => {
    expect(act("turn the volume up")).toEqual({ kind: "volume", delta: 0.15 });
    expect(act("louder")).toEqual({ kind: "volume", delta: 0.15 });
    expect(act("quieter")).toEqual({ kind: "volume", delta: -0.15 });
  });

  it("mute / unmute", () => {
    expect(act("mute the sound")).toEqual({ kind: "mute", on: true });
    expect(act("unmute")).toEqual({ kind: "mute", on: false });
  });
});

describe("askSiri — brightness", () => {
  it("absolute percent", () => {
    expect(act("set brightness to 70%")).toEqual({ kind: "brightness", value: 0.7 });
  });

  it("relative up/down", () => {
    expect(act("brighter")).toEqual({ kind: "brightness", delta: 0.15 });
    expect(act("dim the screen")).toEqual({ kind: "brightness", delta: -0.15 });
  });

  it('"screen\'s too bright" dims rather than brightens', () => {
    expect(act("screen's too bright")).toEqual({ kind: "brightness", delta: -0.15 });
  });
});

describe("askSiri — theme, wallpaper, accent", () => {
  it("make it dark → dark theme, not brightness", () => {
    expect(act("make it dark")).toEqual({ kind: "theme", theme: "dark" });
    expect(act("make it dark in here")).toEqual({ kind: "theme", theme: "dark" });
  });

  it("switch to light mode", () => {
    expect(act("switch to light mode")).toEqual({ kind: "theme", theme: "light" });
    expect(act("turn on dark mode")).toEqual({ kind: "theme", theme: "dark" });
  });

  it("wallpaper by name", () => {
    expect(act("change wallpaper to canyon")).toEqual({ kind: "wallpaper", id: "canyon" });
    expect(act("use the meadow wallpaper")).toEqual({ kind: "wallpaper", id: "green-field" });
    expect(act("set the background to tide")).toEqual({ kind: "wallpaper", id: "teal-coast" });
  });

  it("wallpaper without a name asks back, no action", () => {
    const r = askSiri("change the wallpaper");
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/aurora/i);
  });

  it("accent by color", () => {
    expect(act("set accent to purple")).toEqual({ kind: "accent", id: "purple" });
    expect(act("make the accent green")).toEqual({ kind: "accent", id: "green" });
  });

  it("accent without a color asks back, no action", () => {
    const r = askSiri("change the accent");
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/blue/);
  });
});

describe("askSiri — settings panes", () => {
  it.each([
    ["open sound settings", "sound"],
    ["open display settings", "display"],
    ["open the wallpaper settings", "wallpaper"],
    ["open dock settings", "dock"],
    ["open appearance settings", "appearance"],
    ["open general settings", "general"],
  ] as const)("%s → %s pane", (phrase, pane) => {
    expect(act(phrase)).toEqual({ kind: "settings", pane });
  });

  it("settings with no pane opens the app", () => {
    expect(act("open settings")).toEqual({ kind: "open", app: "settings" });
  });
});

describe("askSiri — desktop files", () => {
  it.each([
    ["show me resume.pdf", "resume"],
    ["open about-me.txt", "about"],
    ["open the readme", "about"],
    ["open contact.mail", "contact"],
  ] as const)("%s → open %s", (phrase, app) => {
    expect(act(phrase)).toEqual({ kind: "open", app });
  });
});

describe("askSiri — projects, photos, notes, views", () => {
  it("names a specific project", () => {
    expect(act("show me gitbundle")).toEqual({ kind: "project", id: "gitbundle" });
    expect(act("open gitbundle")).toEqual({ kind: "project", id: "gitbundle" });
  });

  it("finds a photo by caption words", () => {
    expect(act("show me the photo of the frozen waterfall")).toEqual({ kind: "photo", query: "p9" });
  });

  it("opens a note by leftover query words", () => {
    const a = act("open my note called ideas");
    expect(a).toEqual({ kind: "note", query: "ideas" });
  });

  it("deep-links Music views", () => {
    expect(act("show my favourites in music")).toMatchObject({
      kind: "view",
      app: "music",
      view: "favourites",
    });
  });

  it("deep-links Calendar spans", () => {
    expect(act("show calendar by week")).toMatchObject({ kind: "view", app: "calendar", view: "week" });
  });
});

describe("askSiri — web", () => {
  it("search queries go to the search engine", () => {
    const a = act("search for cats");
    expect(a?.kind).toBe("browse");
    expect((a as Extract<SiriAction, { kind: "browse" }>).url).toContain("html.duckduckgo.com/html/?q=cats");
  });

  it("search queries are URL-encoded", () => {
    const a = act("google nextjs 16");
    expect((a as Extract<SiriAction, { kind: "browse" }>).url).toContain("q=nextjs%2016");
  });

  it("bare domains open in Safari with https", () => {
    expect(act("open wikipedia.org")).toEqual({
      kind: "browse",
      url: "https://wikipedia.org",
    });
  });

  it("his profiles always win over bare domains and searches", () => {
    expect(act("open github")).toEqual({ kind: "browse", url: "https://github.com/sidhxntt" });
    expect(act("open github.com")).toEqual({ kind: "browse", url: "https://github.com/sidhxntt" });
    expect(act("show me your linkedin")).toEqual({
      kind: "browse",
      url: "https://www.linkedin.com/in/sidhxntt",
    });
    expect(act("open twitter")).toEqual({ kind: "browse", url: "https://x.com/sidhxntt" });
    expect(act("open notion")).toEqual({
      kind: "browse",
      url: "https://sidhxntt.notion.site/32f479a1085e80b09884dcbc2c2ad6d1?v=333479a1085e8069b431000c2e9c9bbe",
    });
  });

  it("full URLs pass through untouched", () => {
    expect(act("go to https://example.com/page")).toEqual({
      kind: "browse",
      url: "https://example.com/page",
    });
  });

  it("spotlight", () => {
    expect(act("open spotlight")).toEqual({ kind: "spotlight" });
  });
});

describe("askSiri — info & power", () => {
  it("weather / time / date", () => {
    expect(act("is it raining")).toEqual({ kind: "weather" });
    expect(act("what time is it")).toEqual({ kind: "time" });
    expect(act("whats the date today")).toEqual({ kind: "date" });
  });

  it("restart vs shutdown", () => {
    expect(act("restart")).toEqual({ kind: "power", op: "restart" });
    expect(act("reboot the mac")).toEqual({ kind: "power", op: "restart" });
    expect(act("shut down the mac")).toEqual({ kind: "power", op: "shutdown" });
  });
});

describe("askSiri — small talk & fallback", () => {
  it("greeting and thanks are chat-only", () => {
    expect(askSiri("hey").action).toBeUndefined();
    expect(askSiri("thanks").action).toBeUndefined();
    expect(askSiri("thanks").text).toBe("Anytime.");
  });

  it("identity", () => {
    const r = askSiri("who are you");
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/Siri/);
  });

  it("empty and whitespace input", () => {
    expect(askSiri("")).toEqual({ text: "I'm listening." });
    expect(askSiri("   ")).toEqual({ text: "I'm listening." });
  });

  it("gibberish falls back with no action", () => {
    const r = askSiri("flibbertigibbet quux");
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/not sure/);
  });

  it("percent outside 0..100 is ignored", () => {
    // 500% is invalid, so this degrades to a relative volume change
    expect(act("volume up 500%")).toEqual({ kind: "volume", delta: 0.15 });
  });
});

describe("siri tables", () => {
  it("every alias resolves to a real app id", () => {
    const ids = new Set(APP_META.map((a) => a.id));
    for (const [alias, id] of Object.entries(ALIASES)) {
      expect(ids.has(id), `alias "${alias}" → unknown app "${id}"`).toBe(true);
    }
  });

  it("APP_NAMES covers every app", () => {
    for (const meta of APP_META) {
      expect(APP_NAMES[meta.id]).toBe(meta.name);
    }
  });

  it("every app answers to its own lowercased name", () => {
    for (const meta of APP_META) {
      expect(ALIASES[meta.name.toLowerCase()]).toBe(meta.id);
    }
  });

  it("all built-in suggestions produce a real reply", () => {
    for (const s of SIRI_SUGGESTIONS) {
      const r = askSiri(s);
      expect(r.text.length + (r.action ? 1 : 0)).toBeGreaterThan(0);
      expect(r.text).not.toMatch(/not sure/);
    }
  });
});
