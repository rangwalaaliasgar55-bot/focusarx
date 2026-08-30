import { useEffect, useState } from "react";

const LS_KEY = "focusarx-accent";

/** Default brand violet — must match `--brand-500` in index.css. */
export const DEFAULT_ACCENT = "#8B5CF6";

export interface AccentPreset {
  id: string;
  label: string;
  color: string;
}

/** Curated presets, all tuned to grade well across dark and light surfaces. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "violet", label: "Violet", color: "#8B5CF6" },
  { id: "indigo", label: "Indigo", color: "#6366F1" },
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "sky", label: "Sky", color: "#0EA5E9" },
  { id: "teal", label: "Teal", color: "#14B8A6" },
  { id: "emerald", label: "Emerald", color: "#10B981" },
  { id: "amber", label: "Amber", color: "#F59E0B" },
  { id: "gold", label: "Gold", color: "#FFB800" },
  { id: "rose", label: "Rose", color: "#F43F5E" },
  { id: "crimson", label: "Crimson", color: "#EF4444" },
  { id: "pink", label: "Pink", color: "#EC4899" },
  { id: "fuchsia", label: "Fuchsia", color: "#D946EF" },
];

export interface AccentState {
  /** Preset id, or `"custom"` for a user-picked color. */
  id: string;
  /** The hex color currently driving the UI. */
  color: string;
  /** True once the user has explicitly chosen a color (overrides are live). */
  customized: boolean;
}

/* ── Color math ─────────────────────────────────────────────────────────── */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Accepts `#rgb`, `#rrggbb`, `rgb(…)`-style hex with or without `#`. Returns uppercase `#RRGGBB` or null. */
export function normalizeHex(input: string): string | null {
  const match = input.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const channel = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

const rgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

/* ── Tonal scale generation ─────────────────────────────────────────────── */

export type AccentScale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

/**
 * Build a full 50–900 tonal scale around the user's color. The chosen color is
 * always step 500; lighter/darker steps are interpolated toward white/black
 * with enforced minimum gaps so the ramp stays monotonic even for extreme
 * inputs, and saturation eases off toward the ends for a filmic grade.
 */
export function buildAccentScale(hex: string): AccentScale {
  const rgb = hexToRgb(hex);
  if (!rgb) return solidScale(DEFAULT_ACCENT);
  const { h, s, l } = rgbToHsl(rgb);

  const lighter = (t: number, gap: number, satMult: number) => {
    const toward = Math.max(l + (97 - l) * t, l);
    return hslToHex(h, s * satMult, Math.min(Math.max(toward, l + gap), 98));
  };
  const darker = (t: number, gap: number, satMult: number) => {
    const toward = l - (l - 8) * t;
    return hslToHex(h, s * satMult, Math.max(Math.min(toward, l - gap), 4));
  };

  return {
    50: lighter(0.93, 26, 0.6),
    100: lighter(0.84, 20, 0.72),
    200: lighter(0.7, 14, 0.82),
    300: lighter(0.52, 8, 0.92),
    400: lighter(0.3, 3, 1),
    500: normalizeHex(hex)!,
    600: darker(0.26, 4, 0.98),
    700: darker(0.46, 9, 0.9),
    800: darker(0.63, 15, 0.82),
    900: darker(0.79, 21, 0.74),
  };
}

function solidScale(hex: string): AccentScale {
  const color = normalizeHex(hex)!;
  return { 50: color, 100: color, 200: color, 300: color, 400: color, 500: color, 600: color, 700: color, 800: color, 900: color };
}

/* ── CSS variable overrides ─────────────────────────────────────────────── */

/**
 * Legacy alpha token suffixes that exist in index.css. Re-emitting them with
 * the accent's RGB channels makes every historical `var(--rgba-…)` reference
 * follow the user's color without touching hundreds of call sites.
 */
const LEGACY_RGBA_600: Array<[suffix: string, alpha: number]> = [
  ["0", 0], ["0_03", 0.03], ["0_04", 0.04], ["0_05", 0.05], ["0_06", 0.06],
  ["0_07", 0.07], ["0_08", 0.08], ["0_09", 0.09], ["0_1", 0.1], ["0_10", 0.1],
  ["0_12", 0.12], ["0_14", 0.14], ["0_15", 0.15], ["0_16", 0.16], ["0_18", 0.18],
  ["0_2", 0.2], ["0_20", 0.2], ["0_22", 0.22], ["0_25", 0.25], ["0_3", 0.3],
  ["0_30", 0.3], ["0_35", 0.35], ["0_38", 0.38], ["0_4", 0.4], ["0_45", 0.45],
  ["0_5", 0.5], ["0_55", 0.55], ["0_6", 0.6], ["0_7", 0.7], ["0_8", 0.8],
  ["_2", 0.2], ["_28", 0.28],
];
const LEGACY_RGBA_500: Array<[suffix: string, alpha: number]> = [
  ["0_08", 0.08], ["0_1", 0.1], ["0_2", 0.2], ["0_22", 0.22], ["0_25", 0.25],
  ["0_3", 0.3], ["0_35", 0.35], ["0_4", 0.4], ["0_45", 0.45], ["0_6", 0.6],
];
const LEGACY_RGBA_400: Array<[suffix: string, alpha: number]> = [
  ["0_07", 0.07], ["0_08", 0.08], ["0_1", 0.1], ["0_12", 0.12], ["0_15", 0.15],
  ["0_18", 0.18], ["0_2", 0.2], ["0_35", 0.35], ["0_4", 0.4], ["0_5", 0.5],
  ["0_6", 0.6], ["0_8", 0.8], ["_32", 0.32],
];

/**
 * Compute every CSS custom property the accent owns. Alpha grading is
 * mode-aware: light mode uses the softer values declared under `html.light`.
 */
export function buildAccentOverrides(hex: string, lightMode: boolean): Record<string, string> {
  const scale = buildAccentScale(hex);
  const c300 = scale[300];
  const c400 = scale[400];
  const c500 = scale[500];
  const c600 = scale[600];

  const overrides: Record<string, string> = {
    "--brand-50": scale[50],
    "--brand-100": scale[100],
    "--brand-200": scale[200],
    "--brand-300": scale[300],
    "--brand-400": scale[400],
    "--brand-500": scale[500],
    "--brand-600": scale[600],
    "--brand-700": scale[700],
    "--brand-800": scale[800],
    "--brand-900": scale[900],

    "--brand-violet": c500,
    "--brand-violet-light": c400,
    "--brand-violet-dim": rgba(c500, lightMode ? 0.08 : 0.15),
    "--brand-soft": rgba(c500, lightMode ? 0.09 : 0.14),
    "--brand-soft-hover": rgba(c500, lightMode ? 0.15 : 0.22),
    "--surface-active": rgba(c500, lightMode ? 0.09 : 0.14),

    "--ring": rgba(c500, lightMode ? 0.45 : 0.55),
    "--ring-focus": rgba(c500, lightMode ? 0.4 : 0.5),
    "--card-border": rgba(c500, lightMode ? 0.15 : 0.2),
    "--forge-border-bright": rgba(c600, lightMode ? 0.35 : 0.45),

    "--glow-violet": `0 0 20px ${rgba(c500, 0.4)}, 0 0 60px ${rgba(c500, 0.1)}`,
    "--shadow-violet-sm": `0 4px 16px ${rgba(c600, lightMode ? 0.14 : 0.2)}`,
    "--shadow-violet-md": `0 8px 32px ${rgba(c600, lightMode ? 0.18 : 0.25)}, 0 0 0 1px ${rgba(c600, lightMode ? 0.14 : 0.2)}`,
    "--shadow-violet-lg": `0 16px 48px ${rgba(c600, lightMode ? 0.22 : 0.3)}, 0 0 0 1px ${rgba(c600, lightMode ? 0.18 : 0.25)}`,
  };

  for (const [suffix, alpha] of LEGACY_RGBA_600) overrides[`--rgba-124-58-237-${suffix}`] = rgba(c600, alpha);
  for (const [suffix, alpha] of LEGACY_RGBA_500) overrides[`--rgba-139-92-246-${suffix}`] = rgba(c500, alpha);
  for (const [suffix, alpha] of LEGACY_RGBA_400) overrides[`--rgba-167-139-250-${suffix}`] = rgba(c400, alpha);

  return overrides;
}

/* ── Apply / persist ────────────────────────────────────────────────────── */

let appliedKeys: string[] = [];

function writeOverrides(overrides: Record<string, string>) {
  const root = document.documentElement;
  for (const key of appliedKeys) {
    if (!(key in overrides)) root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(overrides)) {
    root.style.setProperty(key, value);
  }
  appliedKeys = Object.keys(overrides);

  const themeColor = getComputedStyle(root).getPropertyValue("--brand-600").trim();
  if (themeColor) {
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }
}

function clearOverrides() {
  const root = document.documentElement;
  for (const key of appliedKeys) root.style.removeProperty(key);
  appliedKeys = [];
}

function isLightMode(): boolean {
  return document.documentElement.classList.contains("light");
}

/** Read the persisted choice; falls back to the un-customized default. */
export function getAccent(): AccentState {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored?.startsWith("custom:")) {
      const color = normalizeHex(stored.slice(7));
      if (color) return { id: "custom", color, customized: true };
    } else if (stored) {
      const preset = ACCENT_PRESETS.find((p) => p.id === stored);
      if (preset) return { id: preset.id, color: preset.color, customized: true };
    }
  } catch {
    // Storage unavailable (private mode / prerender) — run with defaults.
  }
  return { id: "violet", color: DEFAULT_ACCENT, customized: false };
}

