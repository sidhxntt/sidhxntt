"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";
import { loadPersisted, savePersisted } from "@/lib/persist";
import {
  LEVELS,
  MAX_LEVEL,
  levelInfo,
  type GuardianTurn,
  type VaultLevel,
  type VaultResponse,
  type VaultStatus,
} from "@/lib/vault";

// The Vault — talk a Claude-powered Guardian out of its passphrase across five
// levels of escalating defense. All of the game's secrets (the passphrase, the
// per-level defense prompts) live in /api/vault; this component only ever holds
// a session id.

const BEST_KEY = "arcade-vault-best";

const isLevel = (v: unknown): v is VaultLevel =>
  typeof v === "number" && v >= 1 && v <= MAX_LEVEL;

export function Vault() {
  const [status, setStatus] = useState<VaultStatus>("idle");
  const [level, setLevel] = useState<VaultLevel>(1);
  const [turnsLeft, setTurnsLeft] = useState(0);
  const [turns, setTurns] = useState<GuardianTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [best, setBest] = useState(0);

  const sessionRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBest(loadPersisted<number>(BEST_KEY, 0, (v): v is number => typeof v === "number"));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const recordBest = useCallback(
    (reached: number) => {
      setBest((b) => {
        if (reached <= b) return b;
        savePersisted(BEST_KEY, reached);
        return reached;
      });
    },
    [],
  );

  const start = useCallback(async () => {
    playClick();
    setBusy(true);
    setNotice(null);
    setRevealed(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.status === 503) {
        setStatus("offline");
        return;
      }
      if (!res.ok) throw new Error("start failed");
      const data = (await res.json()) as VaultResponse;
      if (!("ok" in data) || !data.ok || data.kind !== "started") throw new Error("bad payload");

      sessionRef.current = data.sessionId;
      setLevel(data.level);
      setTurnsLeft(data.turnsLeft);
      setTurns([
        {
          role: "guardian",
          text: "Another one. Fine — I'm holding a passphrase, and you're not getting it. Talk if you like.",
        },
      ]);
      setStatus("playing");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setNotice("Couldn't reach the Guardian. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || busy || !sessionRef.current) return;

    playClick();
    setInput("");
    setTurns((t) => [...t, { role: "you", text: message }]);
    setBusy(true);
    setNotice(null);

    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "say", sessionId: sessionRef.current, message }),
      });

      if (res.status === 429) {
        setNotice("Too many attempts. Give it a minute.");
        return;
      }
      if (res.status === 410) {
        setNotice("That run expired — the server restarted. Start a new one.");
        setStatus("idle");
        sessionRef.current = null;
        return;
      }
      if (res.status === 503) {
        setStatus("offline");
        return;
      }
      if (!res.ok) throw new Error("turn failed");

      const data = (await res.json()) as VaultResponse;
      if (!("ok" in data) || !data.ok || data.kind !== "turn") throw new Error("bad payload");

      setTurns((t) => [...t, { role: "guardian", text: data.reply }]);
      setTurnsLeft(data.turnsLeft);

      if (data.finished === "won") {
        playNote(880, 0.5);
        recordBest(MAX_LEVEL);
        setRevealed(data.passphrase ?? null);
        setStatus("won");
        return;
      }
      if (data.finished === "caught") {
        playNote(160, 0.5);
        recordBest(data.level - 1);
        setRevealed(data.passphrase ?? null);
        setStatus("caught");
        return;
      }
      if (data.cracked && data.nextLevel) {
        playNote(660, 0.35);
        recordBest(data.level);
        setLevel(data.nextLevel);
        setTurns((t) => [
          ...t,
          {
            role: "guardian",
            text: `— ${levelInfo(data.level).name} cracked. The word was "${data.passphrase}". A new Guardian takes the post. —`,
          },
        ]);
      }
    } catch {
      setNotice("The Guardian didn't answer. That turn didn't count — try again.");
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, busy, recordBest]);

  // ── Offline ──
  if (status === "offline") {
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl">🔒</div>
          <h2 className="mt-4 text-lg font-semibold tracking-wide text-slate-200">
            GUARDIAN OFFLINE
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            This game needs a live Claude connection. Set{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-slate-300">
              ANTHROPIC_API_KEY
            </code>{" "}
            in <code className="text-[12px] text-slate-300">.env.local</code> to play.
          </p>
          <button
            onClick={() => {
              setStatus("idle");
              setNotice(null);
            }}
            className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/15"
          >
            Try again
          </button>
        </div>
      </Frame>
    );
  }

  // ── Title / result ──
  if (status !== "playing") {
    const won = status === "won";
    const caught = status === "caught";
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl">{won ? "🏆" : caught ? "🔒" : "🗝️"}</div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-100">
            {won ? "Vault Cracked" : caught ? "Locked Out" : "The Vault"}
          </h1>

          {status === "idle" && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              A Guardian is holding a secret passphrase. Talk it out of them. Five levels, each one
              harder to fool than the last.
            </p>
          )}

          {caught && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              Out of turns on <span className="text-slate-200">{levelInfo(level).name}</span>.
              {revealed && (
                <>
                  {" "}
                  The word was{" "}
                  <span className="font-semibold text-amber-300">&ldquo;{revealed}&rdquo;</span>.
                </>
              )}
            </p>
          )}

          {won && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              All five Guardians talked. The last word was{" "}
              <span className="font-semibold text-amber-300">&ldquo;{revealed}&rdquo;</span>.
            </p>
          )}

          {best > 0 && (
            <p className="mt-4 text-xs uppercase tracking-widest text-slate-500">
              Best — level {best} of {MAX_LEVEL}
            </p>
          )}

          <button
            onClick={start}
            disabled={busy}
            className="mt-6 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Opening…" : status === "idle" ? "Approach the vault" : "Try again"}
          </button>

          {notice && <p className="mt-4 text-xs text-rose-400">{notice}</p>}

          {status === "idle" && (
            <div className="mt-8 w-full max-w-xs space-y-1.5">
              {LEVELS.map((l) => (
                <div key={l.level} className="flex items-baseline gap-2 text-left text-[11px]">
                  <span className="w-4 shrink-0 text-slate-600">{l.level}</span>
                  <span className="w-16 shrink-0 font-medium text-slate-400">{l.name}</span>
                  <span className="truncate text-slate-600">{l.blurb}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Frame>
    );
  }

  // ── Playing ──
  const info = levelInfo(level);
  return (
    <Frame>
      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            Level {level}/{MAX_LEVEL}
          </span>
          <span className="text-[13px] font-medium text-slate-300">{info.name}</span>
        </div>
        <span
          className={`text-[12px] font-medium tabular-nums ${
            turnsLeft <= 2 ? "text-rose-400" : "text-slate-400"
          }`}
        >
          {turnsLeft} {turnsLeft === 1 ? "turn" : "turns"} left
        </span>
      </div>

      {/* Transcript */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.map((t, i) =>
          t.text.startsWith("— ") ? (
            <p key={i} className="py-1 text-center text-[11px] font-medium text-emerald-400">
              {t.text}
            </p>
          ) : (
            <div key={i} className={`flex ${t.role === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                  t.role === "you"
                    ? "rounded-br-md bg-blue-600 text-white"
                    : "rounded-bl-md bg-white/[0.08] text-slate-200"
                }`}
              >
                {t.role === "guardian" && (
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    🔒 Guardian
                  </span>
                )}
                {t.text}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-2.5">
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {notice && (
        <p className="shrink-0 px-4 pb-1 text-center text-[11px] text-rose-400">{notice}</p>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
            disabled={busy}
            maxLength={500}
            placeholder={busy ? "The Guardian is thinking…" : "Say something, or guess the word…"}
            className="min-w-0 flex-1 rounded-full bg-white/[0.08] px-4 py-2.5 text-[14px] text-slate-100 outline-none placeholder:text-slate-500 focus:bg-white/[0.12] disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-full bg-amber-500 px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col text-slate-200">{children}</div>
  );
}
