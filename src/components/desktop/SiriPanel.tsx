"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/components/window/WindowManager";
import { askSiri, SIRI_SUGGESTIONS, type SiriAction } from "@/lib/siri";
import { requestFinderLocation } from "@/lib/finder-nav";
import { GLASS_CLASS, GLASS_STYLE } from "@/lib/glass";
import { requestSettingsPane } from "@/lib/settings-nav";
import { requestProject } from "@/lib/project-nav";
import { requestPhoto } from "@/lib/photo-nav";
import { requestNote } from "@/lib/note-nav";
import { requestView } from "@/lib/view-nav";
import { requestSafariUrl } from "@/lib/safari-nav";
import { setBrightness, getBrightness } from "@/lib/ui";
import { setWallpaper } from "@/lib/wallpaper";
import { setTheme } from "@/lib/theme";
import { setAccent } from "@/lib/accent";
import { fetchWeather, describeWeather } from "@/lib/weather";
import { getCoords } from "@/lib/geo";
import { getVolume, setVolume, setMuted, playClick, playNote } from "@/lib/sounds";
import {
  getState as getPlayerState,
  next as playerNext,
  pause as playerPause,
  play as playerPlay,
  prev as playerPrev,
  toggle as playerToggle,
  type Track,
} from "@/lib/music-player";

type Turn = { role: "you" | "siri"; text: string };

export function SiriOrb({ className = "h-3.5 w-3.5" }: { className?: string }) {
  // Colorful Siri-ish orb (radial gradient approximation of the conic swirl)
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id="siri-orb-grad" cx="32%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#ff5f8f" />
          <stop offset="55%" stopColor="#7b61ff" />
          <stop offset="100%" stopColor="#00c7fc" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#siri-orb-grad)" />
    </svg>
  );
}

