import type { TimerConfig } from "@/types/timer";

export const STORAGE_KEYS = {
  sessions: "focusarx-sessions",
  tasks: "focusarx-tasks",
  guestKey: "focusarx-guest-token",
} as const;

/** Default Pomodoro lengths in seconds */
export const DEFAULT_CONFIG: TimerConfig = {
  focusDuration: 25 * 60,
  breakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsBeforeLongBreak: 4,
};
