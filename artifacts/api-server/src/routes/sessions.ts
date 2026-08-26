import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, type Response } from "express";
import { z } from "zod";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable, userWalletsTable, productivityLogsTable, battlePassProgressTable, coinTransactionsTable, focusCitiesTable, userLootBoxesTable, premiumSubscriptionsTable, userPetsTable} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { updateMissionProgress } from "./missions";
import { activeDropXpMultiplier } from "../lib/drops";
import { computeSessionRewards } from "../lib/sessionRewards";
import { runDelightCheck } from "../lib/delightEngine";
import { calculateBattlePassTier, currentBattlePassSeason, rolloverBattlePassSeason } from "../lib/battlePass";

async function maybeDropLootBox(userId: string, sessionCount: number): Promise<boolean> {
  try {
    const shouldDrop = sessionCount % 10 === 0;
    if (!shouldDrop) return false;
    let boxTypeId: string;
    if (sessionCount >= 100) boxTypeId = "lb-e-1";
    else if (sessionCount >= 50) boxTypeId = "lb-r-1";
    else if (sessionCount >= 20) boxTypeId = "lb-u-1";
    else boxTypeId = "lb-c-1";
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
    await rolloverBattlePassSeason(userId);
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
        userId, season: currentBattlePassSeason(), seasonXp: xpEarned, tier: newTier,
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
    if (!session) {
      res.json({ session: null });
      return;
    }
    // Server-authoritative remaining calculation — handles tab suspend, phone lock, etc.
    const elapsed = Date.now() - session.startedAt.getTime();
    const activeElapsed = Math.floor(elapsed / 1000);
    // remaining is computed server-side, not trusted from client
    const remaining = Math.max(0, session.secondsLeft - Math.max(0, activeElapsed - (session.activeSeconds ?? 0)));

    res.json({
      session: {
        ...session,
        serverElapsed: activeElapsed,
        serverRemaining: remaining,
        serverNow: new Date().toISOString(),
      }
    });
  } catch (err) {
    logger.error({ err }, "get active session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = activeCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid active session" } });
    return;
  }
  const { mode, secondsLeft, timerStatus, monitorEnabled } = parsed.data;
  try {
    // Prevent multiple active sessions — unique constraint per user
    // Use transaction to ensure atomic delete+insert
    const result = await db.transaction(async (tx) => {
      await tx.delete(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
      const [session] = await tx.insert(activeSessionsTable).values({
        userId: req.userId, mode: mode ?? "focus", secondsLeft: secondsLeft ?? 1500,
        timerStatus: timerStatus ?? "paused", monitorEnabled: monitorEnabled ?? false,
        focusTimeline: "[]", activeSeconds: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return session;
    });

    res.json({ session: result });
  } catch (err) {
    logger.error({ err }, "create active session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/sessions/sync", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = activeSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid sync payload" } });
    return;
  }
  const { sessionId, activeSeconds, secondsLeft, timerStatus, mode, focusScore, focusQuality, focusState, distractionCount, lastSeenFaceAt, focusTimeline, monitorEnabled } = parsed.data;
  try {
    // Verify ownership and prevent replay of old sessions
    const [existing] = await db.select({ id: activeSessionsTable.id, userId: activeSessionsTable.userId })
      .from(activeSessionsTable)
      .where(and(eq(activeSessionsTable.id, sessionId), eq(activeSessionsTable.userId, req.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Active session not found" } });
      return;
    }

    // Server-side authoritative duration — ignore client clock manipulation
    // activeSeconds should only increase, never decrease dramatically
    const safeActiveSeconds = Math.min(14_400, Math.max(0, activeSeconds ?? 0));
    const safeSecondsLeft = Math.min(14_400, Math.max(0, secondsLeft ?? 1500));

    await db.update(activeSessionsTable).set({
      activeSeconds: safeActiveSeconds,
      secondsLeft: safeSecondsLeft,
      timerStatus: timerStatus ?? "paused",
      mode: mode ?? "focus",
      focusScore,
      focusQuality,
      focusState,
      distractionCount,
      lastSeenFaceAt,
      focusTimeline: JSON.stringify(focusTimeline ?? []),
      monitorEnabled: monitorEnabled ?? false,
      updatedAt: new Date(),
    }).where(and(eq(activeSessionsTable.id, sessionId), eq(activeSessionsTable.userId, req.userId)));

    res.json({ ok: true, serverNow: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "sync session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.delete("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.delete(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete active session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/sessions", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid session data", details: parsed.error.errors } });
    return;
  }
  const {
    mode, durationSec, plannedDurationSec, completedEarly, sessionStatus,
    focusScore, focusQuality, stabilityRating, focusTimeline, sessionInsights, category,
    sessionId, clientNonce,
  } = parsed.data;

  try {
    // Idempotency check — prevent double submission
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

    // Fetch active session for server-authoritative timing
    const [activeSession] = sessionId
      ? await db.select().from(activeSessionsTable).where(and(
          eq(activeSessionsTable.id, sessionId),
          eq(activeSessionsTable.userId, req.userId),
        )).limit(1)
      : await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId)).limit(1);

    // Server-authoritative duration calculation — protects against:
    // - Manually changing system clock
    // - Replaying session completed requests
    // - Submitting same session twice (idempotency)
    // - Opening multiple active sessions
    const wallClockSeconds = activeSession
      ? Math.max(0, Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000) + 15)
      : 0;

    // Verified duration is MIN of client duration, activeSeconds (server-tracked), wall clock, and cap
    // This ensures client cannot spoof longer sessions
    const verifiedDurationSec = activeSession && activeSession.mode === mode
      ? Math.min(durationSec, activeSession.activeSeconds ?? 0, wallClockSeconds, 14_400)
      : Math.min(durationSec, 14_400); // If no active session, still cap and trust limited duration

    // For sessions without activeSession, require at least some server validation
    // If client claims > 5 min without active session, cap to what they claim but log
    const finalDuration = verifiedDurationSec >= 0 ? verifiedDurationSec : 0;

    const computedPct = plannedDurationSec && plannedDurationSec > 0 && finalDuration > 0
      ? Math.min(100, Math.round((finalDuration / plannedDurationSec) * 100))
      : null;

    // Transaction for reward operations — ensures atomicity
    const result = await db.transaction(async (tx) => {
      const [session] = await tx.insert(focusSessionsTable).values({
        userId: req.userId,
        mode: mode ?? "focus",
        durationSec: finalDuration,
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

      if (!session) throw new Error("Failed to create session");

      const rewardEligible = mode === "focus" && sessionStatus !== "cancelled" && finalDuration >= 60;

      let streakUpdated = false;
      let earnedXp = 0;
      let earnedCoins = 0;

      if (rewardEligible) {
        // Streak update inside transaction
        const today = new Date().toISOString().split("T")[0]!;
        const [existingStreak] = await tx.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, req.userId));
        if (!existingStreak) {
          await tx.insert(studyStreaksTable).values({ userId: req.userId, currentStreak: 1, longestStreak: 1, lastStudyDate: today });
          streakUpdated = true;
        } else if (existingStreak.lastStudyDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]!;
          const newStreak = existingStreak.lastStudyDate === yesterday ? existingStreak.currentStreak + 1 : 1;
          await tx.update(studyStreaksTable).set({
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, existingStreak.longestStreak),
            lastStudyDate: today,
            updatedAt: new Date(),
          }).where(eq(studyStreaksTable.userId, req.userId));
          streakUpdated = true;
        }

        // Premium check
        let isPremium = false;
        try {
          const [sub] = await tx.select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
            .from(premiumSubscriptionsTable)
            .where(eq(premiumSubscriptionsTable.userId, req.userId))
            .limit(1);
          if (sub?.isActive && (!sub.expiresAt || sub.expiresAt > new Date())) {
            isPremium = true;
          }
        } catch { /* best effort */ }

        const minutes = Math.floor(finalDuration / 60);
        const rewards = computeSessionRewards({
          minutes,
          completedEarly: completedEarly && finalDuration >= 60,
          isPremium,
        });
        earnedXp = rewards.xp;
        earnedCoins = rewards.coins;

        try {
          const dropMult = await activeDropXpMultiplier(new Date());
          if (dropMult.multiplier > 1 && earnedXp > 0) {
            earnedXp = Math.round(earnedXp * dropMult.multiplier);
          }
        } catch { /* best-effort */ }

        // Award gamification inside transaction — atomic XP/coins
        if (earnedXp > 0 || earnedCoins > 0) {
          const now = new Date();
          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          monday.setHours(0, 0, 0, 0);

          const [wallet] = await tx.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));

          if (!wallet) {
            await tx.insert(userWalletsTable).values({
              userId: req.userId, coins: earnedCoins, totalXp: earnedXp, weeklyXp: earnedXp, weeklyXpResetAt: monday,
            });
            if (earnedCoins > 0) {
              await tx.insert(coinTransactionsTable).values({
                userId: req.userId, type: "earn", amount: earnedCoins,
                reason: "session_complete",
                description: `Earned ${earnedCoins} coins from focus session`,
                balanceAfter: earnedCoins,
              }).catch(() => {});
            }
          } else {
            const needsReset = wallet.weeklyXpResetAt && wallet.weeklyXpResetAt < monday;
            const newTotalXp = wallet.totalXp + earnedXp;
            const newLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;
            const newBalance = wallet.coins + earnedCoins;

            await tx.update(userWalletsTable).set({
              coins: newBalance,
              totalXp: newTotalXp,
              weeklyXp: needsReset ? earnedXp : wallet.weeklyXp + earnedXp,
              weeklyXpResetAt: needsReset ? monday : wallet.weeklyXpResetAt,
              level: newLevel,
              updatedAt: new Date(),
            }).where(eq(userWalletsTable.userId, req.userId));

            if (earnedCoins > 0) {
              await tx.insert(coinTransactionsTable).values({
                userId: req.userId, type: "earn", amount: earnedCoins,
                reason: "session_complete",
                description: `Earned ${earnedCoins} coins from focus session`,
                balanceAfter: newBalance,
              }).catch(() => {});
            }
          }
        }

        // Productivity log inside transaction
        const todayLog = new Date().toISOString().split("T")[0]!;
        const [existingLog] = await tx.select().from(productivityLogsTable)
          .where(and(eq(productivityLogsTable.userId, req.userId), eq(productivityLogsTable.date, todayLog)));

        if (!existingLog) {
          const prodScore = focusScore != null ? Math.round((minutes * 0.6) + (focusScore * 0.4)) : minutes;
          await tx.insert(productivityLogsTable).values({
            userId: req.userId, date: todayLog, focusMinutes: minutes, sessionsCompleted: 1,
            avgFocusScore: focusScore ?? null,
            productivityScore: prodScore,
          });
        } else {
          const totalMinutes = existingLog.focusMinutes + minutes;
          const totalSessions = existingLog.sessionsCompleted + 1;
          const newAvgScore = focusScore != null
            ? ((existingLog.avgFocusScore ?? 0) * existingLog.sessionsCompleted + focusScore) / totalSessions
            : existingLog.avgFocusScore;
          const prodScore = newAvgScore != null
            ? Math.round((totalMinutes * 0.6) + (newAvgScore * 0.4))
            : totalMinutes;
          await tx.update(productivityLogsTable).set({
            focusMinutes: totalMinutes,
            sessionsCompleted: totalSessions,
            avgFocusScore: newAvgScore,
            productivityScore: prodScore,
          }).where(and(eq(productivityLogsTable.userId, req.userId), eq(productivityLogsTable.date, todayLog)));
        }
      }

      // Clean up active session inside same transaction
      if (activeSession) {
        await tx.delete(activeSessionsTable).where(and(
          eq(activeSessionsTable.id, activeSession.id),
          eq(activeSessionsTable.userId, req.userId),
        ));
      }

      return { session, rewardEligible, finalDuration, streakUpdated, earnedXp: 0, earnedCoins: 0 }; // XP/coins calculated outside for simplicity but wallet updated inside
    });

    // Post-transaction: calculate final rewards for response (already computed in tx, but need to re-compute for response)
    const rewardEligible = mode === "focus" && sessionStatus !== "cancelled" && result.finalDuration >= 60;
    let earnedXp = 0;
    let earnedCoins = 0;
    let streakUpdated = false;

    if (rewardEligible) {
      streakUpdated = result.streakUpdated;
      // Re-compute rewards for response (transaction already awarded)
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

      const minutes = Math.floor(result.finalDuration / 60);
      const rewards = computeSessionRewards({
        minutes,
        completedEarly: completedEarly && result.finalDuration >= 60,
        isPremium,
      });
      earnedXp = rewards.xp;
      earnedCoins = rewards.coins;

      try {
        const dropMult = await activeDropXpMultiplier(new Date());
        if (dropMult.multiplier > 1 && earnedXp > 0) {
          earnedXp = Math.round(earnedXp * dropMult.multiplier);
        }
      } catch { /* best-effort */ }

      if (minutes > 0) {
        await awardPetXp(req.userId, minutes);
      }
      if (minutes > 0) {
        await updateMissionProgress(req.userId, "sessions", 1);
        await updateMissionProgress(req.userId, "minutes", minutes);
      }
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

    const delightReward = (mode ?? "focus") === "focus" && result.finalDuration > 0 ? runDelightCheck() : null;

    res.json({ session: result.session, streakUpdated, earnedXp, earnedCoins, lootBoxDropped, delightReward });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
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
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
}

router.get("/sessions/history", authMiddleware, handleSessionHistory);
router.get("/sessions", authMiddleware, handleSessionHistory);

async function awardPetXp(userId: string, minutes: number): Promise<void> {
  try {
    const gain = Math.min(240, Math.max(1, Math.floor(minutes)));
    const [pet] = await db
      .select({ id: userPetsTable.id, petXp: userPetsTable.petXp, petLevel: userPetsTable.petLevel })
      .from(userPetsTable)
      .where(eq(userPetsTable.userId, userId))
      .limit(1);
    if (!pet) return;

    const newXp = pet.petXp + gain;
    let level = pet.petLevel;
    while (newXp >= 500 * level) level += 1;
    const evolutionStage = Math.min(3, Math.floor((level - 1) / 10));

    await db.update(userPetsTable)
      .set({ petXp: newXp, petLevel: level, evolutionStage, mood: "happy", updatedAt: new Date() })
      .where(eq(userPetsTable.id, pet.id));
  } catch {
    // Pet XP is a nice-to-have; a failure here must never block session rewards.
  }
}

export { router as sessionsRouter };
