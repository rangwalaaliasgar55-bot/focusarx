import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, type Response } from "express";
import { z } from "zod";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable, userWalletsTable, productivityLogsTable, battlePassProgressTable, coinTransactionsTable, focusCitiesTable, userLootBoxesTable, premiumSubscriptionsTable, userPetsTable, usersTable, type ActiveSession} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { updateMissionProgress } from "./missions";
import { activeDropXpMultiplier } from "../lib/drops";
import { computeSessionRewards } from "../lib/sessionRewards";
import { runDelightCheck } from "../lib/delightEngine";
import { calculateBattlePassTier, currentBattlePassSeason, rolloverBattlePassSeason } from "../lib/battlePass";
import { sessionCompleteLimiter } from "../lib/rateLimiter";
import {
  dayKeyInZone,
  isValidTimeZone,
  resolveUserZone,
  shiftDayKey,
  weekStartInZone,
  LEGACY_FALLBACK_ZONE,
} from "../lib/timezone";
import {
  computeVerifiedDurationSec,
  isRewardEligible,
  nextStreakValues,
  MIN_REWARD_DURATION_SEC,
} from "../lib/sessionCompletionCore";
import {
  evaluateActiveSession,
  stateFromTimerStatus,
  type SessionState,
} from "../lib/sessionStateMachine";
import { deriveActiveSessionTiming } from "../lib/activeSessionTiming";

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
  // Device IANA zone (e.g. "America/New_York"). Adopted onto the user row
  // and used for streak/productivity day keys. Invalid values are ignored —
  // never a validation error — so old clients keep working.
  timezone: z.string().max(60).optional(),
});

const activeCreateSchema = z.object({
  mode: z.enum(["focus", "short_break", "long_break"]).default("focus"),
  secondsLeft: z.number().int().min(60).max(14_400).default(1_500),
  timerStatus: z.enum(["running", "paused", "idle"]).default("paused"),
  monitorEnabled: z.boolean().default(false),
  timezone: z.string().max(60).optional(),
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
  timezone: z.string().max(60).optional(),
});

const router = Router();

function stringOrNullish(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  return String(value);
}

/**
 * Adopt the device IANA zone onto the user row (Phase 5.3 STREAK fix).
 * Best-effort and silent: invalid zones are ignored, and a DB failure here
 * must never fail a session write. Once a real zone is stored, streaks,
 * productivity logs and weekly resets key off it instead of legacy IST.
 */
