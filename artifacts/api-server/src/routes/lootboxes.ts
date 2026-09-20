import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import {
  db,
  lootBoxTypesTable,
  userLootBoxesTable,
  userWalletsTable,
  notificationsTable,
  marketplaceItemsTable,
  userInventoryTable,
  freezeTokensTable,
  battlePassProgressTable,
} from "@workspace/db";
import { isUserPremium } from "../lib/premiumCheck";
import { eq, and, sql } from "drizzle-orm";
import { burnCoins, mintCoins } from "../lib/coinLedger";
import { BATTLE_PASS_TIERS, calculateBattlePassTier, currentBattlePassSeason } from "../lib/battlePass";
import { logger } from "../lib/logger";
import { ensureDefaultLootBoxTypes } from "../lib/lootBoxCatalog";

export const lootboxesRouter = Router();

interface BoxReward {
  type?: string; rarity?: string; label?: string; description?: string; emoji?: string | null;
  value?: number | string; weight?: number; itemId?: string | null;
}

function pickReward(rewards: BoxReward[]): BoxReward {
  const total = rewards.reduce((s: number, r: BoxReward) => s + (r.weight ?? 10), 0);
  let rand = Math.random() * total;
  for (const r of rewards) {
    rand -= r.weight ?? 10;
    if (rand <= 0) return r;
  }
  return rewards[rewards.length - 1];
}

function describeReward(r: BoxReward): { type?: string; value?: number | string; label: string; description: string; emoji: string } {
  // Keep the machine-readable amount in the reveal payload. The UI uses it for
  // the count-up and the notification/inventory views use it for an exact audit
  // trail; a label alone made a 50-coin reward look like an unquantified prize.
  const payload = { type: r.type, value: r.value };
  switch (r.type) {
    case "coins": return { ...payload, label: `${r.value} Coins`, description: `You earned ${r.value} coins!`, emoji: "🪙" };
    case "xp":    return { ...payload, label: `${r.value} XP`, description: `You gained ${r.value} XP!`, emoji: "⚡" };
    case "streak_shield": return { ...payload, label: "Streak Shield", description: `Your streak is protected for ${r.value} day(s)!`, emoji: "🛡️" };
    case "xp_boost": return { ...payload, label: "XP Booster", description: "Your next session earns double XP!", emoji: "🚀" };
    case "marketplace_item": return { ...payload, label: "Marketplace Item", description: `A ${r.rarity ?? "rare"} cosmetic item!`, emoji: "🎁" };
    case "battle_pass_tiers": return { ...payload, label: `${r.value} Battle Pass Tiers`, description: `Skip ahead ${r.value} tiers!`, emoji: "🏆" };
    default: return { ...payload, label: "Mystery Reward", description: "A surprise reward!", emoji: "✨" };
  }
}

