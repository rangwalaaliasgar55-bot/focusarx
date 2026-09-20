/**
 * Timer face designs (purely cosmetic, client-side, remembered).
 *
 * Four faces for the countdown timer. They apply to the free experience
 * only by design: paid membership skins (plus/pro/elite in membershipSkin)
 * already restyle the ring as part of their value, so when a skin is active
 * it wins and these themes stand down rather than fighting it.
 */

export type TimerTheme = "classic" | "neon" | "zen" | "flip";

export interface TimerThemeDef {
  id: TimerTheme;
  label: string;
  blurb: string;
}

export const TIMER_THEMES: TimerThemeDef[] = [
  { id: "classic", label: "Classic", blurb: "The original ring — solid, calm, focused." },
  { id: "neon", label: "Neon", blurb: "Gradient ring with a brighter halo." },
  { id: "zen", label: "Zen", blurb: "Thin line, barely any glow. Nothing but the time." },
  { id: "flip", label: "Flip Clock", blurb: "Retro mechanical split-flap clock with tactile animations." },
];

const THEME_KEY = "focusarx-timer-theme";

export function getStoredTimerTheme(): TimerTheme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "classic" || stored === "neon" || stored === "zen" || stored === "flip") return stored;
  } catch {
    /* storage unavailable — fall through */
  }
  return "classic";
}

export function setStoredTimerTheme(theme: TimerTheme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore — the choice just won't survive reload */
  }
}
