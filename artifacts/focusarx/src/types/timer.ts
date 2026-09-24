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
  /** A Flowtime exit is a real partial completion, not a discarded reset. */
  completedEarly?: boolean;
  plannedDurationSec?: number | null;
  completionPercentage?: number | null;
}

export interface Task {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: string;
  priority?: "low" | "medium" | "high" | "urgent";
  category?: string;
  /** Server-backed planning metadata, optional for offline/legacy task drafts. */
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  tags?: string[];
}
