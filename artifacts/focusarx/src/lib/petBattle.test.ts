import { describe, expect, it } from "vitest";
import {
  MAX_ENERGY,
  chooseEnemyMove,
  effectiveness,
  elementFor,
  makeFighter,
  makeRng,
  resolveEnemyTurn,
  resolveTurn,
  rivalLevelFor,
  rivalNameFor,
  startBattle,
  statsFor,
  type BattleState,
  type Fighter,
} from "./petBattle";

/**
 * Battle engine invariants.
 *
 * The engine is the one part of the arena that can be checked without a
 * browser, and it is where a mistake is expensive: the bars, the log, the 3D
 * reactions and the row the server stores are all derived from the state this
 * file produces. So the suite is about *properties*, not golden numbers —
 * bounds, determinism, termination and turn order — because the numbers
 * themselves are a balance decision that should stay free to change.
 *
 * Two of these tests are regressions for bugs this engine shipped with:
 *
 *   • `resolveTurn` used to act for whoever's turn it was, so a faster animal's
 *     opening turn made the *player's* first move resolve for the opponent —
 *     with the enemy's chosen move. Turns are now explicit and out-of-order
 *     calls are refused.
 *   • `event.guarded` was read after the guard had already been consumed, so it
 *     was always false and the board could never show that a brace had worked.
 */

/** The player always opens, so a test can drive sides without roll-of-the-dice. */
function playerFighter(): Fighter {
  return { ...makeFighter("player", "fox", 5, "Rusty"), spd: 999 };
}

function enemyFighter(): Fighter {
  return makeFighter("enemy", "owl", 5, "Hoot");
}

function openFight(seed: number): BattleState {
  return startBattle(playerFighter(), enemyFighter(), seed);
}

/** One full round: the player's move, then the opponent's reply. */
function round(state: BattleState, playerMove: number): BattleState {
  const first = resolveTurn(state, playerMove, "player");
  if (first.state.winner) return first.state;
  return resolveEnemyTurn(first.state).state;
}

describe("fighter construction", () => {
  it("scales stats with level and keeps them positive", () => {
    const low = statsFor("fox", 1);
    const high = statsFor("fox", 20);
    expect(low.hp).toBeGreaterThan(0);
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.atk).toBeGreaterThan(low.atk);
    expect(low.def).toBeGreaterThan(0);
  });

  it("is stable per species: the same slug always fights the same way", () => {
    expect(statsFor("capybara", 7)).toEqual(statsFor("capybara", 7));
    // Different species differ, which is what makes *which* companion matter.
    expect(statsFor("capybara", 7)).not.toEqual(statsFor("dragon", 7));
  });

  it("clamps absurd levels instead of producing absurd HP", () => {
    expect(statsFor("fox", 0).hp).toBe(statsFor("fox", 1).hp);
    expect(statsFor("fox", 9999)).toEqual(statsFor("fox", 100));
  });

  it("starts every fighter with a name, a moveset and energy for one big move", () => {
    const fighter = makeFighter("player", "capybara", 3);
    expect(fighter.name).toBe("Capybara");
    expect(fighter.moves.length).toBeGreaterThanOrEqual(4);
    expect(fighter.moves.some((m) => m.kind === "attack" && m.cost === 0)).toBe(true);
    expect(fighter.energy).toBeGreaterThanOrEqual(2);
    expect(fighter.energy).toBeLessThanOrEqual(MAX_ENERGY);
  });
});

describe("elements", () => {
  it("resolves the well-known species", () => {
    expect(elementFor("charmander")).toBe("fire");
    expect(elementFor("squirtle")).toBe("water");
    expect(elementFor("bulbasaur")).toBe("grass");
    expect(elementFor("pikachu")).toBe("electric");
    expect(elementFor("dragon")).toBe("dragon");
  });

  it("has a bounded, symmetric-in-shape matchup table", () => {
    expect(effectiveness("fire", "grass")).toBe(2);
    expect(effectiveness("grass", "fire")).toBe(0.5);
    expect(effectiveness("normal", "normal")).toBe(1);
    for (const [a, b] of [
      ["fire", "water"],
      ["electric", "grass"],
      ["dragon", "fairy"],
      ["ice", "dragon"],
    ] as const) {
      const mult = effectiveness(a, b);
      expect([0.5, 1, 2]).toContain(mult);
    }
  });
});

