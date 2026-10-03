/**
 * The ladder's rules, without a browser.
 *
 * The unlocking rule is the one that can silently rot: a ladder where the last
 * cup is reachable from the first is not a ladder, and a ladder where cup 2
 * stays locked after cup 1 is won is a dead end the user reads as a bug. Neither
 * failure throws anything, so both are pinned here — including the wording of
 * the two different reasons a cup can be locked.
 */
import { describe, expect, it } from "vitest";
import {
  ARENA_CUPS,
  MAX_ARENA_CUP,
  clearedCups,
  cupFor,
  cupLabel,
  cupLockReason,
  cupUnlocked,
  nextCup,
} from "./arenaLadder";

describe("the arena ladder", () => {
  it("is the uploads' six cups, in order, with their own names and blurbs", () => {
    expect(ARENA_CUPS).toHaveLength(6);
    expect(ARENA_CUPS.map((c) => c.name)).toEqual([
      "Meadow Cup",
      "Lantern Cup",
      "Tidewall Cup",
      "Stormgate Cup",
      "Skyfall Cup",
      "Mythic Cup",
    ]);
    expect(ARENA_CUPS.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    // Levels climb, and every cup has a blurb and a scene palette; an empty
    // blurb would render as a blank card nobody could act on.
    const levels = ARENA_CUPS.map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    for (const cup of ARENA_CUPS) {
      expect(cup.blurb.length).toBeGreaterThan(10);
      expect(cup.palette).toHaveLength(3);
    }
    expect(MAX_ARENA_CUP).toBe(6);
  });

  it("opens cup 1, and each later cup only after the one before it is won", () => {
    const [, second, third] = ARENA_CUPS;
    // A strong companion with nothing won is still at cup 1: winning is what
    // advances the ladder, not levelling up.
    expect(cupUnlocked(ARENA_CUPS[0]!, 99, [])).toBe(true);
    expect(cupUnlocked(second!, 99, [])).toBe(false);
    expect(cupUnlocked(second!, 99, [1])).toBe(true);
    expect(cupUnlocked(third!, 99, [1])).toBe(false);
    expect(cupUnlocked(third!, 99, [1, 2])).toBe(true);

    // The level gate is separate, and can hold a cup back on its own.
    expect(cupUnlocked(ARENA_CUPS[0]!, 1, [])).toBe(false);
    expect(cupUnlocked(third!, 2, [1, 2])).toBe(false);
  });

  it("says which of the two gates is holding a cup back", () => {
    const [, second, third] = ARENA_CUPS;
    expect(cupLockReason(second!, 99, [])).toBe("Clear Cup 1 first");
    expect(cupLockReason(third!, 2, [1, 2])).toBe("Needs level 9");
    expect(cupLockReason(third!, 99, [1, 2])).toBeNull();
    // Both unmet: the cup the user has not reached comes first, because that is
    // the one they can actually do something about.
    expect(cupLockReason(third!, 2, [1])).toBe("Clear Cup 2 first");
  });

  it("reads cleared cups off the battle log, and never un-clears one", () => {
    const log = [
      { stage: 1, result: "win" },
      { stage: 2, result: "loss" },
      { stage: 1, result: "win" }, // a re-fight: still cleared, not cleared twice
      { stage: 2, result: "flee" },
      { stage: null, result: "win" }, // a pick-up fight is not a cup
      { result: "win" }, // and neither is a row from before the ladder existed
      { stage: 9, result: "win" }, // nor one with a stage this build does not know
    ];
    expect(clearedCups(log)).toEqual([1]);
  });

  it("suggests the first cup that is open and unwon, and stays put at the end", () => {
    expect(nextCup(3, []).id).toBe(1);
    expect(nextCup(99, [1, 2]).id).toBe(3);
    // Everything won: the suggestion is the last cup, to fight again.
    expect(nextCup(99, [1, 2, 3, 4, 5, 6]).id).toBe(6);
    // Nothing open yet (companion below the first cup's level): cup 1, with its
    // lock reason explaining the level.
    expect(nextCup(1, []).id).toBe(1);
  });

  it("maps a stored stage back to a cup, and refuses anything else", () => {
    expect(cupFor(3)?.name).toBe("Tidewall Cup");
    // The value comes back from the API as JSON, but a form or a query string
    // can hand this a string — it must not silently become cup 0.
    expect(cupFor("4")?.name).toBe("Stormgate Cup");
    for (const bad of [null, undefined, 0, 7, -1, 2.5, "three", "", NaN]) {
      expect(cupFor(bad), `stage ${String(bad)} should not resolve to a cup`).toBeNull();
    }
    expect(cupLabel(5)).toBe("Cup 5 · Skyfall Cup");
    expect(cupLabel(null)).toBeNull();
  });
});
