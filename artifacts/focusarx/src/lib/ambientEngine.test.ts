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

// ── loop-seam quality (pure DSP, no AudioContext) ────────────────────────────
import { renderNoiseChannel, type NoiseColor } from "./ambientEngine";

function rms(a: Float32Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i]! * a[i]!;
  return Math.sqrt(s / Math.max(1, to - from));
}

describe("noise loop seams", () => {
  const sr = 48_000;
  for (const color of ["white", "pink", "brown"] as NoiseColor[]) {
    it(`${color}: level stays flat across the loop point (no periodic dip)`, () => {
      const seconds = 6;
      const d = new Float32Array(sr * seconds);
      renderNoiseChannel(d, sr, color, seconds);
      // Compare the 200 ms just before the loop point with the 200 ms after
      // it (the head), and both with the steady middle of the buffer. The old
      // fade-to-silence tail put the pre-seam block ~20 dB under the middle.
      const win = Math.floor(sr * 0.2);
      const middle = rms(d, Math.floor(d.length / 2), Math.floor(d.length / 2) + win);
      const tail = rms(d, d.length - win, d.length);
      const head = rms(d, 0, win);
      // brown noise has slow wander, so allow a wider band than white/pink
      const tol = color === "brown" ? 0.5 : 0.25;
      expect(Math.abs(tail / middle - 1), `tail ${tail} vs middle ${middle}`).toBeLessThan(tol);
      expect(Math.abs(head / middle - 1), `head ${head} vs middle ${middle}`).toBeLessThan(tol);
      // And the very last sample must not be forced to zero any more.
      expect(rms(d, d.length - 64, d.length)).toBeGreaterThan(middle * 0.1);
    });
  }

  it("one-shot buffers get click-free edges", () => {
    const d = new Float32Array(Math.floor(sr * 0.1));
    renderNoiseChannel(d, sr, "white", 0.1);
    expect(Math.abs(d[0]!)).toBeLessThan(1e-6);
    expect(Math.abs(d[d.length - 1]!)).toBeLessThan(1e-6);
    expect(rms(d, 1000, 3000)).toBeGreaterThan(0.3);
  });

  it("coloured loops do not start from the silent filter state", () => {
    const d = new Float32Array(sr * 2);
    renderNoiseChannel(d, sr, "brown", 2);
    // First 20 ms should already carry normal energy thanks to the pre-roll.
    const first = rms(d, 0, Math.floor(sr * 0.02));
    const mid = rms(d, sr, sr + Math.floor(sr * 0.02));
    expect(first).toBeGreaterThan(mid * 0.2);
  });
});
