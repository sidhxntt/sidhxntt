"use client";

import { useEffect, useRef, useState } from "react";
import type { AppId } from "@/components/AppIcon";
import { useWindowManager } from "@/components/window/WindowManager";
import { profile } from "@/data/portfolio";
import { isMuted, playClick, setMuted, setVolume, getVolume } from "@/lib/sounds";
import { setBrightness, getBrightness } from "@/lib/ui";
import { setWallpaper, WALLPAPERS, type WallpaperId } from "@/lib/wallpaper";
import { openExternal } from "@/lib/browser";
import { ALIASES, APP_NAMES } from "@/lib/siri";
import { fetchWeather, describeWeather } from "@/lib/weather";
import { getCoords } from "@/lib/geo";
import {
  getState as getPlayerState,
  next as playerNext,
  pause as playerPause,
  play as playerPlay,
  prev as playerPrev,
  toggle as playerToggle,
  type Track,
} from "@/lib/music-player";

// Real terminal for the web OS — open/close apps, change wallpaper,
// volume, brightness, restart… `help` lists everything.

type Line = { text: string; kind: "in" | "out" | "err" };

const PROMPT = `${profile.name.split(" ")[0].toLowerCase()}@portfolio ~ %`;

const HELP = `Available commands:
  help                    show this list
  ls                      list files & folders
  ls apps                 list applications
  open <app|file>         open an app or file  (e.g. open notes, open resume.pdf)
  close <app>             close an app's window
  minimize <app>          minimize an app to the dock
  spotlight               open Spotlight search
  browse <url|query>      open a site (or web search) in a new tab
  play <song>             search Spotify and play a preview
  pause / resume          control playback
  next / prev             skip tracks
  now                     what's playing
  weather                 current conditions, right here in the shell
  wallpaper <name>        set wallpaper: ${WALLPAPERS.map((w) => w.id).join(" | ")}
  brightness <40-100>     set display brightness
  volume <0-100>          set sound volume
  mute / unmute           toggle sounds
  whoami                  who is this Mac's human
  date                    current date & time
  neofetch                system info, but make it fancy
  echo <text>             say it back
  clear                   clear the screen
  restart                 reboot Portfolio OS
  shutdown                power off`;

const NEOFETCH = String.raw`
        .:'          ${profile.name}@portfolio-os
     .:'  ..         ---------------------------
   .::  .:::         OS:      Portfolio OS 1.0 (web)
  :::: :::::         Host:    Your Browser
  ::::::::::         Kernel:  react-19.2
  ':::::::::'        Shell:   fake-zsh 1.0
    ':::::'          Chip:    Fable Silicon
      ':'            Memory:  ∞ GB unified dreams
                     Uptime:  since you pressed power`;

