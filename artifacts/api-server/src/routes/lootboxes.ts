import { Router } from "express";
import { extractUserId } from "./auth";
import { db } from "@workspace/db";
import { lootBoxTypesTable, userLootBoxesTable, userWalletsTable, notificationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.user = { id: userId };
  next();
}

export const lootboxesRouter = Router();

function pickReward(rewards: any[]): any {
  const total = rewards.reduce((s: number, r: any) => s + (r.weight ?? 10), 0);
  let rand = Math.random() * total;
  for (const r of rewards) {
    rand -= r.weight ?? 10;
    if (rand <= 0) return r;
  }
  return rewards[rewards.length - 1];
}

function describeReward(r: any): { label: string; description: string; emoji: string } {
  switch (r.type) {
    case "coins": return { label: `${r.value} Coins`, description: `You earned ${r.value} coins!`, emoji: "🪙" };
    case "xp":    return { label: `${r.value} XP`, description: `You gained ${r.value} XP!`, emoji: "⚡" };
    case "streak_shield": return { label: "Streak Shield", description: `Your streak is protected for ${r.value} day(s)!`, emoji: "🛡️" };
    case "xp_boost": return { label: "XP Booster", description: "Your next session earns double XP!", emoji: "🚀" };
    case "marketplace_item": return { label: "Marketplace Item", description: `A ${r.rarity ?? "rare"} cosmetic item!`, emoji: "🎁" };
    case "battle_pass_tiers": return { label: `${r.value} Battle Pass Tiers`, description: `Skip ahead ${r.value} tiers!`, emoji: "🏆" };
    default: return { label: "Mystery Reward", description: "A surprise reward!", emoji: "✨" };
  }
}

lootboxesRouter.get("/api/lootboxes/types", async (_req, res) => {
  try {
    const types = await db.select().from(lootBoxTypesTable);
    res.json(types);
  } catch {
    res.status(500).json({ error: "Failed to load box types" });
  }
});

lootboxesRouter.get("/api/lootboxes/mine", auth, async (req: any, res) => {
  try {
    const boxes = await db.select().from(userLootBoxesTable)
      .where(eq(userLootBoxesTable.userId, req.user.id));
    res.json(boxes);
  } catch {
    res.status(500).json({ error: "Failed to load boxes" });
  }
});

lootboxesRouter.post("/api/lootboxes/buy", auth, async (req: any, res) => {
  const { typeId } = req.body;
  if (!typeId) return res.status(400).json({ error: "Missing typeId" });

  try {
    const [boxType] = await db.select().from(lootBoxTypesTable).where(eq(lootBoxTypesTable.id, typeId)).limit(1);
    if (!boxType) return res.status(404).json({ error: "Box type not found" });

    if (boxType.coinCost > 0) {
      const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
      if (!wallet || wallet.coins < boxType.coinCost) {
        return res.status(400).json({ error: "Insufficient coins" });
      }
      await db.update(userWalletsTable).set({ coins: wallet.coins - boxType.coinCost }).where(eq(userWalletsTable.userId, req.user.id));
    }

    const [box] = await db.insert(userLootBoxesTable).values({
      userId: req.user.id,
      boxTypeId: typeId,
      status: "unopened",
      earnedReason: "purchase",
    }).returning();

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
    res.json({ box, newCoins: w?.coins ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to purchase" });
  }
});

lootboxesRouter.post("/api/lootboxes/:boxId/open", auth, async (req: any, res) => {
  const { boxId } = req.params;
  try {
    const [box] = await db.select().from(userLootBoxesTable)
      .where(and(eq(userLootBoxesTable.id, boxId), eq(userLootBoxesTable.userId, req.user.id))).limit(1);
    if (!box) return res.status(404).json({ error: "Box not found" });
    if (box.status !== "unopened") return res.status(400).json({ error: "Box already opened" });

    const [boxType] = await db.select().from(lootBoxTypesTable).where(eq(lootBoxTypesTable.id, box.boxTypeId)).limit(1);
    if (!boxType) return res.status(404).json({ error: "Box type not found" });

    const rewards = boxType.possibleRewards as any[];
    const picked = pickReward(rewards);

    await db.update(userLootBoxesTable).set({
      status: "opened",
      rewardType: picked.type,
      rewardValue: picked,
      openedAt: new Date(),
    }).where(eq(userLootBoxesTable.id, boxId));

    let newCoins: number | undefined;
    if (picked.type === "coins") {
      const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
      if (w) {
        await db.update(userWalletsTable).set({ coins: w.coins + (picked.value as number) }).where(eq(userWalletsTable.userId, req.user.id));
        newCoins = w.coins + (picked.value as number);
      }
    } else if (picked.type === "xp") {
      const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
      if (w) {
        await db.update(userWalletsTable).set({ totalXp: w.totalXp + (picked.value as number) }).where(eq(userWalletsTable.userId, req.user.id));
      }
    }

    const reward = describeReward(picked);

    await db.insert(notificationsTable).values({
      userId: req.user.id,
      type: "lootbox_reward",
      title: "Loot Box Opened!",
      message: `You received: ${reward.label}`,
    }).catch(() => {});

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
    res.json({ reward, newCoins: newCoins ?? w?.coins });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to open box" });
  }
});
