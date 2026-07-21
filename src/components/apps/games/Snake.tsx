"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// Snake — canvas, arrow keys / WASD, swipe on touch.

const GRID = 17;
const CELL = 22;
const TICK_MS = 110;

type Point = { x: number; y: number };

export function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("portfolio-arcade-snake"));
      if (Number.isFinite(v) && v > 0) setBest(v);
    } catch {
      /* ignore */
    }
  }, []);

  const snake = useRef<Point[]>([]);
  const dir = useRef<Point>({ x: 1, y: 0 });
  const nextDir = useRef<Point>({ x: 1, y: 0 });
  const food = useRef<Point>({ x: 10, y: 8 });
  const touchStart = useRef<Point | null>(null);

  const placeFood = useCallback(() => {
    do {
      food.current = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
    } while (snake.current.some((s) => s.x === food.current.x && s.y === food.current.y));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    // board — subtle checkerboard of two close dark tones
    g.fillStyle = "#0b1220";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "#0f172a";
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if ((x + y) % 2 === 0) g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    // food — soft radial glow + berry with highlight
    const fx = food.current.x * CELL + CELL / 2;
    const fy = food.current.y * CELL + CELL / 2;
    const glow = g.createRadialGradient(fx, fy, 2, fx, fy, CELL * 1.1);
    glow.addColorStop(0, "rgba(244,63,94,0.35)");
    glow.addColorStop(1, "rgba(244,63,94,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(fx, fy, CELL * 1.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f43f5e";
    g.beginPath();
    g.arc(fx, fy, CELL / 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(fx - 2.5, fy - 3, 2.2, 0, Math.PI * 2);
    g.fill();
    // snake
    snake.current.forEach((seg, i) => {
      const isHead = i === 0;
      g.fillStyle = isHead ? "#34d399" : "#10b981";
      g.beginPath();
      g.roundRect(seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3, isHead ? 9 : 6);
      g.fill();
    });
    // eyes on the head, facing the direction of travel
    const head = snake.current[0];
    if (head) {
      const cx = head.x * CELL + CELL / 2;
      const cy = head.y * CELL + CELL / 2;
      const d = dir.current;
      const px = -d.y;
      const py = d.x;
      const side = 4.5;
      const fwd = 3.5;
      const eyes: Point[] = [
        { x: cx + d.x * fwd + px * side, y: cy + d.y * fwd + py * side },
        { x: cx + d.x * fwd - px * side, y: cy + d.y * fwd - py * side },
      ];
      for (const e of eyes) {
        g.fillStyle = "#ecfdf5";
        g.beginPath();
        g.arc(e.x, e.y, 2.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#022c22";
        g.beginPath();
        g.arc(e.x + d.x * 1.1, e.y + d.y * 1.1, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, []);

  const start = useCallback(() => {
    playClick();
    snake.current = [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ];
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    setScore(0);
    placeFood();
    setStatus("playing");
  }, [placeFood]);

  // game loop
  useEffect(() => {
    if (status !== "playing") return;
    const timer = setInterval(() => {
      dir.current = nextDir.current;
      const head = snake.current[0];
      const next = { x: head.x + dir.current.x, y: head.y + dir.current.y };
      const hitWall = next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID;
      const hitSelf = snake.current.some((s) => s.x === next.x && s.y === next.y);
      if (hitWall || hitSelf) {
        playNote(130, 0.4);
        setStatus("over");
        setBest((b) => {
          const next = Math.max(b, snake.current.length - 3);
          try {
            localStorage.setItem("portfolio-arcade-snake", String(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        return;
      }
      snake.current = [next, ...snake.current];
      if (next.x === food.current.x && next.y === food.current.y) {
        playNote(660, 0.15);
        setScore((s) => s + 1);
        placeFood();
      } else {
        snake.current.pop();
      }
      draw();
    }, TICK_MS);
    draw();
    return () => clearInterval(timer);
  }, [status, draw, placeFood]);

  // keep the board painted while idle / paused / over
  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // don't steal keys from Terminal/Spotlight/Siri inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      // no 180° turns
      if (nd.x === -dir.current.x && nd.y === -dir.current.y) return;
      nextDir.current = nd;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // auto-pause when the window loses focus
  useEffect(() => {
    const onBlur = () => setStatus((s) => (s === "playing" ? "paused" : s));
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // any key (or tap on the overlay) resumes from pause
  useEffect(() => {
    if (status !== "paused") return;
    const onKey = () => setStatus("playing");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  // touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    const nd: Point = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    if (nd.x === -dir.current.x && nd.y === -dir.current.y) return;
    nextDir.current = nd;
  };

  return (
    <div
      className="flex h-full flex-col items-center gap-4 bg-slate-950 p-4 text-white max-md:justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes snake-overlay-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes snake-score-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .snake-overlay-in { animation: snake-overlay-in 200ms ease-out; }
        .snake-score-pop { display: inline-block; animation: snake-score-pop 220ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .snake-overlay-in, .snake-score-pop { animation: none; }
        }
      `}</style>
      <div className="flex w-full max-w-[390px] items-center justify-between">
        <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />
          Snake
        </span>
        <div className="flex items-center gap-4 text-sm tabular-nums text-white/70">
          <span>
            Score{" "}
            <span key={score} className="snake-score-pop font-semibold text-white">
              {score}
            </span>
          </span>
          <span>
            Best <span className="font-semibold text-white">{best}</span>
          </span>
        </div>
      </div>
      <div className="relative touch-none rounded-xl bg-slate-900/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10">
        <canvas ref={canvasRef} width={GRID * CELL} height={GRID * CELL} className="h-auto max-w-full rounded-lg" />
        {status !== "playing" && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/40 p-4"
            onPointerDown={status === "paused" ? () => setStatus("playing") : undefined}
          >
            <div className="snake-overlay-in flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-8 py-6 text-center backdrop-blur-md">
              {status === "paused" ? (
                <>
                  <p className="text-lg font-bold text-white">Paused</p>
                  <p className="text-xs text-white/50">
                    <span className="max-md:hidden">Press any key to resume</span>
                    <span className="hidden max-md:inline">Tap to resume</span>
                  </p>
                </>
              ) : (
                <>
                  {status === "over" && (
                    <p className="text-lg font-bold text-rose-400">Game Over — {score} 🍎</p>
                  )}
                  <button
                    onClick={start}
                    className="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-95 max-md:min-h-11 max-md:px-6"
                  >
                    {status === "over" ? "Play Again" : "Start Game"}
                  </button>
                  <p className="text-xs text-white/50">Arrow keys / WASD · swipe on touch</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
