import { Router, type Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
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
  freezeTokensTable,
} from "@workspace/db";
import { ensureStreakEndangerment } from "../lib/streakEndangerment";
import { eq, and, gte, lt, gt, desc, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { isUserPremium } from "../lib/premiumCheck";
import { userZone } from "../lib/userZone";
import { clockInZone, dayKeyInZone, dayStartInZone, shiftDayKey, weekStartInZone, weekdayOfDayKey } from "../lib/timezone";
import { computeTrend, computeTrendVsAverage } from "../lib/trend";

const router = Router();

router.get("/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    // All calendar maths in the user's zone — "today" used to roll over at
    // server midnight (UTC), i.e. 05:30 for an Indian user.
    const zone = await userZone(req.userId);
    const todayKey = dayKeyInZone(now, zone);
    const todayStart = dayStartInZone(todayKey, zone);
    const todayEnd = dayStartInZone(shiftDayKey(todayKey, 1), zone);

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

    const sevenDaysAgo = dayStartInZone(shiftDayKey(todayKey, -6), zone);
    const weekSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, sevenDaysAgo)));

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const dateStr = shiftDayKey(todayKey, i - 6);
      const daySessions = weekSessions.filter(s => s.completedAt && dayKeyInZone(s.completedAt, zone) === dateStr);
      return { day: dayLabels[weekdayOfDayKey(dateStr)] ?? "?", date: dateStr, minutes: Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60) };
    });

    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));
    const completedTasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.completed, true)));

    const recentSessions = await db.select().from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId))
      .orderBy(desc(focusSessionsTable.completedAt)).limit(5);

    // ── Direction for every headline number ──────────────────────────
    // A bare "42 min" asks the reader to remember what yesterday looked like.
    // Each KPI now ships with the comparison that makes it mean something:
    // today vs yesterday (the day-over-day read) and today vs the user's own
    // 7-day daily average (the "is this normal for me" read).
    //
    // Computed from `weekSessions`, which the chart above already fetched —
    // no extra query. Yesterday is `chartData[5]`, the second-to-last bucket,
    // because `chartData` is [today-6 … today].
    const minutesByDay = chartData.map((d) => d.minutes);
    const yesterdaysMinutes = minutesByDay[minutesByDay.length - 2] ?? 0;
    // Exclude today from its own baseline, or today drags the average toward
    // itself and every day looks average.
    const priorDays = minutesByDay.slice(0, -1);

    const excludedToday = todaySessions.length;
    const yesterdaySessions = weekSessions.filter(
      (sn) => sn.completedAt && dayKeyInZone(sn.completedAt, zone) === shiftDayKey(todayKey, -1),
    ).length;

    res.json({
      totalStudyMinutesToday, avgFocusScore, dominantStability,
      sessionsToday: excludedToday, currentStreak: streak?.currentStreak ?? 0,
      completedTasks: completedTasks.length,
      chartData, recentSessions,
      trends: {
        minutesVsYesterday: computeTrend({
          current: totalStudyMinutesToday,
          previous: yesterdaysMinutes,
          comparison: "yesterday",
        }),
        minutesVsAverage: computeTrendVsAverage(
          totalStudyMinutesToday,
          priorDays,
          "your 7-day average",
        ),
        sessionsVsYesterday: computeTrend({
          current: excludedToday,
          previous: yesterdaySessions,
          comparison: "yesterday",
        }),
        // Best day in the visible window, so "this week" has a reference point
        // rather than being a shape with no scale.
        weekly: {
          totalMinutes: minutesByDay.reduce((a, b) => a + b, 0),
          bestDay: chartData.reduce(
            (best, d) => (d.minutes > best.minutes ? d : best),
            { day: "—", date: todayKey, minutes: 0 },
          ),
          activeDays: minutesByDay.filter((m) => m > 0).length,
        },
        // Already in hand from the streak row read above — longest can never be
        // below current, but a legacy row could disagree, so take the max.
        longestStreak: Math.max(streak?.longestStreak ?? 0, streak?.currentStreak ?? 0),
      },
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
    const zone = await userZone(req.userId);
    const todayKey = dayKeyInZone(now, zone);

    const allSessions = await db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, dateLimit)))
      .orderBy(focusSessionsTable.completedAt);

    // Build heatmap
    const heatmap: Record<string, number> = {};
    const dayTotals: Record<string, number> = {};
    for (const s of allSessions) {
      if (!s.completedAt) continue;
      const date = dayKeyInZone(s.completedAt, zone);
      const mins = Math.round(s.durationSec / 60);
      heatmap[date] = (heatmap[date] ?? 0) + mins;
      dayTotals[date] = (dayTotals[date] ?? 0) + mins;
    }

    // 14-day chart
    const chartData14 = Array.from({ length: 14 }, (_, i) => {
      const date = shiftDayKey(todayKey, i - 13);
      return { date, minutes: heatmap[date] ?? 0 };
    });

    // Personal bests
    const longestSession = allSessions.reduce((max, s) => Math.max(max, s.durationSec), 0);
    const bestDayMinutes = Math.max(0, ...Object.values(dayTotals));

    // Hour-of-day distribution
    const clocks = allSessions.map(s => ({ s, c: s.completedAt ? clockInZone(s.completedAt, zone) : null }));
    const hourDist = Array.from({ length: 24 }, (_, h) => {
      const mins = clocks
        .filter(({ c }) => c?.hour === h)
        .reduce((acc, { s }) => acc + s.durationSec / 60, 0);
      return { hour: h, minutes: Math.round(mins) };
    });
    const timeDayHeatmap = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => {
      const matching = clocks.filter(({ c }) => c?.weekday === day && c.hour === hour).map(({ s }) => s);
      return { day, hour, minutes: Math.round(matching.reduce((sum, session) => sum + session.durationSec / 60, 0)), sessions: matching.length };
    })).flat();

    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));

    // Weekly comparison: this week vs last week
    const thisWeekStart = weekStartInZone(now, zone);
    const thisWeekStartKey = dayKeyInZone(thisWeekStart, zone);
    const lastWeekStart = dayStartInZone(shiftDayKey(thisWeekStartKey, -7), zone);
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
    /*
     * `changePercent` used to be computed here as:
     *
     *     lastWeekMinutes > 0 ? round(((this - last) / last) * 100)
     *                         : thisWeekMinutes > 0 ? 100 : 0;
     *
     * The `: 100` is a fabricated figure. Three minutes this week against a
     * blank last week rendered as a confident "+100%" — a number nothing
     * measured. The `: 0` is the mirror problem: two empty weeks rendered as
     * "no change", which is how a dead account looks steady. And a one-minute
     * baseline produced "+5900%".
     *
     * `computeTrend` returns the honest version of each: `percent: null` plus an
     * absolute delta when the baseline cannot support a percentage, and
     * `direction: "unknown"` when there is nothing to compare. `changePercent`
     * is kept so an older client cannot break, but it is now null in exactly
     * the cases where the old value was invented — and every consumer in this
     * repo renders the trend instead.
     */
    const weekChangePercent = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : thisWeekMinutes > 0 ? 100 : 0;
    const weekTrend = computeTrend({
      current: thisWeekMinutes,
      previous: lastWeekMinutes,
      comparison: "last week",
    });

    // Weekly bar chart (last 7 days of week labels)
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekBarData = Array.from({ length: 7 }, (_, i) => {
      const ds = shiftDayKey(thisWeekStartKey, i);
      return { day: dayLabels[weekdayOfDayKey(ds)] ?? "?", date: ds, minutes: dayTotals[ds] ?? 0 };
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
      weekComparison: { thisWeekMinutes, lastWeekMinutes, changePercent: weekChangePercent, trend: weekTrend },
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
    const today = dayKeyInZone(Date.now(), await userZone(req.userId));
    const sevenDaysAgo = shiftDayKey(today, -7);
    const fourteenDaysAgo = shiftDayKey(today, -14);

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

// Project explicit columns — a bare select couples this to
// the whole study_streaks schema and 500s on schema drift.
async function handleStreak(req: AuthRequest, res: Response) {
  try {
    // WS K: streak-endangerment nudge — lazy, idempotent, fire-and-forget.
    void ensureStreakEndangerment(req.userId!);
    const [streak] = await db.select({
      currentStreak: studyStreaksTable.currentStreak,
      longestStreak: studyStreaksTable.longestStreak,
      lastStudyDate: studyStreaksTable.lastStudyDate,
    }).from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId!));
    const [freeze] = await db.select({ tokens: freezeTokensTable.tokensAvailable })
      .from(freezeTokensTable).where(eq(freezeTokensTable.userId, req.userId!)).limit(1);
    res.json({
      streak: streak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
      shieldsAvailable: freeze?.tokens ?? 0,
    });
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

/**
 * Live "focusing right now" counter (Phase 4.6).
 *
 * Public aggregate: rows in `active_sessions` with `timerStatus='running'`.
 * Those rows exist only while a timer runs (deleted on completion), so the
 * count is real by construction. Cached 30 s, no PII, fail-open null.
 */
router.get("/stats/focusing-now", async (_req, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(activeSessionsTable)
      .where(eq(activeSessionsTable.timerStatus, "running"));
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    res.json({ focusingNow: row?.count ?? 0 });
  } catch (err) {
    logger.error({ err }, "focusing-now error");
    res.json({ focusingNow: null });
  }
});

export { router as statsRouter };
