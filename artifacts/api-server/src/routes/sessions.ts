import { Router } from "express";
import { z } from "zod";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable, userWalletsTable, productivityLogsTable, battlePassProgressTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { updateMissionProgress } from "./missions";

const BATTLE_PASS_XP_PER_TIER = 200;
const BATTLE_PASS_MAX_TIER = 50;

async function advanceBattlePass(userId: string, xpEarned: number) {
  try {
    const [bp] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId));
    if (bp) {
      const newSeasonXp = bp.seasonXp + xpEarned;
      const newTier = Math.min(BATTLE_PASS_MAX_TIER, Math.floor(newSeasonXp / BATTLE_PASS_XP_PER_TIER));
      await db.update(battlePassProgressTable).set({
        seasonXp: newSeasonXp,
        tier: newTier,
        updatedAt: new Date(),
      }).where(eq(battlePassProgressTable.userId, userId));
    } else {
      const newTier = Math.min(BATTLE_PASS_MAX_TIER, Math.floor(xpEarned / BATTLE_PASS_XP_PER_TIER));
      await db.insert(battlePassProgressTable).values({
        userId, season: 1, seasonXp: xpEarned, tier: newTier,
        premiumUnlocked: false, claimedTiers: [],
      });
    }
  } catch (err) {
    logger.error({ err }, "advanceBattlePass error");
  }
}

const sessionSchema = z.object({
  mode: z.enum(["focus", "short_break", "long_break"]).default("focus"),
  durationSec: z.number().int().min(0).max(86400).default(0),
  plannedDurationSec: z.number().int().min(0).max(86400).nullable().optional(),
  completedEarly: z.boolean().optional().default(false),
  completionPercentage: z.number().min(0).max(100).nullable().optional(),
  sessionStatus: z.enum(["completed", "completed_early", "cancelled"]).optional().default("completed"),
  focusScore: z.number().min(0).max(100).nullable().optional(),
  focusQuality: z.string().max(20).nullable().optional(),
  stabilityRating: z.number().min(0).max(100).nullable().optional(),
  focusTimeline: z.unknown().optional(),
  sessionInsights: z.unknown().optional(),
  taskId: z.string().uuid().nullable().optional(),
  clientNonce: z.string().max(64).optional(),
  completedAt: z.string().optional(),
  category: z.string().max(50).optional(),
});

const activeSyncSchema = z.object({
  sessionId: z.string().uuid(),
  activeSeconds: z.number().int().min(0).max(86400).optional(),
  secondsLeft: z.number().int().min(0).max(86400).optional(),
  timerStatus: z.enum(["running", "paused", "idle"]).optional(),
  mode: z.enum(["focus", "short_break", "long_break"]).optional(),
  focusScore: z.number().min(0).max(100).nullable().optional(),
  focusQuality: z.string().max(20).nullable().optional(),
  focusState: z.string().max(30).nullable().optional(),
  distractionCount: z.number().int().min(0).optional(),
  lastSeenFaceAt: z.string().nullable().optional(),
  focusTimeline: z.unknown().optional(),
  monitorEnabled: z.boolean().optional(),
});

const router = Router();

function stringOrNullish(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  return String(value);
}

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = String(userId);
  next();
}

