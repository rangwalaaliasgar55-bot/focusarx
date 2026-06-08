import { Router } from "express";
import { db } from "@workspace/db";
import {
  habitsTable, habitCompletionsTable, userWalletsTable, notificationsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, gte } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

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

habitsRouter.get("/habits", auth, async (req, res) => {
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
});

habitsRouter.post("/habits", auth, async (req, res) => {
  const userId = req.userId!;
  const { name, icon, color, frequency, targetDays } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  const [habit] = await db.insert(habitsTable).values({
    userId, name: name.trim(),
    icon: icon || "⭐",
    color: color || "#7C3AED",
    frequency: frequency || "daily",
    targetDays: targetDays || [0,1,2,3,4,5,6],
  }).returning();
  res.status(201).json(habit);
});

habitsRouter.patch("/habits/:id", auth, async (req, res) => {
  const userId = req.userId!;
  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const { name, icon, color, frequency, targetDays, isArchived } = req.body;
  const [updated] = await db.update(habitsTable)
    .set({ name, icon, color, frequency, targetDays, isArchived, updatedAt: new Date() })
    .where(eq(habitsTable.id, req.params.id)).returning();
  res.json(updated);
});

habitsRouter.delete("/habits/:id", auth, async (req, res) => {
  const userId = req.userId!;
  await db.delete(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id), eq(habitsTable.userId, userId)));
  res.json({ ok: true });
});

habitsRouter.post("/habits/:id/complete", auth, async (req, res) => {
  const userId = req.userId!;
  const { date, note } = req.body;
  const completionDate = date || todayStr();

  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const existing = await db.select().from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id), eq(habitCompletionsTable.date, completionDate))).limit(1);
  if (existing.length) return res.status(409).json({ error: "Already completed today" });

  await db.insert(habitCompletionsTable).values({ habitId: req.params.id, userId, date: completionDate, note });

  await db.update(habitsTable)
    .set({ totalCompletions: sql`total_completions + 1`, updatedAt: new Date() })
    .where(eq(habitsTable.id, req.params.id));

  const allCompletions = await db.select({ date: habitCompletionsTable.date })
    .from(habitCompletionsTable).where(eq(habitCompletionsTable.habitId, req.params.id))
    .orderBy(desc(habitCompletionsTable.date));
  const streak = calcStreak(allCompletions);

  await db.update(habitsTable)
    .set({
      currentStreak: streak,
      longestStreak: sql`GREATEST(longest_streak, ${streak})`,
      updatedAt: new Date(),
    })
    .where(eq(habitsTable.id, req.params.id));

  try {
    await db.update(userWalletsTable)
      .set({ coins: sql`coins + 10`, totalXp: sql`total_xp + 25`, weeklyXp: sql`weekly_xp + 25` })
      .where(eq(userWalletsTable.userId, userId));
  } catch {}

  res.json({ ok: true, streak, totalCompletions: habit.totalCompletions + 1 });
});

habitsRouter.delete("/habits/:id/complete", auth, async (req, res) => {
  const userId = req.userId!;
  const date = (req.query.date as string) || todayStr();
  await db.delete(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id), eq(habitCompletionsTable.userId, userId), eq(habitCompletionsTable.date, date)));
  await db.update(habitsTable)
    .set({ totalCompletions: sql`GREATEST(0, total_completions - 1)`, updatedAt: new Date() })
    .where(eq(habitsTable.id, req.params.id));
  res.json({ ok: true });
});

habitsRouter.get("/habits/:id/history", auth, async (req, res) => {
  const userId = req.userId!;
  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, req.params.id), eq(habitsTable.userId, userId))).limit(1);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const days = parseInt((req.query.days as string) || "90");
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0]!;

  const completions = await db.select()
    .from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, req.params.id), gte(habitCompletionsTable.date, sinceStr)))
    .orderBy(desc(habitCompletionsTable.date));

  res.json({ habit, completions });
});

habitsRouter.get("/habits/stats", auth, async (req, res) => {
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
});
