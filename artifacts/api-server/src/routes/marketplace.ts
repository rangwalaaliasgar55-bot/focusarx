import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, marketplaceItemsTable, userInventoryTable, userWalletsTable, coinTransactionsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { isUserPremium } from "../lib/premiumCheck";

const router = Router();

const PREMIUM_ITEM_IDS = new Set(["frame-diamond", "avatar-astronaut", "effect-aurora", "acc-fire-wings"]);

// Seed default marketplace items if none exist
const DEFAULT_ITEMS = [
  // Profile Frames
  { id: "frame-gold", name: "Golden Scholar", description: "Radiant gold profile frame for top achievers", type: "frame", costCoins: 500, rarity: "rare", emoji: "🏆" },
  { id: "frame-nebula", name: "Nebula Frame", description: "Cosmic purple nebula profile frame", type: "frame", costCoins: 750, rarity: "epic", emoji: "🌌" },
  { id: "frame-fire", name: "Fire Ring", description: "Burning fire profile frame", type: "frame", costCoins: 300, rarity: "uncommon", emoji: "🔥" },
  { id: "frame-diamond", name: "Diamond Edge", description: "Shimmering diamond profile frame", type: "frame", costCoins: 1000, rarity: "legendary", emoji: "💎" },
  // Avatars
  { id: "avatar-ninja", name: "Study Ninja", description: "Stealth mode: activated", type: "avatar", costCoins: 400, rarity: "rare", emoji: "🥷" },
  { id: "avatar-wizard", name: "Knowledge Wizard", description: "Ancient wisdom in your avatar", type: "avatar", costCoins: 350, rarity: "uncommon", emoji: "🧙" },
  { id: "avatar-robot", name: "AI Scholar", description: "Future of learning", type: "avatar", costCoins: 600, rarity: "epic", emoji: "🤖" },
  { id: "avatar-astronaut", name: "Space Explorer", description: "Reach for the stars", type: "avatar", costCoins: 800, rarity: "legendary", emoji: "👨‍🚀" },
  // Effects
  { id: "effect-sparkle", name: "Sparkle Aura", description: "Sparkling effects on your sessions", type: "effect", costCoins: 200, rarity: "common", emoji: "✨" },
  { id: "effect-lightning", name: "Lightning Focus", description: "Electric aura during focus", type: "effect", costCoins: 450, rarity: "rare", emoji: "⚡" },
  { id: "effect-aurora", name: "Aurora Effect", description: "Northern lights follow your studies", type: "effect", costCoins: 900, rarity: "legendary", emoji: "🌅" },
  // Pet Accessories — Hats
  { id: "acc-crown",   name: "Royal Crown",       description: "A crown fit for a scholar king",         type: "accessory", costCoins: 300, rarity: "rare",      emoji: "👑" },
  { id: "acc-hat",     name: "Top Hat",            description: "Dapper style for your companion",        type: "accessory", costCoins: 200, rarity: "uncommon",  emoji: "🎩" },
  { id: "acc-grad",    name: "Graduation Cap",     description: "Your pet earned a PhD in focus",         type: "accessory", costCoins: 180, rarity: "common",    emoji: "🎓" },
  { id: "acc-party",   name: "Party Hat",          description: "Every session is a celebration",         type: "accessory", costCoins: 100, rarity: "common",    emoji: "🥳" },
  { id: "acc-halo",    name: "Angel Halo",         description: "Pure focus energy from above",           type: "accessory", costCoins: 350, rarity: "rare",      emoji: "😇" },
  { id: "acc-santa",   name: "Santa Hat",          description: "Ho ho, focus time!",                     type: "accessory", costCoins: 150, rarity: "common",    emoji: "🎅" },
  // Pet Accessories — Glasses
  { id: "acc-glasses",    name: "Study Glasses",   description: "Bookworm glasses for your scholar pet",  type: "accessory", costCoins: 150, rarity: "common",    emoji: "🤓" },
  { id: "acc-sunglasses", name: "Cool Shades",     description: "Too cool for distractions",              type: "accessory", costCoins: 200, rarity: "uncommon",  emoji: "😎" },
  { id: "acc-monocle",    name: "Monocle",         description: "A distinguished scholar look",           type: "accessory", costCoins: 250, rarity: "uncommon",  emoji: "🧐" },
  // Pet Accessories — Back / Cape
  { id: "acc-cape",    name: "Hero Cape",          description: "Your pet, the study hero",               type: "accessory", costCoins: 250, rarity: "uncommon",  emoji: "🦸" },
  { id: "acc-hoodie",  name: "Comfy Hoodie",       description: "Focus in cozy style",                    type: "accessory", costCoins: 180, rarity: "common",    emoji: "🧥" },
  { id: "acc-scarf",   name: "Lucky Scarf",        description: "Your lucky deep-work scarf",             type: "accessory", costCoins: 120, rarity: "common",    emoji: "🧣" },
  // Pet Accessories — Wings
  { id: "acc-wings",      name: "Angel Wings",     description: "Your pet soars above distractions",      type: "accessory", costCoins: 400, rarity: "rare",      emoji: "🪽" },
  { id: "acc-fire-wings", name: "Fire Wings",      description: "Blazing through every session",          type: "accessory", costCoins: 600, rarity: "epic",      emoji: "🔥" },
  { id: "acc-butterfly",  name: "Butterfly Wings", description: "Graceful, focused energy",               type: "accessory", costCoins: 350, rarity: "uncommon",  emoji: "🦋" },
  // City Decorations
  { id: "deco-garden", name: "Zen Garden", description: "A peaceful garden for your Focus City", type: "decoration", costCoins: 200, rarity: "common", emoji: "🌸" },
  { id: "deco-fountain", name: "Crystal Fountain", description: "A shimmering fountain in your city", type: "decoration", costCoins: 400, rarity: "rare", emoji: "⛲" },
  { id: "deco-tower", name: "Knowledge Tower", description: "Tallest building in your city", type: "decoration", costCoins: 800, rarity: "epic", emoji: "🗼" },
  // Special
  { id: "special-xp2", name: "XP Booster (24h)", description: "2× XP for the next 24 hours", type: "booster", costCoins: 500, rarity: "rare", emoji: "⬆️" },
  { id: "special-coin2", name: "Coin Doubler (48h)", description: "2× coins for the next 48 hours", type: "booster", costCoins: 600, rarity: "epic", emoji: "🪙" },
];

