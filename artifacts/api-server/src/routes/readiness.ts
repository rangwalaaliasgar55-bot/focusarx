import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import { readinessLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { userZone } from "../lib/userZone";
import { dayKeyInZone } from "../lib/timezone";

const router = Router();

function calcScore(sleep: number, stress: number, energy: number): number {
  // sleep: 1-5, stress: 1-5 (lower=better), energy: 1-5
  const raw = (sleep + (6 - stress) + energy) / 15;
  return Math.round(raw * 100);
}

function recLength(score: number): number {
  if (score >= 80) return 90;
  if (score >= 50) return 45;
  return 25;
}

router.get("/readiness/today", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const today = dayKeyInZone(Date.now(), await userZone(req.userId));
    const [log] = await db.select().from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));
    res.json({ log: log ?? null });
  } catch (err) {
    logger.error({ err }, "readiness today error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/readiness/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.select().from(readinessLogsTable)
      .where(eq(readinessLogsTable.userId, req.userId))
      .orderBy(desc(readinessLogsTable.createdAt))
      .limit(14);
    const isRecoveryMode = logs.length >= 2 &&
      logs[0]!.score < 50 && logs[1]!.score < 50;
    res.json({ logs, isRecoveryMode });
  } catch (err) {
    logger.error({ err }, "readiness history error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/readiness", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sleep, stress, energy, hrv } = req.body as { sleep?: number; stress?: number; energy?: number; hrv?: number };
  if (!sleep || !stress || !energy) {
    res.status(400).json({ error: "sleep, stress and energy are required (1-5)" });
    return;
  }
  const today = dayKeyInZone(Date.now(), await userZone(req.userId));
  const score = calcScore(sleep, stress, energy);
  const sessionLengthRec = recLength(score);
  try {
    const [existing] = await db.select({ id: readinessLogsTable.id })
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));
    let log;
    if (existing) {
      [log] = await db.update(readinessLogsTable)
        .set({ sleep, stress, energy, score, sessionLengthRec, hrv: hrv ?? null })
        .where(eq(readinessLogsTable.id, existing.id))
        .returning();
    } else {
      [log] = await db.insert(readinessLogsTable)
        .values({ userId: req.userId, date: today, sleep, stress, energy, score, sessionLengthRec, hrv: hrv ?? null })
        .returning();
    }
    res.json({ log });
  } catch (err) {
    logger.error({ err }, "readiness save error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * Quick "energy check-in" used by FocusMoodWidget (SidePanel). The widget only
 * collects a 1-5 mood, so it maps onto the readiness log's `energy` field.
 * Sleep/stress are left untouched when a full check-in already exists today,
 * and default to neutral (3) otherwise so `score` stays meaningful.
 */
router.post("/mood", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mood } = (req.body ?? {}) as { mood?: number };
  const energy = Number(mood);
  if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
    res.status(400).json({ error: "mood must be an integer from 1 to 5" });
    return;
  }
  const today = dayKeyInZone(Date.now(), await userZone(req.userId));
  try {
    const [existing] = await db.select({
      id: readinessLogsTable.id,
      sleep: readinessLogsTable.sleep,
      stress: readinessLogsTable.stress,
    }).from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId!), eq(readinessLogsTable.date, today)));

    const sleep = existing?.sleep ?? 3;
    const stress = existing?.stress ?? 3;
    const score = calcScore(sleep, stress, energy);
    const sessionLengthRec = recLength(score);

    let log;
    if (existing) {
      [log] = await db.update(readinessLogsTable)
        .set({ energy, score, sessionLengthRec })
        .where(eq(readinessLogsTable.id, existing.id))
        .returning();
    } else {
      [log] = await db.insert(readinessLogsTable)
        .values({ userId: req.userId!, date: today, sleep, stress, energy, score, sessionLengthRec, hrv: null })
        .returning();
    }
    res.json({ ok: true, mood: energy, log });
  } catch (err) {
    logger.error({ err }, "mood save error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as readinessRouter };
