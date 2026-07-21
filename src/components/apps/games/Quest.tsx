"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";
import { loadPersisted, savePersisted } from "@/lib/persist";

// Tiny Quest — a small tile RPG on a single hand-built overworld. Walk with
// WASD/arrows (or the on-screen pad), bump NPCs to talk and monsters to fight,
// gain XP, grab the sword, and clear the Cave Wyrm to the east. Turn-based:
// the world only moves when you do. All logic is client-side — no network.

const W = 16;
const H = 16;
const TILE = 24;
const BEST_KEY = "arcade-quest";

// ── Map ───────────────────────────────────────────────────────────────
// Built deterministically by coordinate rather than hand-drawn ASCII, so a
// miscount can't produce a ragged grid. Tile codes:
//   . grass   T tree   w water   R rock   H house   (all but . block below)
//   # cave wall   c cave floor   D door        (c/D walkable)

type Tile = "." | "T" | "w" | "R" | "H" | "#" | "c" | "D";
const BLOCKING = new Set<Tile>(["T", "w", "R", "H", "#"]);

function buildMap(): Tile[][] {
  const g: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "." as Tile));
  const set = (x: number, y: number, c: Tile) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c;
  };

  // Forest border
  for (let x = 0; x < W; x++) {
    set(x, 0, "T");
    set(x, H - 1, "T");
  }
  for (let y = 0; y < H; y++) {
    set(0, y, "T");
    set(W - 1, y, "T");
  }

  // Scenery — kept clear of the start → sword → cave route
  ([[8, 2], [9, 2], [9, 3], [8, 4], [6, 2], [4, 11], [5, 11], [3, 12]] as const).forEach(([x, y]) =>
    set(x, y, "T"),
  );
  ([[12, 2], [13, 2]] as const).forEach(([x, y]) => set(x, y, "H")); // village houses
  ([[9, 6], [10, 6], [9, 7]] as const).forEach(([x, y]) => set(x, y, "w")); // pond
  ([[7, 10], [8, 10]] as const).forEach(([x, y]) => set(x, y, "R")); // boulders

  // Cave: a walled room in the south-east, one door on its west wall
  for (let y = 9; y <= 14; y++) {
    for (let x = 10; x <= 14; x++) {
      set(x, y, x === 10 || x === 14 || y === 9 || y === 14 ? "#" : "c");
    }
  }
  set(10, 11, "D"); // the opening
  set(9, 11, "."); // and clear ground in front of it
  set(9, 10, ".");
  set(9, 12, ".");

  return g;
}

const MAP = buildMap();

function tileAt(x: number, y: number): Tile {
  return MAP[y]?.[x] ?? "T";
}
function walkable(x: number, y: number): boolean {
  return !BLOCKING.has(tileAt(x, y));
}
function isCave(x: number, y: number): boolean {
  const t = tileAt(x, y);
  return t === "c" || t === "D";
}

// ── Entities ──────────────────────────────────────────────────────────

type Player = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  xp: number;
  level: number;
  sword: boolean;
};

type Monster = {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  xp: number;
  name: string;
  glyph: string;
  boss?: boolean;
};

type Npc = { x: number; y: number; glyph: string; lines: string[]; said: number };
type Item = { x: number; y: number; kind: "sword" | "potion"; glyph: string };

const AGGRO = 5; // monsters wake within this Chebyshev distance
const XP_TABLE = [0, 10, 25, 45, 70]; // xp needed to reach level index+1

function freshPlayer(): Player {
  return { x: 3, y: 3, hp: 20, maxHp: 20, atk: 3, xp: 0, level: 1, sword: false };
}
function freshMonsters(): Monster[] {
  let id = 0;
  const m = (x: number, y: number, hp: number, atk: number, xp: number, name: string, glyph: string, boss?: boolean): Monster => ({
    id: id++,
    x,
    y,
    hp,
    maxHp: hp,
    atk,
    xp,
    name,
    glyph,
    boss,
  });
  return [
    m(9, 4, 6, 2, 4, "Slime", "🟢"),
    m(5, 9, 6, 2, 4, "Slime", "🟢"),
    m(8, 8, 9, 3, 6, "Bat", "🦇"),
    m(9, 12, 9, 3, 6, "Bat", "🦇"),
    m(11, 10, 13, 4, 10, "Skeleton", "💀"),
    m(13, 13, 13, 4, 10, "Skeleton", "💀"),
    m(12, 12, 44, 6, 100, "Cave Wyrm", "🐉", true),
  ];
}
function freshNpcs(): Npc[] {
  return [
    {
      x: 5,
      y: 3,
      glyph: "🧙",
      said: 0,
      lines: [
        "The Cave Wyrm woke to the east. Take the sword by the pond and end it.",
        "Bump a foe to strike. Fight weak things first — you'll grow stronger.",
        "Levelling up heals you fully. Use that.",
      ],
    },
    {
      x: 3,
      y: 6,
      glyph: "🧑‍🌾",
      said: 0,
      lines: [
        "Careful of the bats near the cave. Nasty little things.",
        "Green potions mend wounds. Grab any you find.",
      ],
    },
  ];
}
function freshItems(): Item[] {
  return [
    { x: 7, y: 7, kind: "sword", glyph: "🗡️" },
    { x: 4, y: 9, kind: "potion", glyph: "🧪" },
    { x: 12, y: 11, kind: "potion", glyph: "🧪" },
  ];
}

