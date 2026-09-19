import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, lootBoxTypesTable, userLootBoxesTable, userWalletsTable, notificationsTable, coinTransactionsTable, marketplaceItemsTable, userInventoryTable } from "@workspace/db";
import { isUserPremium } from "../lib/premiumCheck";
import { eq, and } from "drizzle-orm";
import { burnCoins, mintCoins } from "../lib/coinLedger";

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

lootboxesRouter.get("/lootboxes/types", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const types = await db.select().from(lootBoxTypesTable);
    const premium = req.userId ? await isUserPremium(req.userId) : false;
    const visible = premium ? types : types.filter(t => !t.premiumOnly);
    res.json(visible);
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
    if (boxType.premiumOnly && !(await isUserPremium(req.userId!))) {
      return res.status(403).json({ error: "This loot box requires Premium" });
    }

    const result = await db.transaction(async (tx) => {
      // Atomic balance check + deduction to prevent race conditions
      if (boxType.coinCost > 0) {
        // Conditional decrement + ledger row, inside the same transaction as
        // the box insert, so a double-submit can never buy two boxes for one.
        const balanceAfter = await burnCoins(req.userId, boxType.coinCost, "lootbox_purchase", {
          description: `Purchased ${boxType.name}`,
          metadata: { boxTypeId: typeId, boxName: boxType.name },
        }, tx);
        if (balanceAfter === null) {
          return { error: "Insufficient coins" } as const;
        }
      }

      const [box] = await tx.insert(userLootBoxesTable).values({
        userId: req.userId,
        boxTypeId: typeId,
        status: "unopened",
        earnedReason: "purchase",
      }).returning();

      const [w] = await tx.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      return { ok: true, box, newCoins: w?.coins ?? 0 } as const;
    });

    if ("error" in result) return res.status(400).json({ error: result.error });
    res.json({ box: result.box, newCoins: result.newCoins });
  } catch {
    res.status(500).json({ error: "Failed to purchase" });
  }
});

lootboxesRouter.post("/lootboxes/:boxId/open", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { boxId } = req.params as { boxId: string };
  try {
    // Use a transaction to atomically check-and-open, preventing double-opens
    const result = await db.transaction(async (tx) => {
      const [box] = await tx.select().from(userLootBoxesTable)
        .where(and(eq(userLootBoxesTable.id, boxId), eq(userLootBoxesTable.userId, req.userId))).limit(1);
      if (!box) return { error: "Box not found", status: 404 } as const;
      if (box.status !== "unopened") return { error: "Box already opened", status: 400 } as const;

      const [boxType] = await tx.select().from(lootBoxTypesTable).where(eq(lootBoxTypesTable.id, box.boxTypeId)).limit(1);
      if (!boxType) return { error: "Box type not found", status: 404 } as const;

      const rewards = boxType.possibleRewards as any[];
      const picked = pickReward(rewards);

      await tx.update(userLootBoxesTable).set({
        status: "opened",
        rewardType: picked.type,
        rewardValue: picked,
        openedAt: new Date(),
      }).where(eq(userLootBoxesTable.id, boxId));

      return { ok: true, box, boxType, picked } as const;
    });

    if ("error" in result) return res.status(result.status ?? 500).json({ error: result.error });

    const { picked } = result;

    let newCoins: number | undefined;
    let grantedItemId: string | undefined;
    let grantedInventoryId: string | undefined;
    let duplicateCompensationCoins: number | undefined;
    let grantedItem: { itemId: string; name: string; emoji: string | null; type: string; rarity: string | null; alreadyOwned: boolean } | undefined;
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
        // Prefer an item the user does not own yet, so a cosmetic reward is
        // always a real addition to their collection rather than a duplicate
        // that silently vanished. Only fall back to any item of the rarity when
        // they own the whole tier.
        const targetRarity = picked.rarity ?? "rare";
        const candidates = await db.select({
          id: marketplaceItemsTable.id,
          name: marketplaceItemsTable.name,
          emoji: marketplaceItemsTable.emoji,
          type: marketplaceItemsTable.type,
          rarity: marketplaceItemsTable.rarity,
          costCoins: marketplaceItemsTable.costCoins,
        }).from(marketplaceItemsTable)
          .where(and(eq(marketplaceItemsTable.rarity, targetRarity), eq(marketplaceItemsTable.isActive, true)))
          .limit(50);

        if (candidates.length > 0) {
          const ownedRows = await db.select({ itemId: userInventoryTable.itemId })
            .from(userInventoryTable).where(eq(userInventoryTable.userId, req.userId));
          const ownedItemIds = new Set(ownedRows.map(r => r.itemId));
          const unowned = candidates.filter(c => !ownedItemIds.has(c.id));
          const item = (unowned.length > 0 ? unowned : candidates)[Math.floor(Math.random() * (unowned.length > 0 ? unowned.length : candidates.length))]!;
          grantedItemId = item.id;

          if (unowned.length > 0) {
            const [invRow] = await db.insert(userInventoryTable).values({
              userId: req.userId,
              itemId: item.id,
              equipped: false,
            }).returning({ id: userInventoryTable.id }).catch(() => [undefined as never]);
            grantedInventoryId = invRow?.id;
          } else {
            // Whole tier owned — pay the duplicate out in coins instead of
            // pretending something was granted. Half the item's value, minted
            // through the ledger so the economy stays auditable.
            duplicateCompensationCoins = Math.max(50, Math.floor(item.costCoins * 0.5));
            const balanceAfter = await mintCoins(req.userId!, duplicateCompensationCoins, "lootbox_duplicate_compensation", {
              description: `${item.name} was already in your collection`,
              metadata: { boxId, itemId: item.id },
            });
            if (balanceAfter !== null) newCoins = balanceAfter;
          }

          grantedItem = {
            itemId: item.id,
            name: item.name,
            emoji: item.emoji,
            type: item.type,
            rarity: item.rarity,
            alreadyOwned: unowned.length === 0,
          };
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
    const enriched = grantedItem
      ? {
          ...reward,
          label: grantedItem.name,
          description: grantedItem.alreadyOwned
            ? `You already owned ${grantedItem.name} — we paid you ${duplicateCompensationCoins?.toLocaleString()} coins instead.`
            : `${grantedItem.rarity} ${grantedItem.type} · now in your collection`,
          emoji: grantedItem.emoji ?? reward.emoji,
        }
      : reward;

    res.json({
      reward: enriched,
      rarity: grantedItem?.rarity ?? (picked.type === "coins" || picked.type === "xp" ? "common" : "rare"),
      type: picked.type,
      newCoins: newCoins ?? w?.coins,
      grantedItemId,
      grantedItem,
      inventoryId: grantedInventoryId,
      duplicateCompensationCoins,
    });
  } catch {
    res.status(500).json({ error: "Failed to open box" });
  }
});
