import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { extractUserId } from "./auth";
import { db, questDefinitionsTable, userQuestProgressTable, userWalletsTable, notificationsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export const questsRouter = Router();

function getPeriod(type: string): string {
  const now = new Date();
  if (type === "daily") return now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  return `week-${monday.toISOString().split("T")[0]}`;
}

async function assignDailyQuests(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.select().from(userQuestProgressTable)
    .where(and(eq(userQuestProgressTable.userId, userId), eq(userQuestProgressTable.period, today)));
  if (existing.length >= 3) return existing;

  const allDailyQuests = await db.select().from(questDefinitionsTable)
    .where(and(eq(questDefinitionsTable.type, "daily"), eq(questDefinitionsTable.isActive, true)));

  const assigned = existing.map(e => e.questId);
  const available = allDailyQuests.filter(q => !assigned.includes(q.id));
  const toAssign = available.slice(0, 3 - existing.length);

  if (toAssign.length > 0) {
    const newAssignments = await db.insert(userQuestProgressTable).values(
      toAssign.map(q => ({ userId, questId: q.id, period: today }))
    ).returning();
    return [...existing, ...newAssignments];
  }
  return existing;
}

questsRouter.get("/quests", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await assignDailyQuests(req.userId);
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    const monday = new Date();
    monday.setDate(new Date().getDate() - ((dayOfWeek + 6) % 7));
    const weekPeriod = `week-${monday.toISOString().split("T")[0]}`;

    const [daily, weekly] = await Promise.all([
      db.select().from(userQuestProgressTable).where(and(eq(userQuestProgressTable.userId, req.userId), eq(userQuestProgressTable.period, today))),
      db.select().from(userQuestProgressTable).where(and(eq(userQuestProgressTable.userId, req.userId), eq(userQuestProgressTable.period, weekPeriod))),
    ]);

    const questIds = [...daily, ...weekly].map(p => p.questId);
    const defs = questIds.length > 0
      ? await db.select().from(questDefinitionsTable).where(inArray(questDefinitionsTable.id, questIds))
      : [];

    const enriched = (progs: typeof daily) => progs.map(p => ({
      ...p,
      quest: defs.find(d => d.id === p.questId),
    }));

    res.json({ daily: enriched(daily), weekly: enriched(weekly) });
  } catch (e) {
    res.status(500).json({ error: "Failed to load quests" });
  }
});

questsRouter.post("/quests/:questId/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { questId } = req.params as { questId: string };
  try {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    const monday = new Date();
    monday.setDate(new Date().getDate() - ((dayOfWeek + 6) % 7));
    const weekPeriod = `week-${monday.toISOString().split("T")[0]}`;

    const [prog] = await db.select().from(userQuestProgressTable)
      .where(and(eq(userQuestProgressTable.userId, req.userId), eq(userQuestProgressTable.questId, questId)))
      .limit(1);

    if (!prog || !prog.completed) return res.status(400).json({ error: "Quest not completed" });
    if (prog.claimedAt) return res.status(400).json({ error: "Already claimed" });

    const [def] = await db.select().from(questDefinitionsTable).where(eq(questDefinitionsTable.id, questId)).limit(1);
    if (!def) return res.status(404).json({ error: "Quest not found" });

    await db.update(userQuestProgressTable).set({ claimedAt: new Date() }).where(eq(userQuestProgressTable.id, prog.id));

    if (def.xpReward || def.coinReward) {
      const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      if (w) {
        await db.update(userWalletsTable).set({
          totalXp: w.totalXp + (def.xpReward ?? 0),
          coins: w.coins + (def.coinReward ?? 0),
        }).where(eq(userWalletsTable.userId, req.userId));
      }
    }

    res.json({ success: true, xpReward: def.xpReward, coinReward: def.coinReward });
  } catch (e) {
    res.status(500).json({ error: "Failed to claim quest" });
  }
});
