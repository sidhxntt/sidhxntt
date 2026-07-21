"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// 2048 — DOM grid, arrow keys / WASD, swipe on touch.

const SIZE = 4;
const BEST_KEY = "portfolio-arcade-2048";

type Dir = "left" | "right" | "up" | "down";

const TILE_STYLES: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#eee4da", fg: "#776e65" },
  4: { bg: "#ede0c8", fg: "#776e65" },
  8: { bg: "#f2b179", fg: "#f9f6f2" },
  16: { bg: "#f59563", fg: "#f9f6f2" },
  32: { bg: "#f67c5f", fg: "#f9f6f2" },
  64: { bg: "#f65e3b", fg: "#f9f6f2" },
  128: { bg: "#edcf72", fg: "#f9f6f2" },
  256: { bg: "#edcc61", fg: "#f9f6f2" },
  512: { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" },
};

function tileStyle(value: number) {
  return TILE_STYLES[value] ?? { bg: "#3c3a32", fg: "#f9f6f2" };
}

function fontSize(value: number) {
  if (value >= 1000) return "text-lg";
  if (value >= 100) return "text-2xl";
  return "text-3xl";
}

function emptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function randomEmptyCell(grid: number[][]): [number, number] | null {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

// Slide + merge one line toward index 0. Each tile merges at most once.
function slideLine(line: number[]): { out: number[]; gained: number; mergedIdx: number[] } {
  const vals = line.filter((v) => v !== 0);
  const out: number[] = [];
  const mergedIdx: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      const merged = vals[i] * 2;
      out.push(merged);
      gained += merged;
      mergedIdx.push(out.length - 1);
      i++; // skip the partner — it already merged
    } else {
      out.push(vals[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { out, gained, mergedIdx };
}

function applyMove(grid: number[][], dir: Dir) {
  const next = grid.map((row) => [...row]);
  let moved = false;
  let gained = 0;
  const pops = new Set<number>();
  for (let i = 0; i < SIZE; i++) {
    const cells: [number, number][] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "left") cells.push([i, j]);
      else if (dir === "right") cells.push([i, SIZE - 1 - j]);
      else if (dir === "up") cells.push([j, i]);
      else cells.push([SIZE - 1 - j, i]);
    }
    const { out, gained: g, mergedIdx } = slideLine(cells.map(([r, c]) => grid[r][c]));
    gained += g;
    cells.forEach(([r, c], j) => {
      if (grid[r][c] !== out[j]) moved = true;
      next[r][c] = out[j];
    });
    mergedIdx.forEach((j) => pops.add(cells[j][0] * SIZE + cells[j][1]));
  }
  return { next, moved, gained, pops };
}

function hasMoves(grid: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

function newGameGrid(): { grid: number[][]; pops: Set<number> } {
  const grid = emptyGrid();
  const pops = new Set<number>();
  for (let i = 0; i < 2; i++) {
    const cell = randomEmptyCell(grid);
    if (cell) {
      grid[cell[0]][cell[1]] = Math.random() < 0.9 ? 2 : 4;
      pops.add(cell[0] * SIZE + cell[1]);
    }
  }
  return { grid, pops };
}

export function Game2048() {
  const [grid, setGrid] = useState<number[][]>(emptyGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "over">("playing");
  const [hasWon, setHasWon] = useState(false);
  // Cells that should replay the pop animation, keyed by move counter so
  // remounting via `key` restarts the CSS animation.
  const [pops, setPops] = useState<Set<number>>(() => new Set());
  const [moveId, setMoveId] = useState(0);
  // Points gained on the last move — drives the floating "+N" over the score box.
  const [gain, setGain] = useState(0);
  // Brief board shake when a move is a no-op.
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  useEffect(() => {
    const fresh = newGameGrid();
    setGrid(fresh.grid);
    setPops(fresh.pops);
    try {
      const v = Number(localStorage.getItem(BEST_KEY));
      if (Number.isFinite(v) && v > 0) setBest(v);
    } catch {
      /* ignore */
    }
  }, []);

  const bumpBest = useCallback((newScore: number) => {
    setBest((b) => {
      if (newScore <= b) return b;
      try {
        localStorage.setItem(BEST_KEY, String(newScore));
      } catch {
        /* ignore */
      }
      return newScore;
    });
  }, []);

  const move = useCallback(
    (dir: Dir) => {
      if (status !== "playing") return;
      const { next, moved, gained, pops: mergePops } = applyMove(grid, dir);
      if (!moved) {
        setShaking(true);
        if (shakeTimer.current) clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShaking(false), 180);
        return;
      }

      if (mergePops.size > 0) playNote(440, 0.08);

      const spawn = randomEmptyCell(next);
      if (spawn) {
        next[spawn[0]][spawn[1]] = Math.random() < 0.9 ? 2 : 4;
        mergePops.add(spawn[0] * SIZE + spawn[1]);
      }

      const newScore = score + gained;
      setGrid(next);
      setScore(newScore);
      bumpBest(newScore);
      setPops(mergePops);
      setGain(gained);
      setMoveId((m) => m + 1);

      if (!hasWon && next.some((row) => row.some((v) => v >= 2048))) {
        setHasWon(true);
        setStatus("won");
        playNote(880, 0.3);
        return;
      }
      if (!hasMoves(next)) {
        setStatus("over");
        playNote(180, 0.4);
      }
    },
    [grid, score, status, hasWon, bumpBest],
  );

  const newGame = useCallback(() => {
    playClick();
    const fresh = newGameGrid();
    setGrid(fresh.grid);
    setPops(fresh.pops);
    setMoveId((m) => m + 1);
    setScore(0);
    setGain(0);
    setHasWon(false);
    setStatus("playing");
  }, []);

  // keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      arrowup: "up",
      arrowdown: "down",
      arrowleft: "left",
      arrowright: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      // don't steal keys from Terminal/Spotlight/Siri inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const dir = map[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault(); // keep arrows from scrolling the window
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  };

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 p-4 text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes pop2048 {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .tile-pop-2048 { animation: pop2048 0.12s ease-out; }
        @keyframes gain2048 {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-16px); opacity: 0; }
        }
        .gain-2048 { animation: gain2048 0.6s ease-out forwards; }
        @keyframes shake2048 {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        .shake-2048 { animation: shake2048 0.15s ease-out; }
        @keyframes overlay2048 {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .overlay-2048 { animation: overlay2048 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .tile-pop-2048, .gain-2048, .shake-2048, .overlay-2048 { animation: none; }
        }
      `}</style>

      <div className="flex w-full max-w-[296px] items-center justify-between gap-2">
        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold">
          🔢 2048
        </span>
        <div className="flex items-center gap-2">
          <div className="relative flex min-w-[64px] flex-col items-center rounded-md bg-[#8f7a66] px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Score</span>
            <span className="text-sm font-bold tabular-nums text-white">{score}</span>
            {gain > 0 && (
              <span
                key={moveId}
                aria-hidden
                className="gain-2048 pointer-events-none absolute -top-2 right-1 text-xs font-bold tabular-nums text-[#edc22e]"
              >
                +{gain}
              </span>
            )}
          </div>
          <div className="flex min-w-[64px] flex-col items-center rounded-md bg-[#8f7a66] px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Best</span>
            <span className="text-sm font-bold tabular-nums text-white">{best}</span>
          </div>
          <button
            onClick={newGame}
            className="rounded-lg bg-[#8f7a66] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 max-md:min-h-11"
          >
            New Game
          </button>
        </div>
      </div>

      <div className="relative touch-none">
        <div className={`rounded-xl ring-1 ring-white/10 ${shaking ? "shake-2048" : ""}`}>
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#bbada0] p-2">
            {grid.flat().map((value, i) => {
              const pop = pops.has(i);
              const { bg, fg } = tileStyle(value);
              return (
                <div
                  key={pop ? `${i}-${moveId}` : i}
                  className={`flex h-16 w-16 items-center justify-center rounded-md font-bold ${fontSize(value)} ${
                    value !== 0 ? "shadow-sm" : ""
                  } ${pop && value !== 0 ? "tile-pop-2048" : ""}`}
                  style={
                    value === 0
                      ? { background: "rgba(238,228,218,0.35)" }
                      : {
                          background: bg,
                          color: fg,
                          ...(value >= 128
                            ? { boxShadow: `0 1px 2px rgba(0,0,0,0.2), 0 0 14px 2px ${bg}40` }
                            : {}),
                        }
                  }
                >
                  {value !== 0 ? value : ""}
                </div>
              );
            })}
          </div>
        </div>

        {status !== "playing" && (
          <div className="overlay-2048 absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md">
            {status === "over" ? (
              <>
                <p className="text-lg font-bold text-[#eee4da]">Game over</p>
                <p className="text-sm tabular-nums text-white/60">Score {score}</p>
                <button
                  onClick={newGame}
                  className="rounded-lg bg-[#8f7a66] px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 max-md:min-h-11 max-md:px-6"
                >
                  Play Again
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-[#edc22e]">You win! 🎉</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus("playing")}
                    className="rounded-lg bg-[#8f7a66] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 max-md:min-h-11"
                  >
                    Keep going
                  </button>
                  <button
                    onClick={newGame}
                    className="rounded-lg bg-[#8f7a66] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 max-md:min-h-11"
                  >
                    New Game
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-white/50">Arrow keys / WASD · swipe on touch</p>
    </div>
  );
}
