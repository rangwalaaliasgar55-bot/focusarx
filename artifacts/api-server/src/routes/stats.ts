import { Router } from "express";
import { db, focusSessionsTable, studyStreaksTable, tasksTable } from "@workspace/db";
import { eq, and, gte, lt, desc, count, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

router.get("/stats", authMiddleware, async (req: any, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const todaySessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, todayStart), lt(focusSessionsTable.completedAt, todayEnd)));

    const totalStudyMinutesToday = Math.round(todaySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60);
    const avgFocusScore = todaySessions.length > 0
      ? Math.round(todaySessions.filter(s => s.focusScore != null).reduce((acc, s) => acc + (s.focusScore ?? 0), 0) / Math.max(1, todaySessions.filter(s => s.focusScore != null).length))
      : null;

    const stabCounts: Record<string, number> = {};
    for (const s of todaySessions) {
      if (s.stabilityRating) stabCounts[s.stabilityRating] = (stabCounts[s.stabilityRating] ?? 0) + 1;
    }
    const dominantStability = Object.entries(stabCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No data yet";

    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);
    const weekSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, sevenDaysAgo)));

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 86400000);
      const dateStr = date.toISOString().split("T")[0]!;
      const daySessions = weekSessions.filter(s => s.completedAt && s.completedAt.toISOString().split("T")[0] === dateStr);
      return { day: dayLabels[date.getDay()] ?? "?", date: dateStr, minutes: Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60) };
    });

    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));
    const completedTasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.completed, true)));

    const recentSessions = await db.select().from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId))
      .orderBy(desc(focusSessionsTable.completedAt)).limit(5);

    res.json({
      totalStudyMinutesToday, avgFocusScore, dominantStability,
      sessionsToday: todaySessions.length, currentStreak: streak?.currentStreak ?? 0,
      completedTasks: completedTasks.length,
      chartData, recentSessions,
    });
  } catch (err) {
    logger.error({ err }, "stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/analytics", authMiddleware, async (req: any, res) => {
  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 13 * 86400000);

    const allSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, ninetyDaysAgo)))
      .orderBy(focusSessionsTable.completedAt);

    // Build heatmap
    const heatmap: Record<string, number> = {};
    const dayTotals: Record<string, number> = {};
    for (const s of allSessions) {
      if (!s.completedAt) continue;
      const date = s.completedAt.toISOString().split("T")[0]!;
      const mins = Math.round(s.durationSec / 60);
      heatmap[date] = (heatmap[date] ?? 0) + mins;
      dayTotals[date] = (dayTotals[date] ?? 0) + mins;
    }

    // 14-day chart
    const chartData14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(fourteenDaysAgo.getTime() + i * 86400000);
      const date = d.toISOString().split("T")[0]!;
      return { date, minutes: heatmap[date] ?? 0 };
    });

    // Personal bests
    const longestSession = allSessions.reduce((max, s) => Math.max(max, s.durationSec), 0);
    const bestDayMinutes = Math.max(0, ...Object.values(dayTotals));
    const totalSessions = allSessions.length;
    const totalMinutes = allSessions.reduce((acc, s) => acc + s.durationSec, 0) / 60;

    // Hour-of-day distribution
    const hourDist = Array.from({ length: 24 }, (_, h) => {
      const mins = allSessions
        .filter(s => s.completedAt && s.completedAt.getHours() === h)
        .reduce((acc, s) => acc + s.durationSec / 60, 0);
      return { hour: h, minutes: Math.round(mins) };
    });

    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));

    // Weekly comparison: this week vs last week
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
    const thisWeekSessions = allSessions.filter(s => s.completedAt && s.completedAt >= thisWeekStart);
    const lastWeekSessions = await db.select().from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.userId, req.userId),
        eq(focusSessionsTable.mode, "focus"),
        gte(focusSessionsTable.completedAt, lastWeekStart),
        lt(focusSessionsTable.completedAt, thisWeekStart),
      ));
    const thisWeekMinutes = Math.round(thisWeekSessions.reduce((acc, s) => acc + s.durationSec, 0) / 60);
    const lastWeekMinutes = Math.round(lastWeekSessions.reduce((acc, s) => acc + s.durationSec, 0) / 60);
    const weekChangePercent = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : thisWeekMinutes > 0 ? 100 : 0;

    // Weekly bar chart (last 7 days of week labels)
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekBarData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(thisWeekStart.getTime() + i * 86400000);
      const ds = d.toISOString().split("T")[0]!;
      return { day: dayLabels[d.getDay()] ?? "?", date: ds, minutes: dayTotals[ds] ?? 0 };
    });

    // All-time stats (query without date filter for totals)
    const allTimeSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus")));
    const allTotalMinutes = Math.round(allTimeSessions.reduce((acc, s) => acc + s.durationSec, 0) / 60);
    const allTotalSessions = allTimeSessions.length;

    res.json({
      heatmap,
      chartData14,
      hourDist,
      weekBarData,
      weekComparison: { thisWeekMinutes, lastWeekMinutes, changePercent: weekChangePercent },
      personalBests: {
        longestSessionMinutes: Math.round(longestSession / 60),
        bestDayMinutes,
        totalSessions: allTotalSessions,
        totalMinutes: allTotalMinutes,
        longestStreak: streak?.longestStreak ?? 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "analytics error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/streak", authMiddleware, async (req: any, res) => {
  try {
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));
    res.json({ streak: streak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: null } });
  } catch (err) {
    logger.error({ err }, "streak error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as statsRouter };