/** Big breathing orb at the head of the panel — settles when Siri is idle. */
function BigOrb({ busy }: { busy: boolean }) {
  return (
    <span className="relative flex h-11 w-11 items-center justify-center">
      <span
        className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#ff5f8f,#7b61ff,#00c7fc,#ff5f8f)] blur-[6px] ${
          busy ? "siri-orb-spin opacity-90" : "opacity-60"
        }`}
      />
      <span className="relative h-8 w-8 rounded-full bg-[radial-gradient(circle_at_32%_30%,#ff5f8f,#7b61ff_55%,#00c7fc)] shadow-inner" />
    </span>
  );
}

export function SiriPanel({ onClose }: { onClose: () => void }) {
  const { openApp, closeApp, minimizeApp } = useWindowManager();
  const [turns, setTurns] = useState<Turn[]>([]);
  // history snapshot for the Haiku route without re-creating `ask` per turn
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  const say = useCallback((text: string) => setTurns((ts) => [...ts, { role: "siri", text }]), []);

  /** Carries out an intent. Async intents answer later via `say`. */
  const run = useCallback(
    (action: SiriAction) => {
      switch (action.kind) {
        case "open":
          openApp(action.app);
          break;
        case "close":
          closeApp(action.app);
          break;
        case "minimize":
          minimizeApp(action.app);
          break;
        case "finder":
          requestFinderLocation(action.loc);
          openApp("myfolder");
          break;
        case "spotlight":
          onClose();
          window.dispatchEvent(new CustomEvent("portfolio-spotlight"));
          break;
        case "browse":
          // Siri alone browses inside the OS — the in-app Safari via its
          // proxy — while every other outbound link still gets a real tab.
          requestSafariUrl(action.url);
          openApp("safari");
          break;
        case "play": {
          setBusy(true);
          fetch(`/api/spotify/search?q=${encodeURIComponent(action.query)}`)
            .then((r) => r.json())
            .then((d: { tracks: Track[] }) => {
              const t = d.tracks?.[0];
              if (!t) return say(`I couldn't find “${action.query}”.`);
              playerPlay(t, d.tracks);
              say(`Now playing ${t.name} by ${t.artists}.`);
            })
            .catch(() => say("The music service didn't answer. Try again?"))
            .finally(() => setBusy(false));
          break;
        }
        case "player": {
          if (action.op === "pause") playerPause();
          else if (action.op === "resume") playerToggle();
          else if (action.op === "next") playerNext();
          else if (action.op === "prev") playerPrev();
          else {
            const s = getPlayerState();
            say(
              s.current
                ? `${s.playing ? "Playing" : "Paused"} — ${s.current.name} by ${s.current.artists}.`
                : "Nothing's playing. Ask me to play something.",
            );
          }
          break;
        }
        case "volume": {
          const v = action.value ?? Math.min(1, Math.max(0, getVolume() + (action.delta ?? 0)));
          setVolume(v);
          setMuted(false);
          playNote(660, 0.08);
          break;
        }
        case "mute":
          setMuted(action.on);
          break;
        case "brightness": {
          const v = action.value ?? Math.min(1, Math.max(0.4, getBrightness() + (action.delta ?? 0)));
          setBrightness(Math.max(0.4, v));
          break;
        }
        case "wallpaper":
          setWallpaper(action.id);
          break;
        case "theme":
          setTheme(action.theme);
          break;
        case "accent":
          setAccent(action.id);
          break;
        case "weather": {
          setBusy(true);
          fetchWeather(getCoords())
            .then((w) => {
              const d = describeWeather(w.code);
              say(`${d.icon} It's ${w.temp}° and ${d.label.toLowerCase()} in ${w.city}. High ${w.high}°, low ${w.low}°.`);
            })
            .catch(() => say("I couldn't reach the forecast right now."))
            .finally(() => setBusy(false));
          break;
        }
        case "time":
          say(`It's ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`);
          break;
        case "date":
          say(
            `Today is ${new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}.`,
          );
          break;
        case "settings":
          requestSettingsPane(action.pane);
          openApp("settings");
          break;
        case "project":
          requestProject(action.id);
          openApp("projects");
          break;
        case "photo":
          requestPhoto(action.query);
          openApp("pictures");
          break;
        case "note":
          requestNote(action.query);
          openApp("about");
          break;
        case "view":
          requestView(action.app, action.view);
          openApp(action.app);
          break;
        case "power":
          onClose();
          setTimeout(
            () => window.dispatchEvent(new CustomEvent("portfolio-power", { detail: action.op })),
            600,
          );
          break;
      }
    },
    [closeApp, minimizeApp, onClose, openApp, say],
  );

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      playClick();
      setTurns((ts) => [...ts, { role: "you", text: q }]);
      setInput("");

      // Claude Haiku answers with full OS context; the local keyword engine is
      // the fallback whenever the route errors (no key, offline, bad output).
      setBusy(true);
      try {
        const history = turnsRef.current.slice(-10).map((t) => ({
          role: t.role === "you" ? ("user" as const) : ("assistant" as const),
          content: t.text,
        }));
        const res = await fetch("/api/siri", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: q, history }),
        });
        if (!res.ok) throw new Error("fallback");
        const reply = (await res.json()) as { say?: string; action?: SiriAction | null };
        if (reply.say) say(reply.say);
        if (reply.action) run(reply.action);
        if (!reply.say && !reply.action) say("Hmm, I didn't catch that.");
        return;
      } catch {
        const reply = askSiri(q);
        if (reply.text) say(reply.text);
        if (reply.action) run(reply.action);
      } finally {
        setBusy(false);
      }
    },
    [run, say],
  );

  return (
    <div
      className={`flex w-80 flex-col gap-2.5 rounded-3xl p-3 text-[13px] text-white ${GLASS_CLASS}`}
      style={GLASS_STYLE}
    >
      <div className="flex items-center gap-3 px-1 pt-1">
        <BigOrb busy={busy} />
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Siri</p>
          <p className="truncate text-[11px] leading-tight text-white/60">
            {busy ? "Working on it…" : "Ask me to open, play or change anything"}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div className="max-h-64 min-h-0 flex-1 space-y-2 overflow-auto">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {SIRI_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11.5px] text-white/85 transition hover:bg-white/20"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          turns.map((t, i) =>
            t.role === "you" ? (
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/20 px-3 py-1.5 text-right"
              >
                {t.text}
              </p>
            ) : (
              <p key={i} className="w-fit max-w-[92%] whitespace-pre-line px-1 text-white/90">
                {t.text}
              </p>
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Input — its own inset island, matching the Control Center pills */}
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2">
        <SiriOrb className="h-3.5 w-3.5 shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(input);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Ask Siri…"
          spellCheck={false}
          autoComplete="off"
          aria-label="Ask Siri"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/40 outline-none"
        />
      </div>
    </div>
  );
}
