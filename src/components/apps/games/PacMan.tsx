"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

// Pac-Man — canvas, arrow keys / WASD, swipe on touch.
// 15×15 tile maze with a wrap-around tunnel on row 7.

const N = 15;
const CELL = 26; // canvas 390×390
const BASE_TICK_MS = 160;
const FRIGHT_MS = 6000;
const STORAGE_KEY = "portfolio-arcade-pacman";

// '#' wall · '.' pellet · 'o' power pellet · ' ' empty · 'P' pacman · 'G' ghost
const MAZE = [
  "###############",
  "#o...........o#",
  "#.##.#####.##.#",
  "#.#.........#.#",
  "#.#.##.#.##.#.#",
  "#......#......#",
  "#.#.#.###.#.#.#",
  "....#.G.G.#....",
  "#.#.#.###.#.#.#",
  "#......#......#",
  "#.#.##.#.##.#.#",
  "#.............#",
  "#.##.#####.##.#",
  "#o.....P.....o#",
  "###############",
] as const;

const WALLS: boolean[][] = MAZE.map((row) => [...row].map((c) => c === "#"));
const PELLET_KEYS: string[] = [];
const POWER_KEYS: string[] = [];
let pacStart = { x: 7, y: 13 };
const ghostStarts: { x: number; y: number }[] = [];
MAZE.forEach((row, y) => {
  [...row].forEach((c, x) => {
    if (c === ".") PELLET_KEYS.push(`${x},${y}`);
    if (c === "o") POWER_KEYS.push(`${x},${y}`);
    if (c === "P") pacStart = { x, y };
    if (c === "G") ghostStarts.push({ x, y });
  });
});

type Dir = { x: number; y: number };
type Ghost = {
  x: number;
  y: number;
  dir: Dir;
  home: { x: number; y: number };
  color: string;
  kind: "blinky" | "clyde";
  fright: boolean;
};

const DIRS: Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const DEATH_MS = 700; // pac-man collapse animation (fits inside the 1s life-loss pause)
const FLOAT_MS = 800; // "+200" ghost-eaten score float

function canMove(x: number, y: number, d: Dir): boolean {
  const ny = y + d.y;
  if (ny < 0 || ny >= N) return false;
  const nx = (x + d.x + N) % N; // horizontal wrap (only open on the tunnel row)
  return !WALLS[ny][nx];
}

function makeGhosts(): Ghost[] {
  return ghostStarts.slice(0, 2).map((home, i) => ({
    x: home.x,
    y: home.y,
    dir: { x: i === 0 ? -1 : 1, y: 0 },
    home: { ...home },
    color: i === 0 ? "#ef4444" : "#f97316", // Blinky red, Clyde orange
    kind: i === 0 ? "blinky" : "clyde",
    fright: false,
  }));
}

