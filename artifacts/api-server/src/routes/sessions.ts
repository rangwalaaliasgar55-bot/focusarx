import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, type Response } from "express";
import { z } from "zod";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable, userWalletsTable, productivityLogsTable, battlePassProgressTable, coinTransactionsTable, focusCitiesTable, userLootBoxesTable, premiumSubscriptionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { updateMissionProgress } from "./missions";
import { activeDropXpMultiplier } from "../lib/drops";
import { computeSessionRewards } from "../lib/sessionRewards";
import { runDelightCheck } from "../lib/delightEngine";
import { BATTLE_PASS_CURRENT_SEASON, calculateBattlePassTier } from "../lib/battlePass";

async function maybeDropLootBox(userId: string, sessionCount: number): Promise<boolean> {
  try {
    const shouldDrop = sessionCount % 10 === 0;
    if (!shouldDrop) return false;
    // Pick the appropriate tier based on session count
    let boxTypeId: string;
    if (sessionCount >= 100) boxTypeId = "lb-e-1";       // Epic at 100+
    else if (sessionCount >= 50) boxTypeId = "lb-r-1";   // Rare at 50+
    else if (sessionCount >= 20) boxTypeId = "lb-u-1";   // Uncommon at 20+
    else boxTypeId = "lb-c-1";                            // Common otherwise
    await db.insert(userLootBoxesTable).values({
      userId,
      boxTypeId,
      status: "unopened",
      earnedReason: `session_${sessionCount}`,
    });
    return true;
  } catch {
    return false;
  }
}

async function updateCityProgress(userId: string): Promise<void> {
  try {
    const [city] = await db.select().from(focusCitiesTable).where(eq(focusCitiesTable.userId, userId)).limit(1);
    if (!city) return;
    const newTotal = (city.totalSessions ?? 0) + 1;
    let newTier = city.tier;
    let newTierName = city.tierName;
    if (newTotal >= 350) { newTier = "civilization"; newTierName = "Enlightened Civilization"; }
    else if (newTotal >= 175) { newTier = "metropolis"; newTierName = "Wisdom Metropolis"; }
    else if (newTotal >= 90)  { newTier = "city";       newTierName = "Knowledge City"; }
    else if (newTotal >= 40)  { newTier = "town";       newTierName = "Learning Town"; }
    else if (newTotal >= 15)  { newTier = "village";    newTierName = "Focus Village"; }
    await db.update(focusCitiesTable).set({
      totalSessions: newTotal,
      tier: newTier,
      tierName: newTierName,
      updatedAt: new Date(),
    }).where(eq(focusCitiesTable.userId, userId));
  } catch { /* best effort */ }
}

async function advanceBattlePass(userId: string, xpEarned: number) {
  try {
    const [bp] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId));
    if (bp) {
      const newSeasonXp = bp.seasonXp + xpEarned;
      const newTier = calculateBattlePassTier(newSeasonXp);
      await db.update(battlePassProgressTable).set({
        seasonXp: newSeasonXp,
        tier: newTier,
        updatedAt: new Date(),
      }).where(eq(battlePassProgressTable.userId, userId));
    } else {
      const newTier = calculateBattlePassTier(xpEarned);
      await db.insert(battlePassProgressTable).values({
        userId, season: BATTLE_PASS_CURRENT_SEASON, seasonXp: xpEarned, tier: newTier,
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
  sessionId: z.string().uuid().optional(),
  clientNonce: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  completedAt: z.string().optional(),
  category: z.string().max(50).optional(),
});

const activeCreateSchema = z.object({
  mode: z.enum(["focus", "short_break", "long_break"]).default("focus"),
  secondsLeft: z.number().int().min(60).max(14_400).default(1_500),
  timerStatus: z.enum(["running", "paused", "idle"]).default("paused"),
  monitorEnabled: z.boolean().default(false),
}).strict();

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

router.get("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [session] = await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    res.json({ session: session ?? null });
  } catch (err) {
    logger.error({ err }, "get active session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = activeCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid active session" }); return; }
  const { mode, secondsLeft, timerStatus, monitorEnabled } = parsed.data;
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

