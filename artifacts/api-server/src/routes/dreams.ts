import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, userDreamsTable, focusSessionsTable, userWalletsTable } from "@workspace/db";
import { eq, and, gte, sum } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const DREAM_TYPES = [
  { id: "iit", label: "IIT/JEE", emoji: "⚙️", desc: "Crack India's toughest engineering exam", targetMinutes: 360 },
  { id: "neet", label: "NEET/AIIMS", emoji: "🩺", desc: "Become a doctor and heal the world", targetMinutes: 360 },
  { id: "upsc", label: "UPSC/IAS", emoji: "🏛️", desc: "Serve the nation as a civil servant", targetMinutes: 300 },
  { id: "cat", label: "CAT/MBA", emoji: "💼", desc: "Lead organizations and build your future", targetMinutes: 240 },
  { id: "startup", label: "Launch a Startup", emoji: "🚀", desc: "Build something people love", targetMinutes: 240 },
  { id: "promotion", label: "Career Promotion", emoji: "📈", desc: "Rise to the top of your field", targetMinutes: 180 },
  { id: "coding", label: "Crack Coding Interviews", emoji: "💻", desc: "Land your dream tech job", targetMinutes: 240 },
  { id: "research", label: "Research/PhD", emoji: "🔬", desc: "Push the boundaries of knowledge", targetMinutes: 300 },
  { id: "language", label: "Learn a Language", emoji: "🌍", desc: "Connect with the world", targetMinutes: 120 },
  { id: "fitness", label: "Get Fit & Healthy", emoji: "💪", desc: "Build the body you deserve", targetMinutes: 90 },
  { id: "creative", label: "Creative Mastery", emoji: "🎨", desc: "Master your art form", targetMinutes: 180 },
  { id: "custom", label: "My Own Dream", emoji: "✨", desc: "Define your own path", targetMinutes: 180 },
];

router.get("/dreams/types", (_req, res) => {
  res.json({ dreamTypes: DREAM_TYPES });
});

router.get("/dreams", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [dream] = await db.select().from(userDreamsTable).where(eq(userDreamsTable.userId, req.userId));
    if (!dream) { res.json({ dream: null }); return; }

    // Calculate progress based on focus sessions since dream start
    let totalMinutesLogged = 0;
    if (dream.startDate) {
      const startDate = new Date(dream.startDate);
      const sessions = await db.select().from(focusSessionsTable)
        .where(and(
          eq(focusSessionsTable.userId, req.userId),
          gte(focusSessionsTable.completedAt, startDate)
        ));
      totalMinutesLogged = sessions.reduce((sum, s) => sum + Math.floor(s.durationSec / 60), 0);
    }

    // Calculate expected minutes by now
    const startDate = dream.startDate ? new Date(dream.startDate) : new Date(dream.createdAt);
    const daysSinceStart = Math.max(1, Math.floor((Date.now() - startDate.getTime()) / 86400000));
    const expectedMinutes = daysSinceStart * (dream.dailyTargetMinutes ?? 120);
    const progressPct = expectedMinutes > 0 ? Math.min(100, Math.round((totalMinutesLogged / expectedMinutes) * 100)) : 0;

    // Calculate days to goal (rough estimate based on current pace)
    const daysLeft = dream.targetDate ? Math.max(0, Math.floor((new Date(dream.targetDate).getTime() - Date.now()) / 86400000)) : null;

    res.json({
      dream: {
        ...dream,
        totalMinutesLogged,
        progressPct,
        daysSinceStart,
        daysLeft,
        expectedMinutes,
        onTrack: progressPct >= 80,
      }
    });
  } catch (err) {
    logger.error({ err }, "get dream error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/dreams", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { dreamType, customGoal, targetDate, dailyTargetMinutes, emoji } = req.body as any;
  if (!dreamType) { res.status(400).json({ error: "dreamType required" }); return; }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const type = DREAM_TYPES.find(d => d.id === dreamType);
    const [existing] = await db.select().from(userDreamsTable).where(eq(userDreamsTable.userId, req.userId));

    if (existing) {
      const [updated] = await db.update(userDreamsTable).set({
        dreamType, customGoal: customGoal || null,
        targetDate: targetDate || null,
        dailyTargetMinutes: dailyTargetMinutes || type?.targetMinutes || 180,
        emoji: emoji || type?.emoji || "🎯",
        updatedAt: new Date(),
      }).where(eq(userDreamsTable.userId, req.userId)).returning();
      res.json({ dream: updated });
    } else {
      const [dream] = await db.insert(userDreamsTable).values({
        userId: req.userId,
        dreamType, customGoal: customGoal || null,
        targetDate: targetDate || null,
        dailyTargetMinutes: dailyTargetMinutes || type?.targetMinutes || 180,
        emoji: emoji || type?.emoji || "🎯",
        startDate: today,
      }).returning();
      res.json({ dream });
    }
  } catch (err) {
    logger.error({ err }, "create dream error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as dreamsRouter };
