import { describe, expect, it } from "vitest";
import {
  MAX_TIMELINE_BYTES,
  MAX_TIMELINE_POINTS,
  normalizeFocusTimeline,
  serializeFocusTimeline,
} from "./focusTimeline";

describe("normalizeFocusTimeline", () => {
  it("returns [] for garbage input", () => {
    expect(normalizeFocusTimeline(undefined)).toEqual([]);
    expect(normalizeFocusTimeline(null)).toEqual([]);
    expect(normalizeFocusTimeline("not json")).toEqual([]);
    expect(normalizeFocusTimeline({ t: 1, state: "focus" })).toEqual([]);
    expect(normalizeFocusTimeline([1, "x", null, { t: "nope" }, { t: 1, state: "bored" }])).toEqual([]);
  });

  it("accepts a JSON string as stored in the text column", () => {
    expect(normalizeFocusTimeline('[{"t":0,"state":"focus"},{"t":30,"state":"distracted"}]')).toEqual([
      { t: 0, state: "focus" },
      { t: 30, state: "distracted" },
    ]);
  });

  it("collapses consecutive same-state samples and sorts by time", () => {
    const input = [
      { t: 45, state: "focus" },
      { t: 0, state: "focus" },
      { t: 15, state: "focus" },
      { t: 60, state: "distracted" },
      { t: 75, state: "distracted" },
      { t: 90, state: "focus" },
    ];
    expect(normalizeFocusTimeline(input)).toEqual([
      { t: 0, state: "focus" },
      { t: 60, state: "distracted" },
      { t: 90, state: "focus" },
    ]);
  });

  it("caps the point count while keeping the first and last sample", () => {
    const flapping = Array.from({ length: 50_000 }, (_, i) => ({ t: i, state: i % 2 ? "distracted" : "focus" }));
    const result = normalizeFocusTimeline(flapping);
    expect(result.length).toBeLessThanOrEqual(MAX_TIMELINE_POINTS);
    expect(result[0]).toEqual({ t: 0, state: "focus" });
    // The tail sample of a same-state run carries no information, so only
    // require that the downsampled list still spans the whole session.
    expect(result[result.length - 1]!.t).toBeGreaterThan(49_000);
    // No two neighbours share a state after downsampling either.
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.state).not.toBe(result[i - 1]!.state);
    }
  });
});

describe("serializeFocusTimeline", () => {
  it("never exceeds the byte budget", () => {
    const flapping = Array.from({ length: 200_000 }, (_, i) => ({ t: i * 1_000_000, state: i % 2 ? "distracted" : "focus" }));
    const json = serializeFocusTimeline(flapping);
    expect(json.length).toBeLessThanOrEqual(MAX_TIMELINE_BYTES);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("is idempotent", () => {
    const flapping = Array.from({ length: 5_000 }, (_, i) => ({ t: i * 3, state: i % 3 === 0 ? "distracted" : "focus" }));
    const once = serializeFocusTimeline(flapping);
    expect(serializeFocusTimeline(once)).toBe(once);
  });
});
