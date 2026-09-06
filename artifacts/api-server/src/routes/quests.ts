import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, questDefinitionsTable, userQuestProgressTable, userWalletsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, isNull as sqlIsNull, sql } from "drizzle-orm";
import { mintCoins } from "../lib/coinLedger";
import { logger } from "../lib/logger";
import { resolveUserZone, LEGACY_FALLBACK_ZONE } from "../lib/timezone";
import { questDailyPeriod, questWeeklyPeriod } from "../lib/questProgress";

export const questsRouter = Router();

async function zoneFor(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ timezone: usersTable.timezone }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return resolveUserZone(user?.timezone);
  } catch {
    return LEGACY_FALLBACK_ZONE;
  }
}

/**
 * Deterministic per-user, per-day rotation. `Math.random`-free so two
 * requests racing on the same morning pick the same three quests, and
 * `rotationWeight` finally does something: heavier quests appear more often.
 */
function pickRotation<T extends { id: string; rotationWeight: number }>(pool: T[], count: number, seedKey: string): T[] {
  let h = 2166136261;
  for (const ch of seedKey) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const next = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, q) => sum + Math.max(1, q.rotationWeight), 0);
    let r = next() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= Math.max(1, remaining[idx]!.rotationWeight);
      if (r <= 0) break;
    }
    picked.push(remaining.splice(Math.min(idx, remaining.length - 1), 1)[0]!);
  }
  return picked;
}

async function assignPeriodQuests(userId: string, type: "daily" | "weekly", period: string, count: number) {
  const existing = await db.select().from(userQuestProgressTable)
    .where(and(eq(userQuestProgressTable.userId, userId), eq(userQuestProgressTable.period, period)));
  if (existing.length >= count) return existing;

  const pool = await db.select().from(questDefinitionsTable)
    .where(and(eq(questDefinitionsTable.type, type), eq(questDefinitionsTable.isActive, true)));

  const assigned = new Set(existing.map((e) => e.questId));
  const available = pool.filter((q) => !assigned.has(q.id));
  const toAssign = pickRotation(available, count - existing.length, `${userId}:${period}`);
  if (toAssign.length === 0) return existing;

  const inserted = await db.insert(userQuestProgressTable)
    .values(toAssign.map((q) => ({ userId, questId: q.id, period })))
    .onConflictDoNothing()
    .returning();
  return [...existing, ...inserted];
}

questsRouter.get("/quests", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const zone = await zoneFor(req.userId);
    const today = questDailyPeriod(Date.now(), zone);
    const weekPeriod = questWeeklyPeriod(Date.now(), zone);

    // Weekly quests were defined in the admin builder and read here, but
    // never assigned — only daily ones were. Both periods rotate now.
    const [daily, weekly] = await Promise.all([
      assignPeriodQuests(req.userId, "daily", today, 3),
      assignPeriodQuests(req.userId, "weekly", weekPeriod, 2),
    ]);

    const questIds = [...daily, ...weekly].map((p) => p.questId);
    const defs = questIds.length > 0
      ? await db.select().from(questDefinitionsTable).where(inArray(questDefinitionsTable.id, questIds))
      : [];

    const enriched = (progs: typeof daily) => progs.map((p) => ({
      ...p,
      quest: defs.find((d) => d.id === p.questId),
    }));

    res.json({ daily: enriched(daily), weekly: enriched(weekly), periods: { daily: today, weekly: weekPeriod } });
  } catch (err) {
    logger.error({ err }, "quests load error");
    res.status(500).json({ error: "Failed to load quests" });
  }
});

questsRouter.post("/quests/:questId/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { questId } = req.params as { questId: string };
  try {
    const zone = await zoneFor(req.userId);
    const periods = [questDailyPeriod(Date.now(), zone), questWeeklyPeriod(Date.now(), zone)];

    // Scoped to the live periods: the old lookup took the first row for the
    // quest id regardless of period, so a stale unclaimed row from a past
    // week could be claimed (or block the current one).
    const [prog] = await db.select().from(userQuestProgressTable)
      .where(and(
        eq(userQuestProgressTable.userId, req.userId),
        eq(userQuestProgressTable.questId, questId),
        inArray(userQuestProgressTable.period, periods),
      ))
      .limit(1);

    if (!prog || !prog.completed) return res.status(400).json({ error: "Quest not completed" });
    if (prog.claimedAt) return res.status(400).json({ error: "Already claimed" });

    const [def] = await db.select().from(questDefinitionsTable).where(eq(questDefinitionsTable.id, questId)).limit(1);
    if (!def) return res.status(404).json({ error: "Quest not found" });

    // Claim is a compare-and-set on `claimed_at IS NULL`: two parallel claims
    // used to both pass the read above and both mint the reward.
    const [claimed] = await db.update(userQuestProgressTable)
      .set({ claimedAt: new Date() })
      .where(and(eq(userQuestProgressTable.id, prog.id), sqlIsNull(userQuestProgressTable.claimedAt)))
      .returning({ id: userQuestProgressTable.id });
    if (!claimed) return res.status(400).json({ error: "Already claimed" });

    if (def.coinReward) {
      await mintCoins(req.userId, def.coinReward, "quest_reward", {
        description: `Quest reward: +${def.coinReward} coins`,
        metadata: { questId, period: prog.period },
      });
    }
    if (def.xpReward) {
      // Atomic increment, not read-then-write, so a session completing at the
      // same moment cannot overwrite this credit.
      await db.update(userWalletsTable)
        .set({ totalXp: sql`${userWalletsTable.totalXp} + ${def.xpReward}` })
        .where(eq(userWalletsTable.userId, req.userId));
    }

    res.json({ success: true, xpReward: def.xpReward, coinReward: def.coinReward });
  } catch (err) {
    logger.error({ err }, "quest claim error");
    res.status(500).json({ error: "Failed to claim quest" });
  }
});
