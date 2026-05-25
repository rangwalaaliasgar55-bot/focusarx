import { prisma } from "@/server/db";
import { isSchemaMismatchError } from "@/server/prisma-errors";

const ADMIN_SESSION_LIMIT = 100;

export type AdminSessionView = {
  id: string;
  mode: string;
  status: string;
  durationSec: number;
  activeSeconds: number;
  completedAt: Date | null;
  startedAt: Date;
  focusScore: number | null;
  focusState: string | null;
  focusTimeline: string | null;
  sessionInsights: string | null;
  focusQuality: string | null;
  stabilityRating: string | null;
  secondsLeft: number | null;
  timerStatus: string | null;
  distractionCount: number;
  lastSeenFaceAt: Date | null;
  monitorEnabled: boolean;
  clientNonce: string | null;
  taskId: string | null;
  userId: string;
};

export function inferSessionStatus(row: {
  status?: string | null;
  completedAt?: Date | null;
}): string {
  if (row.status) return row.status;
  return row.completedAt == null ? "active" : "completed";
}

function normalizeSession(
  row: Record<string, unknown> & { id: string; mode: string; durationSec: number }
): AdminSessionView {
  const completedAt = (row.completedAt as Date | null) ?? null;
  return {
    id: row.id,
    userId: (row.userId as string) ?? "",
    mode: row.mode,
    status: inferSessionStatus({
      status: row.status as string | undefined,
      completedAt,
    }),
    durationSec: row.durationSec,
    activeSeconds: (row.activeSeconds as number) ?? row.durationSec,
    completedAt,
    startedAt:
      (row.startedAt as Date) ?? completedAt ?? new Date(0),
    focusScore: (row.focusScore as number | null) ?? null,
    focusState: (row.focusState as string | null) ?? null,
    focusTimeline: (row.focusTimeline as string | null) ?? null,
    sessionInsights: (row.sessionInsights as string | null) ?? null,
    focusQuality: (row.focusQuality as string | null) ?? null,
    stabilityRating: (row.stabilityRating as string | null) ?? null,
    secondsLeft: (row.secondsLeft as number | null) ?? null,
    timerStatus: (row.timerStatus as string | null) ?? null,
    distractionCount: (row.distractionCount as number) ?? 0,
    lastSeenFaceAt: (row.lastSeenFaceAt as Date | null) ?? null,
    monitorEnabled: Boolean(row.monitorEnabled),
    clientNonce: (row.clientNonce as string | null) ?? null,
    taskId: (row.taskId as string | null) ?? null,
  };
}

const sessionSelectTiers = [
  {
    id: true,
    userId: true,
    mode: true,
    durationSec: true,
    completedAt: true,
    startedAt: true,
    status: true,
    activeSeconds: true,
    focusScore: true,
    focusState: true,
    focusTimeline: true,
    sessionInsights: true,
    focusQuality: true,
    stabilityRating: true,
    secondsLeft: true,
    timerStatus: true,
    distractionCount: true,
    lastSeenFaceAt: true,
    monitorEnabled: true,
    clientNonce: true,
    taskId: true,
  },
  {
    id: true,
    userId: true,
    mode: true,
    durationSec: true,
    completedAt: true,
    focusScore: true,
    focusQuality: true,
    focusTimeline: true,
    sessionInsights: true,
    stabilityRating: true,
    taskId: true,
    clientNonce: true,
  },
  {
    id: true,
    userId: true,
    mode: true,
    durationSec: true,
    completedAt: true,
    focusScore: true,
    taskId: true,
  },
] as const;

async function findSessionsWithTieredSelect(
  where: { userId?: string; id?: string },
  orderBy?: { completedAt: "desc" } | { startedAt: "desc" }
) {
  let lastErr: unknown;
  for (const select of sessionSelectTiers) {
    try {
      if (where.id) {
        const row = await prisma.focusSession.findUnique({ where: { id: where.id }, select });
        return row ? [normalizeSession(row as Record<string, unknown> & { id: string; mode: string; durationSec: number })] : [];
      }
      const rows = await prisma.focusSession.findMany({
        where: { userId: where.userId },
        orderBy: orderBy ?? { completedAt: "desc" },
        select,
        take: ADMIN_SESSION_LIMIT,
      });
      return rows.map((r) =>
        normalizeSession(r as Record<string, unknown> & { id: string; mode: string; durationSec: number })
      );
    } catch (err) {
      lastErr = err;
      if (!isSchemaMismatchError(err)) throw err;
    }
  }
  throw lastErr;
}

export async function countActiveSessions(): Promise<number> {
  try {
    return await prisma.focusSession.count({ where: { status: "active" } });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
  }
  try {
    return await prisma.focusSession.count({ where: { completedAt: null } });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return 0;
  }
}

export async function listUserSessionsForAdmin(
  userId: string
): Promise<AdminSessionView[]> {
  try {
    const rows = await prisma.focusSession.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      take: ADMIN_SESSION_LIMIT,
    });
    return rows.map((r) => normalizeSession(r as unknown as Record<string, unknown> & { id: string; mode: string; durationSec: number }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
  }
  return findSessionsWithTieredSelect({ userId }, { completedAt: "desc" });
}

export async function getSessionForAdmin(
  sessionId: string
): Promise<
  | (AdminSessionView & {
      user: { id: string; email: string; name: string | null; isGuest: boolean };
    })
  | null
> {
  try {
    const row = await prisma.focusSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { id: true, email: true, name: true, isGuest: true },
        },
      },
    });
    if (!row) return null;
    const { user, ...session } = row;
    return {
      ...normalizeSession(session as unknown as Record<string, unknown> & { id: string; mode: string; durationSec: number }),
      user,
    };
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
  }

  const user = await prisma.user.findFirst({
    where: {
      focusSessions: { some: { id: sessionId } },
    },
    select: { id: true, email: true, name: true, isGuest: true },
  });
  if (!user) return null;

  const sessions = await findSessionsWithTieredSelect({ id: sessionId });
  const session = sessions[0];
  if (!session) return null;

  return { ...session, user };
}
