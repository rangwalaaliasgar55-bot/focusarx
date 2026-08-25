import { Router, Request, Response, NextFunction } from "express";
import { db, userWalletsTable, userBadgesTable, usersTable, focusSessionsTable, studyStreaksTable, tasksTable, coinTransactionsTable } from "@workspace/db";
import { eq, desc, and, sql, gte, count } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { authMiddleware, AuthRequest } from "../middlewares/auth";

const router = Router();

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: "time" | "streak" | "sessions" | "quality" | "special" | "tasks" | "social" | "milestones";
  icon: string;
  threshold: number;
  unit: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  // ── TIME BADGES ──────────────────────────────────────────────────────────────
  { id: "first_hour",      name: "First Hour",          description: "Accumulate 1 hour of focus",             tier: "bronze",    category: "time",       icon: "⏱️",  threshold: 60,     unit: "totalMinutes"     },
  { id: "five_hours",      name: "Five Hour Club",      description: "Accumulate 5 hours of focus",            tier: "bronze",    category: "time",       icon: "📖",  threshold: 300,    unit: "totalMinutes"     },
  { id: "ten_hours",       name: "Ten Hour Club",       description: "Accumulate 10 hours of focus",           tier: "silver",    category: "time",       icon: "📚",  threshold: 600,    unit: "totalMinutes"     },
  { id: "twenty_five_h",   name: "Quarter Century",     description: "Accumulate 25 hours of focus",           tier: "silver",    category: "time",       icon: "🎖️",  threshold: 1500,   unit: "totalMinutes"     },
  { id: "fifty_hours",     name: "Fifty Hour Legend",   description: "Accumulate 50 hours of focus",           tier: "gold",      category: "time",       icon: "🌟",  threshold: 3000,   unit: "totalMinutes"     },
  { id: "century",         name: "Century Club",        description: "Accumulate 100 hours of focus",          tier: "gold",      category: "time",       icon: "🏅",  threshold: 6000,   unit: "totalMinutes"     },
  { id: "two_fifty_h",     name: "Deep Work Master",    description: "Accumulate 250 hours of focus",          tier: "gold",      category: "time",       icon: "🧘",  threshold: 15000,  unit: "totalMinutes"     },
  { id: "five_hundred_h",  name: "Half Millennium",     description: "Accumulate 500 hours of focus",          tier: "legendary", category: "time",       icon: "👁️",  threshold: 30000,  unit: "totalMinutes"     },
  { id: "millennium",      name: "Millennium Sage",     description: "Reach 1000 hours of focus",              tier: "legendary", category: "time",       icon: "🧙",  threshold: 60000,  unit: "totalMinutes"     },
  { id: "deep_runner",     name: "Deep Runner",         description: "Complete a single 2-hour focus session",  tier: "silver",    category: "time",       icon: "🏃",  threshold: 120,    unit: "maxSessionMinutes"},
  { id: "marathoner",      name: "Marathoner",          description: "Complete a single 4-hour focus session",  tier: "gold",      category: "time",       icon: "🏔️", threshold: 240,    unit: "maxSessionMinutes"},

  // ── STREAK BADGES ────────────────────────────────────────────────────────────
  { id: "spark",           name: "Spark",               description: "Maintain a 3-day study streak",          tier: "bronze",    category: "streak",     icon: "✨",  threshold: 3,      unit: "streak"           },
  { id: "week_warrior",    name: "Week Warrior",        description: "Maintain a 5-day study streak",          tier: "bronze",    category: "streak",     icon: "🛡️",  threshold: 5,      unit: "streak"           },
  { id: "flame",           name: "Flame",               description: "Maintain a 7-day study streak",          tier: "silver",    category: "streak",     icon: "🔥",  threshold: 7,      unit: "streak"           },
  { id: "fortnight",       name: "Fortnight Force",     description: "Maintain a 14-day study streak",         tier: "silver",    category: "streak",     icon: "⚡",  threshold: 14,     unit: "streak"           },
  { id: "month_master",    name: "Month Master",        description: "Maintain a 21-day study streak",         tier: "gold",      category: "streak",     icon: "📅",  threshold: 21,     unit: "streak"           },
  { id: "inferno",         name: "Inferno",             description: "Maintain a 30-day study streak",         tier: "gold",      category: "streak",     icon: "🌋",  threshold: 30,     unit: "streak"           },
  { id: "zenith",          name: "The Zenith",          description: "Maintain a 100-day study streak",        tier: "legendary", category: "streak",     icon: "⛰️", threshold: 100,    unit: "streak"           },

  // ── TASKS BADGES ─────────────────────────────────────────────────────────────
  { id: "task_init",       name: "Task Init",           description: "Complete 10 tactical tasks",            tier: "bronze",    category: "tasks",      icon: "📌",  threshold: 10,     unit: "completedTasks"   },
  { id: "task_specialist", name: "Task Specialist",      description: "Complete 50 tactical tasks",            tier: "silver",    category: "tasks",      icon: "🎯",  threshold: 50,     unit: "completedTasks"   },
  { id: "task_architect",  name: "Task Architect",       description: "Complete 250 tactical tasks",           tier: "gold",      category: "tasks",      icon: "🏗️",  threshold: 250,    unit: "completedTasks"   },
];

