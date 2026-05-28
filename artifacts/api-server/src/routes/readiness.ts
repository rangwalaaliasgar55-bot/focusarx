import { Router } from "express";
import { db } from "@workspace/db";
import { readinessLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

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

router.get("/readiness/today", auth, async (req: any, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [log] = await db.select().from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));
    res.json({ log: log ?? null });
  } catch (err) {
    logger.error({ err }, "readiness today error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/readiness/history", auth, async (req: any, res) => {
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

router.post("/readiness", auth, async (req: any, res) => {
  const { sleep, stress, energy, hrv } = req.body as { sleep?: number; stress?: number; energy?: number; hrv?: number };
  if (!sleep || !stress || !energy) {
    res.status(400).json({ error: "sleep, stress and energy are required (1-5)" });
    return;
  }
  const today = new Date().toISOString().split("T")[0]!;
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

export { router as readinessRouter };
