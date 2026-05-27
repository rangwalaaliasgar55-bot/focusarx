import { z } from "zod";

const focusTimelineSchema = z.array(
  z.object({
    t: z.number().min(0),
    state: z.enum(["focus", "distracted"]),
  })
);

const sessionInsightsSchema = z.object({
  summary: z.string().max(2000),
  bestFocusPeriod: z.string().max(500),
  worstDistractionPeriod: z.string().max(500),
  totalInterruptions: z.number().int().min(0),
  stabilityRating: z.enum([
    "High Stability",
    "Medium Stability",
    "Low Stability",
  ]),
});

export const sessionCreateSchema = z.object({
  mode: z.enum(["focus", "break", "longBreak"]),
  durationSec: z.number().int().positive(),
  completedAt: z.string().min(4),
  clientNonce: z.string().min(6).max(120).optional(),
  sessionId: z.string().min(1).max(64).optional(),
  focusScore: z.number().int().min(0).max(100).optional().nullable(),
  focusQuality: z.enum(["high", "medium", "low"]).optional().nullable(),
  focusTimeline: focusTimelineSchema.optional().nullable(),
  stabilityRating: z.string().max(64).optional().nullable(),
  sessionInsights: sessionInsightsSchema.optional().nullable(),
  taskId: z.string().optional(),
});

export const sessionActiveCreateSchema = z.object({
  mode: z.enum(["focus", "break", "longBreak"]),
  secondsLeft: z.number().int().min(0).max(86400),
  timerStatus: z.enum(["idle", "running", "paused"]),
  monitorEnabled: z.boolean().optional(),
});

export const sessionSyncSchema = z.object({
  sessionId: z.string().min(1).max(64),
  activeSeconds: z.number().int().min(0).max(86400),
  secondsLeft: z.number().int().min(0).max(86400).optional(),
  timerStatus: z.enum(["idle", "running", "paused"]).optional(),
  mode: z.enum(["focus", "break", "longBreak"]).optional(),
  focusScore: z.number().int().min(0).max(100).optional().nullable(),
  focusQuality: z.enum(["high", "medium", "low"]).optional().nullable(),
  focusState: z.enum(["focus", "distracted", "unknown"]).optional().nullable(),
  distractionCount: z.number().int().min(0).max(9999).optional(),
  lastSeenFaceAt: z.string().optional().nullable(),
  focusTimeline: focusTimelineSchema.optional(),
  monitorEnabled: z.boolean().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(500),
  completed: z.boolean().optional(),
  estimatedPomodoros: z.number().int().min(1).max(99).optional(),
});

export const taskPatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  estimatedPomodoros: z.number().int().min(1).max(99).optional(),
  completedPomodoros: z.number().int().min(0).max(9999).optional(),
});

export const goalCreateSchema = z.object({
  title: z.string().min(1).max(200),
  targetSessions: z.number().int().min(1).max(50),
  goalDate: z.string().min(4),
});

export const goalPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  targetSessions: z.number().int().min(1).max(50).optional(),
  completedSessions: z.number().int().min(0).max(999).optional(),
});

export const streakPostSchema = z.object({
  /** Manual sync / repair — reserved for admin tools */
  action: z.enum(["sync"]).optional(),
});

export const aiCoachSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  context: z.string().max(4000).optional(),
});

export const aiRoadmapSchema = z.object({
  goal: z.string().min(3).max(500),
  dailyHours: z.coerce.number().min(0.25).max(16),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  deadline: z.string().max(80).optional(),
  currentProgress: z.string().max(2000).optional(),
});