// ── Game state (a reducer keeps the turn logic in one pure place) ──────

// Exported for Quest.test.ts — the turn logic is a pure reducer, so it's worth
// testing directly rather than only through the canvas.
export type Status = "title" | "playing" | "won" | "dead";
export type State = {
  status: Status;
  player: Player;
  monsters: Monster[];
  npcs: Npc[];
  items: Item[];
  log: string[];
};

export function initialState(status: Status): State {
  return {
    status,
    player: freshPlayer(),
    monsters: freshMonsters(),
    npcs: freshNpcs(),
    items: freshItems(),
    log: ["A quest begins. The elder is nearby — go talk to him."],
  };
}

const rand = (n: number) => Math.floor(Math.random() * n);
const cheby = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const manhattan = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);

function pushLog(log: string[], line: string): string[] {
  return [...log, line].slice(-5);
}

export type Action = { type: "move"; dx: number; dy: number } | { type: "start" } | { type: "restart" };

export function reducer(state: State, action: Action): State {
  if (action.type === "start" || action.type === "restart") return initialState("playing");
  if (state.status !== "playing") return state;

  const { dx, dy } = action;
  const p = state.player;
  const tx = p.x + dx;
  const ty = p.y + dy;

  // Talk: bumping an NPC is free (no turn passes)
  const npc = state.npcs.find((n) => n.x === tx && n.y === ty);
  if (npc) {
    const line = npc.lines[npc.said % npc.lines.length];
    const npcs = state.npcs.map((n) => (n === npc ? { ...n, said: n.said + 1 } : n));
    return { ...state, npcs, log: pushLog(state.log, `🗨️ ${line}`) };
  }

  // Attack: bumping a monster spends the turn
  const target = state.monsters.find((m) => m.x === tx && m.y === ty);
  if (target) {
    return resolveTurn(state, { attack: target });
  }

  // Blocked by terrain: no turn passes
  if (!walkable(tx, ty)) return state;

  // Move
  return resolveTurn(state, { moveTo: { x: tx, y: ty } });
}