router.post("/sessions/sync", authMiddleware, async (req: AuthRequest, res) => {
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

router.delete("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.delete(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete active session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/sessions", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid session data" }); return; }
  const {
    mode, durationSec, plannedDurationSec, completedEarly, completionPercentage, sessionStatus,
    focusScore, focusQuality, stabilityRating, focusTimeline, sessionInsights, category,
    sessionId, clientNonce,
  } = parsed.data;
  try {
    if (clientNonce) {
      const [existing] = await db.select().from(focusSessionsTable).where(and(
        eq(focusSessionsTable.userId, req.userId),
        eq(focusSessionsTable.clientNonce, clientNonce),
      )).limit(1);
      if (existing) {
        res.json({ session: existing, streakUpdated: false, earnedXp: 0, earnedCoins: 0, idempotentReplay: true });
        return;
      }
    }

    const [activeSession] = sessionId
      ? await db.select().from(activeSessionsTable).where(and(
          eq(activeSessionsTable.id, sessionId),
          eq(activeSessionsTable.userId, req.userId),
        )).limit(1)
      : [];
    const wallClockSeconds = activeSession
      ? Math.max(0, Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000) + 15)
      : 0;
    const verifiedDurationSec = activeSession && activeSession.mode === mode
      ? Math.min(durationSec, activeSession.activeSeconds ?? 0, wallClockSeconds, 14_400)
      : 0;

    // Ignore the client percentage and derive it only from server-bounded time.
    const computedPct = plannedDurationSec && plannedDurationSec > 0 && verifiedDurationSec > 0
      ? Math.min(100, Math.round((verifiedDurationSec / plannedDurationSec) * 100))
      : null;

    const [session] = await db.insert(focusSessionsTable).values({
      userId: req.userId,
      mode: mode ?? "focus",
      durationSec: verifiedDurationSec,
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
      clientNonce: clientNonce ?? null,
    }).returning();

    const rewardEligible = mode === "focus" && sessionStatus !== "cancelled" && verifiedDurationSec >= 60;
    const streakUpdated = rewardEligible ? await updateStreak(req.userId) : false;

    // Check premium status for multipliers
    let isPremium = false;
    try {
      const [sub] = await db.select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
        .from(premiumSubscriptionsTable)
        .where(eq(premiumSubscriptionsTable.userId, req.userId))
        .limit(1);
      if (sub?.isActive && (!sub.expiresAt || sub.expiresAt > new Date())) {
        isPremium = true;
      }
    } catch { /* best effort */ }

    let earnedXp = 0;
    let earnedCoins = 0;
    // All focus sessions with duration > 0 contribute to analytics — including early completions
    if (rewardEligible) {
      const minutes = Math.floor(verifiedDurationSec / 60);
      // Workstream H: sub-linear rewards — full rate for the first 2h,
      // 75% XP/coins beyond (marathon taper), premium multipliers,
      // pomodoro + showed-up bonuses. Pure function → unit tested.
      const rewards = computeSessionRewards({
        minutes,
        completedEarly: completedEarly && verifiedDurationSec >= 60,
        isPremium,
      });
      earnedXp = rewards.xp;
      earnedCoins = rewards.coins;
      // Admin Drop multiplier (Double-XP Hour / Leaderboard Shake-up) —
      // computed server-side so it can never be spoofed by the client.
      try {
        const dropMult = await activeDropXpMultiplier(new Date());
        if (dropMult.multiplier > 1 && earnedXp > 0) {
          earnedXp = Math.round(earnedXp * dropMult.multiplier);
        }
      } catch { /* multiplier is best-effort */ }

      if (earnedXp > 0 || earnedCoins > 0) {
        await awardGamification(req.userId, earnedXp, earnedCoins);
      }

      if (minutes > 0) {
        await updateMissionProgress(req.userId, "sessions", 1);
        await updateMissionProgress(req.userId, "minutes", minutes);
        // Focus score remains analytics-only until it is backed by a trusted,
        // server-verifiable signal; it cannot advance reward missions.
      }

      await updateProductivityLog(req.userId, minutes, 1, focusScore);

      if (earnedXp > 0) {
        await advanceBattlePass(req.userId, earnedXp);
      }
    }

    let lootBoxDropped = false;
    if (rewardEligible) {
      void updateCityProgress(req.userId);
      try {
        const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
          .from(focusSessionsTable)
          .where(and(
            eq(focusSessionsTable.userId, req.userId),
            eq(focusSessionsTable.mode, "focus"),
            sql`${focusSessionsTable.durationSec} >= 60`,
          ));
        lootBoxDropped = await maybeDropLootBox(req.userId, total);
      } catch { /* best effort */ }
    }

    if (activeSession) {
      await db.delete(activeSessionsTable).where(and(
        eq(activeSessionsTable.id, activeSession.id),
        eq(activeSessionsTable.userId, req.userId),
      ));
    }

    const delightReward = (mode ?? "focus") === "focus" && verifiedDurationSec > 0 ? runDelightCheck() : null;

    res.json({ session, streakUpdated, earnedXp, earnedCoins, lootBoxDropped, delightReward });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: "Internal error" });
  }
});

async function handleSessionHistory(req: AuthRequest, res: Response) {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const sessions = await db.select().from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId!))
      .orderBy(desc(focusSessionsTable.completedAt))
      .limit(limit);
    res.json({ sessions });
  } catch (err) {
    logger.error({ err }, "session history error");
    res.status(500).json({ error: "Internal error" });
  }
}

router.get("/sessions/history", authMiddleware, handleSessionHistory);
// Some callers (e.g. the constellations fallback) request /api/sessions
// directly; serve the same payload so it does not 404.
router.get("/sessions", authMiddleware, handleSessionHistory);

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

async function awardGamification(userId: string, xp: number, coins: number, description?: string) {
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
      if (coins > 0) {
        await db.insert(coinTransactionsTable).values({
          userId, type: "earn", amount: coins,
          reason: "session_complete",
          description: description ?? `Earned ${coins} coins from focus session`,
          balanceAfter: coins,
        }).catch(() => {});
      }
      return;
    }

    const needsReset = wallet.weeklyXpResetAt && wallet.weeklyXpResetAt < monday;
    const newTotalXp = wallet.totalXp + xp;
    const newLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;
    const newBalance = wallet.coins + coins;

    await db.update(userWalletsTable).set({
      coins: newBalance,
      totalXp: newTotalXp,
      weeklyXp: needsReset ? xp : wallet.weeklyXp + xp,
      weeklyXpResetAt: needsReset ? monday : wallet.weeklyXpResetAt,
      level: newLevel,
      updatedAt: new Date(),
    }).where(eq(userWalletsTable.userId, userId));

    if (coins > 0) {
      await db.insert(coinTransactionsTable).values({
        userId, type: "earn", amount: coins,
        reason: "session_complete",
        description: description ?? `Earned ${coins} coins from focus session`,
        balanceAfter: newBalance,
      }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "award gamification error");
  }
}

export { router as sessionsRouter };
