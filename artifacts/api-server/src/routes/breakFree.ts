import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  breakFreeStreaksTable,
  breakFreeMoodsTable,
  breakFreePledgesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

  req.userId = userId;
  next();
}

function calcCurrentStreak(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const BLOCKLIST = [
  "fuck", "shit", "ass", "bitch", "cunt", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "dick", "cock", "pussy", "bastard",
];

function sanitizeMessage(msg: string): string {
  let out = msg.trim().slice(0, 100);
  for (const word of BLOCKLIST) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    out = out.replace(re, "***");
  }
  return out;
}

// GET /break-free/streak
router.get("/break-free/streak", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db.select()
      .from(breakFreeStreaksTable)
      .where(eq(breakFreeStreaksTable.userId, req.userId));

    if (!row) {
      res.json({ streak: null });
      return;
    }

    const currentStreak = calcCurrentStreak(row.startDate);
    const longestStreak = Math.max(currentStreak, row.longestStreak);

    if (currentStreak !== row.currentStreak || longestStreak !== row.longestStreak) {
      await db.update(breakFreeStreaksTable)
        .set({ currentStreak, longestStreak })
        .where(eq(breakFreeStreaksTable.id, row.id));
    }

    res.json({ streak: { ...row, currentStreak, longestStreak } });
  } catch (err) {
    logger.error({ err }, "break-free streak get error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /break-free/streak/start
router.post("/break-free/streak/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "startDate is required (YYYY-MM-DD)" });
    return;
  }

  const { startDate } = parsed.data;
  const currentStreak = calcCurrentStreak(startDate);

  try {
    const [existing] = await db.select({ id: breakFreeStreaksTable.id, longestStreak: breakFreeStreaksTable.longestStreak })
      .from(breakFreeStreaksTable)
      .where(eq(breakFreeStreaksTable.userId, req.userId));

    let row;
    if (existing) {
      [row] = await db.update(breakFreeStreaksTable)
        .set({ startDate, currentStreak, updatedAt: new Date() })
        .where(eq(breakFreeStreaksTable.id, existing.id))
        .returning();
    } else {
      [row] = await db.insert(breakFreeStreaksTable)
        .values({ userId: req.userId, startDate, currentStreak, longestStreak: currentStreak })
        .returning();
    }

    res.json({ streak: row });
  } catch (err) {
    logger.error({ err }, "break-free streak start error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /break-free/streak/relapse
router.post("/break-free/streak/relapse", authMiddleware, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0]!;

  try {
    const [existing] = await db.select()
      .from(breakFreeStreaksTable)
      .where(eq(breakFreeStreaksTable.userId, req.userId));

    const prevStreak = existing ? calcCurrentStreak(existing.startDate) : 0;
    const newLongest = existing ? Math.max(prevStreak, existing.longestStreak) : 0;

    let row;
    if (existing) {
      [row] = await db.update(breakFreeStreaksTable)
        .set({
          startDate: today,
          currentStreak: 0,
          longestStreak: newLongest,
          relapseCount: existing.relapseCount + 1,
          lastRelapseDate: today,
          updatedAt: new Date(),
        })
        .where(eq(breakFreeStreaksTable.id, existing.id))
        .returning();
    } else {
      [row] = await db.insert(breakFreeStreaksTable)
        .values({
          userId: req.userId,
          startDate: today,
          currentStreak: 0,
          longestStreak: 0,
          relapseCount: 1,
          lastRelapseDate: today,
        })
        .returning();
    }

    res.json({ streak: row });
  } catch (err) {
    logger.error({ err }, "break-free relapse error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /break-free/moods
router.get("/break-free/moods", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const moods = await db.select()
      .from(breakFreeMoodsTable)
      .where(eq(breakFreeMoodsTable.userId, req.userId))
      .orderBy(desc(breakFreeMoodsTable.createdAt))
      .limit(7);

    const today = new Date().toISOString().split("T")[0]!;
    const todayMood = moods.find(m => m.date === today)?.mood ?? null;

    res.json({ moods, todayMood });
  } catch (err) {
    logger.error({ err }, "break-free moods get error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /break-free/moods
router.post("/break-free/moods", authMiddleware, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ mood: z.number().int().min(1).max(5) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "mood must be 1–5" });
    return;
  }

  const today = new Date().toISOString().split("T")[0]!;

  try {
    let entry;
    const todayEntry = await db.select()
      .from(breakFreeMoodsTable)
      .where(eq(breakFreeMoodsTable.userId, req.userId))
      .then(rows => rows.find(r => r.date === today));

    if (todayEntry) {
      const [updated] = await db.update(breakFreeMoodsTable)
        .set({ mood: parsed.data.mood })
        .where(eq(breakFreeMoodsTable.id, todayEntry.id))
        .returning();
      entry = updated;
    } else {
      const [inserted] = await db.insert(breakFreeMoodsTable)
        .values({ userId: req.userId, mood: parsed.data.mood, date: today })
        .returning();
      entry = inserted;
    }

    res.json(entry);
  } catch (err) {
    logger.error({ err }, "break-free mood log error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /break-free/pledges (no auth)
router.get("/break-free/pledges", async (_req, res) => {
  try {
    const pledges = await db.select()
      .from(breakFreePledgesTable)
      .orderBy(desc(breakFreePledgesTable.postedAt))
      .limit(20);
    res.json({ pledges });
  } catch (err) {
    logger.error({ err }, "break-free pledges get error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /break-free/pledges (no auth)
router.post("/break-free/pledges", async (req: AuthRequest, res: Response) => {
  const schema = z.object({ message: z.string().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "message required, max 100 chars" });
    return;
  }

  const clean = sanitizeMessage(parsed.data.message);

  try {
    const [pledge] = await db.insert(breakFreePledgesTable)
      .values({ message: clean })
      .returning();
    res.json(pledge);
  } catch (err) {
    logger.error({ err }, "break-free pledge post error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as breakFreeRouter };