export function PacMan() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(v) && v > 0) setBest(v);
    } catch {
      /* ignore */
    }
  }, []);

  const pac = useRef({ ...pacStart });
  const dir = useRef<Dir>({ x: -1, y: 0 });
  const nextDir = useRef<Dir>({ x: -1, y: 0 });
  const mouthOpen = useRef(true);
  const pellets = useRef<Set<string>>(new Set(PELLET_KEYS));
  const powers = useRef<Set<string>>(new Set(POWER_KEYS));
  const ghosts = useRef<Ghost[]>(makeGhosts());
  const frightUntil = useRef(0);
  const pauseUntil = useRef(0);
  const flashUntil = useRef(0);
  const tickCount = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // presentation-only refs
  const dying = useRef<{ x: number; y: number; until: number } | null>(null);
  const floats = useRef<{ x: number; y: number; born: number }[]>([]);
  const pausedAt = useRef(0);

  const isFrightened = useCallback(
    (g: Ghost) => g.fright && Date.now() < frightUntil.current,
    [],
  );

  const addScore = useCallback((n: number) => {
    scoreRef.current += n;
    setScore(scoreRef.current);
  }, []);

  const saveBest = useCallback(() => {
    setBest((b) => {
      const nb = Math.max(b, scoreRef.current);
      try {
        localStorage.setItem(STORAGE_KEY, String(nb));
      } catch {
        /* ignore */
      }
      return nb;
    });
  }, []);

  const resetPositions = useCallback(() => {
    pac.current = { ...pacStart };
    dir.current = { x: -1, y: 0 };
    nextDir.current = { x: -1, y: 0 };
    ghosts.current = makeGhosts();
    frightUntil.current = 0;
  }, []);

  const refillPellets = useCallback(() => {
    pellets.current = new Set(PELLET_KEYS);
    powers.current = new Set(POWER_KEYS);
  }, []);

  const start = useCallback(() => {
    playClick();
    scoreRef.current = 0;
    setScore(0);
    livesRef.current = 3;
    setLives(3);
    setLevel(1);
    refillPellets();
    resetPositions();
    flashUntil.current = 0;
    tickCount.current = 0;
    dying.current = null;
    floats.current = [];
    setPaused(false);
    pauseUntil.current = Date.now() + 500;
    setStatus("playing");
  }, [refillPellets, resetPositions]);

  // pause on window blur (timers are shifted on resume so gameplay is unaffected)
  useEffect(() => {
    if (status !== "playing") return;
    const onBlur = () => {
      pausedAt.current = Date.now();
      setPaused(true);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [status]);

  const resume = useCallback(() => {
    const delta = Date.now() - pausedAt.current;
    if (frightUntil.current > pausedAt.current) frightUntil.current += delta;
    if (pauseUntil.current > pausedAt.current) pauseUntil.current += delta;
    if (flashUntil.current > pausedAt.current) flashUntil.current += delta;
    if (dying.current && dying.current.until > pausedAt.current) dying.current.until += delta;
    setPaused(false);
  }, []);

  const drawGhost = useCallback(
    (g: CanvasRenderingContext2D, gh: Ghost) => {
      const cx = gh.x * CELL + CELL / 2;
      const cy = gh.y * CELL + CELL / 2;
      const r = 9;
      const fright = isFrightened(gh);
      const blinking =
        fright &&
        frightUntil.current - Date.now() < 1500 &&
        Math.floor(Date.now() / 200) % 2 === 0;
      g.fillStyle = fright ? (blinking ? "#e2e8f0" : "#3b82f6") : gh.color;
      g.beginPath();
      g.moveTo(cx - r, cy + 8);
      g.lineTo(cx - r, cy);
      g.arc(cx, cy, r, Math.PI, 0);
      g.lineTo(cx + r, cy + 8);
      g.lineTo(cx + r * 0.6, cy + 4.5);
      g.lineTo(cx + r * 0.25, cy + 8);
      g.lineTo(cx, cy + 4.5);
      g.lineTo(cx - r * 0.25, cy + 8);
      g.lineTo(cx - r * 0.6, cy + 4.5);
      g.closePath();
      g.fill();
      if (fright) {
        // classic frightened face: plain white (red while blinking) eyes + wavy mouth
        const feature = blinking ? "#ef4444" : "#f8fafc";
        g.fillStyle = feature;
        for (const ex of [-3.5, 3.5]) {
          g.beginPath();
          g.arc(cx + ex, cy - 2, 2, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = feature;
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(cx - 6, cy + 4.5);
        for (let i = 1; i <= 4; i++) {
          g.lineTo(cx - 6 + i * 3, cy + (i % 2 === 1 ? 2.5 : 4.5));
        }
        g.stroke();
        return;
      }
      // eyes
      const px = gh.dir.x * 1.5;
      const py = gh.dir.y * 1.5;
      for (const ex of [-3.5, 3.5]) {
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(cx + ex, cy - 2, 2.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#1e293b";
        g.beginPath();
        g.arc(cx + ex + px, cy - 2 + py, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    },
    [isFrightened],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const now = Date.now();
    g.fillStyle = "#020617";
    g.fillRect(0, 0, canvas.width, canvas.height);
    // walls — rounded neon-blue outlines (flash bright briefly on level clear)
    const flashing = now < flashUntil.current && Math.floor(now / 130) % 2 === 0;
    g.save();
    g.strokeStyle = flashing ? "#93c5fd" : "#3b82f6";
    g.lineWidth = 1.6;
    g.shadowColor = flashing ? "rgba(147,197,253,0.6)" : "rgba(59,130,246,0.5)";
    g.shadowBlur = 5; // capped so 60fps holds — single stroke call for all walls
    g.beginPath();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!WALLS[y][x]) continue;
        g.roundRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6, 6);
      }
    }
    g.stroke();
    g.restore();
    // pellets — crisp dots
    g.fillStyle = "#fbbf24";
    for (const key of pellets.current) {
      const [x, y] = key.split(",").map(Number);
      g.beginPath();
      g.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    // power pellets (pulsing)
    const pulse = 5 + Math.sin(now / 150) * 1.6;
    for (const key of powers.current) {
      const [x, y] = key.split(",").map(Number);
      g.beginPath();
      g.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, pulse, 0, Math.PI * 2);
      g.fill();
    }
    const dyingNow = dying.current && now < dying.current.until ? dying.current : null;
    if (dyingNow) {
      // death: pac-man collapse — mouth widens until the arc vanishes
      const t = 1 - (dyingNow.until - now) / DEATH_MS;
      const cx = dyingNow.x * CELL + CELL / 2;
      const cy = dyingNow.y * CELL + CELL / 2;
      const m = Math.PI * (0.28 + 0.72 * Math.min(1, Math.max(0, t)));
      if (m < Math.PI) {
        g.fillStyle = "#facc15";
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, 11, -Math.PI / 2 + m, -Math.PI / 2 + Math.PI * 2 - m);
        g.closePath();
        g.fill();
      }
    } else {
      // pac-man
      const px = pac.current.x * CELL + CELL / 2;
      const py = pac.current.y * CELL + CELL / 2;
      const rot = Math.atan2(dir.current.y, dir.current.x);
      const mouth = mouthOpen.current ? Math.PI * 0.28 : Math.PI * 0.06;
      g.fillStyle = "#facc15";
      g.beginPath();
      g.moveTo(px, py);
      g.arc(px, py, 11, rot + mouth, rot + Math.PI * 2 - mouth);
      g.closePath();
      g.fill();
      // ghosts (hidden during the collapse, classic style)
      for (const gh of ghosts.current) drawGhost(g, gh);
    }
    // "+200" ghost-eaten score floats
    if (floats.current.length > 0) {
      floats.current = floats.current.filter((f) => now - f.born < FLOAT_MS);
      g.textAlign = "center";
      g.font = "bold 11px ui-monospace, SFMono-Regular, monospace";
      for (const f of floats.current) {
        const age = (now - f.born) / FLOAT_MS;
        g.globalAlpha = 1 - age;
        g.fillStyle = "#93c5fd";
        g.fillText("+200", f.x * CELL + CELL / 2, f.y * CELL + CELL / 2 - age * 14);
      }
      g.globalAlpha = 1;
    }
    // "READY!" on start / after reset (authentic touch)
    if (status === "playing" && !dyingNow && now < pauseUntil.current) {
      g.textAlign = "center";
      g.font = "bold 15px ui-monospace, SFMono-Regular, monospace";
      g.fillStyle = "#facc15";
      g.fillText("READY!", (N * CELL) / 2, 9 * CELL + CELL / 2 + 5);
    }
  }, [drawGhost, status]);

  const loseLife = useCallback(() => {
    playNote(150, 0.5);
    dying.current = { x: pac.current.x, y: pac.current.y, until: Date.now() + DEATH_MS };
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) {
      saveBest();
      setStatus("over");
      return;
    }
    resetPositions();
    pauseUntil.current = Date.now() + 1000; // brief pause after losing a life
  }, [resetPositions, saveBest]);

  const levelUp = useCallback(() => {
    playNote(880, 0.2);
    saveBest();
    setLevel((l) => l + 1); // game-loop effect re-runs with a 10% faster tick
    refillPellets();
    resetPositions();
    flashUntil.current = Date.now() + 900;
    pauseUntil.current = Date.now() + 1000;
  }, [refillPellets, resetPositions, saveBest]);

  const eatGhost = useCallback(
    (gh: Ghost) => {
      floats.current.push({ x: gh.x, y: gh.y, born: Date.now() });
      addScore(200);
      playNote(880, 0.15);
      gh.x = gh.home.x;
      gh.y = gh.home.y;
      gh.dir = { x: gh.kind === "blinky" ? -1 : 1, y: 0 };
      gh.fright = false;
    },
    [addScore],
  );

  const tick = useCallback(() => {
    if (Date.now() < pauseUntil.current) return;
    tickCount.current += 1;
    const p = pac.current;
    const pacPrev = { x: p.x, y: p.y };
    // queued turn applies at the first tile where it becomes possible
    if (canMove(p.x, p.y, nextDir.current)) dir.current = nextDir.current;
    if (canMove(p.x, p.y, dir.current)) {
      p.x = (p.x + dir.current.x + N) % N;
      p.y += dir.current.y;
      mouthOpen.current = !mouthOpen.current;
    }
    // eat pellets
    const key = `${p.x},${p.y}`;
    if (pellets.current.has(key)) {
      pellets.current.delete(key);
      addScore(10);
      playNote(440, 0.05);
    } else if (powers.current.has(key)) {
      powers.current.delete(key);
      addScore(50);
      playNote(440, 0.05);
      frightUntil.current = Date.now() + FRIGHT_MS;
      ghosts.current.forEach((gh) => {
        gh.fright = true;
      });
    }
    // collision after pac moves
    for (const gh of ghosts.current) {
      if (gh.x === p.x && gh.y === p.y) {
        if (isFrightened(gh)) eatGhost(gh);
        else {
          loseLife();
          return;
        }
      }
    }
    // ghosts
    for (const gh of ghosts.current) {
      const fright = isFrightened(gh);
      if (fright && tickCount.current % 2 === 0) continue; // frightened ghosts move slower
      const ghPrev = { x: gh.x, y: gh.y };
      let options = DIRS.filter(
        (d) => canMove(gh.x, gh.y, d) && !(d.x === -gh.dir.x && d.y === -gh.dir.y),
      );
      if (options.length === 0) options = DIRS.filter((d) => canMove(gh.x, gh.y, d)); // dead end: reverse
      if (options.length > 0) {
        let pick: Dir;
        if (fright || gh.kind === "clyde") {
          pick = options[Math.floor(Math.random() * options.length)];
        } else {
          // Blinky: neighbor minimizing straight-line distance to Pac-Man
          const dist = (d: Dir) => {
            const nx = (gh.x + d.x + N) % N;
            const ny = gh.y + d.y;
            return (nx - p.x) ** 2 + (ny - p.y) ** 2;
          };
          pick = options.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        }
        gh.dir = pick;
        gh.x = (gh.x + pick.x + N) % N;
        gh.y += pick.y;
      }
      // hit, including tile swaps (pac and ghost passing through each other)
      const hit =
        (gh.x === p.x && gh.y === p.y) ||
        (ghPrev.x === p.x && ghPrev.y === p.y && gh.x === pacPrev.x && gh.y === pacPrev.y);
      if (hit) {
        if (isFrightened(gh)) eatGhost(gh);
        else {
          loseLife();
          return;
        }
      }
    }
    // level clear → endless levels
    if (pellets.current.size === 0 && powers.current.size === 0) levelUp();
  }, [addScore, eatGhost, isFrightened, levelUp, loseLife]);

  // game loop — 10% faster each level
  useEffect(() => {
    if (status !== "playing" || paused) return;
    const speed = Math.max(60, Math.round(BASE_TICK_MS * Math.pow(0.9, level - 1)));
    const timer = setInterval(tick, speed);
    return () => clearInterval(timer);
  }, [status, paused, level, tick]);

  // render loop (smooth power-pellet pulse / frightened blink / clear flash)
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const onKey = (e: KeyboardEvent) => {
      // don't steal keys from Terminal/Spotlight/Siri inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      nextDir.current = nd;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    nextDir.current =
      Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  };

  const buttonClass =
    "rounded-lg bg-yellow-400 px-5 py-2 text-sm font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 max-md:min-h-11 max-md:px-6";

  return (
    <div
      className="flex h-full flex-col items-center gap-3 bg-slate-950 p-4 text-white max-md:justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        .pacman-overlay-in { animation: pacman-overlay-in 200ms ease-out; }
        @keyframes pacman-overlay-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pacman-overlay-in { animation: none; }
        }
      `}</style>
      <div className="flex w-full max-w-[390px] items-center justify-between gap-2 text-sm">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-yellow-400">
          🟡 Pac-Man
        </span>
        <span className="text-xs tabular-nums text-white/70">
          Score <span className="font-semibold text-white/90">{score}</span>
          <span aria-hidden="true"> · </span>
          <span className="text-sm leading-none tracking-tight text-red-400" aria-label={`${Math.max(0, lives)} lives`}>
            {"♥".repeat(Math.max(0, lives))}
          </span>
          <span aria-hidden="true"> · </span>
          Lv <span className="font-semibold text-white/90">{level}</span>
          <span aria-hidden="true"> · </span>
          Best <span className="font-semibold text-white/90">{best}</span>
        </span>
      </div>
      <div className="relative touch-none rounded-xl bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          width={N * CELL}
          height={N * CELL}
          className="block h-auto max-w-full rounded-lg"
        />
        {status !== "playing" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40 p-4">
            <div className="pacman-overlay-in flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-8 py-6 backdrop-blur-md">
              {status === "over" && (
                <p className="text-lg font-bold text-yellow-400">
                  Game Over — <span className="tabular-nums">{score}</span> pts
                </p>
              )}
              <button onClick={start} className={buttonClass}>
                {status === "over" ? "Play Again" : "Start Game"}
              </button>
              <p className="text-xs text-white/50">Arrow keys / WASD · swipe on touch</p>
            </div>
          </div>
        )}
        {status === "playing" && paused && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40 p-4">
            <div className="pacman-overlay-in flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-8 py-6 backdrop-blur-md">
              <p className="text-lg font-bold text-yellow-400">Paused</p>
              <button onClick={resume} className={buttonClass}>
                Resume
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
