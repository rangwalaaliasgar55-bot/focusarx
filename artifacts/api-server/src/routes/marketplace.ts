import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, marketplaceItemsTable, userInventoryTable, userWalletsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, sql, inArray, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { isUserPremium } from "../lib/premiumCheck";
import { mintCoins, burnCoins } from "../lib/coinLedger";

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
  // ── Marketplace 2.0 catalogue (rarity ladder: common 100–300, uncommon
  //    400–700, rare 1,000–1,500, epic 2,000–3,500, legendary 8,000–15,000) ──
  // Frames
  { id: "frame-chai", name: "Chai Cup Frame", description: "A warm cup of chai frames your profile — fuel of the serious scholar", type: "frame", costCoins: 250, rarity: "common", emoji: "☕" },
  { id: "frame-monsoon", name: "Monsoon Frame", description: "Grey skies and steady rain — perfect for deep work", type: "frame", costCoins: 180, rarity: "common", emoji: "🌧️" },
  { id: "frame-diya", name: "Diya Glow", description: "A little oil lamp of focus lighting your name", type: "frame", costCoins: 500, rarity: "uncommon", emoji: "🪔" },
  { id: "frame-peacock", name: "Peacock Feather", description: "Regal, iridescent, unmissable", type: "frame", costCoins: 1200, rarity: "rare", emoji: "🦚" },
  { id: "frame-holi", name: "Holi Splash", description: "Colours explode around your profile — focus, but make it festive", type: "frame", costCoins: 2800, rarity: "epic", emoji: "🎨" },
  { id: "frame-surya", name: "Surya Gold", description: "Forged in the first light. For those who top the board", type: "frame", costCoins: 10000, rarity: "legendary", emoji: "☀️" },
  // Avatars
  { id: "avatar-guruji", name: "Guruji", description: "Every answer, a story. Respect the elder", type: "avatar", costCoins: 150, rarity: "common", emoji: "🧓" },
  { id: "avatar-cricket", name: "Cricket Pro", description: "Study like a match is on — every ball counts", type: "avatar", costCoins: 450, rarity: "uncommon", emoji: "🏏" },
  { id: "avatar-dance", name: "Dance Master", description: "Learning moves to the beat", type: "avatar", costCoins: 650, rarity: "uncommon", emoji: "💃" },
  { id: "avatar-chef", name: "Desi Chef", description: "Seasons your syllabus with extra tadka", type: "avatar", costCoins: 1100, rarity: "rare", emoji: "🍳" },
  { id: "avatar-ragini", name: "Raga Master", description: "Recites theorems in perfect raag", type: "avatar", costCoins: 3000, rarity: "epic", emoji: "🎶" },
  { id: "avatar-neelkanta", name: "Neel Kanta", description: "Swallowed the poison of procrastination — and thrived", type: "avatar", costCoins: 12000, rarity: "legendary", emoji: "🐍" },
  // Effects
  { id: "effect-chai", name: "Chai Steam", description: "A gentle wisp of chai vapour trails your cursor", type: "effect", costCoins: 120, rarity: "common", emoji: "💨" },
  { id: "effect-monsoon", name: "Monsoon Drizzle", description: "Soft rain over every session — cozy and focused", type: "effect", costCoins: 550, rarity: "uncommon", emoji: "🌦️" },
  { id: "effect-ganga", name: "Ganga Flow", description: "A river of calm flows through your timer", type: "effect", costCoins: 1000, rarity: "rare", emoji: "🌊" },
  { id: "effect-mandala", name: "Mandala Bloom", description: "Intricate geometry slowly blooms as you focus", type: "effect", costCoins: 2500, rarity: "epic", emoji: "🌀" },
  { id: "effect-kundalini", name: "Kundalini Rise", description: "A serpent of pure energy climbs with every minute", type: "effect", costCoins: 8000, rarity: "legendary", emoji: "🐉" },
  // City decorations
  { id: "deco-haveli", name: "Jaipur Haveli", description: "Pink-city architecture for your Focus City", type: "decoration", costCoins: 280, rarity: "common", emoji: "🕌" },
  { id: "deco-banyan", name: "Village Banyan", description: "The tree under which every exam strategy was born", type: "decoration", costCoins: 600, rarity: "uncommon", emoji: "🌳" },
  { id: "deco-fort", name: "Hill Fort", description: "Defensible deep work, guarded by 300 meters of wall", type: "decoration", costCoins: 1400, rarity: "rare", emoji: "🏰" },
  { id: "deco-temple", name: "Temple Spire", description: "A golden spire that rings at the end of every session", type: "decoration", costCoins: 3200, rarity: "epic", emoji: "🛕" },
  // Accessories
  { id: "acc-tilak", name: "Tilak Mark", description: "A small mark of serious intent for your pet", type: "accessory", costCoins: 100, rarity: "common", emoji: "🪷" },
  { id: "acc-gajra", name: "Gajra Florals", description: "Fresh jasmine — your pet looks like a festival headliner", type: "accessory", costCoins: 700, rarity: "uncommon", emoji: "💐" },
  // Boosters
  { id: "boost-masala", name: "Masala Boost (12h)", description: "Extra spice: +50% session rewards for 12 hours", type: "booster", costCoins: 650, rarity: "uncommon", emoji: "🌶️" },
  { id: "boost-zen", name: "Zen Sutra (24h)", description: "A full day of unbroken, flowing focus energy", type: "booster", costCoins: 1300, rarity: "rare", emoji: "🧘" },
  { id: "boost-xp3", name: "XP Turbo (12h, 3×)", description: "Three times the XP for 12 hours. Burn it wisely", type: "booster", costCoins: 3500, rarity: "epic", emoji: "🚀" },
  // Special
  { id: "special-streakshield", name: "Streak Shield (1×)", description: "One use: a missed day will not break your streak", type: "special", costCoins: 1500, rarity: "rare", emoji: "🛡️" },

  { id: "special-xp2", name: "XP Booster (24h)", description: "2× XP for the next 24 hours", type: "booster", costCoins: 500, rarity: "rare", emoji: "⬆️" },
  { id: "special-coin2", name: "Coin Doubler (48h)", description: "2× coins for the next 48 hours", type: "booster", costCoins: 600, rarity: "epic", emoji: "🪙" },
];