/** Apply the player's action, then give every woken monster its move. */
function resolveTurn(state: State, act: { attack?: Monster; moveTo?: { x: number; y: number } }): State {
  let log = state.log;
  let player = { ...state.player };
  let monsters = state.monsters.map((m) => ({ ...m }));
  let items = state.items;

  const atk = player.atk + (player.sword ? 5 : 0);

  // ── Player action ──
  if (act.attack) {
    const dmg = atk + rand(3);
    const mon = monsters.find((m) => m.id === act.attack!.id)!;
    mon.hp -= dmg;
    log = pushLog(log, `⚔️ You hit ${mon.name} for ${dmg}.`);
    if (mon.hp <= 0) {
      log = pushLog(log, `${mon.glyph} ${mon.name} falls. +${mon.xp} XP.`);
      const wasBoss = mon.boss;
      monsters = monsters.filter((m) => m.id !== mon.id);
      player.xp += mon.xp;

      // Level up (heals fully) — may chain if a boss grants a lot of XP
      while (player.level < XP_TABLE.length && player.xp >= XP_TABLE[player.level]) {
        player.level += 1;
        player.maxHp += 5;
        player.hp = player.maxHp;
        player.atk += 1;
        log = pushLog(log, `✨ Level ${player.level}! Fully healed, ATK up.`);
      }

      if (wasBoss) {
        return { ...state, player, monsters, items, log: pushLog(log, "🏆 The Cave Wyrm is slain. The land is safe."), status: "won" };
      }
    }
  } else if (act.moveTo) {
    player.x = act.moveTo.x;
    player.y = act.moveTo.y;

    // Pick up whatever's underfoot
    const here = items.find((it) => it.x === player.x && it.y === player.y);
    if (here) {
      items = items.filter((it) => it !== here);
      if (here.kind === "sword") {
        player.sword = true;
        log = pushLog(log, "🗡️ Found the Iron Sword! Your strikes bite deeper.");
      } else {
        const heal = Math.min(8, player.maxHp - player.hp);
        player.hp += heal;
        log = pushLog(log, `🧪 Potion — recovered ${heal} HP.`);
      }
    }
  }

  // ── Monster phase ──
  const occupied = (x: number, y: number, selfId: number) =>
    (x === player.x && y === player.y) ||
    monsters.some((m) => m.id !== selfId && m.hp > 0 && m.x === x && m.y === y);

  for (const mon of monsters) {
    if (mon.hp <= 0) continue;
    if (!mon.boss && cheby(mon.x, mon.y, player.x, player.y) > AGGRO) continue;

    if (manhattan(mon.x, mon.y, player.x, player.y) === 1) {
      const dmg = mon.atk + rand(2);
      player.hp -= dmg;
      log = pushLog(log, `${mon.glyph} ${mon.name} hits you for ${dmg}.`);
      if (player.hp <= 0) {
        player.hp = 0;
        return { ...state, player, monsters, items, log: pushLog(log, "💀 You have fallen. The quest ends here."), status: "dead" };
      }
      continue;
    }

    // Step greedily toward the player, larger axis first, wall-aware
    const sx = Math.sign(player.x - mon.x);
    const sy = Math.sign(player.y - mon.y);
    const tries =
      Math.abs(player.x - mon.x) >= Math.abs(player.y - mon.y)
        ? [[sx, 0], [0, sy]]
        : [[0, sy], [sx, 0]];
    for (const [mdx, mdy] of tries) {
      if (mdx === 0 && mdy === 0) continue;
      const nx = mon.x + mdx;
      const ny = mon.y + mdy;
      if (walkable(nx, ny) && !occupied(nx, ny, mon.id)) {
        mon.x = nx;
        mon.y = ny;
        break;
      }
    }
  }

  return { ...state, player, monsters, items, log };
}

// ── Component ─────────────────────────────────────────────────────────