async function adoptTimezone(userId: string, timezone: unknown): Promise<void> {
  if (typeof timezone !== "string" || !isValidTimeZone(timezone)) return;
  try {
    const [user] = await db.select({ timezone: usersTable.timezone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (user && user.timezone !== timezone) {
      await db.update(usersTable).set({ timezone }).where(eq(usersTable.id, userId));
    }
  } catch (err) {
    logger.warn({ err, userId }, "adoptTimezone failed (non-fatal)");
  }
}

/** Resolve the caller's calendar zone: stored IANA zone, else legacy IST. */
async function userZone(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ timezone: usersTable.timezone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return resolveUserZone(user?.timezone);
  } catch {
    return LEGACY_FALLBACK_ZONE;
  }
}

router.get("/sessions/active", authMiddleware, async (req: AuthRequest, res) => {
  try {
    let [session] = await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId));
    if (!session) {
      res.json({ session: null });
      return;
    }

    // State machine: lazily finalize abandoned sessions (no cron needed on
    // serverless — the next read is the tick).
    const evaluation = evaluateActiveSession(session, Date.now());
    if (evaluation.expired) {
      const finalized = await finalizeExpiredSession(req.userId, session);
      res.json({ session: null, expiredSession: finalized });
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
  const { mode, secondsLeft, timerStatus, monitorEnabled, timezone } = parsed.data;
  try {
    // Adopt the device zone so streak/productivity days stay user-local.
    await adoptTimezone(req.userId, timezone);
    // State machine guard: replacing an existing row is a transition into a
    // fresh session — finalize a stale one first so its (earned) rewards and
    // history are not silently destroyed by the delete below.
    const [stale] = await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId)).limit(1);
    let expiredSession: Awaited<ReturnType<typeof finalizeExpiredSession>> | null = null;
    if (stale) {
      const evaluation = evaluateActiveSession(stale, Date.now());
      if (evaluation.expired) {
        expiredSession = await finalizeExpiredSession(req.userId, stale);
      }
    }

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

    res.json(expiredSession ? { session: result, expiredSession } : { session: result });
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
  const { sessionId, activeSeconds, secondsLeft, timerStatus, mode, focusScore, focusQuality, focusState, distractionCount, lastSeenFaceAt, focusTimeline, monitorEnabled, timezone } = parsed.data;
  try {
    await adoptTimezone(req.userId, timezone);
    // Verify ownership and prevent replay of old sessions
    const [existing] = await db.select({ id: activeSessionsTable.id, userId: activeSessionsTable.userId, startedAt: activeSessionsTable.startedAt })
      .from(activeSessionsTable)
      .where(and(eq(activeSessionsTable.id, sessionId), eq(activeSessionsTable.userId, req.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Active session not found" } });
      return;
    }

    // State machine: expired rows cannot transition to anything but archived
    // (sync is not a completion). Finalize and tell the client.
    const [syncTarget] = await db.select().from(activeSessionsTable).where(and(eq(activeSessionsTable.id, sessionId), eq(activeSessionsTable.userId, req.userId))).limit(1);
    const syncEvaluation = evaluateActiveSession(syncTarget, Date.now());
    if (syncEvaluation.expired) {
      const finalized = await finalizeExpiredSession(req.userId, syncTarget);
      res.status(409).json({ error: { code: "SESSION_EXPIRED", message: "Session expired and was archived" }, expiredSession: finalized });
      return;
    }

    // Server-side authoritative bounds — the client may only report *less*
    // focus time than has physically elapsed since startedAt (pauses, tab
    // suspends). Reported values above wall clock are clamped so they can
    // never feed inflated numbers into completion-time reward verification.
    const wallClockSeconds = Math.max(0, Math.floor((Date.now() - existing.startedAt.getTime()) / 1000));
    const safeActiveSeconds = Math.min(14_400, Math.max(0, activeSeconds ?? 0), wallClockSeconds);
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

router.post("/sessions", authMiddleware, sessionCompleteLimiter, async (req: AuthRequest, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid session data", details: parsed.error.errors } });
    return;
  }
  const {
    mode, durationSec, plannedDurationSec, completedEarly, sessionStatus,
    focusScore, focusQuality, stabilityRating, focusTimeline, sessionInsights, category,
    sessionId, clientNonce, timezone,
  } = parsed.data;

  try {
    // Adopt the device zone first so every day key below is user-local.
    await adoptTimezone(req.userId, timezone);
    const zone = await userZone(req.userId);
    const weekStart = weekStartInZone(Date.now(), zone);
    // Fetch the server-side active session — the only trusted evidence that a
    // session actually ran (its startedAt is server-owned).
    const [activeSession] = sessionId
      ? await db.select().from(activeSessionsTable).where(and(
          eq(activeSessionsTable.id, sessionId),
          eq(activeSessionsTable.userId, req.userId),
        )).limit(1)
      : await db.select().from(activeSessionsTable).where(eq(activeSessionsTable.userId, req.userId)).limit(1);

    // Only an active session *of the same mode* is evidence for this
    // completion (a break row started after the fact proves nothing about a
    // focus session, and vice versa).
    const hasActiveSession = Boolean(activeSession && activeSession.mode === (mode ?? "focus"));
    const wallClockSeconds = hasActiveSession && activeSession
      ? Math.max(0, Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000))
      : 0;

    // Verified duration = min(client claim, server wall clock + grace, 4h cap).
    // Without an active session the claim is only recorded, never rewarded
    // (anti-farming: see lib/sessionCompletionCore.ts).
    const serverActiveSeconds = hasActiveSession && activeSession
      ? deriveActiveSessionTiming(activeSession).activeSeconds
      : 0;

    const finalDuration = computeVerifiedDurationSec({
      claimedDurationSec: durationSec,
      hasActiveSession,
      wallClockSeconds,
      serverActiveSeconds,
    });

    if (!hasActiveSession && durationSec > 0) {
      logger.warn(
        { userId: req.userId, claimedDurationSec: durationSec, requestId: (req as { id?: string }).id },
        "session completed without an active session — recorded without rewards",
      );
    }

    const computedPct = plannedDurationSec && plannedDurationSec > 0 && finalDuration > 0
      ? Math.min(100, Math.round((finalDuration / plannedDurationSec) * 100))
      : null;

    const effectiveMode = mode ?? "focus";
    const effectiveStatus = sessionStatus ?? "completed";
    const rewardEligible = isRewardEligible({
      mode: effectiveMode,
      sessionStatus: effectiveStatus,
      verifiedDurationSec: finalDuration,
      hasActiveSession,
    });

    // Premium + drop multiplier are snapshotted once, before the transaction,
    // so the awarded values and the response can never diverge.
    let isPremium = false;
    if (rewardEligible) {
      try {
        const [sub] = await db.select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
          .from(premiumSubscriptionsTable)
          .where(eq(premiumSubscriptionsTable.userId, req.userId))
          .limit(1);
        if (sub?.isActive && (!sub.expiresAt || sub.expiresAt > new Date())) {
          isPremium = true;
        }
      } catch { /* best effort */ }
    }

    let dropMultiplier = 1;
    if (rewardEligible) {
      try {
        const dropMult = await activeDropXpMultiplier(new Date());
        dropMultiplier = dropMult.multiplier > 1 ? dropMult.multiplier : 1;
      } catch { /* best-effort */ }
    }

    const minutes = Math.floor(finalDuration / 60);
    const rewards = rewardEligible
      ? computeSessionRewards({ minutes, completedEarly: completedEarly && finalDuration >= 60, isPremium })
      : { xp: 0, coins: 0 };
    const earnedXp = rewards.xp > 0 ? Math.round(rewards.xp * dropMultiplier) : 0;
    const earnedCoins = rewards.coins;

    // ── Transaction: session row + all reward mutations, atomic & idempotent ──
    const result = await db.transaction(async (tx) => {
      // Idempotent insert: the (user_id, client_nonce) unique constraint is the
      // race-proof backstop. Insert-first means a concurrent duplicate gets an
      // empty returning() and is served the original row instead of 500ing.
      const inserted = await tx.insert(focusSessionsTable).values({
        userId: req.userId,
        mode: effectiveMode,
        durationSec: finalDuration,
        plannedDurationSec: plannedDurationSec ?? null,
        completedEarly: completedEarly ?? false,
        completionPercentage: computedPct,
        sessionStatus: effectiveStatus,
        completedAt: new Date(),
        focusScore,
        focusQuality,
        stabilityRating: stringOrNullish(stabilityRating),
        focusTimeline: typeof focusTimeline === "string" ? focusTimeline : JSON.stringify(focusTimeline ?? []),
        sessionInsights: typeof sessionInsights === "string" ? sessionInsights : JSON.stringify(sessionInsights ?? null),
        category: category ?? "General",
        clientNonce: clientNonce ?? null,
      }).onConflictDoNothing({ target: [focusSessionsTable.userId, focusSessionsTable.clientNonce] }).returning();

      if (inserted.length === 0) {
        // Replay of an already-processed completion (double-click, retry,
        // second tab). Serve the original row; zero incremental rewards.
        const [existing] = await tx.select().from(focusSessionsTable).where(and(
          eq(focusSessionsTable.userId, req.userId),
          eq(focusSessionsTable.clientNonce, clientNonce ?? ""),
        )).limit(1);
        return { session: existing ?? null, replay: true as const, streakUpdated: false };
      }
      const session = inserted[0]!;

      let streakUpdated = false;
      if (rewardEligible) {
        // User-zone day keys — shared transactional streak progression.
        streakUpdated = await applyStreakProgress(tx, req.userId, zone);
      }

      // Award XP/coins inside the transaction — atomic, and a ledger failure
      // rolls the whole completion back (never a wallet credit without its
      // ledger row). Shared with expiry auto-completion.
      await creditSessionRewards(tx, req.userId, earnedXp, earnedCoins, weekStart);

      // Productivity log (user-zone day key — matches streaks and missions).
      if (finalDuration > 0) {
        const todayLog = dayKeyInZone(Date.now(), zone);
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

      // Clean up the consumed active session inside the same transaction — but
      // only the one this completion belongs to (never an unrelated active
      // session another tab just started).
      if (activeSession && activeSession.mode === effectiveMode) {
        await tx.delete(activeSessionsTable).where(and(
          eq(activeSessionsTable.id, activeSession.id),
          eq(activeSessionsTable.userId, req.userId),
        ));
      }

      return { session, replay: false as const, streakUpdated };
    });

    if (result.replay) {
      res.json({ session: result.session, streakUpdated: false, earnedXp: 0, earnedCoins: 0, idempotentReplay: true });
      return;
    }

    // Post-transaction, best-effort gamification (non-monetary progression —
    // failures here degrade gracefully and must never fail the completion).
    if (rewardEligible) {
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

      let lootBoxDropped = false;
      try {
        void updateCityProgress(req.userId);
        const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
          .from(focusSessionsTable)
          .where(and(
            eq(focusSessionsTable.userId, req.userId),
            eq(focusSessionsTable.mode, "focus"),
            sql`${focusSessionsTable.durationSec} >= 60`,
          ));
        lootBoxDropped = await maybeDropLootBox(req.userId, total);
      } catch { /* best effort */ }

      const delightReward = runDelightCheck();

      res.json({ session: result.session, streakUpdated: result.streakUpdated, earnedXp, earnedCoins, lootBoxDropped, delightReward });
      return;
    }

    res.json({ session: result.session, streakUpdated: result.streakUpdated, earnedXp: 0, earnedCoins: 0, lootBoxDropped: false, delightReward: null });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

async function handleSessionHistory(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const [sessions, countResult] = await Promise.all([
      db.select().from(focusSessionsTable)
        .where(eq(focusSessionsTable.userId, req.userId!))
        .orderBy(desc(focusSessionsTable.completedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(focusSessionsTable)
        .where(eq(focusSessionsTable.userId, req.userId!))
        .then(r => r[0]?.count ?? 0),
    ]);

    // If pagination params provided, return paginated format
    if (req.query.page) {
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
    } else {
      // Legacy format for existing clients
      res.json({ sessions });
    }
  } catch (err) {
    logger.error({ err }, "session history error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
}

router.get("/sessions/history", authMiddleware, handleSessionHistory);
router.get("/sessions", authMiddleware, handleSessionHistory);

/**
 * Shared transactional streak progression (used by explicit completion and
 * expiry auto-completion). Returns whether the streak moved forward.
 *
 * Day keys come from the user's own IANA zone. `legacyYesterday` is the IST
 * yesterday key: matching it continues the streak, so adopting a real zone
 * (or travelling) never silently resets progress earned under legacy IST.
 */
async function applyStreakProgress(tx: TxLike, userId: string, zone: string): Promise<boolean> {
  const now = Date.now();
  const today = dayKeyInZone(now, zone);
  const yesterday = shiftDayKey(today, -1);
  const legacyYesterday =
    zone === LEGACY_FALLBACK_ZONE ? undefined : shiftDayKey(dayKeyInZone(now, LEGACY_FALLBACK_ZONE), -1);
  const [existingStreak] = await tx.select().from(studyStreaksTable)
    .where(eq(studyStreaksTable.userId, userId)).for("update");
  const streak = nextStreakValues({
    lastStudyDate: existingStreak?.lastStudyDate ?? null,
    currentStreak: existingStreak?.currentStreak ?? 0,
    longestStreak: existingStreak?.longestStreak ?? 0,
    today,
    yesterday,
    legacyYesterday,
  });
  if (!existingStreak) {
    await tx.insert(studyStreaksTable).values({ userId, currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, lastStudyDate: today });
    return true;
  }
  if (streak.changed) {
    await tx.update(studyStreaksTable).set({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastStudyDate: today,
      updatedAt: new Date(),
    }).where(eq(studyStreaksTable.userId, userId));
    return true;
  }
  return false;
}

/**
 * Shared transactional wallet credit (used by explicit completion and expiry
 * auto-completion). Ledger failures throw → caller's transaction rolls back.
 * `weekStart` is the caller's zone-aware Monday 00:00 instant.
 */
async function creditSessionRewards(tx: TxLike, userId: string, earnedXp: number, earnedCoins: number, weekStart: Date): Promise<void> {
  if (earnedXp <= 0 && earnedCoins <= 0) return;
  const monday = weekStart;

  const [wallet] = await tx.select().from(userWalletsTable)
    .where(eq(userWalletsTable.userId, userId)).for("update");

  if (!wallet) {
    await tx.insert(userWalletsTable).values({
      userId, coins: earnedCoins, totalXp: earnedXp, weeklyXp: earnedXp, weeklyXpResetAt: monday,
    });
    if (earnedCoins > 0) {
      await tx.insert(coinTransactionsTable).values({
        userId, type: "earn", amount: earnedCoins,
        reason: "session_complete",
        description: `Earned ${earnedCoins} coins from focus session`,
        balanceAfter: earnedCoins,
      });
    }
    return;
  }

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
  }).where(eq(userWalletsTable.userId, userId));

  if (earnedCoins > 0) {
    await tx.insert(coinTransactionsTable).values({
      userId, type: "earn", amount: earnedCoins,
      reason: "session_complete",
      description: `Earned ${earnedCoins} coins from focus session`,
      balanceAfter: newBalance,
    });
  }
}

/** The drizzle transaction handle — derived so helpers stay fully typed. */
type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Archive an expired active session (state machine: → expired).
 *
 * - Running past its deadline: auto-COMPLETED with duration = secondsLeft
 *   (server-owned evidence) and full, transactional rewards — this is exactly
 *   what the completion request would have recorded had the tab survived.
 * - Paused/idle past the absolute TTL: archived as "expired" with clamped
 *   duration and NO rewards (focus time is unverifiable).
 *
 * Returns the archived summary for API responses.
 */
async function finalizeExpiredSession(
  userId: string,
  session: ActiveSession,
): Promise<{ sessionId: string; sessionStatus: string; durationSec: number; earnedXp: number; earnedCoins: number }> {
  const evaluation = evaluateActiveSession(session, Date.now());
  if (!evaluation.expired) {
    throw new Error("finalizeExpiredSession called on a live session");
  }

  const zone = await userZone(userId);
  const weekStart = weekStartInZone(Date.now(), zone);

  const outcome = await db.transaction(async (tx) => {
    // Delete-first guard: only finalize if the row is still present (a racing
    // completion or another instance may have beaten us here).
    const deleted = await tx.delete(activeSessionsTable)
      .where(and(eq(activeSessionsTable.id, session.id), eq(activeSessionsTable.userId, userId)))
      .returning({ id: activeSessionsTable.id });
    if (deleted.length === 0) return null;

    const wasRunning = evaluation.wasRunning;
    const sessionStatus = wasRunning ? "completed" : "expired";
    const durationSec = evaluation.maxFocusSec;
    const minutes = Math.floor(durationSec / 60);
    const rewardEligible = wasRunning && session.mode === "focus" && durationSec >= MIN_REWARD_DURATION_SEC;

    let earnedXp = 0;
    let earnedCoins = 0;
    let streakUpdated = false;

    if (rewardEligible) {
      streakUpdated = await applyStreakProgress(tx, userId, zone);
      earnedXp = computeSessionRewards({ minutes, isPremium: false }).xp;
      earnedCoins = computeSessionRewards({ minutes, isPremium: false }).coins;
      await creditSessionRewards(tx, userId, earnedXp, earnedCoins, weekStart);
    }

    const [archived] = await tx.insert(focusSessionsTable).values({
      userId,
      mode: session.mode,
      durationSec,
      plannedDurationSec: session.secondsLeft,
      completedEarly: false,
      completionPercentage: session.secondsLeft > 0
        ? Math.min(100, Math.round((durationSec / session.secondsLeft) * 100))
        : null,
      sessionStatus,
      completedAt: new Date(),
      focusTimeline: session.focusTimeline ?? "[]",
      sessionInsights: session.focusState ? JSON.stringify({ finalFocusState: session.focusState }) : null,
      category: "General",
    }).returning();

    return { session: archived, sessionStatus, durationSec, earnedXp, earnedCoins, streakUpdated };
  });

  if (!outcome) {
    return { sessionId: session.id, sessionStatus: "expired", durationSec: 0, earnedXp: 0, earnedCoins: 0 };
  }

  // Post-transaction best-effort gamification, mirroring explicit completion.
  if (outcome.sessionStatus === "completed" && outcome.durationSec >= MIN_REWARD_DURATION_SEC) {
    const minutes = Math.floor(outcome.durationSec / 60);
    try {
      if (minutes > 0) {
        await awardPetXp(userId, minutes);
        await updateMissionProgress(userId, "sessions", 1);
        await updateMissionProgress(userId, "minutes", minutes);
      }
      if (outcome.earnedXp > 0) {
        await advanceBattlePass(userId, outcome.earnedXp);
      }
    } catch (err) {
      logger.warn({ err, userId }, "expired-session gamification failed (non-fatal)");
    }
  }

  logger.info({ userId, sessionId: session.id, status: outcome.sessionStatus, durationSec: outcome.durationSec }, "expired active session finalized");
  return { sessionId: outcome.session.id, sessionStatus: outcome.sessionStatus, durationSec: outcome.durationSec, earnedXp: outcome.earnedXp, earnedCoins: outcome.earnedCoins };
}

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
