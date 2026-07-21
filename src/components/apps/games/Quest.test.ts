import { afterEach, describe, expect, it, vi } from "vitest";
import { reducer, initialState, type State, type Action } from "./Quest";

// The turn logic is a pure reducer over a deterministic map, so we can drive it
// directly. rand(n) = floor(Math.random()*n); stub Math.random to make combat
// rolls deterministic.

const move = (s: State, dx: number, dy: number) => reducer(s, { type: "move", dx, dy } as Action);
const fresh = () => initialState("playing");

afterEach(() => vi.restoreAllMocks());

describe("Quest reducer — movement", () => {
  it("moves onto open grass", () => {
    // player starts at (3,3); (4,3) is grass
    const s = move(fresh(), 1, 0);
    expect([s.player.x, s.player.y]).toEqual([4, 3]);
  });

  it("is blocked by terrain and spends no turn", () => {
    // (3,0) area is the tree border; step up from (3,1) would hit it. Walk to
    // the top wall first, then confirm the wall bump is a no-op.
    let s = fresh();
    s = move(s, 0, -1); // (3,2)
    s = move(s, 0, -1); // (3,1)
    const before = s.player;
    s = move(s, 0, -1); // (3,0) is a tree — blocked
    expect(s.player).toBe(before); // identical reference: nothing happened
  });

  it("bumping an NPC talks and does not move the player", () => {
    // elder NPC sits at (5,3); reach (4,3) then bump east into him
    let s = move(fresh(), 1, 0); // (4,3)
    const pos = { x: s.player.x, y: s.player.y };
    s = move(s, 1, 0); // bump elder
    expect([s.player.x, s.player.y]).toEqual([pos.x, pos.y]); // didn't move
    expect(s.log[s.log.length - 1]).toContain("🗨️");
  });
});

describe("Quest reducer — combat & progression", () => {
  it("kills a monster, grants XP, and removes it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // max damage rolls
    // A slime (6 HP) sits at (9,4). Hand-place the player next to it so the
    // test doesn't depend on a walkable route.
    const s0 = fresh();
    const slime = s0.monsters.find((m) => m.name === "Slime" && m.x === 9 && m.y === 4)!;
    s0.player.x = 9;
    s0.player.y = 5;
    let s: State = s0;
    // attack upward until the slime is gone (2 hits at 3+2 dmg)
    for (let i = 0; i < 4 && s.monsters.some((m) => m.id === slime.id); i++) {
      s = move(s, 0, -1);
    }
    expect(s.monsters.some((m) => m.id === slime.id)).toBe(false);
    expect(s.player.xp).toBeGreaterThanOrEqual(slime.xp);
  });

  it("winning the boss fight sets status to won", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const s0 = fresh();
    // give the player the sword and enough attack to end it, place next to boss
    s0.player.sword = true;
    s0.player.atk = 50;
    const boss = s0.monsters.find((m) => m.boss)!;
    s0.player.x = boss.x - 1;
    s0.player.y = boss.y;
    const s = move(s0, 1, 0); // strike the boss
    expect(s.status).toBe("won");
  });

  it("running out of HP sets status to dead", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const s0 = fresh();
    // one HP, standing next to a boss that will swing on the enemy phase
    s0.player.hp = 1;
    const boss = s0.monsters.find((m) => m.boss)!;
    s0.player.x = boss.x - 1;
    s0.player.y = boss.y;
    s0.player.atk = 1; // don't one-shot the boss; let it retaliate
    boss.hp = 999;
    const s = move(s0, 1, 0); // attack; boss survives and kills us back
    expect(s.status).toBe("dead");
    expect(s.player.hp).toBe(0);
  });
});
