import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { extractUserId } from "./auth";
import { db, lootBoxTypesTable, userLootBoxesTable, userWalletsTable, notificationsTable, coinTransactionsTable, marketplaceItemsTable, userInventoryTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

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

lootboxesRouter.get("/lootboxes/types", async (_req, res) => {
  try {
    const types = await db.select().from(lootBoxTypesTable);
    res.json(types);
  } catch {
    res.status(500).json({ error: "Failed to load box types" });
  }
});

lootboxesRouter.get("/lootboxes/mine", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const boxes = await db.select().from(userLootBoxesTable)
      .where(eq(userLootBoxesTable.userId, req.userId));
    res.json(boxes);
  } catch {
    res.status(500).json({ error: "Failed to load boxes" });
  }
});

lootboxesRouter.post("/lootboxes/buy", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { typeId } = req.body;
  if (!typeId) return res.status(400).json({ error: "Missing typeId" });

  try {
    const [boxType] = await db.select().from(lootBoxTypesTable).where(eq(lootBoxTypesTable.id, typeId)).limit(1);
    if (!boxType) return res.status(404).json({ error: "Box type not found" });

    if (boxType.coinCost > 0) {
      const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      if (!wallet || wallet.coins < boxType.coinCost) {
        return res.status(400).json({ error: "Insufficient coins" });
      }
      const newBalance = wallet.coins - boxType.coinCost;
      await db.update(userWalletsTable).set({ coins: newBalance }).where(eq(userWalletsTable.userId, req.userId));
      await db.insert(coinTransactionsTable).values({
        userId: req.userId,
        type: "spend",
        amount: -boxType.coinCost,
        reason: "lootbox_purchase",
        description: `Purchased ${boxType.name}`,
        balanceAfter: newBalance,
        metadata: { boxTypeId: typeId, boxName: boxType.name },
      }).catch(() => {});
    }

    const [box] = await db.insert(userLootBoxesTable).values({
      userId: req.userId,
      boxTypeId: typeId,
      status: "unopened",
      earnedReason: "purchase",
    }).returning();

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
    res.json({ box, newCoins: w?.coins ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to purchase" });
  }
});

lootboxesRouter.post("/lootboxes/:boxId/open", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { boxId } = req.params as { boxId: string };
  try {
    const [box] = await db.select().from(userLootBoxesTable)
      .where(and(eq(userLootBoxesTable.id, boxId), eq(userLootBoxesTable.userId, req.userId))).limit(1);
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
    let grantedItemId: string | undefined;
    if (picked.type === "coins") {
      const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      if (w) {
        const earned = picked.value as number;
        const afterBalance = w.coins + earned;
        await db.update(userWalletsTable).set({ coins: afterBalance }).where(eq(userWalletsTable.userId, req.userId));
        await db.insert(coinTransactionsTable).values({
          userId: req.userId,
          type: "earn",
          amount: earned,
          reason: "lootbox_reward",
          description: `Loot box reward: ${earned} coins`,
          balanceAfter: afterBalance,
          metadata: { boxId },
        }).catch(() => {});
        newCoins = afterBalance;
      }
    } else if (picked.type === "xp") {
      const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      if (w) {
        await db.update(userWalletsTable).set({ totalXp: w.totalXp + (picked.value as number) }).where(eq(userWalletsTable.userId, req.userId));
      }
    } else if (picked.type === "marketplace_item") {
      try {
        const targetRarity = picked.rarity ?? "rare";
        const candidates = await db.select({ id: marketplaceItemsTable.id, name: marketplaceItemsTable.name })
          .from(marketplaceItemsTable)
          .where(eq(marketplaceItemsTable.rarity, targetRarity))
          .limit(20);
        if (candidates.length > 0) {
          const item = candidates[Math.floor(Math.random() * candidates.length)]!;
          grantedItemId = item.id;
          const alreadyOwned = await db.select({ id: userInventoryTable.id })
            .from(userInventoryTable)
            .where(and(eq(userInventoryTable.userId, req.userId), eq(userInventoryTable.itemId, item.id)))
            .limit(1);
          if (alreadyOwned.length === 0) {
            await db.insert(userInventoryTable).values({
              userId: req.userId,
              itemId: item.id,
              equipped: false,
            }).catch(() => {});
          }
        }
      } catch { /* best effort */ }
    }

    const reward = describeReward(picked);

    await db.insert(notificationsTable).values({
      userId: req.userId,
      type: "lootbox_reward",
      title: "Loot Box Opened!",
      message: `You received: ${reward.label}`,
    }).catch(() => {});

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
    res.json({ reward, newCoins: newCoins ?? w?.coins, grantedItemId });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to open box" });
  }
});
