import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureUserProfile } from "@/server/session";

function dayKeyUtc(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  await ensureUserProfile(userId);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.focusSession.findMany({
    where: { userId, completedAt: { gte: since, not: null } },
    select: { mode: true, durationSec: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 500,
  });

  const focusRows = rows.filter((r) => r.mode === "focus");
  const breakRows = rows.filter((r) => r.mode !== "focus");

  const totalFocusSeconds = focusRows.reduce((a, r) => a + r.durationSec, 0);
  const totalBreakSeconds = breakRows.reduce((a, r) => a + r.durationSec, 0);

  const perDay: Record<string, { focus: number; breaks: number }> = {};
  for (const r of rows) {
    if (!r.completedAt) continue;
    const k = dayKeyUtc(r.completedAt);
    if (!perDay[k]) perDay[k] = { focus: 0, breaks: 0 };
    if (r.mode === "focus") perDay[k].focus += 1;
    else perDay[k].breaks += 1;
  }

  const streak = await prisma.studyStreak.findUniqueOrThrow({
    where: { userId },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekGoals = await prisma.goal.findMany({
    where: { userId, goalDate: { gte: weekStart } },
    take: 20,
  });
  const goalsDone = weekGoals.filter(
    (g) => g.completedSessions >= g.targetSessions
  ).length;
  const goalCompletionRate =
    weekGoals.length === 0 ? 0 : goalsDone / weekGoals.length;

  return NextResponse.json({
    totals: {
      totalFocusSeconds,
      totalBreakSeconds,
      focusSessionCount: focusRows.length,
      breakSessionCount: breakRows.length,
    },
    streak,
    gamification: { xp: user.xp, level: user.level },
    sessionsPerDay: perDay,
    goalCompletionRate,
    weeklyProductivityTrend: Object.entries(perDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, focus: v.focus, breaks: v.breaks })),
  });
}
