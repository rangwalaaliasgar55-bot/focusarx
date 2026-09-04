import { describe, it, expect } from "vitest";
import { flowSuggestedBreakMin, getPresetById, SESSION_PRESETS } from "./sessionPresets";

describe("sessionPresets (Phase 9.1)", () => {
  it("defines the required modes with sane durations", () => {
    const ids = SESSION_PRESETS.map((p) => p.id);
    for (const id of ["pomodoro", "extended", "deep", "animedoro", "flow", "custom"]) {
      expect(ids).toContain(id);
    }
    expect(getPresetById("pomodoro")).toMatchObject({ focusMin: 25, breakMin: 5 });
    expect(getPresetById("extended")).toMatchObject({ focusMin: 50, breakMin: 10 });
    expect(getPresetById("deep")).toMatchObject({ focusMin: 90 });
    expect(getPresetById("flow").flow).toBe(true);
  });

  it("falls back to pomodoro for unknown ids", () => {
    expect(getPresetById("nope").id).toBe("pomodoro");
  });

  it("suggests proportional flow breaks, capped", () => {
    expect(flowSuggestedBreakMin(25)).toBe(5);
    expect(flowSuggestedBreakMin(50)).toBe(10);
    expect(flowSuggestedBreakMin(0)).toBe(5);
    expect(flowSuggestedBreakMin(400)).toBe(30);
  });
});
