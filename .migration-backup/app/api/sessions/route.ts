import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { applyFocusStreak } from "@/server/streak-logic";
import { onFocusSessionRecorded } from "@/server/achievements";
import { ensureUserProfile } from "@/server/session";
import { sessionCreateSchema } from "@/lib/validators";

const MAX_SESSION_LIST_LIMIT = 20;
const DEFAULT_SESSION_LIST_LIMIT = 20;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit") ?? DEFAULT_SESSION_LIST_LIMIT);
  const take = Math.min(
    MAX_SESSION_LIST_LIMIT,
    Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_SESSION_LIST_LIMIT)
  );
  const cursor = searchParams.get("cursor");

  const rows = await prisma.focusSession.findMany({
    where: {
      userId: session.user.id,
      completedAt: { not: null },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const sessions = rows.slice(0, take);
  return NextResponse.json({
    sessions,
    nextCursor: rows.length > take ? rows[take].id : null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await ensureUserProfile(userId);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sessionCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const {
    mode,
    durationSec,
    completedAt,
    clientNonce,
    sessionId,
    focusScore,
    focusQuality,
    focusTimeline,
    stabilityRating,
    sessionInsights,
    taskId,
  } = parsed.data;
  const completed = new Date(completedAt);
  if (Number.isNaN(completed.getTime())) {
    return NextResponse.json({ error: "Invalid completedAt" }, { status: 422 });
  }

  let streakUpdated = false;

  if (sessionId) {
    const active = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: "active",
      },
    });
    if (!active) {
      const completedExisting = await prisma.focusSession.findFirst({
        where: {
          id: sessionId,
          userId,
          status: "completed",
        },
      });

      if (completedExisting) {
        return NextResponse.json({
          session: completedExisting,
          duplicate: true,
          streakUpdated: false,
        });
      }

      return NextResponse.json({ error: "Active session not found" }, { status: 404 });
    }

    const completedData = {
      status: "completed",
      mode,
      durationSec,
      activeSeconds: durationSec,
      completedAt: completed,
      focusScore: focusScore ?? null,
      focusQuality: focusQuality ?? null,
      focusTimeline: focusTimeline ? JSON.stringify(focusTimeline) : null,
      stabilityRating: stabilityRating ?? null,
      sessionInsights: sessionInsights ? JSON.stringify(sessionInsights) : null,
      taskId: taskId ?? null,
      timerStatus: "idle",
      secondsLeft: null,
    };

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.focusSession.update({
          where: { id: sessionId },
          data: completedData,
        });

        if (mode === "focus") {
          const streak = await tx.studyStreak.findUniqueOrThrow({
            where: { userId },
          });
          const next = applyFocusStreak({
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            totalStudyDays: streak.totalStudyDays,
            lastStudyDate: streak.lastStudyDate,
          });

          if (next.currentStreak > streak.currentStreak) {
            streakUpdated = true;
          }

          await tx.studyStreak.update({
            where: { userId },
            data: next,
          });

          const user = await tx.user.update({
            where: { id: userId },
            data: { xp: { increment: 10 } },
            select: { xp: true },
          });
          const level = Math.min(99, Math.floor(user.xp / 200) + 1);
          await tx.user.update({
            where: { id: userId },
            data: { level },
          });

          if (taskId) {
            await tx.task.updateMany({
              where: { id: taskId, userId },
              data: { completedPomodoros: { increment: 1 } },
            });
          }
        }

        return row;
      });

      if (mode === "focus") {
        const dayStart = new Date(completed);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

        const goals = await prisma.goal.findMany({
          where: {
            userId,
            goalDate: { gte: dayStart, lt: dayEnd },
          },
          take: 20,
        });
        for (const g of goals) {
          if (g.completedSessions < g.targetSessions) {
            await prisma.goal.update({
              where: { id: g.id },
              data: { completedSessions: { increment: 1 } },
            });
          }
        }

        await onFocusSessionRecorded(userId);
      }

      return NextResponse.json({ session: updated, streakUpdated });
    } catch (e) {
      console.error("[POST /api/sessions complete active]", e);
      return NextResponse.json({ error: "Could not save session" }, { status: 500 });
    }
  }

  const baseSessionData = {
    userId,
    mode,
    status: "completed",
    durationSec,
    activeSeconds: durationSec,
    completedAt: completed,
    clientNonce: clientNonce ?? null,
    taskId: taskId ?? null,
  };

  const extendedSessionData = {
    ...baseSessionData,
    focusScore: focusScore ?? null,
    focusQuality: focusQuality ?? null,
    focusTimeline: focusTimeline ? JSON.stringify(focusTimeline) : null,
    stabilityRating: stabilityRating ?? null,
    sessionInsights: sessionInsights ? JSON.stringify(sessionInsights) : null,
  };

  try {
    const created = await prisma.$transaction(async (tx) => {
      let row;
      try {
        row = await tx.focusSession.create({ data: extendedSessionData });
      } catch (createErr) {
        const msg =
          createErr instanceof Error ? createErr.message : String(createErr);
        if (
          createErr instanceof Error &&
          (createErr.name === "PrismaClientValidationError" ||
            msg.includes("Unknown argument"))
        ) {
          row = await tx.focusSession.create({ data: baseSessionData });
        } else {
          throw createErr;
        }
      }

      if (mode === "focus") {
        const streak = await tx.studyStreak.findUniqueOrThrow({
          where: { userId },
        });
        const next = applyFocusStreak({
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          totalStudyDays: streak.totalStudyDays,
          lastStudyDate: streak.lastStudyDate,
        });
        
        if (next.currentStreak > streak.currentStreak) {
          streakUpdated = true;
        }

        await tx.studyStreak.update({
          where: { userId },
          data: next,
        });

        const user = await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: 10 } },
          select: { xp: true },
        });
        const level = Math.min(99, Math.floor(user.xp / 200) + 1);
        await tx.user.update({
          where: { id: userId },
          data: { level },
        });

        if (taskId) {
          await tx.task.updateMany({
            where: { id: taskId, userId },
            data: { completedPomodoros: { increment: 1 } },
          });
        }
      }

      return row;
    });

    if (mode === "focus") {
      const dayStart = new Date(completed);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const goals = await prisma.goal.findMany({
        where: {
          userId,
          goalDate: { gte: dayStart, lt: dayEnd },
        },
        take: 20,
      });
      for (const g of goals) {
        if (g.completedSessions < g.targetSessions) {
          await prisma.goal.update({
            where: { id: g.id },
            data: { completedSessions: { increment: 1 } },
          });
        }
      }

      await onFocusSessionRecorded(userId);
    }

    return NextResponse.json({ session: created, streakUpdated });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as any).code === "P2002" && clientNonce) {
      // Unique constraint failed, handle race condition gracefully
      const existing = await prisma.focusSession.findUnique({
        where: { clientNonce: clientNonce as string },
      });
      if (existing) {
        if (existing.userId !== userId) {
          return NextResponse.json({ error: "Nonce conflict" }, { status: 409 });
        }
        return NextResponse.json({ session: existing, duplicate: true, streakUpdated: false });
      }
    }
    console.error("[POST /api/sessions]", e);
    return NextResponse.json({ error: "Could not save session" }, { status: 500 });
  }
}
