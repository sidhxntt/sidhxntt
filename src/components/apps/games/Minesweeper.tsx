"use client";

import { useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// Minesweeper — classic 9×9, 10 mines. First click always safe, flood-fill,
// right-click / long-press to flag, LED counters, best-time in localStorage.

const SIZE = 9;
const MINES = 10;
const BEST_KEY = "portfolio-arcade-minesweeper";

const NUMBER_COLORS = [
  "",
  "#2563eb", // 1
  "#16a34a", // 2
  "#dc2626", // 3
  "#1e3a8a", // 4
  "#7f1d1d", // 5
  "#0d9488", // 6
  "#111827", // 7
  "#6b7280", // 8
];

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adj: number };
type Status = "idle" | "playing" | "won" | "lost";

const freshGrid = (): Cell[] =>
  Array.from({ length: SIZE * SIZE }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adj: 0,
  }));

function neighbors(i: number): number[] {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
    }
  }
  return out;
}

// Classic bevels — raised for unrevealed cells / smiley, sunken for LED wells + board frame
const RAISED =
  "border-2 border-t-white border-l-white border-b-neutral-500 border-r-neutral-500 bg-neutral-300";
const LED_WELL =
  "inline-block w-14 rounded-sm border border-t-black border-l-black border-b-white/25 border-r-white/25 bg-black py-0.5 text-center font-mono text-lg font-bold leading-6 tabular-nums text-red-500";
const LED_GLOW = { textShadow: "0 0 4px rgba(239,68,68,0.55)" };

