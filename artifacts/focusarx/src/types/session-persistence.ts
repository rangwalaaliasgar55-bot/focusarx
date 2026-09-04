import type { FocusTimelinePoint } from "./focus";
import type { TimerMode, TimerStatus } from "./timer";

export type PersistedActiveSession = {
  id: string;
  mode: TimerMode;
  status: "active";
  activeSeconds: number;
  secondsLeft: number | null;
  timerStatus: TimerStatus | null;
  startedAt: string;
  focusScore: number | null;
  focusQuality: string | null;
  focusState: string | null;
  distractionCount: number;
  lastSeenFaceAt: string | null;
  focusTimeline: FocusTimelinePoint[];
  stabilityRating: string | null;
  insights: unknown;
  monitorEnabled: boolean;
  durationSec: number;
  taskId: string | null;
};

export type SessionSyncPayload = {
  sessionId: string;
  activeSeconds: number;
  secondsLeft?: number;
  timerStatus?: TimerStatus;
  mode?: TimerMode;
  focusScore?: number | null;
  focusQuality?: string | null;
  focusState?: "focus" | "distracted" | "unknown" | null;
  distractionCount?: number;
  lastSeenFaceAt?: string | null;
  focusTimeline?: FocusTimelinePoint[];
  monitorEnabled?: boolean;
  timezone?: string;
};