async function ensureDefaultItems() {
  try {
    // Always upsert every default item so new items added to code appear in DB
    await db.insert(marketplaceItemsTable)
      .values(DEFAULT_ITEMS.map(item => ({ ...item, premiumOnly: PREMIUM_ITEM_IDS.has(item.id), isActive: true })))
      .onConflictDoNothing();
  } catch { }
}

router.get("/marketplace", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaultItems();
    const [items, inventory, premium] = await Promise.all([
      db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.isActive, true)),
      db.select().from(userInventoryTable).where(eq(userInventoryTable.userId, req.userId)),
      isUserPremium(req.userId),
    ]);
    const ownedIds = new Set(inventory.map(i => i.itemId));
    const itemsWithOwned = items.map(item => ({
      ...item, owned: ownedIds.has(item.id), locked: item.premiumOnly && !premium,
    }));
    res.json({ items: itemsWithOwned });
  } catch (err) {
    logger.error({ err }, "get marketplace error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/marketplace/inventory", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const inventory = await db.select({
      id: userInventoryTable.id,
      itemId: userInventoryTable.itemId,
      acquiredAt: userInventoryTable.acquiredAt,
      equipped: userInventoryTable.equipped,
      name: marketplaceItemsTable.name,
      type: marketplaceItemsTable.type,
      emoji: marketplaceItemsTable.emoji,
      rarity: marketplaceItemsTable.rarity,
    }).from(userInventoryTable)
      .leftJoin(marketplaceItemsTable, eq(userInventoryTable.itemId, marketplaceItemsTable.id))
      .where(eq(userInventoryTable.userId, req.userId));
    res.json({ inventory });
  } catch (err) {
    logger.error({ err }, "get inventory error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/marketplace/:itemId/purchase", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { itemId } = req.params as { itemId: string };
  try {
    // Check item exists
    const [item] = await db.select().from(marketplaceItemsTable)
      .where(and(eq(marketplaceItemsTable.id, itemId), eq(marketplaceItemsTable.isActive, true)));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    if (item.premiumOnly && !await isUserPremium(req.userId)) {
      res.status(403).json({ error: "This marketplace item requires Premium" }); return;
    }

    const purchase = await db.transaction(async (tx) => {
      const [alreadyOwned] = await tx.select({ id: userInventoryTable.id }).from(userInventoryTable)
        .where(and(eq(userInventoryTable.userId, req.userId), eq(userInventoryTable.itemId, itemId)))
        .limit(1);
      if (alreadyOwned) return { error: "Already owned", status: 409 } as const;

      const [wallet] = await tx.update(userWalletsTable).set({
        coins: sql`${userWalletsTable.coins} - ${item.costCoins}`,
        updatedAt: new Date(),
      }).where(and(
        eq(userWalletsTable.userId, req.userId),
        gte(userWalletsTable.coins, item.costCoins),
      )).returning({ coins: userWalletsTable.coins });
      if (!wallet) return { error: "Insufficient coins", status: 400 } as const;

      await tx.insert(userInventoryTable).values({ userId: req.userId, itemId });
      await tx.insert(coinTransactionsTable).values({
        userId: req.userId,
        type: "spend",
        amount: -item.costCoins,
        reason: "marketplace_purchase",
        description: `Purchased ${item.name}`,
        balanceAfter: wallet.coins,
        metadata: { itemId, itemName: item.name, itemType: item.type },
      });
      return { ok: true, newBalance: wallet.coins } as const;
    });

    if (!("ok" in purchase)) return res.status(purchase.status).json({ error: purchase.error });
    res.json(purchase);
  } catch (err) {
    logger.error({ err }, "purchase error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/marketplace/inventory/:invId/equip", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { invId } = req.params as { invId: string };
  try {
    const [inv] = await db.select().from(userInventoryTable)
      .where(and(eq(userInventoryTable.id, invId), eq(userInventoryTable.userId, req.userId)));
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(userInventoryTable).set({ equipped: !inv.equipped })
      .where(eq(userInventoryTable.id, invId));
    res.json({ ok: true, equipped: !inv.equipped });
  } catch (err) {
    logger.error({ err }, "equip error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as marketplaceRouter };
