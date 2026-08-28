import { Router } from "express";
import { db, sessionGhostsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { sendUnauthorized(res); return; }
  req.userId = userId;
  next();
}

router.get("/ghosts", auth, async (req: any, res) => {
  try {
    const ghosts = await db
      .select()
      .from(sessionGhostsTable)
      .where(eq(sessionGhostsTable.userId, req.userId))
      .orderBy(desc(sessionGhostsTable.bestDurationSec));
    res.json({ ghosts });
  } catch (err) {
    logger.error({ err }, "get ghosts error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/ghosts/:category", auth, async (req: any, res) => {
  try {
    const category = decodeURIComponent(req.params.category as string);
    const [ghost] = await db
      .select()
      .from(sessionGhostsTable)
      .where(and(
        eq(sessionGhostsTable.userId, req.userId),
        eq(sessionGhostsTable.taskCategory, category),
      ));
    res.json({ ghost: ghost ?? null });
  } catch (err) {
    logger.error({ err }, "get ghost by category error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/ghosts", auth, async (req: any, res) => {
  const { taskCategory, durationSec, unbrokenSec, sessionId } = req.body as {
    taskCategory?: string;
    durationSec?: number;
    unbrokenSec?: number;
    sessionId?: string;
  };

  const category = taskCategory?.trim() || "General";
  const dur = durationSec ?? 0;
  const unbroken = unbrokenSec ?? 0;

  try {
    const [existing] = await db
      .select()
      .from(sessionGhostsTable)
      .where(and(
        eq(sessionGhostsTable.userId, req.userId),
        eq(sessionGhostsTable.taskCategory, category),
      ));

    const isNewPR = !existing || dur > existing.bestDurationSec;
    const isUnbrokenPR = !existing || unbroken > existing.bestUnbrokenSec;

    let ghost;
    if (!existing) {
      [ghost] = await db
        .insert(sessionGhostsTable)
        .values({
          userId: req.userId,
          taskCategory: category,
          bestDurationSec: dur,
          bestUnbrokenSec: unbroken,
          sessionId: sessionId ?? null,
        })
        .returning();
    } else if (isNewPR || isUnbrokenPR) {
      [ghost] = await db
        .update(sessionGhostsTable)
        .set({
          bestDurationSec: isNewPR ? dur : existing.bestDurationSec,
          bestUnbrokenSec: isUnbrokenPR ? unbroken : existing.bestUnbrokenSec,
          sessionId: isNewPR ? (sessionId ?? null) : existing.sessionId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(sessionGhostsTable.userId, req.userId),
          eq(sessionGhostsTable.taskCategory, category),
        ))
        .returning();
    } else {
      ghost = existing;
    }

    res.json({ ghost, isNewPR, isUnbrokenPR });
  } catch (err) {
    logger.error({ err }, "post ghost error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as ghostsRouter };
