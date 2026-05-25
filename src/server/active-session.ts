import { prisma } from "@/server/db";
import type { FocusTimelinePoint } from "@/types/focus";

export type ActiveSessionRow = {
  id: string;
  mode: string;
  status: string;
  activeSeconds: number;
  secondsLeft: number | null;
  timerStatus: string | null;
  startedAt: Date;
  focusScore: number | null;
  focusQuality: string | null;
  focusState: string | null;
  distractionCount: number;
  lastSeenFaceAt: Date | null;
  focusTimeline: string | null;
  stabilityRating: string | null;
  sessionInsights: string | null;
  monitorEnabled: boolean;
  durationSec: number;
  taskId: string | null;
};

const activeSelect = {
  id: true,
  mode: true,
  status: true,
  activeSeconds: true,
  secondsLeft: true,
  timerStatus: true,
  startedAt: true,
  focusScore: true,
  focusQuality: true,
  focusState: true,
  distractionCount: true,
  lastSeenFaceAt: true,
  focusTimeline: true,
  stabilityRating: true,
  sessionInsights: true,
  monitorEnabled: true,
  durationSec: true,
  taskId: true,
} as const;

export function parseFocusTimelineJson(raw: string | null): FocusTimelinePoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is FocusTimelinePoint =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as FocusTimelinePoint).t === "number" &&
        ((p as FocusTimelinePoint).state === "focus" ||
          (p as FocusTimelinePoint).state === "distracted")
    );
  } catch {
    return [];
  }
}

export async function findActiveFocusSession(
  userId: string
): Promise<ActiveSessionRow | null> {
  return prisma.focusSession.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
    select: activeSelect,
  });
}

export async function ensureActiveFocusSession(
  userId: string,
  data: {
    mode: string;
    secondsLeft: number;
    timerStatus: string;
    monitorEnabled?: boolean;
  }
): Promise<ActiveSessionRow> {
  const existing = await findActiveFocusSession(userId);
  if (existing) return existing;

  return prisma.focusSession.create({
    data: {
      userId,
      mode: data.mode,
      status: "active",
      durationSec: 0,
      activeSeconds: 0,
      secondsLeft: data.secondsLeft,
      timerStatus: data.timerStatus,
      monitorEnabled: data.monitorEnabled ?? false,
      completedAt: null,
    },
    select: activeSelect,
  });
}

export function serializeActiveSession(row: ActiveSessionRow) {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    activeSeconds: row.activeSeconds,
    secondsLeft: row.secondsLeft,
    timerStatus: row.timerStatus,
    startedAt: row.startedAt.toISOString(),
    focusScore: row.focusScore,
    focusQuality: row.focusQuality,
    focusState: row.focusState,
    distractionCount: row.distractionCount,
    lastSeenFaceAt: row.lastSeenFaceAt?.toISOString() ?? null,
    focusTimeline: parseFocusTimelineJson(row.focusTimeline),
    stabilityRating: row.stabilityRating,
    insights: row.sessionInsights
      ? (() => {
          try {
            return JSON.parse(row.sessionInsights) as unknown;
          } catch {
            return null;
          }
        })()
      : null,
    monitorEnabled: row.monitorEnabled,
    durationSec: row.durationSec,
    taskId: row.taskId,
  };
}