export async function ensureDefaultItems() {
  try {
    // Always upsert every default item so new items added to code appear in DB
    await db.insert(marketplaceItemsTable)
      .values(DEFAULT_ITEMS.map(item => ({ ...item, premiumOnly: PREMIUM_ITEM_IDS.has(item.id), isActive: true })))
      .onConflictDoNothing();
  } catch { }
}

// ── Bundles (Workstream C): curated multi-item packs at a discount ──────────
const BUNDLES = [
  { id: "bundle-starter", name: "Starter Kit", description: "Everything a fresh scholar needs to look the part", items: ["acc-party", "effect-sparkle", "acc-scarf"], price: 350 },
  { id: "bundle-scholar", name: "Scholar's Set", description: "Golden frame, sharp optics, electric focus", items: ["frame-gold", "acc-glasses", "effect-lightning"], price: 850 },
  { id: "bundle-legend", name: "Legend's Vault", description: "The diamond, the stars, the aurora — for board-toppers only", items: ["frame-diamond", "avatar-astronaut", "effect-aurora"], price: 2000 },
] as const;

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
    const itemMap = new Map(items.map(i => [i.id, i]));
    const bundles = BUNDLES.map(b => {
      const bundleItems = b.items.map(id => itemMap.get(id)).filter(Boolean) as any[];
      const fullPrice = bundleItems.reduce((sum, i) => sum + i.costCoins, 0);
      const allOwned = bundleItems.every(i => ownedIds.has(i.id));
      return {
        id: b.id, name: b.name, description: b.description,
        items: bundleItems.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, rarity: i.rarity, costCoins: i.costCoins })),
        price: b.price, fullPrice,
        discountPct: fullPrice > 0 ? Math.round((1 - b.price / fullPrice) * 100) : 0,
        owned: allOwned,
      };
    });
    res.json({ items: itemsWithOwned, bundles });
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

      // Ledger burn inside the transaction (balance + coin_transactions row
      // commit or roll back together).
      const newBalance = await burnCoins(req.userId, item.costCoins, "marketplace_purchase", {
        description: `Purchased ${item.name}`,
        metadata: { itemId, itemName: item.name, itemType: item.type },
      }, tx as never);
      if (newBalance === null) return { error: "Insufficient coins", status: 400 } as const;

      await tx.insert(userInventoryTable).values({ userId: req.userId, itemId });
      return { ok: true, newBalance } as const;
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

// ─── GIFT (Workstream C): give an item to another member (+5% gift tax) ────

