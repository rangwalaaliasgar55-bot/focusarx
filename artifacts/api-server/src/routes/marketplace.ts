import { Router } from "express";
import { db, marketplaceItemsTable, userInventoryTable, userWalletsTable } from "@workspace/db";
import { coinTransactionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

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
  // Pet Accessories
  { id: "acc-crown", name: "Royal Crown", description: "A crown fit for a scholar king", type: "accessory", costCoins: 300, rarity: "rare", emoji: "👑" },
  { id: "acc-glasses", name: "Study Glasses", description: "Bookworm glasses for your pet", type: "accessory", costCoins: 150, rarity: "common", emoji: "🤓" },
  { id: "acc-cape", name: "Hero Cape", description: "Your pet, the hero", type: "accessory", costCoins: 250, rarity: "uncommon", emoji: "🦸" },
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
    const existing = await db.select().from(marketplaceItemsTable).limit(1);
    if (existing.length === 0) {
      await db.insert(marketplaceItemsTable).values(DEFAULT_ITEMS.map(item => ({
        ...item, isActive: true,
      }))).onConflictDoNothing();
    }
  } catch { }
}

router.get("/marketplace", authMiddleware, async (req: any, res) => {
  try {
    await ensureDefaultItems();
    const [items, inventory] = await Promise.all([
      db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.isActive, true)),
      db.select().from(userInventoryTable).where(eq(userInventoryTable.userId, req.userId)),
    ]);
    const ownedIds = new Set(inventory.map(i => i.itemId));
    const itemsWithOwned = items.map(item => ({ ...item, owned: ownedIds.has(item.id) }));
    res.json({ items: itemsWithOwned });
  } catch (err) {
    logger.error({ err }, "get marketplace error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/marketplace/inventory", authMiddleware, async (req: any, res) => {
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

router.post("/marketplace/:itemId/purchase", authMiddleware, async (req: any, res) => {
  const { itemId } = req.params as { itemId: string };
  try {
    // Check item exists
    const [item] = await db.select().from(marketplaceItemsTable)
      .where(and(eq(marketplaceItemsTable.id, itemId), eq(marketplaceItemsTable.isActive, true)));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    // Check not already owned
    const [alreadyOwned] = await db.select().from(userInventoryTable)
      .where(and(eq(userInventoryTable.userId, req.userId), eq(userInventoryTable.itemId, itemId)));
    if (alreadyOwned) { res.status(400).json({ error: "Already owned" }); return; }

    // Check wallet balance
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));
    if (!wallet) { res.status(400).json({ error: "No wallet found" }); return; }
    if (wallet.coins < item.costCoins) { res.status(400).json({ error: "Insufficient coins" }); return; }

    const newBalance = wallet.coins - item.costCoins;
    // Deduct coins, add to inventory, log transaction
    await Promise.all([
      db.update(userWalletsTable).set({ coins: newBalance, updatedAt: new Date() })
        .where(eq(userWalletsTable.userId, req.userId)),
      db.insert(userInventoryTable).values({ userId: req.userId, itemId }),
      db.insert(coinTransactionsTable).values({
        userId: req.userId,
        type: "spend",
        amount: -item.costCoins,
        reason: "marketplace_purchase",
        description: `Purchased ${item.name}`,
        balanceAfter: newBalance,
        metadata: { itemId, itemName: item.name, itemType: item.type },
      }).catch(() => {}),
    ]);

    res.json({ ok: true, newBalance });
  } catch (err) {
    logger.error({ err }, "purchase error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/marketplace/inventory/:invId/equip", authMiddleware, async (req: any, res) => {
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
