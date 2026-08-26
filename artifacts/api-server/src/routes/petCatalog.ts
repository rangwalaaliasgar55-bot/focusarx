import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { petCatalogTable, userPetInventoryTable, assetCatalogTable } from "@workspace/db";
import { userPetsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { earnTokens } from "../lib/tokenLedger";
import { logger } from "../lib/logger";

const router = Router();

// Seed catalog if empty — called lazily
const DEFAULT_PETS = [
  { slug: "owl", name: "Sage Owl", description: "Wise and calm. Perfect for deep study.", rarity: "common", category: "starter", isPremium: false, tokenCost: 0, sortOrder: 0, thumbnailUrl: null, modelUrl: null, fallbackImageUrl: null, maxLevel: 20 },
  { slug: "fox", name: "Focus Fox", description: "Sharp and cunning. Thrives on consistency.", rarity: "common", category: "starter", isPremium: false, tokenCost: 0, sortOrder: 1 },
  { slug: "robot", name: "Study Bot", description: "Logical and precise. Optimizes sessions.", rarity: "common", category: "starter", isPremium: false, tokenCost: 0, sortOrder: 2 },
  { slug: "cat", name: "Neko Scholar", description: "Curious and playful. Keeps you motivated.", rarity: "common", category: "free", isPremium: false, tokenCost: 0, sortOrder: 3 },
  { slug: "dragon", name: "Study Dragon", description: "Fierce and powerful. Grows with ambition.", rarity: "epic", category: "premium", isPremium: true, tokenCost: 2500, sortOrder: 10 },
  { slug: "phoenix", name: "Rising Phoenix", description: "Reborn every session. Symbolizes growth.", rarity: "legendary", category: "premium", isPremium: true, tokenCost: 5000, sortOrder: 11 },
  { slug: "turtle", name: "Zen Turtle", description: "Slow and steady wins the race.", rarity: "rare", category: "achievement", isPremium: false, tokenCost: 0, sortOrder: 4 },
  { slug: "panda", name: "Chill Panda", description: "Relaxed focus companion.", rarity: "rare", category: "seasonal", isPremium: false, tokenCost: 1000, sortOrder: 5, isSeasonal: true },
  { slug: "unicorn", name: "Mystic Unicorn", description: "Magical productivity booster.", rarity: "legendary", category: "event", isPremium: true, tokenCost: 8000, sortOrder: 20 },
  { slug: "axolotl", name: "Axolotl Scholar", description: "Rare and adorable deep work buddy.", rarity: "epic", category: "exclusive", isPremium: true, tokenCost: 6000, sortOrder: 15 },
  { slug: "capybara", name: "Capybara Chill", description: "The most chill study companion.", rarity: "rare", category: "free", isPremium: false, tokenCost: 1500, sortOrder: 6 },
  { slug: "otter", name: "Focus Otter", description: "Playful and productive.", rarity: "common", category: "free", isPremium: false, tokenCost: 800, sortOrder: 7 },
];

async function ensureSeeded() {
  try {
    const existing = await db.select({ id: petCatalogTable.id }).from(petCatalogTable).limit(1);
    if (existing.length > 0) return;
    for (const p of DEFAULT_PETS) {
      await db.insert(petCatalogTable).values({
        slug: p.slug,
        name: p.name,
        description: p.description,
        rarity: p.rarity as any,
        category: p.category as any,
        isPremium: p.isPremium,
        tokenCost: p.tokenCost ?? 0,
        sortOrder: p.sortOrder,
        isActive: true,
        maxLevel: 20,
        unlockSource: p.category,
        isSeasonal: (p as any).isSeasonal ?? false,
      }).onConflictDoNothing();
    }
  } catch (e) {
    logger.warn({ err: e }, "pet catalog seed failed");
  }
}

// GET /api/pets/catalog — public list with filters
router.get("/pets/catalog", async (req, res) => {
  await ensureSeeded();
  try {
    const pets = await db.select().from(petCatalogTable).where(eq(petCatalogTable.isActive, true)).orderBy(petCatalogTable.sortOrder);
    res.json({ pets });
  } catch (err) {
    logger.error({ err }, "pet catalog list error");
    res.status(500).json({ error: "Failed to load catalog" });
  }
});

// GET /api/pets/inventory — user's pet inventory with progression 1-20
router.get("/pets/inventory", authMiddleware, async (req: AuthRequest, res) => {
  await ensureSeeded();
  try {
    const inventory = await db.select({
      inventory: userPetInventoryTable,
      catalog: petCatalogTable,
    }).from(userPetInventoryTable)
      .innerJoin(petCatalogTable, eq(userPetInventoryTable.petId, petCatalogTable.id))
      .where(eq(userPetInventoryTable.userId, req.userId!))
      .orderBy(desc(userPetInventoryTable.acquiredAt));

    // Also include legacy pet from userPetsTable for backward compat
    const [legacy] = await db.select().from(userPetsTable).where(eq(userPetsTable.userId, req.userId!)).limit(1);
    let legacyEntry = null;
    if (legacy) {
      const cat = await db.select().from(petCatalogTable).where(eq(petCatalogTable.slug, legacy.petType)).limit(1);
      if (cat[0]) {
        // ensure inventory entry exists
        const existing = inventory.find(i => i.catalog.slug === legacy.petType);
        if (!existing) {
          try {
            const [inv] = await db.insert(userPetInventoryTable).values({
              userId: req.userId!,
              petId: cat[0].id,
              level: legacy.petLevel ?? 1,
              bondXp: legacy.petXp ?? 0,
              nickname: legacy.petName,
              isActive: true,
              acquiredFrom: "starter",
            }).onConflictDoNothing().returning();
            if (inv) {
              inventory.unshift({ inventory: inv, catalog: cat[0] } as any);
            }
          } catch {}
        }
      }
    }

    res.json({ inventory });
  } catch (err) {
    logger.error({ err }, "pet inventory error");
    res.status(500).json({ error: "Failed to load inventory" });
  }
});

// POST /api/pets/catalog/:slug/unlock — token purchase or free starter
router.post("/pets/catalog/:slug/unlock", authMiddleware, async (req: AuthRequest, res) => {
  await ensureSeeded();
  const slug = (req.params.slug as string);
  try {
    const [catalog] = await db.select().from(petCatalogTable).where(eq(petCatalogTable.slug, slug)).limit(1);
    if (!catalog) return res.status(404).json({ error: "Pet not found" });
    if (!catalog.isActive) return res.status(400).json({ error: "Pet not available" });

    // Check if already owned
    const [existing] = await db.select().from(userPetInventoryTable)
      .where(and(eq(userPetInventoryTable.userId, req.userId!), eq(userPetInventoryTable.petId, catalog.id))).limit(1);
    if (existing) return res.json({ inventory: existing, catalog, alreadyOwned: true });

    // Premium check
    if (catalog.isPremium) {
      const premium = await isUserPremium(req.userId!);
      if (!premium && catalog.category === "premium") {
        // allow token purchase even without premium? Requirement: more pets for premium, but premium pets require premium OR token cost
        // For token-based system: premium pets require premium status + token cost
        // Enforce premium status for premium category
        return res.status(403).json({ error: "Premium pet requires Premium membership", requiresPremium: true });
      }
    }

    // If token cost > 0, deduct via ledger
    if (catalog.tokenCost && catalog.tokenCost > 0) {
      const { spendTokens, getTokenBalance } = await import("../lib/tokenLedger");
      const balance = await getTokenBalance(req.userId!);
      if (balance < catalog.tokenCost) {
        return res.status(400).json({ error: "Insufficient Focus Tokens", balance, required: catalog.tokenCost, needed: catalog.tokenCost - balance });
      }
      const idempotencyKey = `pet_unlock_${req.userId}_${catalog.id}`;
      try {
        await spendTokens(req.userId!, catalog.tokenCost, "cosmetic_purchase", idempotencyKey, { description: `pet ${slug}`, relatedEntityId: catalog.id });
      } catch (e: any) {
        if (e.message === "INSUFFICIENT_BALANCE") {
          return res.status(400).json({ error: "Insufficient tokens" });
        }
        // idempotent duplicate — treat as success if already owned
      }
    }

    const [inv] = await db.insert(userPetInventoryTable).values({
      userId: req.userId!,
      petId: catalog.id,
      level: 1,
      bondXp: 0,
      isActive: false,
      acquiredFrom: catalog.unlockSource,
    }).returning();

    res.json({ inventory: inv, catalog });
  } catch (err) {
    logger.error({ err }, "pet unlock error");
    res.status(500).json({ error: "Failed to unlock pet" });
  }
});

// POST /api/pets/inventory/:id/activate — set active pet
router.post("/pets/inventory/:id/activate", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    const [inv] = await db.select().from(userPetInventoryTable).where(and(eq(userPetInventoryTable.id, id as string), eq(userPetInventoryTable.userId, req.userId!))).limit(1);
    if (!inv) return res.status(404).json({ error: "Pet not found in inventory" });

    await db.transaction(async (tx) => {
      await tx.update(userPetInventoryTable).set({ isActive: false, updatedAt: new Date() }).where(eq(userPetInventoryTable.userId, req.userId!));
      await tx.update(userPetInventoryTable).set({ isActive: true, updatedAt: new Date() }).where(eq(userPetInventoryTable.id, id as string));
      // sync legacy table
      const catalog = await tx.select().from(petCatalogTable).where(eq(petCatalogTable.id, inv.petId)).limit(1);
      if (catalog[0]) {
        const [legacy] = await tx.select().from(userPetsTable).where(eq(userPetsTable.userId, req.userId!)).limit(1);
        if (legacy) {
          await tx.update(userPetsTable).set({ petType: catalog[0].slug, petName: inv.nickname || catalog[0].name, petLevel: inv.level, petXp: inv.bondXp, updatedAt: new Date() }).where(eq(userPetsTable.userId, req.userId!));
        } else {
          await tx.insert(userPetsTable).values({ userId: req.userId!, petType: catalog[0].slug, petName: inv.nickname || catalog[0].name, petLevel: inv.level, petXp: inv.bondXp }).onConflictDoNothing();
        }
      }
    });

    const updated = await db.select().from(userPetInventoryTable).where(eq(userPetInventoryTable.id, id as string)).limit(1);
    res.json({ inventory: updated[0] });
  } catch (err) {
    logger.error({ err }, "pet activate error");
    res.status(500).json({ error: "Failed to activate pet" });
  }
});

