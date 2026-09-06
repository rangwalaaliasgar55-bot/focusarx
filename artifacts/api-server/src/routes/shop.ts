import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import { userWalletsTable, notificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

import { burnCoins } from "../lib/coinLedger";

export const shopRouter = Router();

type ShopItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  category: "cosmetic" | "boost" | "theme" | "title";
  effect?: string;
};

const SHOP_ITEMS: ShopItem[] = [
  { id: "xp_boost_2x_1h",  name: "2× XP Boost (1h)",      icon: "⚡", price: 200,   category: "boost",     description: "Double XP for your next hour of focus.", effect: "xp_2x" },
  { id: "xp_boost_2x_1d",  name: "2× XP Boost (1 day)",   icon: "🚀", price: 800,   category: "boost",     description: "Double XP for 24 hours.", effect: "xp_2x_day" },
  { id: "streak_shield",   name: "Streak Shield",           icon: "🛡️", price: 500,   category: "boost",     description: "Protect your streak from breaking once." },
  { id: "focus_crystal",   name: "Focus Crystal",           icon: "💎", price: 300,   category: "cosmetic",  description: "Legendary cosmetic for your profile." },
  { id: "title_scholar",   name: "Title: Scholar",          icon: "📚", price: 1000,  category: "title",     description: "Display 'Scholar' as your profile title." },
  { id: "title_prodigy",   name: "Title: Prodigy",          icon: "✨", price: 2500,  category: "title",     description: "Display 'Prodigy' as your profile title." },
  { id: "title_legend",    name: "Title: Legend",           icon: "🏆", price: 5000,  category: "title",     description: "Display 'Legend' as your profile title." },
  { id: "theme_midnight",  name: "Theme: Midnight",         icon: "🌙", price: 1500,  category: "theme",     description: "Unlock the Midnight theme for your profile." },
  { id: "theme_aurora",    name: "Theme: Aurora",           icon: "🌌", price: 1500,  category: "theme",     description: "Unlock the Aurora theme." },
  { id: "theme_ember",     name: "Theme: Ember",            icon: "🔥", price: 1500,  category: "theme",     description: "Unlock the Ember theme." },
  { id: "garden_boost",    name: "Garden Fertilizer",       icon: "🌿", price: 150,   category: "boost",     description: "Instantly grow your focus garden by 30 minutes." },
  { id: "xp_bonus_500",    name: "500 XP Bundle",           icon: "💫", price: 400,   category: "boost",     description: "Instantly gain 500 XP." },
  { id: "xp_bonus_2000",   name: "2,000 XP Bundle",         icon: "🌟", price: 1400,  category: "boost",     description: "Instantly gain 2,000 XP." },
  { id: "coin_refund",     name: "Coin Vault Key",          icon: "🗝️", price: 750,   category: "cosmetic",  description: "A rare collectible for coin holders." },
  { id: "badge_frame_gold",name: "Gold Badge Frame",        icon: "🖼️", price: 2000,  category: "cosmetic",  description: "Stylish gold frame for your badges." },
];

shopRouter.get("/shop/items", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [wallet] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
  res.json({ items: SHOP_ITEMS, coins: wallet?.coins ?? 0 });
});

shopRouter.post("/shop/purchase/:itemId", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { itemId } = req.params as { itemId: string };
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  let xpGain = 0;
  if (item.id === "xp_bonus_500") xpGain = 500;
  if (item.id === "xp_bonus_2000") xpGain = 2000;

  // Conditional decrement (coins >= price) + ledger row in one call. The old
  // read-check-then-write let two simultaneous purchases both pass the check
  // and drive the balance negative.
  const balanceAfter = await burnCoins(userId, item.price, "shop_purchase", {
    description: `Purchased: ${item.name}`,
    metadata: { itemId: item.id, itemName: item.name, category: item.category },
  });
  if (balanceAfter === null) return res.status(400).json({ error: "Not enough coins" });

  if (xpGain > 0) {
    await db.update(userWalletsTable)
      .set({ totalXp: sql`${userWalletsTable.totalXp} + ${xpGain}`, updatedAt: new Date() })
      .where(eq(userWalletsTable.userId, userId));
  }

  await db.insert(notificationsTable).values({
    id: crypto.randomUUID(),
    userId,
    type: "system",
    title: `Purchased: ${item.name}`,
    message: `You spent ${item.price.toLocaleString()} coins on ${item.name}. ${item.description}`,
    read: false,
  });

  const updated = { coins: balanceAfter };

  res.json({ ok: true, item, coinsRemaining: updated?.coins ?? 0, xpGained: xpGain });
});