router.get("/gamification/wallet", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));
    if (!wallet) {
      const [newWallet] = await db.insert(userWalletsTable).values({ userId: req.userId, coins: 500, totalXp: 0, weeklyXp: 0 }).returning();
      res.json(newWallet);
      return;
    }
    res.json(wallet);
  } catch (err) {
    logger.error({ err }, "get wallet error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/badges", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, req.userId));
    const badgeMap = new Map(userBadges.map(b => [b.badgeId, b]));
    
    // Calculate current stats to show progress
    const [stats] = await db.select({
      totalMinutes: sql<number>`sum(${focusSessionsTable.durationSec}) / 60`,
      sessions: sql<number>`count(*)`,
    }).from(focusSessionsTable).where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus")));

    const [streak] = await db.select({
      currentStreak: studyStreaksTable.currentStreak,
      longestStreak: studyStreaksTable.longestStreak,
    }).from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));
    const [tasks] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.completed, true)));

    // Session-quality stats. The profile page renders these directly
    // (stats.totalMinutes, stats.maxScore, ...), so every field the client
    // declares must be present — a missing `stats` object used to throw a
    // TypeError mid-render and take the whole /profile view down.
    const [quality] = await db.select({
      maxScore: sql<number>`coalesce(max(${focusSessionsTable.focusScore}), 0)`,
      perfectSessions: sql<number>`count(*) filter (where ${focusSessionsTable.focusScore} >= 100)`,
      maxSessionMinutes: sql<number>`coalesce(max(${focusSessionsTable.durationSec}), 0) / 60`,
      nightSessions: sql<number>`count(*) filter (where extract(hour from ${focusSessionsTable.completedAt}) >= 22 or extract(hour from ${focusSessionsTable.completedAt}) < 5)`,
      earlySessions: sql<number>`count(*) filter (where ${focusSessionsTable.completedEarly} = true)`,
    }).from(focusSessionsTable).where(and(eq(focusSessionsTable.userId, req.userId), eq(focusSessionsTable.mode, "focus")));

    // Busiest single day (minutes). Scalar sub-select: drizzle does not emit a
    // column alias for `sql` fragments inside a derived table, so the per-day
    // grouping is written out explicitly and aliased in raw SQL.
    const [dayPeak] = await db.select({
      maxDayMinutes: sql<number>`coalesce((
        select max(per_day.minutes) from (
          select coalesce(sum(day_sessions.duration_sec), 0) / 60 as minutes
          from focus_sessions day_sessions
          where day_sessions.user_id = ${req.userId}
            and day_sessions.mode = 'focus'
            and day_sessions.completed_at is not null
          group by date(day_sessions.completed_at)
        ) per_day
      ), 0)`,
    }).from(focusSessionsTable).where(eq(focusSessionsTable.userId, req.userId!)).limit(1);

    // Social proof (audit M1): what share of registered learners hold each badge.
    const [{ value: totalLearners }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.isGuest, false));
    const holderRows = await db
      .select({ badgeId: userBadgesTable.badgeId, holders: count() })
      .from(userBadgesTable)
      .groupBy(userBadgesTable.badgeId);
    const holderMap = new Map(holderRows.map((row) => [row.badgeId, row.holders]));

    const badges = BADGE_DEFS.map(def => {
      const unlocked = badgeMap.get(def.id);
      let progress = 0;
      if (def.unit === "totalMinutes") progress = Number(stats?.totalMinutes ?? 0);
      else if (def.unit === "streak") progress = streak?.currentStreak ?? 0;
      else if (def.unit === "completedTasks") progress = Number(tasks?.count ?? 0);
      else if (def.unit === "maxSessionMinutes") progress = Math.floor(Number(quality?.maxSessionMinutes ?? 0));

      return {
        ...def,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt ?? null,
        progress: Math.min(progress, def.threshold),
        unlockRate: Math.round(((holderMap.get(def.id) ?? 0) / Math.max(1, totalLearners)) * 100),
      };
    });

    res.json({
      badges,
      stats: {
        totalMinutes: Number(stats?.totalMinutes ?? 0),
        sessions: Number(stats?.sessions ?? 0),
        streak: Number(streak?.currentStreak ?? 0),
        longestStreak: Number(streak?.longestStreak ?? 0),
        maxScore: Math.round(Number(quality?.maxScore ?? 0)),
        perfectSessions: Number(quality?.perfectSessions ?? 0),
        maxSessionMinutes: Math.round(Number(quality?.maxSessionMinutes ?? 0)),
        maxDayMinutes: Math.round(Number(dayPeak?.maxDayMinutes ?? 0)),
        nightSessions: Number(quality?.nightSessions ?? 0),
        earlySessions: Number(quality?.earlySessions ?? 0),
        completedTasks: Number(tasks?.count ?? 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "get badges error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/wallet/transactions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const txs = await db.select().from(coinTransactionsTable)
      .where(eq(coinTransactionsTable.userId, req.userId))
      .orderBy(desc(coinTransactionsTable.createdAt))
      .limit(50);
    res.json({ transactions: txs });
  } catch (err) {
    logger.error({ err }, "get transactions error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as gamificationRouter };
