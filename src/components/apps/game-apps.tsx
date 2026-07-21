"use client";

// Standalone-app wrappers for each Arcade game — dark chrome to match the
// games' own styling, one window per game. On phones the game is centered
// vertically so a short playfield (e.g. Dino) doesn't leave a dead band below.

import { Snake } from "./games/Snake";
import { PacMan } from "./games/PacMan";
import { Game2048 } from "./games/Game2048";
import { Minesweeper } from "./games/Minesweeper";
import { Breakout } from "./games/Breakout";
import { Dino } from "./games/Dino";
import { Vault } from "./games/Vault";
import { Quest } from "./games/Quest";

function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-auto bg-slate-950 max-md:justify-center">
      {children}
    </div>
  );
}

export function SnakeApp() {
  return (
    <GameShell>
      <Snake />
    </GameShell>
  );
}

export function PacManApp() {
  return (
    <GameShell>
      <PacMan />
    </GameShell>
  );
}

export function Game2048App() {
  return (
    <GameShell>
      <Game2048 />
    </GameShell>
  );
}

export function MinesweeperApp() {
  return (
    <GameShell>
      <Minesweeper />
    </GameShell>
  );
}

export function BreakoutApp() {
  return (
    <GameShell>
      <Breakout />
    </GameShell>
  );
}

export function DinoApp() {
  return (
    <GameShell>
      <Dino />
    </GameShell>
  );
}

// The Vault scrolls its own transcript and pins a composer to the bottom, so it
// needs the full height rather than GameShell's centered, outer-scrolling box.
export function VaultApp() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      <Vault />
    </div>
  );
}

// Tiny Quest owns its own vertical rhythm (HUD, map, log, d-pad) and mustn't
// outer-scroll, so it uses the same full-height dark frame as The Vault.
export function QuestApp() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      <Quest />
    </div>
  );
}
