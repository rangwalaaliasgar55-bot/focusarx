/**
 * Session-mode presets (Phase 9.1).
 *
 * Named duration recipes applied through the existing custom-duration path
 * (no engine change): Pomodoro 25/5, Extended 50/10, Deep Work 90/15,
 * Animedoro 40/10, plus free Custom and the Flowtime stopwatch.
 * The choice is remembered across visits (chosen once, kept).
 */

export interface SessionPreset {
  id: string;
  label: string;
  blurb: string;
  focusMin: number | null;
  breakMin: number | null;
  longBreakMin: number | null;
  /** Renders the Flowtime stopwatch instead of the countdown. */
  flow?: boolean;
}

export const SESSION_PRESETS: SessionPreset[] = [
  { id: "pomodoro", label: "Pomodoro", blurb: "25 focus, 5 rest.", focusMin: 25, breakMin: 5, longBreakMin: 15 },
  { id: "extended", label: "Extended", blurb: "50 focus, 10 rest.", focusMin: 50, breakMin: 10, longBreakMin: 20 },
  { id: "deep", label: "Deep Work", blurb: "90-minute block, 15 rest.", focusMin: 90, breakMin: 15, longBreakMin: 30 },
  { id: "animedoro", label: "Animedoro", blurb: "40 focus, 10 rest.", focusMin: 40, breakMin: 10, longBreakMin: 20 },
  { id: "flow", label: "Flowtime", blurb: "Stopwatch. Break suggested.", focusMin: null, breakMin: null, longBreakMin: null, flow: true },
  { id: "custom", label: "Custom", blurb: "Your own durations.", focusMin: null, breakMin: null, longBreakMin: null },
];

const PRESET_KEY = "focusarx-session-preset";

export function getSessionPreset(): string {
  try {
    const stored = window.localStorage.getItem(PRESET_KEY);
    if (stored && SESSION_PRESETS.some((p) => p.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return "pomodoro";
}

export function setSessionPreset(id: string): void {
  try {
    if (SESSION_PRESETS.some((p) => p.id === id)) window.localStorage.setItem(PRESET_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getPresetById(id: string): SessionPreset {
  return SESSION_PRESETS.find((p) => p.id === id) ?? SESSION_PRESETS[0]!;
}

/** Suggested break after a Flowtime run: ~5 min per 25 worked, capped at 30. */
export function flowSuggestedBreakMin(workedMin: number): number {
  if (!Number.isFinite(workedMin) || workedMin <= 0) return 5;
  return Math.min(30, Math.max(5, Math.round((workedMin / 25) * 5)));
}