export function Minesweeper() {
  const [grid, setGrid] = useState<Cell[]>(freshGrid);
  const [status, setStatus] = useState<Status>("idle");
  const [time, setTime] = useState(0);
  const [exploded, setExploded] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  // reveal-cascade delays (ms) for the most recent reveal, keyed by cell index
  const [revealDelay, setRevealDelay] = useState<Record<number, number>>({});
  const [focused, setFocused] = useState(true);

  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  // a pending long-press must not fire after unmount
  useEffect(() => {
    return () => {
      if (longPress.current) clearTimeout(longPress.current);
    };
  }, []);
  const suppressClick = useRef(false);

  // load best time ("34s" format)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const v = parseInt(raw, 10);
        if (Number.isFinite(v) && v >= 0) setBest(v);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // pause the clock while the window is unfocused
  useEffect(() => {
    const onBlur = () => setFocused(false);
    const onFocus = () => setFocused(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // timer — runs from first reveal until win/loss, paused on window blur
  useEffect(() => {
    if (status !== "playing" || !focused) return;
    const t = setInterval(() => setTime((s) => Math.min(s + 1, 999)), 1000);
    return () => clearInterval(t);
  }, [status, focused]);

  const toggleFlag = (i: number) => {
    if (status === "won" || status === "lost") return;
    setGrid((g) => {
      if (g[i].revealed) return g;
      const next = g.slice();
      next[i] = { ...next[i], flagged: !next[i].flagged };
      return next;
    });
  };

  const reveal = (i: number) => {
    if (status === "won" || status === "lost") return;
    let g = grid.slice();
    if (g[i].flagged || g[i].revealed) return;

    // First reveal: place mines, excluding the clicked cell + its 8 neighbors
    if (status === "idle") {
      const excluded = new Set([i, ...neighbors(i)]);
      const candidates: number[] = [];
      for (let k = 0; k < SIZE * SIZE; k++) if (!excluded.has(k)) candidates.push(k);
      for (let m = 0; m < MINES; m++) {
        const j = m + Math.floor(Math.random() * (candidates.length - m));
        [candidates[m], candidates[j]] = [candidates[j], candidates[m]];
        g[candidates[m]] = { ...g[candidates[m]], mine: true };
      }
      for (let k = 0; k < SIZE * SIZE; k++) {
        g[k] = { ...g[k], adj: neighbors(k).filter((n) => g[n].mine).length };
      }
      setStatus("playing");
    }

    if (g[i].mine) {
      g = g.map((c) => (c.mine ? { ...c, revealed: true } : c));
      setGrid(g);
      setExploded(i);
      setStatus("lost");
      playNote(150, 0.5);
      return;
    }

    // Flood-fill zero regions, revealing their bordering numbers (incl. diagonals)
    const order: number[] = [];
    const stack = [i];
    while (stack.length) {
      const k = stack.pop()!;
      if (g[k].revealed || g[k].mine) continue;
      g[k] = { ...g[k], revealed: true, flagged: false };
      order.push(k);
      if (g[k].adj === 0) {
        for (const n of neighbors(k)) if (!g[n].revealed && !g[n].mine) stack.push(n);
      }
    }
    // ~15ms per cell cascade, capped at 300ms total
    const delays: Record<number, number> = {};
    order.forEach((k, idx) => {
      delays[k] = Math.min(idx * 15, 300);
    });
    setRevealDelay(delays);

    const won = g.every((c) => c.mine || c.revealed);
    if (won) {
      g = g.map((c) => (c.mine ? { ...c, flagged: true } : c));
      setStatus("won");
      playNote(880, 0.2);
      if (best === null || time < best) {
        setBest(time);
        setNewBest(true);
        try {
          localStorage.setItem(BEST_KEY, `${time}s`);
        } catch {
          /* ignore */
        }
      }
    }
    setGrid(g);
  };

  const reset = () => {
    playClick();
    setGrid(freshGrid());
    setStatus("idle");
    setTime(0);
    setExploded(null);
    setNewBest(false);
    setRevealDelay({});
  };

  const onCellClick = (i: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    reveal(i);
  };

  const onCellTouchStart = (i: number) => {
    longPress.current = setTimeout(() => {
      longPress.current = null;
      suppressClick.current = true;
      toggleFlag(i);
    }, 450);
  };

  const cancelLongPress = (e?: React.TouchEvent) => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
    if (e && suppressClick.current) {
      e.preventDefault();
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };

  const flags = grid.reduce((n, c) => n + (c.flagged ? 1 : 0), 0);
  const smiley = status === "lost" ? "😵" : status === "won" ? "😎" : "🙂";
  const led = (n: number) =>
    n < 0
      ? `-${String(Math.min(Math.abs(n), 99)).padStart(2, "0")}`
      : String(Math.min(n, 999)).padStart(3, "0");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 p-4 text-white">
      <style>{`
        @keyframes ms-reveal-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ms-flag-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes ms-frame-flash {
          0%, 25% { box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.9), 0 0 16px 2px rgba(244, 63, 94, 0.5); }
          100% { box-shadow: none; }
        }
        .ms-reveal { animation: ms-reveal-in 160ms ease-out backwards; }
        .ms-flag { animation: ms-flag-pop 120ms ease-out; }
        .ms-flash { animation: ms-frame-flash 350ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .ms-reveal, .ms-flag, .ms-flash { animation: none !important; }
        }
      `}</style>

      {/* chip row */}
      <div className="flex w-full max-w-[336px] items-center justify-between text-sm">
        <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-semibold">
          💣 Minesweeper
        </span>
        <span className="text-white/70">{best !== null ? `Best: ${best}s` : ""}</span>
      </div>

      <div className="rounded-xl bg-slate-900 p-3 shadow-lg ring-1 ring-white/10">
        {/* header — LED wells + smiley */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/50 px-2 py-1.5">
          <span className={LED_WELL} style={LED_GLOW} aria-label="Mines remaining">
            {led(MINES - flags)}
          </span>
          <button
            onClick={reset}
            aria-label="Reset game"
            className={`flex h-9 w-9 items-center justify-center rounded-sm text-xl transition-transform active:translate-y-px max-md:h-11 max-md:w-11 ${RAISED}`}
          >
            {smiley}
          </button>
          <span className={LED_WELL} style={LED_GLOW} aria-label="Timer">
            {led(time)}
          </span>
        </div>

        {/* board — sunken bezel frame */}
        <div
          className={`border-2 border-t-neutral-600 border-l-neutral-600 border-b-white/80 border-r-white/80 ${
            status === "lost" ? "ms-flash" : ""
          }`}
        >
          <div
            className="grid touch-none select-none [-webkit-touch-callout:none]"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 34px)` }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {grid.map((cell, i) => {
              const isExploded = i === exploded;
              let content: React.ReactNode = null;
              if (cell.revealed) {
                if (cell.mine) content = isExploded ? "💥" : "💣";
                else if (cell.adj > 0)
                  content = <span style={{ color: NUMBER_COLORS[cell.adj] }}>{cell.adj}</span>;
              } else if (cell.flagged) {
                content = <span className="ms-flag">🚩</span>;
              }
              const delay = cell.revealed && !cell.mine ? revealDelay[i] : undefined;
              const face = cell.revealed
                ? `border border-neutral-300 ${isExploded ? "bg-red-400" : "bg-neutral-200"}`
                : `${RAISED} hover:bg-neutral-200 active:translate-y-px`;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onCellClick(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    // long-press timer already flagged this touch — don't double-toggle
                    if (suppressClick.current) return;
                    if (longPress.current) {
                      clearTimeout(longPress.current);
                      longPress.current = null;
                      suppressClick.current = true;
                    }
                    toggleFlag(i);
                  }}
                  onTouchStart={() => onCellTouchStart(i)}
                  onTouchEnd={(e) => cancelLongPress(e)}
                  onTouchMove={() => cancelLongPress()}
                  className={`flex h-[34px] w-[34px] items-center justify-center text-base font-bold leading-none ${face} ${
                    delay !== undefined ? "ms-reveal" : ""
                  }`}
                  style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* status pill */}
      <p className="flex min-h-7 items-center justify-center text-sm">
        {status === "lost" && (
          <span className="rounded-full bg-white/5 px-3 py-1 text-rose-300">Boom. Try again.</span>
        )}
        {status === "won" && (
          <span className="rounded-full bg-white/5 px-3 py-1 text-emerald-300">
            Cleared in {time}s 🎉{newBest && <span className="text-amber-300"> New best!</span>}
          </span>
        )}
        {(status === "idle" || status === "playing") && (
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">
            <span className="max-md:hidden">Left click reveal · right click flag</span>
            <span className="hidden max-md:inline">Tap reveal · long-press flag</span>
          </span>
        )}
      </p>
    </div>
  );
}
