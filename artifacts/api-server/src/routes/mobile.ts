import { Router, type Response } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { db, focusSessionsTable, tasksTable, studyStreaksTable, userWalletsTable, activeSessionsTable } from "@workspace/db";
import { and, eq, gte, lt, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { userZone } from "../lib/userZone";
import { clockInZone, dayKeyInZone, dayStartInZone, shiftDayKey, weekdayOfDayKey } from "../lib/timezone";

const router = Router();

/**
 * Mobile-specific lightweight endpoints
 * - Split dashboard into smaller payloads
 * - Pagination for history
 * - Optimized for poor network
 */

// GET /api/mobile/dashboard - lightweight dashboard for mobile
router.get("/mobile/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const zone = await userZone(userId);
    const todayKey = dayKeyInZone(now, zone);
    const todayStart = dayStartInZone(todayKey, zone);
    const todayEnd = dayStartInZone(shiftDayKey(todayKey, 1), zone);

    // Parallel lightweight queries
    const [todaySessions, streakRow, walletRow, activeSession, nextTasks] = await Promise.all([
      db.select({ durationSec: focusSessionsTable.durationSec, focusScore: focusSessionsTable.focusScore })
        .from(focusSessionsTable)
        .where(and(
          eq(focusSessionsTable.userId, userId),
          eq(focusSessionsTable.mode, "focus"),
          gte(focusSessionsTable.completedAt, todayStart),
          lt(focusSessionsTable.completedAt, todayEnd)
        )),
      db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).then(r => r[0] || null),
      db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).then(r => r[0] || null),
      db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, userId)).then(r => r[0] || null),
      db.select({ id: tasksTable.id, title: tasksTable.text, priority: tasksTable.priority, dueDate: tasksTable.dueDate })
        .from(tasksTable)
        .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, false)))
        .orderBy(desc(tasksTable.priority), tasksTable.createdAt)
        .limit(3),
    ]);

    const totalMinutes = Math.round(todaySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60);
    const avgScore = todaySessions.length > 0
      ? Math.round(todaySessions.filter(s => s.focusScore != null).reduce((a, s) => a + (s.focusScore ?? 0), 0) / Math.max(1, todaySessions.filter(s => s.focusScore != null).length))
      : null;

    // Server time for clock sync
    const serverNow = Date.now();
    let activeRemaining: number | null = null;
    let activeElapsed: number | null = null;
    if (activeSession) {
      const elapsed = Math.floor((serverNow - new Date(activeSession.startedAt).getTime()) / 1000);
      activeElapsed = elapsed;
      activeRemaining = Math.max(0, activeSession.secondsLeft - elapsed);
    }

    res.json({
      greeting: {
        hour: clockInZone(now, zone).hour,
        serverNow,
      },
      today: {
        minutes: totalMinutes,
        sessions: todaySessions.length,
        avgScore,
      },
      streak: {
        current: streakRow?.currentStreak ?? 0,
        longest: streakRow?.longestStreak ?? 0,
      },
      wallet: walletRow ? {
        coins: walletRow.coins,
        totalXp: walletRow.totalXp,
        level: walletRow.level,
        weeklyXp: walletRow.weeklyXp,
      } : null,
      activeSession: activeSession ? {
        id: activeSession.id,
        mode: activeSession.mode,
        secondsLeft: activeSession.secondsLeft,
        remaining: activeRemaining,
        elapsed: activeElapsed,
        status: activeSession.timerStatus,
        startedAt: activeSession.startedAt,
        serverNow,
      } : null,
      nextTasks,
    });
  } catch (err) {
    logger.error({ err }, "mobile dashboard error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/mobile/timer - just active session, ultra lightweight
router.get("/mobile/timer", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [active] = await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, userId)).limit(1);
    if (!active) {
      res.json({ active: null, serverNow: Date.now() });
      return;
    }
    const serverNow = Date.now();
    const elapsed = Math.floor((serverNow - new Date(active.startedAt).getTime()) / 1000);
    res.json({
      active: {
        id: active.id,
        mode: active.mode,
        secondsLeft: active.secondsLeft,
        activeSeconds: active.activeSeconds,
        status: active.timerStatus,
        startedAt: active.startedAt,
        elapsed,
        remaining: Math.max(0, active.secondsLeft - elapsed),
      },
      serverNow,
    });
  } catch (err) {
    logger.error({ err }, "mobile timer error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/mobile/recent-sessions - paginated, lightweight
router.get("/mobile/recent-sessions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [sessions, countResult] = await Promise.all([
      db.select({
        id: focusSessionsTable.id,
        mode: focusSessionsTable.mode,
        durationSec: focusSessionsTable.durationSec,
        completedAt: focusSessionsTable.completedAt,
        focusScore: focusSessionsTable.focusScore,
      })
        .from(focusSessionsTable)
        .where(eq(focusSessionsTable.userId, userId))
        .orderBy(desc(focusSessionsTable.completedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(focusSessionsTable)
        .where(eq(focusSessionsTable.userId, userId))
        .then(r => r[0]?.count ?? 0),
    ]);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total: Number(countResult),
        totalPages: Math.ceil(Number(countResult) / limit),
        hasMore: offset + sessions.length < Number(countResult),
      },
      serverNow: Date.now(),
    });
  } catch (err) {
    logger.error({ err }, "mobile recent sessions error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/mobile/stats - minimal stats for Plan/Stats tabs
router.get("/mobile/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const zone = await userZone(userId);
    const todayKey = dayKeyInZone(now, zone);
    const weekAgo = dayStartInZone(shiftDayKey(todayKey, -6), zone);

    const [weekSessions, streak] = await Promise.all([
      db.select({ completedAt: focusSessionsTable.completedAt, durationSec: focusSessionsTable.durationSec })
        .from(focusSessionsTable)
        .where(and(
          eq(focusSessionsTable.userId, userId),
          eq(focusSessionsTable.mode, "focus"),
          gte(focusSessionsTable.completedAt, weekAgo)
        )),
      db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).then(r => r[0] || null),
    ]);

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const dateStr = shiftDayKey(todayKey, i - 6);
      const daySessions = weekSessions.filter(s => s.completedAt && dayKeyInZone(s.completedAt, zone) === dateStr);
      return {
        day: dayLabels[weekdayOfDayKey(dateStr)] ?? "?",
        date: dateStr,
        minutes: Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60),
        sessions: daySessions.length,
      };
    });

    res.json({
      week: chartData,
      totalMinutesWeek: chartData.reduce((a, d) => a + d.minutes, 0),
      totalSessionsWeek: weekSessions.length,
      streak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      serverNow: Date.now(),
    });
  } catch (err) {
    logger.error({ err }, "mobile stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as mobileRouter };
