import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import {
  db,
  focusSessionsTable,
  studyStreaksTable,
  tasksTable,
  productivityLogsTable,
  usersTable,
  activeSessionsTable,
  userWalletsTable,
  studyRoomMembersTable,
} from "@workspace/db";
import { eq, and, gte, lt, gt, desc, count, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { isUserPremium } from "../lib/premiumCheck";

const router = Router();

router.get("/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
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

router.get("/analytics", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const premium = await isUserPremium(req.userId!);
    const historyDays = premium ? 180 : 60;
    const dateLimit = new Date(now.getTime() - historyDays * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 13 * 86400000);

    const allSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, dateLimit)))
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
    const timeDayHeatmap = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => {
      const matching = allSessions.filter((session) => session.completedAt?.getDay() === day && session.completedAt.getHours() === hour);
      return { day, hour, minutes: Math.round(matching.reduce((sum, session) => sum + session.durationSec / 60, 0)), sessions: matching.length };
    })).flat();

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
      timeDayHeatmap,
      weekBarData,
      weekComparison: { thisWeekMinutes, lastWeekMinutes, changePercent: weekChangePercent },
      personalBests: {
        longestSessionMinutes: Math.round(longestSession / 60),
        bestDayMinutes,
        totalSessions: allTotalSessions,
        totalMinutes: allTotalMinutes,
        longestStreak: streak?.longestStreak ?? 0,
      },
      isPremium: premium,
      historyDays,
    });
  } catch (err) {
    logger.error({ err }, "analytics error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/stats/productivity", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]!;
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]!;

    const [todayLog] = await db.select().from(productivityLogsTable)
      .where(and(eq(productivityLogsTable.userId, req.userId), eq(productivityLogsTable.date, today)));

    const thisWeekLogs = await db.select().from(productivityLogsTable)
      .where(and(eq(productivityLogsTable.userId, req.userId), sql`date >= ${sevenDaysAgo}`));

    const lastWeekLogs = await db.select().from(productivityLogsTable)
      .where(and(eq(productivityLogsTable.userId, req.userId), sql`date >= ${fourteenDaysAgo}`, sql`date < ${sevenDaysAgo}`));

    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));

    const thisWeekAvg = thisWeekLogs.length > 0
      ? thisWeekLogs.reduce((s: number, l) => s + (l.productivityScore ?? 0), 0) / thisWeekLogs.length
      : 0;
    const lastWeekAvg = lastWeekLogs.length > 0
      ? lastWeekLogs.reduce((s: number, l) => s + (l.productivityScore ?? 0), 0) / lastWeekLogs.length
      : 0;
    const trend = Math.round(thisWeekAvg - lastWeekAvg);

    res.json({
      productivityScore: Math.round(todayLog?.productivityScore ?? thisWeekAvg ?? 0),
      focusMinutesToday: todayLog?.focusMinutes ?? 0,
      sessionsToday: todayLog?.sessionsCompleted ?? 0,
      avgFocusScore: todayLog?.avgFocusScore ?? null,
      currentStreak: streak?.currentStreak ?? 0,
      trend,
    });
  } catch (err) {
    logger.error({ err }, "productivity stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Community social proof for the dashboard: who is focusing right now,
// today's top performer (first name only for privacy), community size and
// the signed-in user's weekly XP rank.
router.get("/stats/community", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // A user counts as "focusing right now" when their persisted timer is
    // actively running and has checked in within the last 5 minutes.
    const [{ value: focusingNow }] = await db.select({ value: count() })
      .from(activeSessionsTable)
      .where(and(eq(activeSessionsTable.timerStatus, "running"), gte(activeSessionsTable.updatedAt, fiveMinAgo)));

    const [{ value: communityMembers }] = await db.select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.isGuest, false));

    const topRows = await db.select({
      name: usersTable.name,
      seconds: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}), 0)`,
    })
      .from(focusSessionsTable)
      .innerJoin(usersTable, eq(usersTable.id, focusSessionsTable.userId))
      .where(and(eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, todayStart)))
      .groupBy(focusSessionsTable.userId, usersTable.name)
      .orderBy(desc(sql`sum(${focusSessionsTable.durationSec})`))
      .limit(1);

    const [myWallet] = await db.select({ weeklyXp: userWalletsTable.weeklyXp })
      .from(userWalletsTable)
      .where(eq(userWalletsTable.userId, req.userId!))
      .limit(1);

    let yourWeeklyRank: number | null = null;
    if (myWallet && myWallet.weeklyXp > 0) {
      const [{ value: richerUsers }] = await db.select({ value: count() })
        .from(userWalletsTable)
        .where(gt(userWalletsTable.weeklyXp, myWallet.weeklyXp));
      yourWeeklyRank = richerUsers + 1;
    }

    res.json({
      focusingNow,
      communityMembers,
      topPerformerToday: topRows[0]
        ? { firstName: (topRows[0].name || "A learner").split(" ")[0], minutes: Math.round((topRows[0].seconds ?? 0) / 60) }
        : null,
      yourWeeklyRank,
    });
  } catch (err) {
    logger.error({ err }, "community stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Server-side signals that drive the dashboard onboarding checklist.
router.get("/stats/onboarding", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select({ name: usersTable.name, bio: usersTable.bio, onboardingCompleted: usersTable.onboardingCompleted })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    const [{ value: totalSessions }] = await db.select({ value: count() })
      .from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId!), eq(focusSessionsTable.mode, "focus")));

    const [{ value: taskCount }] = await db.select({ value: count() })
      .from(tasksTable)
      .where(eq(tasksTable.userId, req.userId!));

    const [{ value: studyRoomCount }] = await db.select({ value: count() })
      .from(studyRoomMembersTable)
      .where(eq(studyRoomMembersTable.userId, req.userId!));

    res.json({
      totalSessions,
      taskCount,
      studyRoomCount,
      profileComplete: Boolean(user?.name || user?.bio),
      onboardingQuizDone: Boolean(user?.onboardingCompleted),
    });
  } catch (err) {
    logger.error({ err }, "onboarding stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Project explicit columns (CLAUDE.md rule #1) — a bare select couples this to
// the whole study_streaks schema and 500s on schema drift.
async function handleStreak(req: AuthRequest, res: Response) {
  try {
    const [streak] = await db.select({
      currentStreak: studyStreaksTable.currentStreak,
      longestStreak: studyStreaksTable.longestStreak,
      lastStudyDate: studyStreaksTable.lastStudyDate,
    }).from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId!));
    res.json({ streak: streak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: null } });
  } catch (err) {
    logger.error({ err }, "streak error");
    res.status(500).json({ error: "Internal error" });
  }
}

// Two callers use two different paths for the same payload: Timer.tsx uses
// /api/streak, while StreakNudge + the dashboard StreakFreezeCard use
// /api/stats/streak. Both are served here so neither silently 404s.
router.get("/streak", authMiddleware, handleStreak);
router.get("/stats/streak", authMiddleware, handleStreak);

export { router as statsRouter };