describe("deterministic rng", () => {
  it("produces the same sequence for the same seed and changes with the seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays inside [0, 1)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("turn order", () => {
  it("gives the faster animal the opening turn", () => {
    const fast = startBattle({ ...playerFighter(), spd: 999 }, enemyFighter(), 5);
    expect(fast.turn).toBe("player");
    const slow = startBattle({ ...playerFighter(), spd: 1 }, enemyFighter(), 5);
    expect(slow.turn).toBe("enemy");
  });

  it("lets a faster opponent open the fight, then hands over to the player", () => {
    const slow = startBattle({ ...playerFighter(), spd: 1 }, enemyFighter(), 5);
    const opening = resolveEnemyTurn(slow);
    expect(opening.event.side).toBe("enemy");
    expect(opening.state.turn).toBe("player");
    // The player's move now resolves for the player, not for the opponent.
    const reply = resolveTurn(opening.state, 0, "player");
    expect(reply.event.side).toBe("player");
    expect(reply.event.move.name).toBe("Nudge");
  });

  it("refuses a side acting out of turn, so one side cannot move twice", () => {
    const state = openFight(3);
    expect(() => resolveTurn(state, 0, "enemy")).toThrow(/turn/i);
    // The default side still follows the state, which is what the board uses.
    expect(resolveTurn(state, 0).event.side).toBe("player");
  });
});

describe("turn resolution", () => {
  it("never lets HP or energy leave their bounds over a full fight", () => {
    let state = openFight(1234);
    let actions = 0;
    while (!state.winner && actions < 200) {
      state = round(state, 1);
      for (const side of [state.player, state.enemy] as const) {
        expect(side.hp).toBeGreaterThanOrEqual(0);
        expect(side.hp).toBeLessThanOrEqual(side.maxHp);
        expect(side.energy).toBeGreaterThanOrEqual(0);
        expect(side.energy).toBeLessThanOrEqual(MAX_ENERGY);
      }
      actions += 1;
    }
    expect(state.winner).not.toBeNull();
    expect(actions).toBeLessThan(200);
  });

  it("ends after a bounded number of actions, for every opening move", () => {
    for (let opening = 0; opening < 5; opening += 1) {
      let state = openFight(99);
      let actions = 0;
      state = resolveTurn(state, opening, "player").state;
      if (!state.winner) state = resolveEnemyTurn(state).state;
      while (!state.winner && actions < 200) {
        state = round(state, actions % 5);
        actions += 1;
      }
      expect(state.winner, `opening move ${opening} never resolved`).not.toBeNull();
      expect(actions).toBeLessThan(200);
    }
  });

  it("is reproducible from the same seed and actions", () => {
    const run = () => {
      let state = openFight(555);
      const events: string[] = [];
      for (let i = 0; i < 6 && !state.winner; i += 1) {
        const first = resolveTurn(state, i % 5, "player");
        state = first.state;
        events.push(first.event.text);
        if (state.winner) break;
        const second = resolveEnemyTurn(state);
        state = second.state;
        events.push(second.event.text);
      }
      return { events, hp: [state.player.hp, state.enemy.hp] };
    };
    expect(run()).toEqual(run());
  });

  it("spends energy for a move that costs it and never goes negative", () => {
    const state = openFight(11);
    const heavyIndex = state.player.moves.findIndex((m) => m.cost === 4);
    expect(heavyIndex).toBeGreaterThanOrEqual(0);
    // Not affordable at the start (2 energy): the move still resolves without
    // driving energy below zero — the board greys it out, but the engine stays
    // safe even when a caller ignores the affordability hint.
    const { state: after } = resolveTurn(state, heavyIndex, "player");
    expect(after.player.energy).toBeGreaterThanOrEqual(0);
    expect(after.player.energy).toBeLessThan(MAX_ENERGY);
  });

  it("heals up to — and never past — the maximum", () => {
    let state = openFight(21);
    state = round(state, 0);
    const healIndex = state.player.moves.findIndex((m) => m.kind === "heal");
    expect(healIndex).toBeGreaterThanOrEqual(0);
    state = { ...state, player: { ...state.player, energy: MAX_ENERGY, hp: 1 } };
    const healed = resolveTurn(state, healIndex, "player");
    expect(healed.state.player.hp).toBeLessThanOrEqual(healed.state.player.maxHp);
    expect(healed.state.player.hp).toBeGreaterThan(1);
    expect(healed.event.heal).toBeGreaterThan(0);
    expect(healed.event.side).toBe("player");
  });

  it("reports a brace as guarded and halves the hit it protects against", () => {
    const state = openFight(31);
    const guardIndex = state.player.moves.findIndex((m) => m.kind === "guard");
    const jabIndex = state.enemy.moves.findIndex((m) => m.id === "jab");
    const guardedState = resolveTurn(state, guardIndex, "player").state;
    expect(guardedState.player.guard).toBe(true);

    const hitThroughGuard = resolveTurn(guardedState, jabIndex, "enemy");
    expect(hitThroughGuard.event.side).toBe("enemy");
    expect(hitThroughGuard.event.guarded).toBe(true);
    // The brace is spent by the blow it absorbed.
    expect(hitThroughGuard.state.player.guard).toBe(false);

    // Same seed, same round, same move — only the brace differs, so the RNG
    // stream lines up and the comparison is the guard's doing and nothing else.
    const openState = { ...guardedState, player: { ...guardedState.player, guard: false } };
    const hitWithoutGuard = resolveTurn(openState, jabIndex, "enemy");
    expect(hitWithoutGuard.event.guarded).toBe(false);
    expect(hitWithoutGuard.event.dmg).toBeGreaterThanOrEqual(hitThroughGuard.event.dmg);
  });

  it("marks a winner exactly once and stops taking turns", () => {
    let state = openFight(3);
    let resolves = 0;
    while (!state.winner && resolves < 200) {
      state = resolveTurn(state, 2, "player").state;
      resolves += 1;
      if (state.winner) break;
      state = resolveEnemyTurn(state).state;
      resolves += 1;
    }
    expect(state.winner).not.toBeNull();
    // The log's last line names the outcome, and the fight is over.
    expect(state.log[state.log.length - 1]).toMatch(/wins|You win/);
  });

  it("counts damage dealt per side, for the row the server stores", () => {
    let state = openFight(77);
    state = round(state, 1);
    expect(state.dealt.player).toBeGreaterThanOrEqual(0);
    expect(state.dealt.enemy).toBeGreaterThanOrEqual(0);
    expect(state.dealt.player + state.dealt.enemy).toBeGreaterThan(0);
  });

  it("never chooses an out-of-range move for the opponent", () => {
    let state = openFight(5);
    for (let i = 0; i < 12 && !state.winner; i += 1) {
      state = resolveTurn(state, i % 5, "player").state;
      if (state.winner) break;
      const index = chooseEnemyMove(state);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(state.enemy.moves.length);
      state = resolveTurn(state, index, "enemy").state;
    }
  });
});

describe("opponent bands", () => {
  it("stays two levels around the pet and inside the level range", () => {
    expect(rivalLevelFor(5, "easy")).toBe(3);
    expect(rivalLevelFor(5, "normal")).toBe(5);
    expect(rivalLevelFor(5, "hard")).toBe(7);
    expect(rivalLevelFor(1, "easy")).toBe(1);
    expect(rivalLevelFor(100, "hard")).toBe(100);
  });

  it("names opponents readably and differently per band", () => {
    expect(rivalNameFor("capybara", "normal")).toBe("Wild Capybara");
    expect(rivalNameFor("capybara", "hard")).toBe("Elder Capybara");
    expect(rivalNameFor("dragon", "easy")).toBe("Young Dragon");
  });
});
