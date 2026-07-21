"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// Dino — the Chrome offline T-Rex runner. Space / ↑ / tap to jump (release early
// for a short hop), ↓ to duck or fast-fall. Canvas + rAF, monochrome pixel art.

const W = 460;
const H = 220;
const S = 2; // pixel-art scale
const GROUND_Y = 196;
const DINO_X = 30;
const DINO_H = 44;
const DUCK_H = 24;
const DUCK_W = 52;
const DINO_W = 36;
const GRAVITY = 0.55;
const JUMP_V = 9.8;
const SHORT_JUMP_V = 4.5;
const FAST_FALL = 1.5;
const BASE_SPEED = 6;
const MAX_SPEED = 13;
const ACCEL = 0.0016;
const PTERO_SCORE = 300;
const NIGHT_EVERY = 700;
const RESTART_DELAY_MS = 350;
const STORAGE_KEY = "portfolio-arcade-dino";

// --- pixel art ('#' = filled block, drawn at ×2) ---

const BODY: string[] = [
  "..........########",
  "..........#.######", // the gap is the eye
  "..........########",
  "..........########",
  "..........####....",
  "..........######..",
  "#.........#####...",
  "#........######...",
  "##......########..",
  "###....#########..",
  "###...##########..",
  "####.###########..",
  "#################.",
  ".###############..",
  ".##############...",
  "..############....",
  "...##########.....",
  "....#########.....",
];
const BODY_BLINK: string[] = BODY.map((r, i) => (i === 1 ? "..........########" : r));

const LEGS_BOTH: string[] = [
  ".....##...##......",
  ".....#....#.......",
  ".....#....#.......",
  ".....###..###.....",
];
const LEGS_A: string[] = [
  ".....##...##......",
  ".....#....###.....",
  ".....#............",
  ".....###..........",
];
const LEGS_B: string[] = [
  ".....##...##......",
  ".....###..#.......",
  "..........#.......",
  "..........###.....",
];

const DUCK_BASE: string[] = [
  "..................########",
  "..................#.######",
  "..................########",
  "..................######..",
  "#.....#################...",
  "##...##################...",
  "#######################...",
  ".#####################....",
  "...#################......",
];
const DUCK_A: string[] = [
  ...DUCK_BASE,
  "....##......##............",
  "....##......#.............",
  "....###.....##............",
];
const DUCK_B: string[] = [
  ...DUCK_BASE,
  "....##......##............",
  "....#.......##............",
  "....##......###...........",
];

const CACTUS_SMALL: string[] = [
  "....##....",
  "....##....",
  ".#..##..#.",
  ".#..##..#.",
  ".#..##..#.",
  ".#..##..#.",
  ".#..##..#.",
  ".##.##.##.",
  "..######..",
  "....##....",
  "....##....",
  "....##....",
  "....##....",
  "....##....",
  "....##....",
  "....##....",
  "....##....",
];
const CACTUS_LARGE: string[] = [
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".#...##...#.",
  ".#...##...#.",
  ".#...##...#.",
  ".#...##...#.",
  ".#...##...#.",
  ".#...##...#.",
  ".##..##..##.",
  "..########..",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
  ".....##.....",
];

const PTERO_UP: string[] = [
  "..........#.........",
  "..........##........",
  "..........###.......",
  "..........####......",
  "..........######....",
  "..##################",
  "####################",
  "....############....",
  "........######......",
];
const PTERO_DOWN: string[] = [
  "..##################",
  "####################",
  "....############....",
  "........######......",
  "..........######....",
  "..........####......",
  "..........###.......",
  "..........##........",
  "..........#.........",
];

const CLOUD: string[] = [
  "......######......",
  "....##########....",
  "..##############..",
  "##################",
];

function drawArt(g: CanvasRenderingContext2D, art: string[], x: number, y: number, color: string) {
  g.fillStyle = color;
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    let c = 0;
    while (c < row.length) {
      if (row.charCodeAt(c) === 35 /* '#' */) {
        let e = c + 1;
        while (e < row.length && row.charCodeAt(e) === 35) e++;
        g.fillRect(x + c * S, y + r * S, (e - c) * S, S);
        c = e;
      } else c++;
    }
  }
}

/** Grayscale lerp between day and night values. */
const gray = (day: number, night: number, t: number) => {
  const v = Math.round(day + (night - day) * t);
  return `rgb(${v},${v},${v})`;
};

const fmt = (n: number) => String(Math.min(99999, Math.max(0, Math.floor(n)))).padStart(5, "0");