router.get("/sessions/active", authMiddleware, async (req: any, res) => {
  try {
    const [session] = await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    res.json({ session: session ?? null });
  } catch (err) {
    logger.error({ err }, "get active session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/sessions/active", authMiddleware, async (req: any, res) => {
  const { mode, secondsLeft, timerStatus, monitorEnabled } = req.body as any;
  try {
    await db.delete(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    const [session] = await db.insert(activeSessionsTable).values({
      userId: req.userId, mode: mode ?? "focus", secondsLeft: secondsLeft ?? 1500,
      timerStatus: timerStatus ?? "paused", monitorEnabled: monitorEnabled ?? false,
      focusTimeline: "[]", activeSeconds: 0,
    }).returning();
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "create active session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/sessions/sync", authMiddleware, async (req: any, res) => {
  const parsed = activeSyncSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sync payload" }); return; }
  const { sessionId, activeSeconds, secondsLeft, timerStatus, mode, focusScore, focusQuality, focusState, distractionCount, lastSeenFaceAt, focusTimeline, monitorEnabled } = parsed.data;
  try {
    await db.update(activeSessionsTable).set({
      activeSeconds: activeSeconds ?? 0, secondsLeft: secondsLeft ?? 1500,
      timerStatus: timerStatus ?? "paused", mode: mode ?? "focus",
      focusScore, focusQuality, focusState, distractionCount,
      lastSeenFaceAt, focusTimeline: JSON.stringify(focusTimeline ?? []),
      monitorEnabled: monitorEnabled ?? false, updatedAt: new Date(),
    }).where(and(eq(activeSessionsTable.id, sessionId), eq(activeSessionsTable.userId, req.userId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "sync session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/sessions/active", authMiddleware, async (req: any, res) => {
  try {
    await db.delete(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete active session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/sessions", authMiddleware, async (req: any, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid session data" }); return; }
  const {
    mode, durationSec, plannedDurationSec, completedEarly, completionPercentage, sessionStatus,
    focusScore, focusQuality, stabilityRating, focusTimeline, sessionInsights, category
  } = parsed.data;
  try {
    // Compute completion percentage if not provided but we have both durations
    let computedPct = completionPercentage ?? null;
    if (computedPct === null && plannedDurationSec && plannedDurationSec > 0 && durationSec > 0) {
      computedPct = Math.min(100, Math.round((durationSec / plannedDurationSec) * 100));
    }

    const [session] = await db.insert(focusSessionsTable).values({
      userId: req.userId,
      mode: mode ?? "focus",
      durationSec: durationSec ?? 0,
      plannedDurationSec: plannedDurationSec ?? null,
      completedEarly: completedEarly ?? false,
      completionPercentage: computedPct,
      sessionStatus: sessionStatus ?? "completed",
      completedAt: new Date(),
      focusScore,
      focusQuality,
      stabilityRating: stringOrNullish(stabilityRating),
      focusTimeline: typeof focusTimeline === "string" ? focusTimeline : JSON.stringify(focusTimeline ?? []),
      sessionInsights: typeof sessionInsights === "string" ? sessionInsights : JSON.stringify(sessionInsights ?? null),
      category: category ?? "General",
    }).returning();

    const streakUpdated = await updateStreak(req.userId);

    let earnedXp = 0;
    let earnedCoins = 0;
    // All focus sessions with duration > 0 contribute to analytics — including early completions
    if ((mode ?? "focus") === "focus" && durationSec > 0) {
      const minutes = Math.floor(durationSec / 60);
      earnedXp = minutes * 20;
      earnedCoins = Math.floor(minutes / 5) * 10;
      // Bonus for completing a full 25-min pomodoro
      if (durationSec >= 1500) earnedCoins += 50;
      // Small bonus for early completion (you still showed up!)
      if (completedEarly && durationSec >= 60) earnedCoins += 10;

      if (earnedXp > 0 || earnedCoins > 0) {
        await awardGamification(req.userId, earnedXp, earnedCoins);
      }

      if (minutes > 0) {
        await updateMissionProgress(req.userId, "sessions", 1);
        await updateMissionProgress(req.userId, "minutes", minutes);
        if (focusScore != null) {
          await updateMissionProgress(req.userId, "score", focusScore, { replace: true });
        }
      }

      await updateProductivityLog(req.userId, minutes, 1, focusScore);

      if (earnedXp > 0) {
        await advanceBattlePass(req.userId, earnedXp);
      }
    }

    res.json({ session, streakUpdated, earnedXp, earnedCoins });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/sessions/history", authMiddleware, async (req: any, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const sessions = await db.select().from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId))
      .orderBy(desc(focusSessionsTable.completedAt))
      .limit(limit);
    res.json({ sessions });
  } catch (err) {
    logger.error({ err }, "session history error");
    res.status(500).json({ error: "Internal error" });
  }
});

async function updateProductivityLog(userId: string, focusMinutes: number, sessionsCompleted: number, avgScore?: number | null) {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [existing] = await db.select().from(productivityLogsTable)
      .where(and(eq(productivityLogsTable.userId, userId), eq(productivityLogsTable.date, today)));

    if (!existing) {
      const prodScore = avgScore != null ? Math.round((focusMinutes * 0.6) + (avgScore * 0.4)) : focusMinutes;
      await db.insert(productivityLogsTable).values({
        userId, date: today, focusMinutes, sessionsCompleted,
        avgFocusScore: avgScore ?? null,
        productivityScore: prodScore,
      });
    } else {
      const totalMinutes = existing.focusMinutes + focusMinutes;
      const totalSessions = existing.sessionsCompleted + sessionsCompleted;
      const newAvgScore = avgScore != null
        ? ((existing.avgFocusScore ?? 0) * existing.sessionsCompleted + avgScore) / totalSessions
        : existing.avgFocusScore;
      const prodScore = newAvgScore != null
        ? Math.round((totalMinutes * 0.6) + (newAvgScore * 0.4))
        : totalMinutes;
      await db.update(productivityLogsTable).set({
        focusMinutes: totalMinutes,
        sessionsCompleted: totalSessions,
        avgFocusScore: newAvgScore,
        productivityScore: prodScore,
      }).where(and(eq(productivityLogsTable.userId, userId), eq(productivityLogsTable.date, today)));
    }
  } catch (err) {
    logger.error({ err }, "productivity log error");
  }
}

async function updateStreak(userId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [existing] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));
    if (!existing) {
      await db.insert(studyStreaksTable).values({ userId, currentStreak: 1, longestStreak: 1, lastStudyDate: today });
      return true;
    }
    if (existing.lastStudyDate === today) return false;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]!;
    const newStreak = existing.lastStudyDate === yesterday ? existing.currentStreak + 1 : 1;
    await db.update(studyStreaksTable).set({
      currentStreak: newStreak, longestStreak: Math.max(newStreak, existing.longestStreak),
      lastStudyDate: today, updatedAt: new Date(),
    }).where(eq(studyStreaksTable.userId, userId));
    await updateMissionProgress(userId, "days", 1);
    return true;
  } catch {
    return false;
  }
}

async function awardGamification(userId: string, xp: number, coins: number) {
  try {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));

    if (!wallet) {
      await db.insert(userWalletsTable).values({
        userId, coins, totalXp: xp, weeklyXp: xp, weeklyXpResetAt: monday,
      });
      return;
    }

    const needsReset = wallet.weeklyXpResetAt && wallet.weeklyXpResetAt < monday;
    const newTotalXp = wallet.totalXp + xp;
    const newLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;

    await db.update(userWalletsTable).set({
      coins: wallet.coins + coins,
      totalXp: newTotalXp,
      weeklyXp: needsReset ? xp : wallet.weeklyXp + xp,
      weeklyXpResetAt: needsReset ? monday : wallet.weeklyXpResetAt,
      level: newLevel,
      updatedAt: new Date(),
    }).where(eq(userWalletsTable.userId, userId));
  } catch (err) {
    logger.error({ err }, "award gamification error");
  }
}

export { router as sessionsRouter };