function applyColor(color: string) {
  writeOverrides(buildAccentOverrides(color, isLightMode()));
}

/**
 * Re-apply the stored accent on top of whatever the active theme just set.
 * Called by `applyTheme` so an explicit user color always wins over theme
 * defaults, and at boot to restore the saved choice before first paint.
 */
export function reapplyAccentOverrides() {
  const { color, customized } = getAccent();
  if (customized) applyColor(color);
  else clearOverrides();
}

/** Persist + apply a color. Matching a preset stores the preset id. */
export function setAccentColor(hex: string) {
  const color = normalizeHex(hex);
  if (!color) return;
  const preset = ACCENT_PRESETS.find((p) => p.color.toUpperCase() === color);
  try {
    localStorage.setItem(LS_KEY, preset ? preset.id : `custom:${color}`);
  } catch {}
  applyColor(color);
  window.dispatchEvent(
    new CustomEvent("focusarx:accent", { detail: { id: preset?.id ?? "custom", color } }),
  );
}

/** Drop the stored choice and return to the built-in brand palette. */
export function resetAccent() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
  clearOverrides();
  window.dispatchEvent(
    new CustomEvent("focusarx:accent", { detail: { id: "violet", color: DEFAULT_ACCENT } }),
  );
}

/** Reactive hook mirroring `useTheme`. */
export function useAccent(): [AccentState, (hex: string) => void, () => void] {
  const [accent, setAccent] = useState<AccentState>(getAccent);

  useEffect(() => {
    const handler = () => setAccent(getAccent());
    window.addEventListener("focusarx:accent", handler);
    return () => window.removeEventListener("focusarx:accent", handler);
  }, []);

  return [accent, setAccentColor, resetAccent];
}
