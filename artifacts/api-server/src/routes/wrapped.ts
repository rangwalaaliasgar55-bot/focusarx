import { Router } from "express";
import { db, focusSessionsTable, tasksTable, userWalletsTable, studyStreaksTable, wrappedSnapshotsTable, userBadgesTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { sendUnauthorized(res); return; }
  req.userId = userId;
  next();
}

function getDateRange(period: string, periodType: string) {
  if (periodType === "monthly") {
    const [year, month] = period.split("-").map(Number);
    const start = new Date(year!, month! - 1, 1);
    const end = new Date(year!, month!, 0, 23, 59, 59);
    return { start, end };
  } else {
    const year = Number(period);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    return { start, end };
  }
}

router.get("/wrapped/:period", authMiddleware, async (req: any, res) => {
  const { period } = req.params as { period: string };
  const periodType = period.includes("-") ? "monthly" : "yearly";

  try {
    // Check if cached snapshot exists
    const [cached] = await db.select().from(wrappedSnapshotsTable)
      .where(and(eq(wrappedSnapshotsTable.userId, req.userId), eq(wrappedSnapshotsTable.period, period)));
    if (cached) { res.json({ wrapped: cached.data, cached: true }); return; }

    const { start, end } = getDateRange(period, periodType);

    // Fetch all sessions in period
    const sessions = await db.select().from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.userId, req.userId),
        gte(focusSessionsTable.completedAt, start),
        lte(focusSessionsTable.completedAt, end),
        eq(focusSessionsTable.mode, "focus"),
      ));

    const totalMinutes = sessions.reduce((s, sess) => s + Math.floor(sess.durationSec / 60), 0);
    const totalSessions = sessions.length;

    if (totalSessions === 0) {
      res.json({ wrapped: null, message: "No sessions in this period" });
      return;
    }

    // Best study day
    const byDay: Record<string, { minutes: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const day = s.completedAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { minutes: 0, sessions: 0 };
      byDay[day]!.minutes += Math.floor(s.durationSec / 60);
      byDay[day]!.sessions += 1;
    }
    const bestDay = Object.entries(byDay).sort((a, b) => b[1].minutes - a[1].minutes)[0];

    // Best hour
    const byHour: Record<number, number> = {};
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const hour = s.completedAt.getHours();
      byHour[hour] = (byHour[hour] ?? 0) + 1;
    }
    const bestHour = Object.entries(byHour).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Avg focus score
    const scored = sessions.filter(s => s.focusScore != null);
    const avgFocusScore = scored.length > 0 ? Math.round(scored.reduce((s, sess) => s + (sess.focusScore ?? 0), 0) / scored.length) : null;

    // Tasks completed
    const tasks = await db.select().from(tasksTable)
      .where(and(
        eq(tasksTable.userId, req.userId),
        eq(tasksTable.completed, true),
        gte(tasksTable.completedAt, start),
        lte(tasksTable.completedAt, end),
      ));
    const tasksCompleted = tasks.length;

    // XP gained (rough estimate based on sessions)
    const xpGained = totalMinutes * 20;

    // Wallet data for level
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));

    // Streak data
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));

    // Badges unlocked in period
    const badges = await db.select().from(userBadgesTable)
      .where(and(
        eq(userBadgesTable.userId, req.userId),
        gte(userBadgesTable.unlockedAt, start),
        lte(userBadgesTable.unlockedAt, end),
      ));

    // Generate title based on stats
    let title = "The Scholar's Journey";
    if (totalMinutes >= 3000) title = "The Knowledge Titan";
    else if (totalMinutes >= 1500) title = "The Dedicated Learner";
    else if (totalMinutes >= 600) title = "The Rising Scholar";
    else if (totalSessions >= 30) title = "The Consistent Achiever";

    const wrappedData = {
      period, periodType, title,
      totalHours: Math.floor(totalMinutes / 60),
      totalMinutes,
      totalSessions,
      tasksCompleted,
      xpGained,
      avgFocusScore,
      bestDay: bestDay ? { date: bestDay[0], minutes: bestDay[1].minutes, sessions: bestDay[1].sessions } : null,
      bestHour: bestHour ? { hour: Number(bestHour[0]), count: Number(bestHour[1]) } : null,
      currentLevel: wallet?.level ?? 1,
      longestStreak: streak?.longestStreak ?? 0,
      badgesUnlocked: badges.length,
      dailyAvgMinutes: Math.round(totalMinutes / Math.max(1, Object.keys(byDay).length)),
      consistency: Math.round(Object.keys(byDay).length / (periodType === "monthly" ? 30 : 365) * 100),
    };

    // Cache the snapshot
    try {
      await db.insert(wrappedSnapshotsTable).values({
        userId: req.userId, period, periodType, data: wrappedData,
      });
    } catch { }

    res.json({ wrapped: wrappedData, cached: false });
  } catch (err) {
    logger.error({ err }, "wrapped error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as wrappedRouter };
