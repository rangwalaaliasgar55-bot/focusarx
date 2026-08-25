/**
 * Ambient v3 catalogue integrity (Workstream D).
 * Pure-data checks — no AudioContext needed.
 */
import { describe, it, expect } from "vitest";
import {
  AMBIENT_SOUNDS,
  AMBIENT_PRESETS,
  EQ_PRESETS,
  MAX_LAYERS,
  type SoundId,
} from "./ambientEngine";

const V3_IDS: SoundId[] = [
  "monsoon-roof",
  "waterfall",
  "night-train",
  "library",
  "city-night",
  "dawn-chorus",
  "temple-bells",
  "chai-stall",
  "river-side",
  "rain-tent",
  "wind-chimes",
  "binaural",
];

describe("ambient v3 catalogue", () => {
  it("ships the original 10 scenes plus 12+ new v3 scenes", () => {
    expect(AMBIENT_SOUNDS.length).toBeGreaterThanOrEqual(22);
    const ids = new Set(AMBIENT_SOUNDS.map(s => s.id));
    // Originals still present
    for (const id of ["rain", "storm", "ocean", "forest", "cafe", "fireplace", "crickets", "pink", "brown", "white"] as SoundId[]) {
      expect(ids.has(id)).toBe(true);
    }
    // All v3 scenes present
    for (const id of V3_IDS) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
    // Unique ids
    expect(ids.size).toBe(AMBIENT_SOUNDS.length);
  });

  it("every sound has a label, emoji, and color token", () => {
    for (const s of AMBIENT_SOUNDS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.emoji.length).toBeGreaterThan(0);
      expect(s.color.startsWith("var(") || s.color.startsWith("#") || s.color.startsWith("rgb")).toBe(true);
    }
  });

  it("every preset references existing sounds and respects the layer cap", () => {
    const ids = new Set(AMBIENT_SOUNDS.map(s => s.id));
    expect(AMBIENT_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of AMBIENT_PRESETS) {
      expect(preset.layers.length, `${preset.id} too many layers`).toBeLessThanOrEqual(MAX_LAYERS);
      expect(preset.layers.length, `${preset.id} empty`).toBeGreaterThan(0);
      for (const l of preset.layers) {
        expect(ids.has(l.id), `${preset.id} → ${l.id} unknown`).toBe(true);
        expect(l.volume).toBeGreaterThan(0);
        expect(l.volume).toBeLessThanOrEqual(1);
      }
    }
  });

  it("EQ presets: flat is neutral, focus narrows the spectrum", () => {
    const flat = EQ_PRESETS.find(p => p.id === "flat");
    expect(flat).toBeDefined();
    expect(flat!.lowShelfDb).toBe(0);
    expect(flat!.highShelfDb).toBe(0);
    expect(flat!.focusLowpass ?? 0).toBe(0);
    const focus = EQ_PRESETS.find(p => p.id === "focus");
    expect(focus).toBeDefined();
    expect(focus!.focusLowpass).toBeGreaterThan(2000);
    expect(focus!.focusLowpass).toBeLessThan(12000);
  });

  it("layer cap is 4", () => {
    expect(MAX_LAYERS).toBe(4);
  });
});
