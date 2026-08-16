export type TimerMode = "focus" | "break" | "longBreak";

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerConfig {
  focusDuration: number;   // in seconds
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

import type { FocusQuality, FocusTimelinePoint, SessionInsights } from "./focus";

export interface Session {
  id: string;
  mode: TimerMode;
  completedAt: string; // ISO string
  durationSeconds: number;
  focusScore?: number | null;
  focusQuality?: FocusQuality | null;
  focusTimeline?: FocusTimelinePoint[] | null;
  stabilityRating?: string | null;
  sessionInsights?: SessionInsights | null;
  taskId?: string;
}

export interface Task {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: string;
  priority?: "low" | "medium" | "high";
  category?: string;
}
