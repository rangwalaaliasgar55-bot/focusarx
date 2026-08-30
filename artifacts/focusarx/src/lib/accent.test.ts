import { describe, it, expect } from "vitest";
import {
  normalizeHex,
  hexToRgb,
  rgbToHsl,
  buildAccentScale,
  buildAccentOverrides,
  DEFAULT_ACCENT,
} from "./accent";

describe("normalizeHex", () => {
  it("accepts 6-digit hex with or without hash", () => {
    expect(normalizeHex("#8B5CF6")).toBe("#8B5CF6");
    expect(normalizeHex("8b5cf6")).toBe("#8B5CF6");
  });

  it("expands 3-digit shorthand", () => {
    expect(normalizeHex("#f0a")).toBe("#FF00AA");
  });

  it("rejects invalid input", () => {
    expect(normalizeHex("not-a-color")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});

describe("hexToRgb / rgbToHsl", () => {
  it("parses channels correctly", () => {
    expect(hexToRgb("#8B5CF6")).toEqual({ r: 0x8b, g: 0x5c, b: 0xf6 });
  });

  it("round-trips through HSL without drifting more than a rounding step", () => {
    const rgb = hexToRgb("#14B8A6")!;
    const { h, s, l } = rgbToHsl(rgb);
    expect(h).toBeGreaterThan(160);
    expect(h).toBeLessThan(190);
    expect(s).toBeGreaterThan(60);
    expect(l).toBeGreaterThan(30);
    expect(l).toBeLessThan(50);
  });
});

describe("buildAccentScale", () => {
  it("keeps the chosen color exactly at step 500", () => {
    const scale = buildAccentScale("#EF4444");
    expect(scale[500]).toBe("#EF4444");
  });

  it("produces a monotonic lightness ramp from 50 to 900", () => {
    for (const input of ["#8B5CF6", "#0EA5E9", "#F59E0B", "#111111", "#FAFAFA"]) {
      const scale = buildAccentScale(input);
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (let i = 1; i < steps.length; i++) {
        const prev = rgbToHsl(hexToRgb(scale[steps[i - 1]])!).l;
        const next = rgbToHsl(hexToRgb(scale[steps[i]])!).l;
        expect(next).toBeLessThanOrEqual(prev);
      }
    }
  });

  it("generates valid hex values for every step", () => {
    const scale = buildAccentScale("#EC4899");
    for (const value of Object.values(scale)) {
      expect(value).toMatch(/^#[\dA-F]{6}$/);
    }
  });

  it("falls back to the default accent for invalid input", () => {
    const scale = buildAccentScale("nonsense");
    expect(scale[500]).toBe(DEFAULT_ACCENT);
  });
});

describe("buildAccentOverrides", () => {
  it("emits the full brand scale and semantic tokens", () => {
    const overrides = buildAccentOverrides("#10B981", false);
    const scale = buildAccentScale("#10B981");
    const c600 = hexToRgb(scale[600])!;
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(overrides[`--brand-${step}`]).toBeDefined();
    }
    expect(overrides["--brand-500"]).toBe("#10B981");
    expect(overrides["--brand-violet"]).toBe("#10B981");
    expect(overrides["--ring"]).toMatch(/^rgba\(16, 185, 129, 0\.55\)$/);
    expect(overrides["--card-border"]).toMatch(/^rgba\(16, 185, 129, 0\.2\)$/);
    expect(overrides["--shadow-violet-md"]).toContain(`rgba(${c600.r}, ${c600.g}, ${c600.b}, 0.25)`);
    expect(overrides["--glow-violet"]).toContain("rgba(16, 185, 129");
  });

  it("uses softer alpha grading in light mode", () => {
    const dark = buildAccentOverrides("#3B82F6", false);
    const light = buildAccentOverrides("#3B82F6", true);
    expect(dark["--brand-soft"]).toBe("rgba(59, 130, 246, 0.14)");
    expect(light["--brand-soft"]).toBe("rgba(59, 130, 246, 0.09)");
    expect(dark["--ring"]).toBe("rgba(59, 130, 246, 0.55)");
    expect(light["--ring"]).toBe("rgba(59, 130, 246, 0.45)");
  });

  it("re-emits legacy rgba token families with the accent channels", () => {
    const overrides = buildAccentOverrides("#F59E0B", false);
    const scale = buildAccentScale("#F59E0B");
    const c600 = hexToRgb(scale[600])!;
    const c500 = hexToRgb(scale[500])!;
    const c400 = hexToRgb(scale[400])!;
    expect(overrides["--rgba-124-58-237-0_18"]).toBe(`rgba(${c600.r}, ${c600.g}, ${c600.b}, 0.18)`);
    expect(overrides["--rgba-139-92-246-0_4"]).toBe(`rgba(${c500.r}, ${c500.g}, ${c500.b}, 0.4)`);
    expect(overrides["--rgba-167-139-250-_32"]).toBe(`rgba(${c400.r}, ${c400.g}, ${c400.b}, 0.32)`);
    expect(overrides["--rgba-124-58-237-0"]).toBe(`rgba(${c600.r}, ${c600.g}, ${c600.b}, 0)`);
  });
});
