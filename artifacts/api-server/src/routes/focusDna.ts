import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import {
  db, focusDnaTable, focusSessionsTable, distractionLogsTable,
} from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { clockInZone } from "../lib/timezone";
import { userZone } from "../lib/userZone";
import { generateAi } from "../lib/aiProvider";

const router = Router();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ARCHETYPES = [
  { name: "Night Sprinter",  colorPrimary: "#7C3AED", colorSecondary: "#A78BFA", icon: "🌙" },
  { name: "Deep Diver",      colorPrimary: "#0EA5E9", colorSecondary: "#38BDF8", icon: "🌊" },
  { name: "Chaos Warrior",   colorPrimary: "#EF4444", colorSecondary: "#F97316", icon: "⚡" },
  { name: "Morning Monk",    colorPrimary: "#F59E0B", colorSecondary: "#FCD34D", icon: "☀️" },
  { name: "Steady Climber",  colorPrimary: "#10B981", colorSecondary: "#34D399", icon: "🏔️" },
  { name: "Flow Phantom",    colorPrimary: "#8B5CF6", colorSecondary: "#C4B5FD", icon: "👻" },
  { name: "Iron Scheduler",  colorPrimary: "#64748B", colorSecondary: "#94A3B8", icon: "🤖" },
  { name: "Spark Chaser",    colorPrimary: "#EC4899", colorSecondary: "#F472B6", icon: "✨" },
];

router.get("/focus-dna", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [dna] = await db.select().from(focusDnaTable).where(eq(focusDnaTable.userId, req.userId));
    const [{ value: totalSessions }] = await db
      .select({ value: count() })
      .from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId));
    res.json({ dna: dna ?? null, totalSessions: Number(totalSessions) });
  } catch (err) {
    logger.error({ err }, "get focus-dna error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/focus-dna/generate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await db
      .select()
      .from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId))
      .orderBy(desc(focusSessionsTable.createdAt))
      .limit(100);

    if (sessions.length < 3) {
      res.status(400).json({ error: "Need at least 3 sessions to generate Focus DNA." });
      return;
    }

    const distractions = await db
      .select({ reason: distractionLogsTable.reason, hour: distractionLogsTable.hour })
      .from(distractionLogsTable)
      .where(eq(distractionLogsTable.userId, req.userId))
      .orderBy(desc(distractionLogsTable.createdAt))
      .limit(50);

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    let totalDurationSec = 0;

    const zone = await userZone(req.userId);
    for (const s of sessions) {
      totalDurationSec += s.durationSec;
      const { hour, weekday } = clockInZone(s.completedAt ?? s.createdAt, zone);
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      dayCounts[weekday] = (dayCounts[weekday] ?? 0) + 1;
    }

    const topHour = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12);
    const topDay = Number(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1);
    const avgSessionMin = Math.round(totalDurationSec / sessions.length / 60);
    const strongestDay = DAYS[topDay] ?? "Monday";

    const distractionFreq: Record<string, number> = {};
    for (const d of distractions) {
      distractionFreq[d.reason] = (distractionFreq[d.reason] ?? 0) + 1;
    }
    const biggestWeakness = Object.entries(distractionFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Social media";

    let archetypeIdx = 0;
    if (topHour >= 20 || topHour < 4) archetypeIdx = 0;
    else if (avgSessionMin >= 45) archetypeIdx = 1;
    else if (sessions.length > 50) archetypeIdx = 2;
    else if (topHour >= 5 && topHour < 10) archetypeIdx = 3;
    else if (avgSessionMin >= 30 && avgSessionMin < 45) archetypeIdx = 4;
    else if (distractions.length < 5) archetypeIdx = 5;
    else if (strongestDay === "Monday" || strongestDay === "Tuesday") archetypeIdx = 6;
    else archetypeIdx = 7;

    const archetype = ARCHETYPES[archetypeIdx]!;
    const hrFmt = topHour === 0 ? "12am" : topHour < 12 ? `${topHour}am` : topHour === 12 ? "12pm" : `${topHour - 12}pm`;

    const aiResult = await generateAi({
      purpose: "focus_dna_desc",
      prompt: `Write a 2-sentence personality description for someone with the focus archetype "${archetype.name}".\nTheir stats: peak focus hour ${hrFmt}, avg session ${avgSessionMin} min, strongest day ${strongestDay}, biggest distraction: ${biggestWeakness}.\nMake it feel like a trading card personality — dramatic, accurate, motivating.`,
      system: "You write punchy, insightful personality descriptions for a focus productivity app called FocusArx powered by Google Gemini. Keep it under 50 words, no lists, no markdown.",
      maxTokens: 120,
      userId: req.userId,
    });

    const description = aiResult?.text?.trim()
      ?? `A ${archetype.name} who dominates at ${hrFmt} with relentless ${avgSessionMin}-minute focus blocks. ${strongestDay}s are your superpower — use them.`;

    const [existing] = await db.select().from(focusDnaTable).where(eq(focusDnaTable.userId, req.userId));

    let dna;
    if (existing) {
      [dna] = await db.update(focusDnaTable).set({
        archetype: archetype.name, description,
        colorPrimary: archetype.colorPrimary, colorSecondary: archetype.colorSecondary,
        icon: archetype.icon, topFocusHour: topHour, avgSessionMin, strongestDay,
        biggestWeakness, sessionCountAtGeneration: sessions.length,
        generatedAt: new Date(), updatedAt: new Date(),
      }).where(eq(focusDnaTable.userId, req.userId)).returning();
    } else {
      [dna] = await db.insert(focusDnaTable).values({
        userId: req.userId, archetype: archetype.name, description,
        colorPrimary: archetype.colorPrimary, colorSecondary: archetype.colorSecondary,
        icon: archetype.icon, topFocusHour: topHour, avgSessionMin, strongestDay,
        biggestWeakness, sessionCountAtGeneration: sessions.length,
      }).returning();
    }

    res.json({ dna, isNew: !existing });
  } catch (err) {
    logger.error({ err }, "generate focus-dna error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as focusDnaRouter };
