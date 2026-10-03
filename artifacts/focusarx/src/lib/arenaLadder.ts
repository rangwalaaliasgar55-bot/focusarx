/**
 * The arena ladder — six named cups, ported from the PR #99 uploads.
 *
 * The uploaded build did not present a single "pick an opponent" screen: it had
 * a ladder of six cups with their own names, blurbs and levels, each unlocked by
 * clearing the one before it (see `ARENA` in the uploads' `lib/pets.ts`). The
 * names and the blurbs here are the uploads' own words, kept verbatim, because
 * the point of copying a design is that the writing comes with it.
 *
 * Two deliberate differences, both because the app around this file is not the
 * uploaded demo:
 *
 *   • **Foes are level bands, not fixed species ids.** The uploads named pets
 *     that do not exist in this catalog (`magikarp`, `hoot`, `lucky`…). Inventing
 *     species to satisfy a list would produce a rival the user cannot own and
 *     that no other surface knows about, so a cup sets the *level* and the arena
 *     draws the opponent from the live catalog at that level.
 *   • **No cup currency.** The uploads charged "arena energy" earned from focus
 *     minutes and paid coins and XP per cup. This app has no arena economy, and a
 *     second currency invented for a ladder would be the tail wagging the dog —
 *     the cup still sets the stakes, it just does not mint anything.
 *
 * The difficulty is what makes the six cups feel different rather than only
 * longer: the ladder climbs from an easy warm-up to a hard, higher-level fight.
 */

import type { Difficulty } from "@/lib/petBattle";

export interface ArenaCup {
  /** 1-based position in the ladder — also what the battle log stores. */
  id: number;
  name: string;
  blurb: string;
  /** Level the opponent is fought at. */
  level: number;
  difficulty: Difficulty;
  /** Scene colours for this cup: [backdrop, floor, ring]. The uploads' palette. */
  palette: [string, string, string];
}

/** The ladder, name for name, from the uploads' `ARENA` table. */
export const ARENA_CUPS: ArenaCup[] = [
  {
    id: 1,
    name: "Meadow Cup",
    blurb: "A friendly warm-up on soft grass.",
    level: 3,
    difficulty: "easy",
    palette: ["#2b4a3a", "#16261e", "#4d7a52"],
  },
  {
    id: 2,
    name: "Lantern Cup",
    blurb: "Evening matches under paper lanterns.",
    level: 6,
    difficulty: "easy",
    palette: ["#4a2f2b", "#1e1414", "#8a4a35"],
  },
  {
    id: 3,
    name: "Tidewall Cup",
    blurb: "Slippery stones and splashy rivals.",
    level: 9,
    difficulty: "normal",
    palette: ["#1f3a52", "#101c28", "#2c6a8f"],
  },
  {
    id: 4,
    name: "Stormgate Cup",
    blurb: "Sparks fly above the old gate.",
    level: 12,
    difficulty: "normal",
    palette: ["#3a3158", "#16122a", "#5a4aa0"],
  },
  {
    id: 5,
    name: "Skyfall Cup",
    blurb: "Only the dragons are left up here.",
    level: 16,
    difficulty: "hard",
    palette: ["#2a3f55", "#0e1621", "#4f7fa8"],
  },
  {
    id: 6,
    name: "Mythic Cup",
    blurb: "Legends step into the ring.",
    level: 20,
    difficulty: "hard",
    palette: ["#4a3a1f", "#1a1408", "#c79b3b"],
  },
];

/** Highest cup number a battle report may carry (mirrors the DB CHECK). */
export const MAX_ARENA_CUP = ARENA_CUPS.length;

/** The cup a log row refers to, or null for a pick-up fight. */
export function cupFor(stage: unknown): ArenaCup | null {
  const id = typeof stage === "string" ? Number(stage) : typeof stage === "number" ? stage : NaN;
  if (!Number.isInteger(id)) return null;
  return ARENA_CUPS.find((cup) => cup.id === id) ?? null;
}

/** Short label for a log row's stage: "Cup 3 · Tidewall Cup", or null. */
export function cupLabel(stage: unknown): string | null {
  const cup = cupFor(stage);
  return cup ? `Cup ${cup.id} · ${cup.name}` : null;
}

/**
 * Cups the log says have been won.
 *
 * A cup counts as cleared on any win at it, not on the first win only: the log
 * is a list of what happened, and re-fighting a cup must not un-clear it.
 */
export function clearedCups(battles: { stage?: unknown; result?: unknown }[]): number[] {
  const cleared = new Set<number>();
  for (const battle of battles) {
    const cup = cupFor(battle.stage);
    if (cup && battle.result === "win") cleared.add(cup.id);
  }
  return [...cleared].sort((a, b) => a - b);
}

/**
 * Whether a cup can be entered: the first cup always, every later one only
 * after the previous cup is won *and* at the companion's level. Both conditions
 * are stated in the UI — "needs level 9" and "clear Cup 2 first" are different
 * pieces of advice, and a single greyed-out card tells the user neither.
 */
export function cupUnlocked(cup: ArenaCup, petLevel: number, cleared: number[]): boolean {
  if (cup.id === 1) return petLevel >= cup.level;
  return cleared.includes(cup.id - 1) && petLevel >= cup.level;
}

/** The cup the arena suggests next: the first unlocked cup not yet won. */
export function nextCup(petLevel: number, cleared: number[]): ArenaCup {
  return ARENA_CUPS.find((cup) => cupUnlocked(cup, petLevel, cleared) && !cleared.includes(cup.id))
    ?? ARENA_CUPS[cleared.length - 1]
    ?? ARENA_CUPS[0]!;
}

/** Why a locked cup is locked, in the user's words. Null when it is open. */
export function cupLockReason(cup: ArenaCup, petLevel: number, cleared: number[]): string | null {
  if (cup.id > 1 && !cleared.includes(cup.id - 1)) return `Clear Cup ${cup.id - 1} first`;
  if (petLevel < cup.level) return `Needs level ${cup.level}`;
  return null;
}
