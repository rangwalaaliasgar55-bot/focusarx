import { Router } from "express";
import { db, focusSessionsTable, activeSessionsTable, studyStreaksTable } from "@workspace/db";
import { eq, and, desc, gte, lt } from "drizzle-orm";
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
    await updateStreak(req.userId);
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "create session error");
    res.status(500).json({ error: "Internal error" });
  }
});

async function updateStreak(userId: string) {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [existing] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));
    if (!existing) {
      await db.insert(studyStreaksTable).values({ userId, currentStreak: 1, longestStreak: 1, lastStudyDate: today });
      return;
    }
    if (existing.lastStudyDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]!;
    const newStreak = existing.lastStudyDate === yesterday ? existing.currentStreak + 1 : 1;
    await db.update(studyStreaksTable).set({ currentStreak: newStreak, longestStreak: Math.max(newStreak, existing.longestStreak), lastStudyDate: today, updatedAt: new Date() }).where(eq(studyStreaksTable.userId, userId));
  } catch {}
}

export { router as sessionsRouter };
