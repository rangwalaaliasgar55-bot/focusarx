import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Emoji-as-UI gate (WS5a).
 * ══════════════════════════════════════════════════════════════════
 * Emoji made sense as placeholders; as a UI system they fail three ways
 * at once — they render differently on every platform, they ignore the
 * colour and weight tokens around them, and a screen reader reads
 * "fire" where the interface means "streak". Lucide glyphs inherit the
 * design system and the reduced-motion rules, so every control, tab,
 * stat chip and ritual icon in the timer chrome now uses them.
 *
 * Two rules are enforced here:
 *
 *   1. the chrome — app shell, the whole timer cluster and the shared
 *      ui/ components — must contain no pictographic emoji at all;
 *   2. everywhere else is on a ratchet: the remaining emoji (pet art,
 *      city weather, celebratory copy like "🎉 streak saved!") may not
 *      grow. New celebratory copy reuses what is already there or
 *      removes a stale glyph; the budget only moves deliberately.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

/** Pictographic emoji only — typographic dashes, arrows and quotes are prose. */
const PICTOGRAPH = /[\u{1F300}-\u{1FAFF}]/u;

const CHROME = [
  "components/AppShell.tsx",
  "components/Timer.tsx",
  "components/TimerControls.tsx",
  "components/TimerDisplay.tsx",
  "components/TimerRituals.tsx",
  "components/BreakActivityCard.tsx",
  "components/MinimalRing.tsx",
];

function uiFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) uiFiles(full, acc);
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) acc.push(full);
  }
  return acc;
}

describe("the timer and shell chrome", () => {
  it("contains no pictographic emoji", () => {
    for (const rel of [...CHROME, ...uiFiles(path.join(SRC, "components", "ui")).map((f) => path.relative(SRC, f))]) {
      const source = readFileSync(path.join(SRC, rel), "utf8");
      const hits = source.match(PICTOGRAPH) ?? [];
      // ui/ EmptyState documents an `illustration` prop for legacy emoji art;
      // the component itself must not ship any.
      expect(hits.length, `${rel} still renders emoji as UI — use a lucide glyph`).toBe(0);
    }
  });
});

describe("the rest of the app", () => {
  // Measured after the WS5 sweep: pet art, city weather and celebratory copy.
  // Ratchet: sweep more files and lower this; never raise it casually.
  const EMOJI_BUDGET = 397;

  it(`stays inside the emoji ratchet (<= ${EMOJI_BUDGET} glyphs)`, () => {
    let total = 0;
    const worst: string[] = [];
    for (const file of uiFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const count = (source.match(PICTOGRAPH) ?? []).length;
      total += count;
      if (count > 15) worst.push(`${path.relative(SRC, file)}:${count}`);
    }
    expect(
      total,
      `emoji-as-UI grew to ${total} (budget ${EMOJI_BUDGET}). Largest holders: ${worst.join(", ")} — swap to lucide or raise the budget deliberately`,
    ).toBeLessThanOrEqual(EMOJI_BUDGET);
  });
});
