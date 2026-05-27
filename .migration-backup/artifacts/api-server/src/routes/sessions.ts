import { Router } from "express";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable, userWalletsTable } from "@workspace/db";
import { eq, and, desc, gte, lt, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
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
  const { sessionId, activeSeconds, secondsLeft, timerStatus, mode, focusScore, focusQuality, focusState, distractionCount, lastSeenFaceAt, focusTimeline, monitorEnabled } = req.body as any;
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
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
  const { mode, durationSec, focusScore, focusQuality, stabilityRating, focusTimeline, sessionInsights } = req.body as any;
  try {
    const [session] = await db.insert(focusSessionsTable).values({
      userId: req.userId, mode: mode ?? "focus", durationSec: durationSec ?? 0,
      completedAt: new Date(), focusScore, focusQuality, stabilityRating,
      focusTimeline: typeof focusTimeline === "string" ? focusTimeline : JSON.stringify(focusTimeline ?? []),
      sessionInsights: typeof sessionInsights === "string" ? sessionInsights : JSON.stringify(sessionInsights ?? null),
    }).returning();

    const streakUpdated = await updateStreak(req.userId);

    // Award XP and coins for focus sessions
    let earnedXp = 0;
    let earnedCoins = 0;
    if ((mode ?? "focus") === "focus" && durationSec > 0) {
      const minutes = Math.floor(durationSec / 60);
      earnedXp = minutes * 20;
      earnedCoins = Math.floor(minutes / 5) * 10;
      if (durationSec >= 1500) earnedCoins += 50; // Pomodoro bonus
      if (earnedXp > 0 || earnedCoins > 0) {
        await awardGamification(req.userId, earnedXp, earnedCoins);
      }
    }

    res.json({ session, streakUpdated, earnedXp, earnedCoins });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: "Internal error" });
  }
});

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
    return true;
  } catch {
    return false;
  }
}

async function awardGamification(userId: string, xp: number, coins: number) {
  try {
    // Check if weekly XP needs resetting (Monday of current week)
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
    await db.update(userWalletsTable).set({
      coins: wallet.coins + coins,
      totalXp: wallet.totalXp + xp,
      weeklyXp: needsReset ? xp : wallet.weeklyXp + xp,
      weeklyXpResetAt: needsReset ? monday : wallet.weeklyXpResetAt,
      updatedAt: new Date(),
    }).where(eq(userWalletsTable.userId, userId));
  } catch (err) {
    logger.error({ err }, "award gamification error");
  }
}

export { router as sessionsRouter };