export function Quest() {
  const [state, dispatch] = useReducer(reducer, "title", initialState);
  const [best, setBest] = useState<{ bestLevel: number; cleared: boolean }>({ bestLevel: 1, cleared: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setBest(
      loadPersisted(BEST_KEY, { bestLevel: 1, cleared: false }, (v): v is { bestLevel: number; cleared: boolean } =>
        typeof v === "object" && v !== null && "bestLevel" in v,
      ),
    );
  }, []);

  // Persist high-water marks as they happen
  useEffect(() => {
    setBest((prev) => {
      const cleared = prev.cleared || state.status === "won";
      const bestLevel = Math.max(prev.bestLevel, state.player.level);
      if (cleared === prev.cleared && bestLevel === prev.bestLevel) return prev;
      const next = { cleared, bestLevel };
      savePersisted(BEST_KEY, next);
      return next;
    });
  }, [state.status, state.player.level]);

  // Sound cues on the transitions worth hearing
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (prevStatus.current !== state.status) {
      if (state.status === "won") playNote(880, 0.5);
      if (state.status === "dead") playNote(150, 0.5);
      prevStatus.current = state.status;
    }
  }, [state.status]);

  const move = useCallback((dx: number, dy: number) => {
    if (stateRef.current.status !== "playing") return;
    playClick();
    dispatch({ type: "move", dx, dy });
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, [number, number]> = {
        arrowup: [0, -1],
        w: [0, -1],
        arrowdown: [0, 1],
        s: [0, 1],
        arrowleft: [-1, 0],
        a: [-1, 0],
        arrowright: [1, 0],
        d: [1, 0],
      };
      if (map[k]) {
        e.preventDefault();
        move(...map[k]);
      } else if ((k === "enter" || k === " ") && stateRef.current.status !== "playing") {
        e.preventDefault();
        dispatch({ type: "start" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // Render the map + entities
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * TILE * dpr;
    canvas.height = H * TILE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const COLORS: Record<Tile, [string, string]> = {
      ".": ["#3e6b34", "#457539"],
      T: ["#24421f", "#24421f"],
      w: ["#2f6db0", "#2f6db0"],
      R: ["#6f6e6c", "#6f6e6c"],
      H: ["#7a4a2b", "#7a4a2b"],
      "#": ["#322c3a", "#322c3a"],
      c: ["#1b1720", "#1b1720"],
      D: ["#241f2c", "#241f2c"],
    };
    const GLYPH: Partial<Record<Tile, string>> = { T: "🌲", H: "🏠", R: "🪨" };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = tileAt(x, y);
        ctx.fillStyle = COLORS[t][(x + y) % 2];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyph = (gx: number, gy: number, ch: string, size = TILE - 3) => {
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
      ctx.fillText(ch, gx * TILE + TILE / 2, gy * TILE + TILE / 2 + 1);
    };

    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const g = GLYPH[tileAt(x, y)];
        if (g) glyph(x, y, g, TILE - 6);
      }

    state.items.forEach((it) => glyph(it.x, it.y, it.glyph, TILE - 8));
    state.npcs.forEach((n) => glyph(n.x, n.y, n.glyph));
    state.monsters.forEach((m) => {
      glyph(m.x, m.y, m.glyph, m.boss ? TILE : TILE - 4);
      if (m.hp < m.maxHp) {
        const w = TILE - 6;
        ctx.fillStyle = "#000a";
        ctx.fillRect(m.x * TILE + 3, m.y * TILE + 1, w, 3);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(m.x * TILE + 3, m.y * TILE + 1, (w * m.hp) / m.maxHp, 3);
      }
    });
    glyph(state.player.x, state.player.y, "🧝");
  }, [state]);

  const p = state.player;

  // ── Title / result screens ──
  if (state.status !== "playing") {
    const won = state.status === "won";
    const dead = state.status === "dead";
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl">{won ? "🏆" : dead ? "💀" : "🗺️"}</div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-100">
            {won ? "Quest Complete" : dead ? "You Fell" : "Tiny Quest"}
          </h1>

          {state.status === "title" && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              A wyrm woke in the eastern cave. Talk to the elder, find the sword by the pond, level
              up on the field&apos;s monsters, then end the beast.
            </p>
          )}
          {won && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              The Cave Wyrm is slain at level {p.level}. The village sleeps easy.
            </p>
          )}
          {dead && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              Overwhelmed at level {p.level}. Fight the weak things first, and don&apos;t skip the
              potions.
            </p>
          )}

          {(best.cleared || best.bestLevel > 1) && (
            <p className="mt-4 text-xs uppercase tracking-widest text-slate-500">
              {best.cleared ? "Quest cleared" : `Best — level ${best.bestLevel}`}
            </p>
          )}

          <button
            onClick={() => {
              playClick();
              dispatch({ type: "start" });
            }}
            className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            {state.status === "title" ? "Begin quest" : "Play again"}
          </button>

          {state.status === "title" && (
            <p className="mt-6 text-[11px] text-slate-600">
              Move with WASD / arrows. Bump to talk or fight.
            </p>
          )}
        </div>
      </Frame>
    );
  }

  // ── Playing ──
  return (
    <Frame>
      {/* HUD */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            Lv {p.level}
          </span>
          <div className="h-2.5 w-24 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-rose-500 transition-all"
              style={{ width: `${(p.hp / p.maxHp) * 100}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-slate-400">
            {p.hp}/{p.maxHp}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span title="Sword equipped">{p.sword ? "🗡️" : "🥖"}</span>
          <span className="tabular-nums">XP {p.xp}</span>
        </div>
      </div>

      {/* Map — scales down to fit small phones; the backing store keeps its
          dpr-scaled resolution, only the CSS box shrinks */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden py-2">
        <canvas
          ref={canvasRef}
          style={{ maxWidth: `min(100%, ${W * TILE}px)`, maxHeight: `min(100%, ${H * TILE}px)` }}
          className="rounded-md shadow-lg [image-rendering:pixelated]"
        />
      </div>

      {/* Message log */}
      <div className="mx-auto h-[74px] w-full max-w-[384px] shrink-0 space-y-0.5 overflow-hidden rounded-md bg-black/30 px-3 py-2 text-[12px] leading-snug text-slate-300">
        {state.log.map((line, i) => (
          <p key={state.log.length - i} className={i === state.log.length - 1 ? "text-slate-100" : "opacity-60"}>
            {line}
          </p>
        ))}
      </div>

      {/* Touch D-pad (also clickable on desktop) */}
      <div className="shrink-0 select-none py-3">
        <div className="mx-auto grid w-[168px] grid-cols-3 grid-rows-3 gap-1.5">
          <span />
          <PadButton label="▲" onPress={() => move(0, -1)} />
          <span />
          <PadButton label="◀" onPress={() => move(-1, 0)} />
          <span />
          <PadButton label="▶" onPress={() => move(1, 0)} />
          <span />
          <PadButton label="▼" onPress={() => move(0, 1)} />
          <span />
        </div>
      </div>
    </Frame>
  );
}

function PadButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-lg bg-white/[0.08] text-lg text-slate-200 transition active:bg-white/20"
    >
      {label}
    </button>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-full w-full max-w-[520px] flex-col text-slate-200">{children}</div>;
}
