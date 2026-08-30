import { useState, useEffect } from "react";
import { reapplyAccentOverrides } from "./accent";

const LS_KEY = "focusarx-theme";

export type Theme = "dark" | "light" | "midnight-gold" | "aurora" | "crimson";

/** Premium themes that require an active subscription. */
export const PREMIUM_THEMES: Set<Theme> = new Set(["midnight-gold", "aurora", "crimson"]);

/** Metadata for displaying themes in a picker. */
export const THEME_META: Record<Theme, { label: string; preview: string; premium: boolean }> = {
  dark:           { label: "Midnight",     preview: "bg-zinc-900",  premium: false },
  light:          { label: "Daylight",     preview: "bg-zinc-100",  premium: false },
  "midnight-gold":{ label: "Midnight Gold", preview: "bg-amber-950", premium: true },
  aurora:         { label: "Aurora",        preview: "bg-teal-950",  premium: true },
  crimson:        { label: "Crimson",       preview: "bg-red-950",   premium: true },
};

/**
 * CSS variable overrides applied when a premium theme is active.
 * These sit on top of the existing dark-mode base variables.
 */
const PREMIUM_OVERRIDES: Record<string, Record<string, string>> = {
  "midnight-gold": {
    "--brand-400": "#f59e0b",
    "--brand-500": "#d97706",
    "--brand-600": "#b45309",
    "--brand-soft-hover": "rgba(245,158,11,0.12)",
    "--brand-gold": "#fbbf24",
  },
  aurora: {
    "--brand-400": "#2dd4bf",
    "--brand-500": "#14b8a6",
    "--brand-600": "#0d9488",
    "--brand-soft-hover": "rgba(45,212,191,0.12)",
  },
  crimson: {
    "--brand-400": "#f87171",
    "--brand-500": "#ef4444",
    "--brand-600": "#dc2626",
    "--brand-soft-hover": "rgba(248,113,113,0.12)",
  },
};

let _premiumCheck: (() => Promise<boolean>) | null = null;

/** Register a function that resolves premium status (called once at app init). */
export function registerPremiumChecker(check: () => Promise<boolean>) {
  _premiumCheck = check;
}

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(LS_KEY) as Theme | null;
    if (stored && (THEME_META as any)[stored]) return stored;
    // Default to dark theme for better focus experience
    return "dark";
  } catch {}
  return "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Clear any previously applied premium theme data attribute
  root.removeAttribute("data-premium-theme");

  if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }

  // Apply premium CSS variable overrides
  if (PREMIUM_OVERRIDES[theme]) {
    root.setAttribute("data-premium-theme", theme);
    for (const [prop, val] of Object.entries(PREMIUM_OVERRIDES[theme])) {
      root.style.setProperty(prop, val);
    }
  } else {
    // Reset inline styles set by a premium theme
    for (const vars of Object.values(PREMIUM_OVERRIDES)) {
      for (const prop of Object.keys(vars)) {
        root.style.removeProperty(prop);
      }
    }
  }

  // A user-picked accent outranks theme-provided brand colors. Re-assert it
  // after the overrides above so the final --brand-* values win.
  reapplyAccentOverrides();

  const themeColor = getComputedStyle(root).getPropertyValue("--brand-600").trim();
  if (themeColor) {
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", themeColor);
    document.querySelector<HTMLMetaElement>('meta[name="msapplication-TileColor"]')?.setAttribute("content", themeColor);
  }
}

export async function setTheme(theme: Theme): Promise<boolean> {
  if (PREMIUM_THEMES.has(theme) && _premiumCheck) {
    const isPremium = await _premiumCheck();
    if (!isPremium) return false; // caller should show an upsell
  }
  try { localStorage.setItem(LS_KEY, theme); } catch {}
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("focusarx:theme", { detail: theme }));
  return true;
}

export function useTheme(): [Theme, (t: Theme) => Promise<boolean>] {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setThemeState((e as CustomEvent<Theme>).detail);
    };
    window.addEventListener("focusarx:theme", handler);
    return () => window.removeEventListener("focusarx:theme", handler);
  }, []);

  const update = async (t: Theme): Promise<boolean> => {
    const ok = await setTheme(t);
    if (ok) setThemeState(t);
    return ok;
  };

  return [theme, update];
}
