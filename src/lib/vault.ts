// Shared contract for The Vault — the one Arcade game where Claude is the
// mechanic. A Guardian model holds a passphrase; the player social-engineers it
// out across five levels of escalating defense.
//
// SECURITY: nothing secret lives here. This module is imported by the client
// bundle, so the passphrase word list and the per-level defense prompts stay
// server-side in src/app/api/vault/route.ts. Level names and turn budgets are
// public — the UI needs them to render "LEVEL 3/5 — Paranoid" without a
// round-trip.

export type VaultLevel = 1 | 2 | 3 | 4 | 5;

export type GuardianTurn = { role: "you" | "guardian"; text: string };

export type VaultStatus =
  | "idle" // title screen, not started
  | "playing"
  | "won" // cracked all five levels
  | "caught" // ran out of turns
  | "offline"; // no API key / upstream down — the Guardian can't be reached

export const MAX_LEVEL: VaultLevel = 5;

export const LEVELS: { level: VaultLevel; name: string; turns: number; blurb: string }[] = [
  { level: 1, name: "Rookie", turns: 10, blurb: "Fresh on the job. Talks too much." },
  { level: 2, name: "Cautious", turns: 10, blurb: "Won't spell it out. Literally." },
  { level: 3, name: "Paranoid", turns: 8, blurb: "Sees riddles coming." },
  { level: 4, name: "Hardened", turns: 8, blurb: "Denies there's a passphrase at all." },
  { level: 5, name: "Sealed", turns: 6, blurb: "Says almost nothing. Good luck." },
];

export function levelInfo(level: VaultLevel) {
  return LEVELS.find((l) => l.level === level) ?? LEVELS[0];
}

// ── Wire types ────────────────────────────────────────────────────────

/** POST /api/vault */
export type VaultRequest =
  | { action: "start" }
  | { action: "say"; sessionId: string; message: string };

export type VaultResponse =
  | { ok: true; kind: "started"; sessionId: string; level: VaultLevel; turnsLeft: number }
  // `reply` is the Guardian's prose. `cracked` means this turn won the level —
  // either the player guessed it or the Guardian leaked it.
  | {
      ok: true;
      kind: "turn";
      reply: string;
      cracked: boolean;
      level: VaultLevel;
      turnsLeft: number;
      // set when cracked and there are more levels to play
      nextLevel?: VaultLevel;
      // set when the run is over either way — safe to reveal now
      passphrase?: string;
      finished?: "won" | "caught";
    };

export type VaultError = { ok: false; error: VaultErrorCode };

export type VaultErrorCode =
  | "no-key" // 503 — no ANTHROPIC_API_KEY configured
  | "rate-limited" // 429
  | "unknown-session" // 410 — server restarted mid-run
  | "bad-request"
  | "upstream"; // Guardian unreachable