type Ob =
  | { kind: "cactus"; x: number; y: number; w: number; h: number; art: string[] }
  | { kind: "ptero"; x: number; y: number; w: number; h: number; extra: number };

export function Dino() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const bestRef = useRef(best);
  bestRef.current = best;

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(v) && v > 0) setBest(v);
    } catch {
      /* ignore */
    }
  }, []);

  const game = useRef({
    alt: 0, // height above ground
    vy: 0,
    down: false,
    obstacles: [] as Ob[],
    clouds: [] as { x: number; y: number }[],
    marks: [] as { x: number; w: number; up: boolean }[],
    speed: BASE_SPEED,
    dist: 0,
    lastScore: 0,
    frame: 0,
    nightT: 0,
    gap: 380,
    groundOff: 0,
    blinkT: 130,
    blink: 0,
    overAt: 0,
  });

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const gm = game.current;
    const t = gm.nightT;
    const fg = gray(83, 230, t); // #535353 ↔ light
    g.fillStyle = gray(247, 31, t); // #f7f7f7 ↔ #1f1f1f
    g.fillRect(0, 0, W, H);

    // clouds (parallax)
    const cloudC = gray(205, 92, t);
    for (const c of gm.clouds) drawArt(g, CLOUD, c.x, c.y, cloudC);

    // ground — scrolling dashed line + bumps/pebbles
    g.fillStyle = fg;
    const patt = 48;
    for (let x = -(gm.groundOff % patt); x < W; x += patt) g.fillRect(x, GROUND_Y, 38, 2);
    for (const m of gm.marks) {
      if (m.up) g.fillRect(m.x, GROUND_Y - 2, m.w, 2);
      else {
        g.fillRect(m.x, GROUND_Y + 7, 3, 2);
        g.fillRect(m.x + 6, GROUND_Y + 11, 2, 2);
      }
    }

    // score — right-aligned monospace, Chrome style
    g.font = "700 13px 'Courier New', monospace";
    g.textAlign = "right";
    g.textBaseline = "top";
    g.fillStyle = fg;
    const sTxt = fmt(gm.lastScore);
    g.fillText(sTxt, W - 10, 8);
    if (bestRef.current > 0) {
      g.globalAlpha = 0.6;
      g.fillText(`HI ${fmt(bestRef.current)}`, W - 10 - g.measureText(sTxt).width - 12, 8);
      g.globalAlpha = 1;
    }

    // obstacles
    const flap = Math.floor(gm.frame / 15) % 2 === 0;
    for (const ob of gm.obstacles) {
      if (ob.kind === "cactus") drawArt(g, ob.art, ob.x, ob.y, fg);
      else if (flap) drawArt(g, PTERO_UP, ob.x, ob.y, fg);
      else drawArt(g, PTERO_DOWN, ob.x, ob.y + 10, fg);
    }

    // dino
    const legPhase = Math.floor(gm.frame / 6) % 2 === 0;
    const ducking = gm.down && gm.alt === 0 && statusRef.current !== "idle";
    if (ducking) {
      drawArt(g, legPhase ? DUCK_A : DUCK_B, DINO_X, GROUND_Y - DUCK_H, fg);
    } else {
      const top = GROUND_Y - DINO_H - gm.alt;
      const airborne = gm.alt > 0;
      const running = statusRef.current === "playing" && !airborne;
      const legs = running ? (legPhase ? LEGS_A : LEGS_B) : LEGS_BOTH;
      drawArt(g, gm.blink > 0 ? BODY_BLINK : BODY, DINO_X, top, fg);
      drawArt(g, legs, DINO_X, top + BODY.length * S, fg);
    }
  }, []);

  const drawGameOver = useCallback(() => {
    const g = canvasRef.current?.getContext("2d");
    if (!g) return;
    const fg = gray(83, 230, game.current.nightT);
    g.fillStyle = fg;
    g.font = "700 15px 'Courier New', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("G A M E   O V E R", W / 2, 72);
    // restart icon — circular arrow, Chrome style
    const cx = W / 2;
    const cy = 112;
    const r = 12;
    g.strokeStyle = fg;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 1.2);
    g.stroke();
    const ax = cx + r * Math.cos(-Math.PI * 0.35);
    const ay = cy + r * Math.sin(-Math.PI * 0.35);
    g.beginPath();
    g.moveTo(ax - 3, ay - 7);
    g.lineTo(ax + 7, ay + 1);
    g.lineTo(ax - 6, ay + 4);
    g.closePath();
    g.fill();
  }, []);

  const endGame = useCallback(() => {
    const gm = game.current;
    playNote(150, 0.5);
    gm.overAt = performance.now();
    setBest((b) => {
      const next = Math.max(b, gm.lastScore);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setStatus("over");
  }, []);

  const start = useCallback(() => {
    playClick();
    const gm = game.current;
    gm.alt = 0;
    gm.vy = 0;
    gm.down = false;
    gm.obstacles = [];
    gm.marks = [];
    gm.clouds = [
      { x: 90, y: 42 },
      { x: 300, y: 72 },
    ];
    gm.speed = BASE_SPEED;
    gm.dist = 0;
    gm.lastScore = 0;
    gm.frame = 0;
    gm.nightT = 0;
    gm.gap = 380;
    gm.groundOff = 0;
    gm.blink = 0;
    setScore(0);
    setStatus("playing");
  }, []);

  // game loop — runs for idle (blink anim) + playing; over draws a frozen frame
  useEffect(() => {
    const gm = game.current;
    if (status === "over") {
      drawScene();
      drawGameOver();
      return;
    }
    if (status === "paused") {
      drawScene();
      return;
    }
    let raf = 0;

    const step = () => {
      gm.frame++;
      // blink occasionally while idle / standing
      if (status === "idle") {
        if (gm.blink > 0) gm.blink--;
        else if (--gm.blinkT <= 0) {
          gm.blink = 10;
          gm.blinkT = 130 + Math.random() * 200;
        }
        drawScene();
        raf = requestAnimationFrame(step);
        return;
      }

      // speed + distance
      gm.speed = Math.min(MAX_SPEED, gm.speed + ACCEL);
      gm.dist += gm.speed;
      gm.groundOff += gm.speed;
      const s = Math.floor(gm.dist * 0.025);
      if (s !== gm.lastScore) {
        if (Math.floor(s / 100) > Math.floor(gm.lastScore / 100)) playNote(660, 0.08);
        gm.lastScore = s;
        setScore(s);
      }
      // day/night flip every NIGHT_EVERY points, eased
      const nightTarget = Math.floor(s / NIGHT_EVERY) % 2;
      gm.nightT += (nightTarget - gm.nightT) * 0.04;

      // physics — jump / gravity / fast-fall
      if (gm.alt > 0 || gm.vy > 0) {
        gm.vy -= GRAVITY + (gm.down ? FAST_FALL : 0);
        gm.alt += gm.vy;
        if (gm.alt <= 0) {
          gm.alt = 0;
          gm.vy = 0;
        }
      }

      // clouds drift slower than the ground
      for (const c of gm.clouds) c.x -= gm.speed * 0.3;
      gm.clouds = gm.clouds.filter((c) => c.x > -80);
      if (gm.clouds.length < 4 && Math.random() < 0.007)
        gm.clouds.push({ x: W + 40, y: 24 + Math.random() * 70 });

      // ground detail
      gm.marks = gm.marks.filter((m) => m.x + m.w > -20);
      for (const m of gm.marks) m.x -= gm.speed;
      if (Math.random() < 0.05) gm.marks.push({ x: W + 10, w: 6 + Math.random() * 16, up: Math.random() < 0.5 });

      // spawn obstacles with shrinking randomized gaps
      gm.gap -= gm.speed;
      if (gm.gap <= 0) {
        let width = 0;
        if (s > PTERO_SCORE && Math.random() < 0.25) {
          const y = GROUND_Y - [18, 30, 48][Math.floor(Math.random() * 3)];
          gm.obstacles.push({ kind: "ptero", x: W + 20, y, w: 40, h: 18, extra: Math.random() * 1.6 - 0.4 });
        } else {
          const art = Math.random() < 0.5 ? CACTUS_LARGE : CACTUS_SMALL;
          const w = art[0].length * S;
          const h = art.length * S;
          const roll = Math.random();
          const count = roll < 0.5 ? 1 : roll < 0.8 ? 2 : 3;
          for (let i = 0; i < count; i++)
            gm.obstacles.push({ kind: "cactus", x: W + 20 + i * w, y: GROUND_Y - h + 2, w, h, art });
          width = (count - 1) * w;
        }
        const base = 270 + Math.random() * 320;
        gm.gap = Math.max(200, base - (gm.speed - BASE_SPEED) * 20) + width;
      }

      // move + cull
      for (const ob of gm.obstacles) ob.x -= gm.speed + (ob.kind === "ptero" ? ob.extra : 0);
      gm.obstacles = gm.obstacles.filter((ob) => ob.x + ob.w > -20);

      // collision — forgiving AABB
      const ducking = gm.down && gm.alt === 0;
      const dTop = GROUND_Y - (ducking ? DUCK_H : DINO_H) - gm.alt;
      const box = ducking
        ? { x: DINO_X + 6, y: dTop + 4, w: DUCK_W - 14, h: DUCK_H - 6 }
        : { x: DINO_X + 6, y: dTop + 5, w: DINO_W - 12, h: DINO_H - 7 };
      for (const ob of gm.obstacles) {
        const ptero = ob.kind === "ptero";
        const ox = ob.x + (ptero ? 5 : 3);
        const oy = ob.y + (ptero ? 4 : 2);
        const ow = ob.w - (ptero ? 10 : 6);
        const oh = ob.h - (ptero ? 8 : 4);
        if (box.x < ox + ow && box.x + box.w > ox && box.y < oy + oh && box.y + box.h > oy) {
          drawScene();
          endGame();
          return; // freeze frame — no further rAF
        }
      }

      drawScene();
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [status, drawScene, drawGameOver, endGame]);

  const press = useCallback(() => {
    const st = statusRef.current;
    const gm = game.current;
    if (st === "playing") {
      if (gm.alt === 0 && gm.vy <= 0 && !gm.down) {
        gm.vy = JUMP_V;
        gm.alt = 0.01;
        playNote(500, 0.06);
      }
    } else if (st === "idle") {
      start();
    } else if (st === "paused") {
      playClick();
      setStatus("playing");
    } else if (performance.now() - gm.overAt > RESTART_DELAY_MS) {
      start();
    }
  }, [start]);

  const release = useCallback(() => {
    const gm = game.current;
    // variable jump — releasing early shortens the arc
    if (statusRef.current === "playing" && gm.vy > SHORT_JUMP_V) gm.vy = SHORT_JUMP_V;
  }, []);

  // touch: first finger jumps, a second finger held down ducks
  const touchIds = useRef<Set<number>>(new Set());
  const duckPointerId = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (touchIds.current.size > 0 && statusRef.current === "playing") {
          // second finger — duck while held
          touchIds.current.add(e.pointerId);
          duckPointerId.current = e.pointerId;
          game.current.down = true;
          return;
        }
        touchIds.current.add(e.pointerId);
      }
      press();
    },
    [press],
  );

  const onPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") {
        touchIds.current.delete(e.pointerId);
        if (duckPointerId.current === e.pointerId) {
          duckPointerId.current = null;
          game.current.down = false;
          return;
        }
      }
      release();
    },
    [release],
  );

  // pause when the window loses focus
  useEffect(() => {
    const onBlur = () => {
      if (statusRef.current !== "playing") return;
      game.current.down = false; // keyup may never arrive
      setStatus("paused");
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // don't steal keys from Terminal/Spotlight/Siri inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const k = e.key;
      if (k === " " || k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight")
        e.preventDefault();
      if (statusRef.current === "over" || statusRef.current === "paused") {
        press(); // any key restarts / resumes
        return;
      }
      if (k === " " || k === "ArrowUp") press();
      else if (k === "ArrowDown") game.current.down = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") release();
      else if (e.key === "ArrowDown") game.current.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [press, release]);

  const buttonCls =
    "rounded-lg bg-stone-200 px-5 py-2 text-sm font-bold text-slate-900 transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 max-md:min-h-11 max-md:px-6";

  return (
    <div className="flex h-full flex-col items-center gap-3 bg-slate-950 p-4 text-white max-md:justify-center">
      <style>{`
        @keyframes dino-overlay-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .dino-overlay-in { animation: dino-overlay-in 200ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .dino-overlay-in { animation: none; } }
      `}</style>
      <div className="flex w-full max-w-[460px] items-center justify-between text-sm">
        <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-neutral-200">
          🦖 Dino Run
        </span>
        <span className="px-1 py-1 font-mono tabular-nums text-white/70">
          Score {fmt(score)} · HI {fmt(best)}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={release}
        />
        {(status === "idle" || status === "paused") && (
          <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center"
            onClick={status === "idle" ? start : press}
          >
            <div className="dino-overlay-in flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-8 py-6 backdrop-blur-md">
              {status === "paused" ? (
                <>
                  <p className="text-lg font-bold text-neutral-200">Paused</p>
                  <p className="text-xs text-white/50">
                    <span className="max-md:hidden">Click or press any key to resume</span>
                    <span className="hidden max-md:inline">Tap to resume</span>
                  </p>
                </>
              ) : (
                <>
                  <button className={buttonCls}>Start Game</button>
                  <p className="text-xs text-white/50">
                    <span className="max-md:hidden">Space / ↑ / tap — jump · ↓ — duck</span>
                    <span className="hidden max-md:inline">Tap — jump · second finger — duck</span>
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
