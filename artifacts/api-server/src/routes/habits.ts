import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  habitsTable, habitCompletionsTable, userWalletsTable, notificationsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { mintCoins } from "../lib/coinLedger";
import { logger } from "../lib/logger";

export const habitsRouter = Router();

const todayStr = () => new Date().toISOString().split("T")[0]!;

function calcStreak(completions: { date: string }[]): number {
  if (!completions.length) return 0;
  const sorted = [...completions].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = todayStr();
  let current = today;
  for (const c of sorted) {
    if (c.date === current) {
      streak++;
      const d = new Date(current);
      d.setDate(d.getDate() - 1);
      current = d.toISOString().split("T")[0]!;
    } else if (c.date < current) {
      break;
    }
  }
  return streak;
}

habitsRouter.get("/habits", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const habits = await db.select().from(habitsTable)
      .where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false)))
      .orderBy(habitsTable.createdAt);

    const today = todayStr();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
    const since = thirtyDaysAgo.toISOString().split("T")[0]!;

    const enriched = await Promise.all(habits.map(async h => {
      const completions = await db.select({ date: habitCompletionsTable.date })
        .from(habitCompletionsTable)
        .where(and(eq(habitCompletionsTable.habitId, h.id), gte(habitCompletionsTable.date, since)))
        .orderBy(desc(habitCompletionsTable.date));
      const completedToday = completions.some(c => c.date === today);
      const streak = calcStreak(completions);
      return { ...h, completedToday, streak, recentDates: completions.map(c => c.date) };
    }));

    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /habits error:");
    res.status(500).json({ error: "Failed to load habits" });
  }
});

habitsRouter.post("/habits", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, icon, color, frequency, targetDays } = req.body;
  if (!name?.trim() || typeof name !== "string") return res.status(400).json({ error: "name required" });
  if (name.trim().length > 100) return res.status(400).json({ error: "name too long (max 100 chars)" });
  if (typeof color === "string" && !/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: "color must be a hex value like #7C3AED" });
  if (typeof icon === "string" && icon.length > 10) return res.status(400).json({ error: "icon too long" });

  const [habit] = await db.insert(habitsTable).values({
    userId, name: name.trim().slice(0, 100),
    icon: (typeof icon === "string" ? icon : "⭐").slice(0, 10),
    color: (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#7C3AED"),
    frequency: (typeof frequency === "string" && ["daily", "weekly", "custom"].includes(frequency) ? frequency : "daily"),
    targetDays: (Array.isArray(targetDays) ? targetDays.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6) : [0,1,2,3,4,5,6]),
  }).returning();
  res.status(201).json(habit);
});

habitsRouter.patch("/habits/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id as string), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  // Only update fields that are explicitly provided and valid.
  // Never set a field to undefined — that corrupts the record.
  const { name, icon, color, frequency, targetDays, isArchived } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 100);
  if (typeof icon === "string") updates.icon = icon.slice(0, 10);
  if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) updates.color = color;
  if (typeof frequency === "string" && ["daily", "weekly", "custom"].includes(frequency)) updates.frequency = frequency;
  if (Array.isArray(targetDays)) updates.targetDays = targetDays.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6);
  if (typeof isArchived === "boolean") updates.isArchived = isArchived;

  const [updated] = await db.update(habitsTable)
    .set(updates)
    .where(eq(habitsTable.id, req.params.id as string)).returning();
  res.json(updated);
});

habitsRouter.delete("/habits/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await db.delete(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id as string), eq(habitsTable.userId, userId)));
  res.json({ ok: true });
});

habitsRouter.post("/habits/:id/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { date, note } = req.body;
  const completionDate = date || todayStr();

  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id as string), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const existing = await db.select().from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id as string), eq(habitCompletionsTable.date, completionDate))).limit(1);
  if (existing.length) return res.status(409).json({ error: "Already completed today" });

  await db.insert(habitCompletionsTable).values({ habitId: req.params.id as string, userId, date: completionDate, note });

  await db.update(habitsTable)
    .set({ totalCompletions: sql`total_completions + 1`, updatedAt: new Date() })
    .where(eq(habitsTable.id, req.params.id as string));

  const allCompletions = await db.select({ date: habitCompletionsTable.date })
    .from(habitCompletionsTable).where(eq(habitCompletionsTable.habitId, req.params.id as string))
    .orderBy(desc(habitCompletionsTable.date));
  const streak = calcStreak(allCompletions);

  await db.update(habitsTable)
    .set({
      currentStreak: streak,
      longestStreak: sql`GREATEST(longest_streak, ${streak})`,
      updatedAt: new Date(),
    })
    .where(eq(habitsTable.id, req.params.id as string));

  try {
    await db.update(userWalletsTable)
      .set({ totalXp: sql`total_xp + 25`, weeklyXp: sql`weekly_xp + 25` })
      .where(eq(userWalletsTable.userId, userId));
    await mintCoins(userId, 10, "habit_reward", {
      description: "Habit completed: +10 coins",
      metadata: { habitId: habit.id },
    });
  } catch {}

  res.json({ ok: true, streak, totalCompletions: habit.totalCompletions + 1 });
});

habitsRouter.delete("/habits/:id/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const date = (req.query.date as string) || todayStr();
  await db.delete(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id as string), eq(habitCompletionsTable.userId, userId), eq(habitCompletionsTable.date, date)));
  await db.update(habitsTable)
    .set({ totalCompletions: sql`GREATEST(0, total_completions - 1)`, updatedAt: new Date() })
    .where(eq(habitsTable.id, req.params.id as string));
  res.json({ ok: true });
});

habitsRouter.get("/habits/:id/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id as string), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const days = parseInt((req.query.days as string) || "90");
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0]!;

  const completions = await db.select()
    .from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id as string), gte(habitCompletionsTable.date, sinceStr)))
    .orderBy(desc(habitCompletionsTable.date));

  res.json({ habit, completions });
});

habitsRouter.get("/habits/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const habits = await db.select().from(habitsTable)
      .where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false)));

    const today = todayStr();
    let completedToday = 0;
    let totalStreak = 0;
    for (const h of habits) {
      const c = await db.select().from(habitCompletionsTable)
        .where(and(eq(habitCompletionsTable.habitId, h.id), eq(habitCompletionsTable.date, today))).limit(1);
      if (c.length) completedToday++;
      totalStreak += h.currentStreak;
    }

    res.json({
      total: habits.length,
      completedToday,
      remaining: habits.length - completedToday,
      avgStreak: habits.length ? Math.round(totalStreak / habits.length) : 0,
      longestStreak: Math.max(0, ...habits.map(h => h.longestStreak)),
    });
  } catch (err) {
    logger.error({ err }, "GET /habits/stats error:");
    res.status(500).json({ error: "Failed to load habit stats" });
  }
});