// POST /api/pets/inventory/:id/bond — add bond XP, level 1-20 progression with unlocks
router.post("/pets/inventory/:id/bond", authMiddleware, async (req: AuthRequest, res) => {
  const { xp, source } = req.body as { xp: number; source?: string };
  if (!xp || xp <= 0 || xp > 1000) return res.status(400).json({ error: "Invalid XP" });
  try {
    const [inv] = await db.select().from(userPetInventoryTable).where(and(eq(userPetInventoryTable.id, req.params.id as string), eq(userPetInventoryTable.userId, req.userId!))).limit(1);
    if (!inv) return res.status(404).json({ error: "Pet not found" });

    // Bond XP curve: level 1-20, each level needs level*100 XP
    let newXp = inv.bondXp + xp;
    let newLevel = inv.level;
    const unlocks: number[] = [];
    while (newLevel < 20) {
      const needed = newLevel * 100;
      if (newXp >= needed) {
        newXp -= needed;
        newLevel++;
        unlocks.push(newLevel);
      } else break;
    }
    if (newLevel === 20) newXp = 0; // capped

    const [updated] = await db.update(userPetInventoryTable).set({ level: newLevel, bondXp: newXp, updatedAt: new Date() }).where(eq(userPetInventoryTable.id, inv.id as string)).returning();

    // Token rewards for milestones
    const milestoneLevels = [3, 5, 8, 10, 15, 20];
    const earnedMilestones = unlocks.filter(l => milestoneLevels.includes(l));
    for (const lvl of earnedMilestones) {
      try {
        await earnTokens(req.userId!, "pet_milestone", `pet_${inv.id}_lvl_${lvl}`, { description: `pet ${inv.petId} lvl ${lvl}` }, 50 + lvl * 10);
      } catch {}
    }

    res.json({ inventory: updated, leveledUp: unlocks, earnedMilestones });
  } catch (err) {
    logger.error({ err }, "pet bond error");
    res.status(500).json({ error: "Failed to add bond XP" });
  }
});

// GET /api/pets/progression — returns unlock table
router.get("/pets/progression", async (_req, res) => {
  res.json({
    levels: Array.from({ length: 20 }, (_, i) => {
      const lvl = i + 1;
      const xpNeeded = lvl * 100;
      const unlocks: string[] = [];
      if (lvl === 1) unlocks.push("Pet unlocked");
      if (lvl === 3) unlocks.push("Custom nickname");
      if (lvl === 5) unlocks.push("Accessory slot: hat");
      if (lvl === 8) unlocks.push("Accessory slot: glasses");
      if (lvl === 10) unlocks.push("Evolution stage 2 + 100 Focus Tokens");
      if (lvl === 15) unlocks.push("Evolution stage 3 + aura");
      if (lvl === 20) unlocks.push("Legendary evolution + 500 Focus Tokens + exclusive badge");
      return { level: lvl, xpNeeded, unlocks };
    }),
  });
});

export { router as petCatalogRouter };