export function Terminal() {
  const { openApp, closeApp, minimizeApp, windows } = useWindowManager();
  const [lines, setLines] = useState<Line[]>([
    { text: "Portfolio OS Terminal — type `help` to see what I can do.", kind: "out" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const print = (text: string, kind: Line["kind"] = "out") =>
    setLines((ls) => [...ls, ...text.split("\n").map((t) => ({ text: t, kind }))]);

  const resolveApp = (raw: string): AppId | null => ALIASES[raw.toLowerCase()] ?? null;

  const exec = (raw: string) => {
    const cmd = raw.trim();
    setLines((ls) => [...ls, { text: `${PROMPT} ${cmd}`, kind: "in" }]);
    if (!cmd) return;
    setHistory((h) => [cmd, ...h]);
    setHistIdx(-1);

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    switch (head.toLowerCase()) {
      case "help":
        print(HELP);
        break;
      case "ls":
        if (arg.toLowerCase() === "apps" || arg === "/Applications") {
          print(Object.values(APP_NAMES).map((n) => `${n}.app`).join("  "));
        } else {
          print("Projects/  Pictures/  about-me.txt  resume.pdf  contact.mail");
        }
        break;
      case "open": {
        if (!arg) return print("usage: open <app|file> — try `ls apps`", "err");
        const id = resolveApp(arg);
        if (!id) return print(`open: no such app or file: ${arg}`, "err");
        openApp(id);
        print(`Opening ${APP_NAMES[id]}…`);
        break;
      }
      case "close": {
        const id = arg ? resolveApp(arg) : null;
        if (!id) return print(`close: no such app: ${arg || "(none)"}`, "err");
        if (!windows[id]?.open) return print(`close: ${APP_NAMES[id]} is not running`, "err");
        closeApp(id);
        print(`Closed ${APP_NAMES[id]}.`);
        break;
      }
      case "minimize": {
        const id = arg ? resolveApp(arg) : null;
        if (!id) return print(`minimize: no such app: ${arg || "(none)"}`, "err");
        if (!windows[id]?.open) return print(`minimize: ${APP_NAMES[id]} is not running`, "err");
        minimizeApp(id);
        print(`Minimized ${APP_NAMES[id]} to the dock.`);
        break;
      }
      case "wallpaper": {
        const id = arg.toLowerCase() as WallpaperId;
        if (!WALLPAPERS.some((w) => w.id === id))
          return print(`wallpaper: unknown. Options: ${WALLPAPERS.map((w) => w.id).join(", ")}`, "err");
        setWallpaper(id);
        print(`Wallpaper set to ${id}.`);
        break;
      }
      case "brightness": {
        const v = Number(arg);
        if (!Number.isFinite(v) || v < 40 || v > 100)
          return print("brightness: give a number 40–100", "err");
        setBrightness(v / 100);
        print(`Brightness → ${v}%`);
        break;
      }
      case "volume": {
        const v = Number(arg);
        if (!Number.isFinite(v) || v < 0 || v > 100) return print("volume: give a number 0–100", "err");
        setVolume(v / 100);
        print(`Volume → ${v}%`);
        break;
      }
      case "spotlight":
        window.dispatchEvent(new CustomEvent("portfolio-spotlight"));
        print("Spotlight opened — start typing.");
        break;
      case "browse":
      case "google": {
        if (!arg) return print("usage: browse <url or search terms>", "err");
        const looksLikeUrl = arg.includes(".") && !arg.includes(" ");
        const url = looksLikeUrl
          ? arg.startsWith("http")
            ? arg
            : `https://${arg}`
          : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(arg)}`;
        openExternal(url);
        print(`Opening ${url} in a new tab…`);
        break;
      }
      case "play": {
        if (!arg) return print("usage: play <song name>", "err");
        print(`Searching “${arg}”…`);
        fetch(`/api/spotify/search?q=${encodeURIComponent(arg)}`)
          .then((r) => r.json())
          .then((d: { tracks: Track[] }) => {
            const t = d.tracks?.[0];
            if (!t) return print(`play: nothing found for “${arg}”`, "err");
            playerPlay(t, d.tracks);
            print(`▶ ${t.name} — ${t.artists}`);
          })
          .catch(() => print("play: search failed", "err"));
        break;
      }
      case "pause":
        playerPause();
        print("Paused.");
        break;
      case "resume":
        playerToggle();
        print("Resumed.");
        break;
      case "next":
        playerNext();
        print("Skipped forward.");
        break;
      case "prev":
        playerPrev();
        print("Skipped back.");
        break;
      case "now": {
        const s = getPlayerState();
        if (!s.current) print("Nothing playing. Try `play <song>`.");
        else print(`${s.playing ? "▶" : "⏸"} ${s.current.name} — ${s.current.artists}`);
        break;
      }
      case "weather":
        print("Checking the sky…");
        fetchWeather(getCoords())
          .then((w) => {
            const d = describeWeather(w.code);
            print(`${d.icon} ${w.city}: ${w.temp}° ${d.label} (H:${w.high}° L:${w.low}°)`);
          })
          .catch(() => print("weather: couldn't reach the forecast service", "err"));
        break;
      case "mute":
        setMuted(true);
        print("Sounds muted. 🤫");
        break;
      case "unmute":
        setMuted(false);
        print("Sounds back on.");
        break;
      case "whoami":
        print(`${profile.name} — ${profile.role}. (You're browsing their portfolio.)`);
        break;
      case "date":
        print(new Date().toString());
        break;
      case "neofetch":
        print(NEOFETCH);
        print(`Brightness: ${Math.round(getBrightness() * 100)}%  Volume: ${Math.round(getVolume() * 100)}%  Muted: ${isMuted() ? "yes" : "no"}`);
        break;
      case "echo":
        print(arg);
        break;
      case "clear":
        setLines([]);
        break;
      case "restart":
        print("Rebooting…");
        setTimeout(() => window.dispatchEvent(new CustomEvent("portfolio-power", { detail: "restart" })), 600);
        break;
      case "shutdown":
        print("Shutting down…");
        setTimeout(() => window.dispatchEvent(new CustomEvent("portfolio-power", { detail: "shutdown" })), 600);
        break;
      case "sudo":
        print("Nice try. This incident will be reported to absolutely no one.", "err");
        break;
      case "rm":
        print("rm: permission denied — this portfolio took too long to build.", "err");
        break;
      default:
        print(`zsh: command not found: ${head} — try \`help\``, "err");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      playClick();
      exec(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      if (history[next]) {
        setHistIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next < 0 ? -1 : next);
      setInput(next < 0 ? "" : history[next]);
    }
  };

  return (
    <div
      className="flex h-full flex-col bg-[#1c1c1e]/95 font-mono text-[12.5px] leading-relaxed text-neutral-100 max-md:text-[13px]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 max-md:overscroll-contain max-md:px-4 max-md:py-3">
        {lines.map((l, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-words ${
              l.kind === "in" ? "text-emerald-300" : l.kind === "err" ? "text-rose-400" : "text-neutral-200"
            }`}
          >
            {l.text}
          </pre>
        ))}
        {/* input line */}
        <div className="flex items-center gap-2 max-md:min-h-10">
          <span className="shrink-0 text-emerald-300">{PROMPT}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent text-neutral-100 caret-emerald-300 outline-none max-md:text-[16px]"
            aria-label="Terminal input"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