router.post("/marketplace/:itemId/gift", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { itemId } = req.params as { itemId: string };
  const toEmail = typeof (req.body as any)?.toEmail === "string" ? (req.body as any).toEmail.trim().toLowerCase() : "";
  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    res.status(400).json({ error: "A valid recipient email is required" }); return;
  }
  try {
    const [item] = await db.select().from(marketplaceItemsTable)
      .where(and(eq(marketplaceItemsTable.id, itemId), eq(marketplaceItemsTable.isActive, true)));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const [recipient] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, isGuest: usersTable.isGuest })
      .from(usersTable).where(eq(usersTable.email, toEmail)).limit(1);
    if (!recipient || recipient.isGuest || recipient.role === "bot") {
      res.status(404).json({ error: "No member found with that email" }); return;
    }
    if (recipient.id === req.userId) { res.status(400).json({ error: "You cannot gift to yourself — just buy it!" }); return; }

    const [alreadyOwned] = await db.select({ id: userInventoryTable.id })
      .from(userInventoryTable)
      .where(and(eq(userInventoryTable.userId, recipient.id), eq(userInventoryTable.itemId, itemId))).limit(1);
    if (alreadyOwned) { res.status(409).json({ error: "That member already owns this item" }); return; }

    if (item.premiumOnly && !await isUserPremium(req.userId)) {
      res.status(403).json({ error: "Gifting premium items requires Premium" }); return;
    }

    // Gift tax: +5% on the item price, paid by the giver.
    const tax = Math.ceil(item.costCoins * 0.05);
    const total = item.costCoins + tax;
    const newBalance = await burnCoins(req.userId, total, "gift_purchase", {
      description: `Gifted ${item.name} to ${recipient.name || toEmail}`,
      metadata: { itemId, itemName: item.name, recipientId: recipient.id, tax },
    });
    if (newBalance === null) { res.status(400).json({ error: "Not enough coins (includes 5% gift tax)" }); return; }

    await db.insert(userInventoryTable).values({ userId: recipient.id, itemId, equipped: false }).onConflictDoNothing();
    await db.insert(notificationsTable).values({
      userId: recipient.id, type: "gift",
      title: `You received a gift! ${item.emoji}`,
      message: `${req.userId === recipient.id ? "Someone" : "A member"} gifted you “${item.name}”${item.emoji ? "" : ""}. Open your inventory to see it.`,
      data: { itemId, itemName: item.name },
    }).catch(() => {});

    res.json({ ok: true, newBalance, tax, item: item.name, recipient: recipient.name || toEmail });
  } catch (err) {
    logger.error({ err }, "gift item error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── SELL-BACK (Workstream C): sell an owned item for 50% of its price ──────

router.post("/marketplace/inventory/:invId/sell", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { invId } = req.params as { invId: string };
  try {
    const [inv] = await db.select().from(userInventoryTable)
      .where(and(eq(userInventoryTable.id, invId), eq(userInventoryTable.userId, req.userId)));
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }

    const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, inv.itemId)).limit(1);
    if (!item) { res.status(404).json({ error: "Item no longer exists" }); return; }

    const refund = Math.floor(item.costCoins * 0.5);
    await db.delete(userInventoryTable).where(eq(userInventoryTable.id, invId));
    let newBalance = 0;
    if (refund > 0) {
      newBalance = await mintCoins(req.userId, refund, "sellback", {
        description: `Sold “${item.name}” (50% refund)`,
        metadata: { itemId: item.id, originalCost: item.costCoins },
      });
    } else {
      const [w] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));
      newBalance = w?.coins ?? 0;
    }

    res.json({ ok: true, refund, newBalance, item: item.name });
  } catch (err) {
    logger.error({ err }, "sell-back error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── BUNDLE PURCHASE (Workstream C) ──────────────────────────────────────────

router.post("/marketplace/bundles/:bundleId/purchase", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { bundleId } = req.params as { bundleId: string };
  const bundle = BUNDLES.find(b => b.id === bundleId);
  if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }
  try {
    const [existing] = await db.select({ id: userInventoryTable.id }).from(userInventoryTable)
      .where(and(eq(userInventoryTable.userId, req.userId), inArray(userInventoryTable.itemId, [...bundle.items]))).limit(1);
    if (existing) { res.status(409).json({ error: "You already own one of the items in this bundle" }); return; }

    const newBalance = await burnCoins(req.userId, bundle.price, "bundle_purchase", {
      description: `Purchased bundle “${bundle.name}” (${bundle.items.length} items)`,
      metadata: { bundleId, items: [...bundle.items] },
    });
    if (newBalance === null) { res.status(400).json({ error: "Not enough coins" }); return; }

    await db.insert(userInventoryTable)
      .values([...bundle.items].map(itemId => ({ userId: req.userId, itemId, equipped: false })))
      .onConflictDoNothing();

    res.json({ ok: true, newBalance, items: bundle.items.length, bundle: bundle.name });
  } catch (err) {
    logger.error({ err }, "bundle purchase error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as marketplaceRouter };
