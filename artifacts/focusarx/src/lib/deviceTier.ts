/**
 * Capability tiers (Phase 6.1).
 *
 * Feature-detected, never UA-sniffed — except to detect in-app WebViews,
 * which is explicitly allowed because those environments break install/push
 * prompts and old-OS WebViews break modern rendering.
 *
 * - TIER `full`:      WebGL2 && deviceMemory≥4 && hardwareConcurrency≥4 &&
 *                      !reduced-motion. R3F Focus Core, bloom, particles,
 *                      glass, springs, parallax.
 * - TIER `lite`:      everything in between. 2D <canvas> Core with identical
 *                      data mappings; solid surfaces; springs; no parallax.
 * - TIER `essential`:  no WebGL || deviceMemory<2 || reduced-motion ||
 *                      saveData || effectiveType∈{2g,slow-2g} || in-app
 *                      WebView on iOS<15/Android<10. CSS ring + opacity fades.
 *
 * Unknown `deviceMemory`/`hardwareConcurrency` (Firefox/Safari hide them)
 * count as meeting the bar — they cannot prove otherwise, and WebGL2 +
 * no-reduced-motion already selects capable machines.
 *
 * All three tiers render the same meaning: elapsed%, paused, complete,
 * streak count, weekly facets.
 */

export type DeviceTier = "full" | "lite" | "essential";
export type TierPreference = "auto" | DeviceTier;

export interface DeviceCaps {
  webgl2: boolean;
  webgl1: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  reducedMotion: boolean;
  saveData: boolean;
  effectiveType: string | null;
  inAppWebView: boolean;
  oldOs: boolean;
}

const TIER_KEY = "focusarx-visual-tier";
const TIER_REPORTED_KEY = "focusarx-tier-reported";

const IN_APP_UA = /instagram|fban|fbav|tiktok|musical\.ly|snapchat|micromessenger|line\/|twitterandroid|pinterest|linkedinapp|fb_iab/i;

export function isInAppWebView(ua: string): boolean {
  return IN_APP_UA.test(ua || "");
}

export interface OsGeneration {
  os: "ios" | "android" | "other";
  major: number | null;
}

/** Parse the OS generation from a UA string (best-effort, WebView gating only). */
export function parseOsGeneration(ua: string): OsGeneration {
  const s = ua || "";
  const ios = /OS (\d+)[_.](\d+)?/.exec(s);
  if (/iPhone|iPad|iPod/.test(s) && ios) {
    return { os: "ios", major: Number(ios[1]) };
  }
  const and = /Android (\d+)/.exec(s);
  if (and) return { os: "android", major: Number(and[1]) };
  return { os: "other", major: null };
}

export function isOldOs(ua: string): boolean {
  const { os, major } = parseOsGeneration(ua);
  if (major == null) return false;
  if (os === "ios") return major < 15;
  if (os === "android") return major < 10;
  return false;
}

/** Pure tier decision — fully unit-testable with injected capabilities. */
export function detectTier(caps: DeviceCaps): DeviceTier {
  if (
    (!caps.webgl1 && !caps.webgl2) ||
    (caps.deviceMemoryGb != null && caps.deviceMemoryGb < 2) ||
    caps.reducedMotion ||
    caps.saveData ||
    caps.effectiveType === "slow-2g" ||
    caps.effectiveType === "2g" ||
    (caps.inAppWebView && caps.oldOs)
  ) {
    return "essential";
  }
  if (
    caps.webgl2 &&
    !caps.reducedMotion &&
    (caps.deviceMemoryGb == null || caps.deviceMemoryGb >= 4) &&
    (caps.hardwareConcurrency == null || caps.hardwareConcurrency >= 4)
  ) {
    return "full";
  }
  return "lite";
}

function probeWebgl(): { webgl2: boolean; webgl1: boolean } {
  try {
    const canvas = document.createElement("canvas");
    const webgl2 = Boolean(canvas.getContext("webgl2"));
    const webgl1 =
      webgl2 || Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    return { webgl2, webgl1 };
  } catch {
    return { webgl2: false, webgl1: false };
  }
}

/** Read live capabilities from the browser. Never throws. */
export function probeDeviceCaps(): DeviceCaps {
  try {
    const { webgl2, webgl1 } = probeWebgl();
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const ua = nav.userAgent || "";
    return {
      webgl2,
      webgl1,
      deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
      hardwareConcurrency:
        typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      reducedMotion:
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: nav.connection?.saveData === true,
      effectiveType: nav.connection?.effectiveType ?? null,
      inAppWebView: isInAppWebView(ua),
      oldOs: isOldOs(ua),
    };
  } catch {
    return {
      webgl2: false,
      webgl1: false,
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      reducedMotion: false,
      saveData: false,
      effectiveType: null,
      inAppWebView: false,
      oldOs: false,
    };
  }
}

export function getTierPreference(): TierPreference {
  try {
    const stored = window.localStorage.getItem(TIER_KEY) as TierPreference | null;
    if (stored === "auto" || stored === "full" || stored === "lite" || stored === "essential") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "auto";
}

export function setTierPreference(pref: TierPreference): void {
  try {
    window.localStorage.setItem(TIER_KEY, pref);
    window.sessionStorage.removeItem(TIER_REPORTED_KEY);
  } catch {
    /* ignore */
  }
}

let cachedTier: DeviceTier | null = null;

/** Effective tier: manual override wins, otherwise auto-detect (cached per load). */
export function getDeviceTier(): DeviceTier {
  const pref = getTierPreference();
  if (pref !== "auto") return pref;
  if (!cachedTier) cachedTier = detectTier(probeDeviceCaps());
  return cachedTier;
}

/** True when the tier report for this tab session was already sent. */
export function markTierReported(): boolean {
  try {
    if (window.sessionStorage.getItem(TIER_REPORTED_KEY) === "1") return true;
    window.sessionStorage.setItem(TIER_REPORTED_KEY, "1");
    return false;
  } catch {
    return true;
  }
}