lootboxesRouter.get("/lootboxes/types", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaultLootBoxTypes();
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
    await ensureDefaultLootBoxTypes();
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
    await ensureDefaultLootBoxTypes();
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
    // Opening and granting are one transaction. If any configured reward cannot
    // be delivered, the box stays unopened and the user can retry; there is no
    // "opened successfully" response that hides a failed grant.
    const result = await db.transaction(async (tx) => {
      const [box] = await tx.select().from(userLootBoxesTable)
        .where(and(eq(userLootBoxesTable.id, boxId), eq(userLootBoxesTable.userId, req.userId)))
        .limit(1).for("update");
      if (!box) return { error: "Box not found", status: 404 } as const;
      if (box.status !== "unopened") return { error: "Box already opened", status: 400 } as const;

      const [boxType] = await tx.select().from(lootBoxTypesTable)
        .where(eq(lootBoxTypesTable.id, box.boxTypeId)).limit(1);
      if (!boxType) return { error: "Box type not found", status: 404 } as const;

      const rewards = Array.isArray(boxType.possibleRewards) ? boxType.possibleRewards as BoxReward[] : [];
      if (rewards.length === 0) return { error: "This box has no configured rewards", status: 409 } as const;
      const picked = pickReward(rewards);
      if (!picked?.type) return { error: "This box has an invalid reward", status: 409 } as const;

      // Make the wallet row exist before any ledger or XP mutation. This also
      // means every coin reward gets a coin_transactions row in this same tx.
      await tx.insert(userWalletsTable).values({ userId: req.userId, coins: 0, totalXp: 0, weeklyXp: 0 }).onConflictDoNothing();

      let newCoins: number | undefined;
      let grantedItemId: string | undefined;
      let grantedInventoryId: string | undefined;
      let duplicateCompensationCoins: number | undefined;
      let grantedItem: {
        itemId: string;
        name: string;
        emoji: string | null;
        type: string;
        rarity: string | null;
        alreadyOwned: boolean;
      } | undefined;
      let fallbackXp = 0;
      let fallbackCoins = 0;

      const grantXp = async (amount: number) => {
        const xp = Math.max(0, Math.floor(amount));
        if (!xp) return;
        await tx.update(userWalletsTable).set({
          totalXp: sql`${userWalletsTable.totalXp} + ${xp}`,
          weeklyXp: sql`${userWalletsTable.weeklyXp} + ${xp}`,
          level: sql`GREATEST(1, floor(sqrt((${userWalletsTable.totalXp} + ${xp}) / 100.0)) + 1)`,
          updatedAt: new Date(),
        }).where(eq(userWalletsTable.userId, req.userId));
      };

      const grantCatalogueItem = async (targetRarity: string, type?: string) => {
        const conditions = [
          eq(marketplaceItemsTable.rarity, targetRarity),
          eq(marketplaceItemsTable.isActive, true),
          ...(type ? [eq(marketplaceItemsTable.type, type)] : []),
        ];
        const candidates = await tx.select({
          id: marketplaceItemsTable.id,
          name: marketplaceItemsTable.name,
          emoji: marketplaceItemsTable.emoji,
          type: marketplaceItemsTable.type,
          rarity: marketplaceItemsTable.rarity,
          costCoins: marketplaceItemsTable.costCoins,
        }).from(marketplaceItemsTable).where(and(...conditions)).limit(100);
        if (candidates.length === 0) return false;

        const ownedRows = await tx.select({ itemId: userInventoryTable.itemId })
          .from(userInventoryTable).where(eq(userInventoryTable.userId, req.userId));
        const ownedIds = new Set(ownedRows.map((row) => row.itemId));
        const unowned = candidates.filter((item) => !ownedIds.has(item.id));
        const item = (unowned.length > 0 ? unowned : candidates)[Math.floor(Math.random() * (unowned.length > 0 ? unowned.length : candidates.length))]!;
        grantedItemId = item.id;

        if (unowned.length > 0) {
          const [inventoryRow] = await tx.insert(userInventoryTable)
            .values({ userId: req.userId, itemId: item.id, equipped: false })
            .returning({ id: userInventoryTable.id });
          grantedInventoryId = inventoryRow?.id;
        } else {
          // A duplicate is still a real, auditable grant: compensate it with
          // half the catalogue value rather than silently discarding it.
          duplicateCompensationCoins = Math.max(50, Math.floor(item.costCoins * 0.5));
          newCoins = await mintCoins(req.userId, duplicateCompensationCoins, "lootbox_duplicate_compensation", {
            description: `${item.name} was already in your collection`,
            metadata: { boxId, itemId: item.id },
          }, tx);
        }
        grantedItem = {
          itemId: item.id,
          name: item.name,
          emoji: item.emoji,
          type: item.type,
          rarity: item.rarity,
          alreadyOwned: unowned.length === 0,
        };
        return true;
      };

      if (picked.type === "coins") {
        newCoins = await mintCoins(req.userId, Math.max(1, Math.floor(Number(picked.value) || 0)), "lootbox_reward", {
          description: `Loot box reward: ${Number(picked.value) || 0} coins`,
          metadata: { boxId },
        }, tx);
      } else if (picked.type === "xp") {
        await grantXp(Number(picked.value) || 0);
      } else if (picked.type === "streak_shield") {
        const tokens = Math.max(1, Math.floor(Number(picked.value) || 1));
        await tx.insert(freezeTokensTable).values({ userId: req.userId, tokensAvailable: tokens })
          .onConflictDoUpdate({
            target: freezeTokensTable.userId,
            set: {
              tokensAvailable: sql`${freezeTokensTable.tokensAvailable} + ${tokens}`,
              updatedAt: new Date(),
            },
          });
      } else if (picked.type === "xp_boost") {
        // Boosters are catalogue inventory items. Prefer an active booster
        // with the requested rarity; if the catalogue has none, do not lose
        // the reward — grant an explicit XP equivalent and say so in the reveal.
        const delivered = await grantCatalogueItem(String(picked.rarity ?? "rare"), "booster")
          || await grantCatalogueItem("rare", "booster")
          || await grantCatalogueItem("uncommon", "booster");
        if (!delivered) {
          fallbackXp = Math.max(100, Math.floor(Number(picked.value) || 1) * 100);
          await grantXp(fallbackXp);
        }
      } else if (picked.type === "marketplace_item") {
        const targetRarity = String(picked.rarity ?? picked.value ?? "rare");
        const delivered = await grantCatalogueItem(targetRarity);
        if (!delivered) {
          // A deleted catalogue tier must not consume a box without a grant.
          fallbackCoins = Math.max(100, Math.floor(Number(picked.value) || 100));
          newCoins = await mintCoins(req.userId, fallbackCoins, "lootbox_missing_item_compensation", {
            description: "Loot box item unavailable — coin compensation",
            metadata: { boxId, requestedRarity: targetRarity },
          }, tx);
        }
      } else if (picked.type === "battle_pass_tiers") {
        const skip = Math.max(1, Math.floor(Number(picked.value) || 1));
        const [progress] = await tx.select().from(battlePassProgressTable)
          .where(eq(battlePassProgressTable.userId, req.userId)).limit(1).for("update");
        const currentSeason = currentBattlePassSeason();
        const currentXp = progress?.season === currentSeason ? progress.seasonXp : 0;
        const currentTier = calculateBattlePassTier(currentXp);
        const maxTier = BATTLE_PASS_TIERS[BATTLE_PASS_TIERS.length - 1]?.tier ?? currentTier;
        const targetTier = Math.min(maxTier, currentTier + skip);
        const targetXp = Math.max(currentXp, BATTLE_PASS_TIERS.find((tier) => tier.tier === targetTier)?.xpRequired ?? currentXp);
        if (progress) {
          await tx.update(battlePassProgressTable).set({
            season: currentSeason,
            seasonXp: targetXp,
            tier: calculateBattlePassTier(targetXp),
            updatedAt: new Date(),
            ...(progress.season === currentSeason ? {} : { claimedTiers: [] }),
          }).where(eq(battlePassProgressTable.userId, req.userId));
        } else {
          await tx.insert(battlePassProgressTable).values({
            userId: req.userId,
            season: currentSeason,
            seasonXp: targetXp,
            tier: calculateBattlePassTier(targetXp),
            premiumUnlocked: false,
            claimedTiers: [],
          });
        }
      } else {
        return { error: `Unsupported reward type: ${picked.type}`, status: 409 } as const;
      }

      const baseReward = describeReward(picked);
      const reward = fallbackXp > 0
        ? { ...baseReward, label: `+${fallbackXp} XP`, description: `The XP Booster catalogue item was unavailable, so ${fallbackXp} XP was credited instead.`, emoji: "⚡" }
        : fallbackCoins > 0
          ? { ...baseReward, label: `${fallbackCoins} Coins`, description: `The catalogue item was unavailable, so you received ${fallbackCoins} coins instead.`, emoji: "🪙" }
          : grantedItem
            ? {
                ...baseReward,
                label: grantedItem.name,
                description: grantedItem.alreadyOwned
                  ? `You already owned ${grantedItem.name} — ${duplicateCompensationCoins?.toLocaleString()} coins were credited instead.`
                  : `${grantedItem.rarity ?? "rare"} ${grantedItem.type} · now in your collection`,
                emoji: grantedItem.emoji ?? baseReward.emoji,
              }
            : baseReward;

      await tx.update(userLootBoxesTable).set({
        status: "opened",
        rewardType: picked.type,
        rewardValue: picked,
        openedAt: new Date(),
      }).where(eq(userLootBoxesTable.id, boxId));
      await tx.insert(notificationsTable).values({
        userId: req.userId,
        type: "lootbox_reward",
        title: "Loot Box Opened!",
        message: `You received: ${reward.label}`,
        data: { boxId, rewardType: picked.type, rewardValue: picked, grantedItemId: grantedItemId ?? null },
      });

      const [wallet] = await tx.select({ coins: userWalletsTable.coins })
        .from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      return {
        ok: true as const,
        reward,
        rarity: grantedItem?.rarity ?? (picked.type === "coins" || picked.type === "xp" ? "common" : boxType.rarity),
        type: picked.type,
        newCoins: newCoins ?? wallet?.coins,
        grantedItemId,
        grantedItem,
        inventoryId: grantedInventoryId,
        duplicateCompensationCoins,
      };
    });

    if (!("ok" in result)) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (err) {
    logger.error({ err, boxId }, "open loot box error — transaction rolled back");
    res.status(500).json({ error: "Failed to open box; your box was not consumed" });
  }
});
