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
