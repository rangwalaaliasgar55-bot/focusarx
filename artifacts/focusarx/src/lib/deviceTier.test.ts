import { describe, it, expect } from "vitest";
import {
  detectTier,
  isInAppWebView,
  isOldOs,
  parseOsGeneration,
  type DeviceCaps,
} from "./deviceTier";

const DESKTOP_FULL: DeviceCaps = {
  webgl2: true,
  webgl1: true,
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  reducedMotion: false,
  saveData: false,
  effectiveType: "4g",
  inAppWebView: false,
  oldOs: false,
};

describe("deviceTier (Phase 6.1)", () => {
  it("grants full to capable desktops", () => {
    expect(detectTier(DESKTOP_FULL)).toBe("full");
  });

  it("treats hidden memory/concurrency (Firefox/Safari) as meeting the bar", () => {
    expect(
      detectTier({ ...DESKTOP_FULL, deviceMemoryGb: null, hardwareConcurrency: null }),
    ).toBe("full");
  });

  it("drops to lite on WebGL1-only or mid-range memory", () => {
    expect(detectTier({ ...DESKTOP_FULL, webgl2: false })).toBe("lite");
    expect(detectTier({ ...DESKTOP_FULL, deviceMemoryGb: 3 })).toBe("lite");
    expect(detectTier({ ...DESKTOP_FULL, hardwareConcurrency: 2 })).toBe("lite");
  });

  it("drops to essential without WebGL, on tiny memory, reduced-motion, saveData or slow nets", () => {
    expect(detectTier({ ...DESKTOP_FULL, webgl2: false, webgl1: false })).toBe("essential");
    expect(detectTier({ ...DESKTOP_FULL, deviceMemoryGb: 1 })).toBe("essential");
    expect(detectTier({ ...DESKTOP_FULL, reducedMotion: true })).toBe("essential");
    expect(detectTier({ ...DESKTOP_FULL, saveData: true })).toBe("essential");
    expect(detectTier({ ...DESKTOP_FULL, effectiveType: "2g" })).toBe("essential");
    expect(detectTier({ ...DESKTOP_FULL, effectiveType: "slow-2g" })).toBe("essential");
  });

  it("sends old-OS in-app WebViews to essential, modern ones to their hardware tier", () => {
    const oldIg = { ...DESKTOP_FULL, inAppWebView: true, oldOs: true };
    expect(detectTier(oldIg)).toBe("essential");
    const modernIg = { ...DESKTOP_FULL, inAppWebView: true, oldOs: false };
    expect(detectTier(modernIg)).toBe("full");
  });

  it("detects in-app WebViews (the only allowed UA sniffing)", () => {
    expect(
      isInAppWebView(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0",
      ),
    ).toBe(true);
    expect(isInAppWebView("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Safari/537.36")).toBe(
      false,
    );
  });

  it("parses OS generations for the old-OS gate", () => {
    expect(parseOsGeneration("Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X)")).toEqual({
      os: "ios",
      major: 14,
    });
    expect(isOldOs("Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X)")).toBe(true);
    expect(isOldOs("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")).toBe(false);
    expect(isOldOs("Mozilla/5.0 (Linux; Android 9; Redmi 6A) AppleWebKit/537.36")).toBe(true);
    expect(isOldOs("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36")).toBe(false);
  });
});
