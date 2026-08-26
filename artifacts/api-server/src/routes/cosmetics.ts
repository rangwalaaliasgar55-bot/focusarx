import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { cosmeticInventoryTable, assetCatalogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { spendTokens, getTokenBalance } from "../lib/tokenLedger";
import { logger } from "../lib/logger";

const router = Router();

const COSMETICS_CATALOG = [
  { id: "frame_bronze", type: "avatar_frame", name: "Bronze Frame", rarity: "common", tokenCost: 0, premium: false, description: "Starter frame" },
  { id: "frame_silver", type: "avatar_frame", name: "Silver Frame", rarity: "rare", tokenCost: 500, premium: false, description: "Shiny silver" },
  { id: "frame_gold", type: "avatar_frame", name: "Gold Frame", rarity: "epic", tokenCost: 2000, premium: true, description: "Premium gold" },
  { id: "frame_diamond", type: "avatar_frame", name: "Diamond Frame", rarity: "legendary", tokenCost: 5000, premium: true, description: "Diamond encrusted" },
  { id: "nameplate_neon", type: "nameplate", name: "Neon Nameplate", rarity: "rare", tokenCost: 800, premium: false },
  { id: "nameplate_galaxy", type: "nameplate", name: "Galaxy Nameplate", rarity: "epic", tokenCost: 2500, premium: true },
  { id: "bg_sunset", type: "background", name: "Sunset Background", rarity: "rare", tokenCost: 1000, premium: true },
  { id: "bg_aurora", type: "background", name: "Aurora Background", rarity: "legendary", tokenCost: 4000, premium: true },
  { id: "badge_streak_7", type: "badge", name: "7-Day Streak", rarity: "common", tokenCost: 0, premium: false },
  { id: "badge_focus_100", type: "badge", name: "100h Focus", rarity: "epic", tokenCost: 0, premium: false },
  { id: "aura_emerald", type: "aura", name: "Emerald Aura", rarity: "rare", tokenCost: 1200, premium: true },
  { id: "aura_phoenix", type: "aura", name: "Phoenix Aura", rarity: "legendary", tokenCost: 6000, premium: true },
  { id: "emote_gg", type: "emote", name: "GG Emote", rarity: "common", tokenCost: 200, premium: false },
  { id: "emote_fire", type: "emote", name: "Fire Emote", rarity: "epic", tokenCost: 1500, premium: true },
];

// GET /api/cosmetics/catalog
router.get("/cosmetics/catalog", async (req, res) => {
  res.json({ cosmetics: COSMETICS_CATALOG });
});

// GET /api/cosmetics/inventory
router.get("/cosmetics/inventory", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const inventory = await db.select().from(cosmeticInventoryTable).where(eq(cosmeticInventoryTable.userId, req.userId!));
    res.json({ inventory, catalog: COSMETICS_CATALOG });
  } catch (err) {
    logger.error({ err }, "cosmetics inventory error");
    res.status(500).json({ error: "Failed to load inventory" });
  }
});

// POST /api/cosmetics/:id/unlock — token purchase
router.post("/cosmetics/:id/unlock", authMiddleware, async (req: AuthRequest, res) => {
  const id = (req.params.id as string);
  const cosmetic = COSMETICS_CATALOG.find(c => c.id === id);
  if (!cosmetic) return res.status(404).json({ error: "Cosmetic not found" });

  try {
    const [existing] = await db.select().from(cosmeticInventoryTable).where(and(eq(cosmeticInventoryTable.userId, req.userId!), eq(cosmeticInventoryTable.cosmeticId, id))).limit(1);
    if (existing) return res.json({ inventory: existing, alreadyOwned: true });

    if (cosmetic.premium) {
      const premium = await isUserPremium(req.userId!);
      if (!premium) return res.status(403).json({ error: "Premium required", requiresPremium: true });
    }

    if (cosmetic.tokenCost > 0) {
      const balance = await getTokenBalance(req.userId!);
      if (balance < cosmetic.tokenCost) return res.status(400).json({ error: "Insufficient tokens", balance, required: cosmetic.tokenCost });
      const idempotencyKey = `cosmetic_${req.userId}_${id}`;
      await spendTokens(req.userId!, cosmetic.tokenCost, "cosmetic_purchase", idempotencyKey, { description: `cosmetic ${id}`, relatedEntityId: id });
    }

    const [inv] = await db.insert(cosmeticInventoryTable).values({
      userId: req.userId!,
      cosmeticId: id,
      type: cosmetic.type,
      equipped: false,
      acquiredFrom: cosmetic.tokenCost > 0 ? "token_purchase" : "starter",
    }).returning();

    res.json({ inventory: inv });
  } catch (err) {
    logger.error({ err }, "cosmetic unlock error");
    res.status(500).json({ error: "Failed to unlock" });
  }
});

// POST /api/cosmetics/:id/equip
router.post("/cosmetics/:id/equip", authMiddleware, async (req: AuthRequest, res) => {
  const id = (req.params.id as string);
  try {
    const [item] = await db.select().from(cosmeticInventoryTable).where(and(eq(cosmeticInventoryTable.userId, req.userId!), eq(cosmeticInventoryTable.cosmeticId, id))).limit(1);
    if (!item) return res.status(404).json({ error: "Not owned" });

    // Unequip others of same type
    await db.update(cosmeticInventoryTable).set({ equipped: false }).where(and(eq(cosmeticInventoryTable.userId, req.userId!), eq(cosmeticInventoryTable.type, item.type)));
    const [updated] = await db.update(cosmeticInventoryTable).set({ equipped: true }).where(eq(cosmeticInventoryTable.id, item.id)).returning();

    res.json({ inventory: updated });
  } catch (err) {
    logger.error({ err }, "cosmetic equip error");
    res.status(500).json({ error: "Failed to equip" });
  }
});

// GET /api/assets/catalog — asset catalog for 3D models, etc
router.get("/assets/catalog", async (_req, res) => {
  try {
    const assets = await db.select().from(assetCatalogTable).limit(100);
    res.json({ assets, fallback: COSMETICS_CATALOG });
  } catch {
    res.json({ assets: [], fallback: COSMETICS_CATALOG });
  }
});

export { router as cosmeticsRouter };
