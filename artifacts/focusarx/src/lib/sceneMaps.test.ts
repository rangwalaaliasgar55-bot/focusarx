import { describe, it, expect } from "vitest";
import {
  seaDepth,
  seaCreatures,
  seaCameraY,
  seaFogDensity,
  lampIntensity,
  windowSky,
  bookStack,
} from "./sceneMaps";

describe("sceneMaps (Phase 7.4 data mappings)", () => {
  it("dives with elapsed time and surfaces when stale", () => {
    expect(seaDepth(0)).toBe(0);
    expect(seaDepth(1)).toBe(1);
    expect(seaCameraY(0.8, false)).toBeLessThan(seaCameraY(0.2, false));
    // Hidden tab pulls the diver up even late in a session.
    expect(seaCameraY(0.9, true)).toBeGreaterThan(seaCameraY(0.9, false));
    expect(seaFogDensity(1)).toBeGreaterThan(seaFogDensity(0));
  });

  it("reveals creatures at 25/50/75%", () => {
    expect(seaCreatures(0)).toBe(0);
    expect(seaCreatures(0.3)).toBe(1);
    expect(seaCreatures(0.6)).toBe(2);
    expect(seaCreatures(0.9)).toBe(3);
  });

  it("brightens the lamp with progress and dims on pause", () => {
    expect(lampIntensity(1, false)).toBeGreaterThan(lampIntensity(0, false));
    expect(lampIntensity(0.8, true)).toBeLessThan(lampIntensity(0.8, false));
  });

  it("moves the window from dusk to night", () => {
    const dusk = windowSky(0);
    const night = windowSky(1);
    expect(dusk).not.toEqual(night);
    expect(night.top).toBe("rgb(8,10,40)");
  });

  it("stacks books per weekly session, capped", () => {
    expect(bookStack(3)).toBe(3);
    expect(bookStack(99)).toBe(7);
    expect(bookStack(NaN)).toBe(0);
  });
});
