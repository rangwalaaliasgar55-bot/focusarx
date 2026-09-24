/**
 * Timer face designs (purely cosmetic, client-side, remembered).
 *
 * Six faces for the countdown timer, in two families: the three ring faces
 * (`classic` / `neon` / `zen`) describe progress on the same dial, `flip` and the
 * two geometry faces (`segments` / `bars`) are different *layouts* — they change
 * what the picture means, not only how it is coloured. Every face carries a
 * `blurb` written to be read: the picker shows the selected face's blurb under
 * the row, so "how does this one work" is answerable in the interface instead of
 * being left to a tooltip.
 *
 * Paid membership skins (plus/pro/elite in membershipSkin) dress the ring, so a
 * skin wins over the ring faces; the layout faces render their own geometry and
 * take the skin's colour as their accent.
 */

export type TimerTheme = "classic" | "neon" | "zen" | "flip" | "segments" | "bars" | "dots" | "rounds";

export interface TimerThemeDef {
  id: TimerTheme;
  label: string;
  blurb: string;
}

export const TIMER_THEMES: TimerThemeDef[] = [
  { id: "classic", label: "Classic", blurb: "The original ring — solid, calm, focused." },
  { id: "neon", label: "Neon", blurb: "Gradient ring with a brighter halo." },
  { id: "zen", label: "Zen", blurb: "Thin line, barely any glow. Nothing but the time." },
  { id: "flip", label: "Flip Clock", blurb: "Retro mechanical split-flap clock: each digit that changes physically rolls over." },
  // Both of these are geometry, not skin (components/timerfaces/TimerFaces.tsx):
  // the layout itself carries the information, which is why they work as layouts
  // rather than as another colour of ring.
  { id: "segments", label: "Segments", blurb: "60 segments, one per minute. A segment goes out each minute, so the dial is a count you can read at a glance." },
  { id: "bars", label: "Minute bars", blurb: "One bar per minute of the session. The bar currently draining shrinks in real time; finished minutes collapse flat." },
  { id: "dots", label: "Block grid", blurb: "Five-minute blocks as dots, five to a row. A dot is printed only while that block is still ahead — a two-hour session is 24 dots you can count without reading the clock." },
  { id: "rounds", label: "Pomodoro rounds", blurb: "The session counted in 25-minute rounds: finished rounds fill in, the round you are in closes like a gauge. Fewer units to face than a number going down." },
];

const THEME_KEY = "focusarx-timer-theme";

export function getStoredTimerTheme(): TimerTheme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    // Validated against the registry rather than a hand-written list: adding a
    // face above must not leave a stored choice silently reverting to Classic.
    if (stored && TIMER_THEMES.some((t) => t.id === stored)) return stored as TimerTheme;
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
