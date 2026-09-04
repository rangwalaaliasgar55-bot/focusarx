import { describe, it, expect } from "vitest";
import { weeklyFacets } from "./weeklyFacets";
import { sceneElapsedPct, sceneIsStale } from "./sceneBus";
import { clampPct } from "../components/MinimalRing";

describe("scene meanings (Phase 6.1/7 — same meaning every tier)", () => {
  it("computes elapsed fraction, clamped and NaN-proof", () => {
    expect(sceneElapsedPct({ secondsLeft: 750, totalSeconds: 1500 })).toBe(0.5);
    expect(sceneElapsedPct({ secondsLeft: 0, totalSeconds: 1500 })).toBe(1);
    expect(sceneElapsedPct(null)).toBe(0);
    expect(sceneElapsedPct({ secondsLeft: NaN, totalSeconds: 1500 })).toBe(0);
    expect(sceneElapsedPct({ secondsLeft: -5, totalSeconds: 1500 })).toBe(1);
    expect(sceneElapsedPct({ secondsLeft: 10, totalSeconds: 0 })).toBe(0);
    expect(clampPct(2)).toBe(1);
    expect(clampPct(-1)).toBe(0);
  });

  it("treats snapshots older than 2.5 s as stale (hidden-tab signal)", () => {
    const at = 1_000_000;
    expect(sceneIsStale({ mode: "focus", status: "running", secondsLeft: 1, totalSeconds: 2, at }, at + 1000)).toBe(false);
    expect(sceneIsStale({ mode: "focus", status: "running", secondsLeft: 1, totalSeconds: 2, at }, at + 3000)).toBe(true);
    expect(sceneIsStale(null)).toBe(true);
  });

  it("derives 7-day facets oldest → today", () => {
    // Friday 2026-09-04 12:00 local.
    const now = new Date(2026, 8, 4, 12, 0, 0).getTime();
    const facets = weeklyFacets(
      [
        { completedAt: new Date(2026, 8, 4, 9, 0, 0).toISOString(), mode: "focus" },
        { completedAt: new Date(2026, 7, 30, 9, 0, 0).toISOString(), mode: "focus" },
        { completedAt: new Date(2026, 7, 30, 10, 0, 0).toISOString(), mode: "break" },
        { completedAt: "garbage", mode: "focus" },
      ],
      now,
    );
    expect(facets).toEqual([false, true, false, false, false, false, true]);
  });
});
