import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, userDreamsTable, focusSessionsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { userZone } from "../lib/userZone";
import { dayKeyInZone } from "../lib/timezone";
import { DREAM_TYPES, DREAM_SYSTEMS } from "../lib/dreamSystems";

const router = Router();

/** Today's plan, the weekly split, and where the next milestone sits. */
function buildSystem(dreamType: string, dailyTargetMinutes: number, progressPct: number, daysLeft: number | null) {
  const system = DREAM_SYSTEMS[dreamType] ?? DREAM_SYSTEMS.custom!;
  const total = system.blocks.reduce((sum, b) => sum + b.minutes, 0);
  // Scale the template's day to the learner's own daily target.
  const scale = total > 0 && dailyTargetMinutes > 0 ? dailyTargetMinutes / total : 1;
  const blocks = system.blocks.map(b => ({
    ...b,
    minutes: Math.max(10, Math.round((b.minutes * scale) / 5) * 5),
    weightPercent: Math.round((b.minutes / total) * 100),
  }));

  const perMilestone = 100 / system.milestones.length;
  const milestoneIndex = Math.min(system.milestones.length - 1, Math.floor(progressPct / perMilestone));
  const milestones = system.milestones.map((label, i) => ({
    label,
    reached: progressPct >= (i + 1) * perMilestone,
    current: i === milestoneIndex && progressPct < 100,
  }));

  return {
    tagline: system.tagline,
    subjects: system.subjects,
    blocks,
    milestoneProgressPercent: perMilestone,
    milestones,
    nextMilestone: milestones.find(m => !m.reached)?.label ?? "All milestones reached — set a bigger dream.",
    dailyHabit: system.dailyHabit,
    checkIn: system.checkIn,
    daysLeft,
  };
}

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
        // The system the learner should follow *because* of this dream.
        system: buildSystem(dream.dreamType, dream.dailyTargetMinutes ?? 120, progressPct, daysLeft),
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
    const today = dayKeyInZone(Date.now(), await userZone(req.userId));
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
