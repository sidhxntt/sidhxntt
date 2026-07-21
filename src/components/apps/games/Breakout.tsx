"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// Breakout — canvas, mouse / touch-drag / arrow keys, click or Space to launch.

const W = 440;
const H = 520;
const COLS = 10;
const ROWS = 6;
const SIDE = 8;
const GAP = 4;
const BRICK_W = (W - SIDE * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 16;
const BRICK_TOP = 54;
const PADDLE_W = 70;
const PADDLE_H = 10;
const PADDLE_Y = H - 28;
const BALL_R = 6;
const BASE_SPEED = 4;
const MAX_SPEED = 9;
const KEY_SPEED = 7;
const STORAGE_KEY = "portfolio-arcade-breakout";

const ROW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
const ROW_POINTS = [60, 50, 40, 30, 20, 10];

const MAX_LIVES = 3;
const TRAIL_LEN = 5;
const PARTICLE_POOL = 40;
const PARTICLES_PER_BRICK = 5;
const PARTICLE_DECAY = 1 / 18; // ~300ms at 60fps
const SQUASH_MS = 80;
const LIFE_LOST_MS = 300;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "over" | "won">("idle");
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(v) && v > 0) setBest(v);
    } catch {
      /* ignore */
    }
  }, []);

  const bricks = useRef<boolean[][]>([]);
  const rowLeft = useRef<number[]>([]);
  const paddleX = useRef(W / 2 - PADDLE_W / 2);
  const ball = useRef({ x: W / 2, y: PADDLE_Y - BALL_R, dx: 0, dy: 0 });
  const speed = useRef(BASE_SPEED);
  const launched = useRef(false);
  const keys = useRef({ left: false, right: false });
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  // visual-only state (never affects physics)
  const trail = useRef<{ x: number; y: number }[]>([]);
  const particles = useRef<Particle[]>(
    Array.from({ length: PARTICLE_POOL }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: "#fff" })),
  );
  const squashUntil = useRef(0);
  const lifeLostUntil = useRef(0); // >0 while the "Ball lost" dim is showing

  const saveBest = useCallback(() => {
    setBest((b) => {
      const next = Math.max(b, scoreRef.current);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const spawnPuff = useCallback((cx: number, cy: number, color: string) => {
    let spawned = 0;
    for (const p of particles.current) {
      if (p.life > 0) continue;
      p.x = cx;
      p.y = cy;
      p.vx = (Math.random() - 0.5) * 3;
      p.vy = -(Math.random() * 2 + 0.5);
      p.life = 1;
      p.color = color;
      if (++spawned >= PARTICLES_PER_BRICK) break;
    }
  }, []);

  const draw = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    g.fillStyle = "#0f172a";
    g.fillRect(0, 0, W, H);
    // bricks — rounded with a darker bottom edge for depth
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!bricks.current[r]?.[c]) continue;
        const bx = SIDE + c * (BRICK_W + GAP);
        const by = BRICK_TOP + r * (BRICK_H + GAP);
        g.fillStyle = ROW_COLORS[r];
        g.beginPath();
        g.roundRect(bx, by, BRICK_W, BRICK_H, 3);
        g.fill();
        g.fillStyle = "rgba(0, 0, 0, 0.3)";
        g.fillRect(bx + 3, by + BRICK_H - 1.5, BRICK_W - 6, 1.5);
      }
    }
    // particles
    for (const p of particles.current) {
      if (p.life <= 0) continue;
      g.globalAlpha = Math.max(p.life, 0);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    g.globalAlpha = 1;
    // ball trail — short fading tail
    const t = trail.current;
    for (let i = 0; i < t.length; i++) {
      const f = (i + 1) / (t.length + 1);
      g.globalAlpha = f * 0.22;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(t[i].x, t[i].y, BALL_R * (0.5 + f * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // paddle — squashes briefly on ball hit, subtle top highlight
    const squash = now < squashUntil.current ? 0.85 : 1;
    const ph = PADDLE_H * squash;
    const py = PADDLE_Y + (PADDLE_H - ph);
    g.fillStyle = "#e2e8f0";
    g.beginPath();
    g.roundRect(paddleX.current, py, PADDLE_W, ph, 5);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.beginPath();
    g.roundRect(paddleX.current + 3, py + 1.5, PADDLE_W - 6, 2, 1);
    g.fill();
    // ball
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(ball.current.x, ball.current.y, BALL_R, 0, Math.PI * 2);
    g.fill();
    // life-lost moment — brief dim + label
    if (now < lifeLostUntil.current) {
      g.fillStyle = "rgba(2, 6, 23, 0.55)";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255, 255, 255, 0.85)";
      g.font = "600 15px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("Ball lost", W / 2, H / 2);
    }
  }, []);

  const resetBall = useCallback(() => {
    launched.current = false;
    trail.current = [];
    ball.current = { x: paddleX.current + PADDLE_W / 2, y: PADDLE_Y - BALL_R, dx: 0, dy: 0 };
  }, []);

  const start = useCallback(() => {
    playClick();
    bricks.current = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => true));
    rowLeft.current = Array.from({ length: ROWS }, () => COLS);
    paddleX.current = W / 2 - PADDLE_W / 2;
    speed.current = BASE_SPEED;
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    lifeLostUntil.current = 0;
    for (const p of particles.current) p.life = 0;
    resetBall();
    setPaused(false);
    setStatus("playing");
  }, [resetBall]);

  const launch = useCallback(() => {
    if (launched.current) return;
    if (performance.now() < lifeLostUntil.current) return; // wait out the "Ball lost" beat
    launched.current = true;
    playClick();
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI; // slight random tilt from vertical
    ball.current.dx = Math.sin(angle) * speed.current;
    ball.current.dy = -Math.cos(angle) * speed.current;
  }, []);

  const setSpeed = useCallback((next: number) => {
    const capped = Math.min(next, MAX_SPEED);
    const b = ball.current;
    const mag = Math.hypot(b.dx, b.dy);
    if (mag > 0) {
      b.dx = (b.dx / mag) * capped;
      b.dy = (b.dy / mag) * capped;
    }
    speed.current = capped;
  }, []);

  // pause when the window loses focus
  useEffect(() => {
    const onBlur = () => {
      if (status === "playing") {
        keys.current.left = false;
        keys.current.right = false;
        setPaused(true);
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [status]);

  // game loop
  useEffect(() => {
    if (status !== "playing" || paused) return;
    let raf = 0;

    const step = () => {
      const now = performance.now();
      // keyboard paddle movement
      if (keys.current.left) paddleX.current -= KEY_SPEED;
      if (keys.current.right) paddleX.current += KEY_SPEED;
      paddleX.current = Math.max(0, Math.min(W - PADDLE_W, paddleX.current));

      // waiting out the life-lost beat: freeze the ball until the dim ends
      if (lifeLostUntil.current) {
        if (now >= lifeLostUntil.current) {
          lifeLostUntil.current = 0;
          resetBall();
        } else {
          updateParticles();
          draw(now);
          raf = requestAnimationFrame(step);
          return;
        }
      }

      const b = ball.current;
      if (!launched.current) {
        b.x = paddleX.current + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R;
      } else {
        b.x += b.dx;
        b.y += b.dy;

        // walls
        if (b.x - BALL_R < 0) {
          b.x = BALL_R;
          b.dx = Math.abs(b.dx);
          playNote(220, 0.04);
        } else if (b.x + BALL_R > W) {
          b.x = W - BALL_R;
          b.dx = -Math.abs(b.dx);
          playNote(220, 0.04);
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R;
          b.dy = Math.abs(b.dy);
          playNote(220, 0.04);
        }

        // paddle
        if (
          b.dy > 0 &&
          b.y + BALL_R >= PADDLE_Y &&
          b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          b.x >= paddleX.current - BALL_R &&
          b.x <= paddleX.current + PADDLE_W + BALL_R
        ) {
          const offset = (b.x - (paddleX.current + PADDLE_W / 2)) / (PADDLE_W / 2);
          const clamped = Math.max(-1, Math.min(1, offset));
          speed.current = Math.min(speed.current * 1.015, MAX_SPEED);
          b.dx = clamped * speed.current * 0.75;
          b.dy = -Math.sqrt(Math.max(speed.current * speed.current - b.dx * b.dx, 1));
          b.y = PADDLE_Y - BALL_R;
          squashUntil.current = now + SQUASH_MS;
          playNote(330, 0.05);
        }

        // bricks
        let hitBrick = false;
        for (let r = 0; r < ROWS && !hitBrick; r++) {
          for (let c = 0; c < COLS && !hitBrick; c++) {
            if (!bricks.current[r][c]) continue;
            const bx = SIDE + c * (BRICK_W + GAP);
            const by = BRICK_TOP + r * (BRICK_H + GAP);
            if (
              b.x + BALL_R < bx ||
              b.x - BALL_R > bx + BRICK_W ||
              b.y + BALL_R < by ||
              b.y - BALL_R > by + BRICK_H
            )
              continue;
            bricks.current[r][c] = false;
            playNote(660, 0.05);
            spawnPuff(bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[r]);
            scoreRef.current += ROW_POINTS[r];
            setScore(scoreRef.current);
            // bounce along the axis of least penetration
            const overlapX = Math.min(b.x + BALL_R - bx, bx + BRICK_W - (b.x - BALL_R));
            const overlapY = Math.min(b.y + BALL_R - by, by + BRICK_H - (b.y - BALL_R));
            if (overlapX < overlapY) b.dx = -b.dx;
            else b.dy = -b.dy;
            // row cleared → speed up
            rowLeft.current[r] -= 1;
            if (rowLeft.current[r] === 0) setSpeed(speed.current * 1.08);
            // win?
            if (rowLeft.current.every((n) => n === 0)) {
              playNote(880, 0.3);
              saveBest();
              setStatus("won");
              return;
            }
            hitBrick = true;
          }
        }

        // ball trail
        trail.current.push({ x: b.x, y: b.y });
        if (trail.current.length > TRAIL_LEN) trail.current.shift();

        // missed the paddle
        if (b.y - BALL_R > H) {
          playNote(150, 0.5);
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            saveBest();
            setStatus("over");
            return;
          }
          launched.current = false;
          trail.current = [];
          lifeLostUntil.current = now + LIFE_LOST_MS;
        }
      }

      updateParticles();
      draw(now);
      raf = requestAnimationFrame(step);
    };

    const updateParticles = () => {
      for (const p of particles.current) {
        if (p.life <= 0) continue;
        p.life -= PARTICLE_DECAY;
        p.vy += 0.25; // gravity
        p.x += p.vx;
        p.y += p.vy;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [status, paused, draw, resetBall, saveBest, setSpeed, spawnPuff]);

  // keyboard — held-key movement + Space to launch
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // don't steal keys from Terminal/Spotlight/Siri inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keys.current.left = true;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        keys.current.right = true;
      } else if (e.key === " ") {
        e.preventDefault();
        if (status === "playing" && !paused) launch();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = false;
      if (e.key === "ArrowRight") keys.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, paused, launch]);

  const movePaddleTo = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    paddleX.current = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  }, []);

  const overlayPanel = "breakout-overlay-panel flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-8 py-6 backdrop-blur-md";
  const primaryBtn =
    "rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 max-md:min-h-11 max-md:px-6";

  return (
    <div className="flex h-full flex-col items-center gap-3 bg-slate-950 p-4 text-white max-md:justify-center">
      <style>{`
        @keyframes breakout-overlay-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .breakout-overlay-panel { animation: breakout-overlay-in 200ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .breakout-overlay-panel { animation: none; } }
      `}</style>
      <div className="flex w-full max-w-[440px] items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/90">
          🧱 Breakout
        </span>
        <div className="flex items-center gap-2 tabular-nums text-white/70">
          <span>Score {score}</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1" role="img" aria-label={`${Math.max(lives, 0)} of ${MAX_LIVES} lives`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <span
                key={i}
                className={
                  i < Math.max(lives, 0)
                    ? "h-2 w-2 rounded-full bg-orange-400"
                    : "h-2 w-2 rounded-full ring-1 ring-inset ring-white/25"
                }
              />
            ))}
          </span>
          <span aria-hidden>·</span>
          <span>Best {best}</span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto max-w-full touch-none"
          onMouseMove={(e) => movePaddleTo(e.clientX)}
          onTouchStart={(e) => movePaddleTo(e.touches[0].clientX)}
          onTouchMove={(e) => movePaddleTo(e.touches[0].clientX)}
          onClick={() => {
            if (status === "playing" && !paused) launch();
          }}
        />
        {status === "playing" && paused && (
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 p-4 focus-visible:outline-none"
          >
            <span className={overlayPanel}>
              <span className="text-base font-bold text-white">Paused</span>
              <span className="text-xs text-white/60">
                <span className="max-md:hidden">Click to resume</span>
                <span className="hidden max-md:inline">Tap to resume</span>
              </span>
            </span>
          </button>
        )}
        {status !== "playing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 p-4">
            <div className={overlayPanel}>
              {status === "over" && <p className="text-lg font-bold text-rose-400">Game Over — {score} pts</p>}
              {status === "won" && <p className="text-lg font-bold text-emerald-400">You cleared the wall! 🎉</p>}
              <button onClick={start} className={primaryBtn}>
                {status === "idle" ? "Start Game" : "Play Again"}
              </button>
              <p className="text-xs text-white/60">
                <span className="max-md:hidden">Click to launch — move with mouse/arrows</span>
                <span className="hidden max-md:inline">Tap to launch — drag to move</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
