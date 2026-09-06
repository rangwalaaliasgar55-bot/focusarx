import { describe, expect, it } from "vitest";
import { BRAND, DESCRIPTION_BUDGET, MIN_SNIPPET, TITLE_BUDGET, clampText, composeTitle } from "./seo-text.mjs";

/**
 * The rules that decide what a search result says about a page.
 *
 * Both renderers — components/PageSEO.tsx on the client and scripts/prerender.mjs
 * at build time — call these helpers, so this covers the emitted HTML for every one
 * of the ~90 prerendered pages plus any route that only renders client-side.
 */
describe("composeTitle", () => {
  it("appends the brand exactly once", () => {
    expect(composeTitle("Free Focus Timer")).toBe("Free Focus Timer | FocusArx");
  });

  it.each([
    ["Deep Work Tracker | FocusArx", "Deep Work Tracker | FocusArx"],
    ["Deep Work Tracker — FocusArx", "Deep Work Tracker | FocusArx"],
    ["Deep Work Tracker – FocusArx", "Deep Work Tracker | FocusArx"],
    ["Deep Work Tracker|FocusArx", "Deep Work Tracker | FocusArx"],
  ])("normalises an authored brand mark (%s)", (input, expected) => {
    expect(composeTitle(input)).toBe(expected);
  });

  it("exposes the same snippet floor the build gate uses", () => {
    expect(MIN_SNIPPET).toBe(60);
  });

  it("is idempotent, so a title can be composed twice without drifting", () => {
    const once = composeTitle("ADHD Focus Tools: Timers, Rooms, Body Doubling");
    expect(composeTitle(once)).toBe(once);
  });

  it("keeps a brand mention inside the title rather than treating it as a suffix", () => {
    expect(composeTitle("About FocusArx: Our Mission")).toBe("About FocusArx: Our Mission | FocusArx");
  });

  it("never emits a title over the search-result budget, whatever it is given", () => {
    const long = "Pomodoro Timer for NDA & NA (National Defence Academy / Naval Academy Entrance Examination) | Focus Sessions That Count";
    const result = composeTitle(long);
    expect(result.length).toBeLessThanOrEqual(TITLE_BUDGET);
    expect(result.endsWith(`| ${BRAND}`)).toBe(true);
  });

  it("cuts on a word boundary, never mid-word", () => {
    const result = composeTitle("How to Focus with ADHD: 15 Science-Backed Strategies That Actually Work Every Single Day");
    // The character just before the separator must be end-of-word.
    const pagePart = result.slice(0, result.lastIndexOf(" | FocusArx"));
    expect(pagePart).toBe(pagePart.trim());
    expect(/[\w)]$/.test(pagePart)).toBe(true);
  });

  it("leaves a short title alone instead of padding it", () => {
    expect(composeTitle("Cookie Policy")).toBe("Cookie Policy | FocusArx");
  });
});

describe("clampText", () => {
  it("collapses whitespace rather than truncating", () => {
    expect(clampText("  a   b \n c ", 100)).toBe("a b c");
  });

  it("keeps whole sentences that fit and drops the rest", () => {
    const text = "Learn how to focus with one timer per thought, and stop restarting the same afternoon over and over. This second sentence is far too long to ever appear in a search snippet so it is dropped by the clamping logic.";
    const result = clampText(text, DESCRIPTION_BUDGET);
    expect(result).toBe("Learn how to focus with one timer per thought, and stop restarting the same afternoon over and over.");
  });

  it("does not fall back to a 19-character sentence, which would read as boilerplate", () => {
    const result = clampText("Too short. " + "word ".repeat(60), DESCRIPTION_BUDGET);
    expect(result.length).toBeGreaterThanOrEqual(150);
  });

  it("falls back to a word boundary and closes with a full stop", () => {
    const text = "x".repeat(40) + " " + "y".repeat(140);
    const result = clampText(text, DESCRIPTION_BUDGET);
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    expect(result).toBe(`${"x".repeat(40)}.`);
  });

  it("trims dangling punctuation instead of leaving a stray comma", () => {
    // Cut lands right after a comma: the comma goes with it, mid-text punctuation stays.
    expect(clampText("alpha beta, gamma delta epsilon zeta", 12, { fullStop: false })).toBe("alpha beta");
    expect(clampText("alpha beta, gamma delta epsilon zeta", 20, { fullStop: false })).toBe("alpha beta, gamma");
  });

  it("ends a clipped description with a full stop and a clipped title without one", () => {
    const text = "Run a timer, finish the chapter, and keep the streak alive for as long as it takes to matter";
    expect(clampText(text, 60)).toMatch(/\.$/);
    expect(clampText(text, 60, { fullStop: false })).not.toMatch(/\.$/);
  });

  it("survives missing content without throwing", () => {
    expect(clampText(undefined, 160)).toBe("");
    expect(composeTitle("")).toBe(BRAND);
  });
});
