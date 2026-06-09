import { Router } from "express";
import { db } from "@workspace/db";
import {
  marketplaceItemsTable,
  userPetsTable,
  lootBoxTypesTable,
  questDefinitionsTable,
  battlePassProgressTable,
  notificationsTable,
  usersTable,
  userWalletsTable,
  premiumSubscriptionsTable,
  coinTransactionsTable,
} from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

async function checkAuth(req: any): Promise<boolean> {
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)focusarx_admin=([^;]+)/);
  const token = match?.[1];
  if (token) {
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env.AUTH_SECRET ?? process.env.JWT_SECRET ?? "dev-secret";
      const payload = jwt.default.verify(token, secret) as { role?: string };
      if (payload?.role === "admin_session") return true;
    } catch { }
  }
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch { return false; }
}

// ─── MARKETPLACE CMS ─────────────────────────────────────────────────────────

router.get("/admin/cms/marketplace", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const items = await db.select().from(marketplaceItemsTable).orderBy(marketplaceItemsTable.type, marketplaceItemsTable.name);
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "cms marketplace get error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/cms/marketplace", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { id, name, description, type, costCoins, rarity, emoji, isActive } = req.body as any;
  if (!id || !name || !type || costCoins === undefined) {
    res.status(400).json({ error: "id, name, type, costCoins required" }); return;
  }
  try {
    const [item] = await db.insert(marketplaceItemsTable).values({
      id, name, description: description ?? "", type, costCoins: Number(costCoins),
      rarity: rarity ?? "common", emoji: emoji ?? "🎁", isActive: isActive ?? true,
    }).onConflictDoNothing().returning();
    res.json({ ok: true, item });
  } catch (err) {
    logger.error({ err }, "cms marketplace create error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/admin/cms/marketplace/:itemId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { itemId } = req.params;
  const { name, description, type, costCoins, rarity, emoji, isActive } = req.body as any;
  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (costCoins !== undefined) updates.costCoins = Number(costCoins);
    if (rarity !== undefined) updates.rarity = rarity;
    if (emoji !== undefined) updates.emoji = emoji;
    if (isActive !== undefined) updates.isActive = isActive;
    const [item] = await db.update(marketplaceItemsTable).set(updates)
      .where(eq(marketplaceItemsTable.id, itemId)).returning();
    res.json({ ok: true, item });
  } catch (err) {
    logger.error({ err }, "cms marketplace update error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/cms/marketplace/:itemId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { itemId } = req.params;
  try {
    await db.delete(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, itemId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "cms marketplace delete error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PET CMS ─────────────────────────────────────────────────────────────────

router.get("/admin/cms/pets", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const stats = await db.select({
      petType: userPetsTable.petType,
      count: sql<number>`count(*)::int`,
      avgLevel: sql<number>`round(avg(${userPetsTable.petLevel}), 1)::float`,
    }).from(userPetsTable).groupBy(userPetsTable.petType).orderBy(sql`count(*) desc`);

    const totalPets = await db.select({ count: count() }).from(userPetsTable);

    res.json({ stats, totalPets: totalPets[0]?.count ?? 0 });
  } catch (err) {
    logger.error({ err }, "cms pets get error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── LOOTBOX CMS ─────────────────────────────────────────────────────────────

router.get("/admin/cms/lootboxes", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const types = await db.select().from(lootBoxTypesTable);
    res.json({ types });
  } catch (err) {
    logger.error({ err }, "cms lootboxes get error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/admin/cms/lootboxes/:typeId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { typeId } = req.params;
  const { name, description, coinCost, isAvailable, emoji } = req.body as any;
  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (coinCost !== undefined) updates.coinCost = Number(coinCost);
    if (isAvailable !== undefined) updates.isAvailable = isAvailable;
    if (emoji !== undefined) updates.emoji = emoji;
    const [type] = await db.update(lootBoxTypesTable).set(updates)
      .where(eq(lootBoxTypesTable.id, typeId)).returning();
    res.json({ ok: true, type });
  } catch (err) {
    logger.error({ err }, "cms lootboxes update error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── QUEST BUILDER ────────────────────────────────────────────────────────────

router.get("/admin/cms/quests", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const quests = await db.select().from(questDefinitionsTable).orderBy(questDefinitionsTable.type, questDefinitionsTable.title);
    res.json({ quests });
  } catch (err) {
    logger.error({ err }, "cms quests get error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/cms/quests", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, description, type, requirementType, requirementValue, xpReward, coinReward, emoji } = req.body as any;
  if (!title || !type || !requirementType || requirementValue === undefined) {
    res.status(400).json({ error: "title, type, requirementType, requirementValue required" }); return;
  }
  try {
    const autoId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [quest] = await db.insert(questDefinitionsTable).values({
      id: autoId,
      title, description: description ?? "", type, requirementType,
      requirementValue: Number(requirementValue),
      xpReward: Number(xpReward ?? 0), coinReward: Number(coinReward ?? 0),
      emoji: emoji ?? "⭐", isActive: true,
    }).returning();
    res.json({ ok: true, quest });
  } catch (err) {
    logger.error({ err }, "cms quest create error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/admin/cms/quests/:questId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { questId } = req.params;
  const { title, description, type, requirementType, requirementValue, xpReward, coinReward, emoji, isActive } = req.body as any;
  try {
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (requirementType !== undefined) updates.requirementType = requirementType;
    if (requirementValue !== undefined) updates.requirementValue = Number(requirementValue);
    if (xpReward !== undefined) updates.xpReward = Number(xpReward);
    if (coinReward !== undefined) updates.coinReward = Number(coinReward);
    if (emoji !== undefined) updates.emoji = emoji;
    if (isActive !== undefined) updates.isActive = isActive;
    const [quest] = await db.update(questDefinitionsTable).set(updates)
      .where(eq(questDefinitionsTable.id, questId)).returning();
    res.json({ ok: true, quest });
  } catch (err) {
    logger.error({ err }, "cms quest update error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/cms/quests/:questId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { questId } = req.params;
  try {
    await db.update(questDefinitionsTable).set({ isActive: false }).where(eq(questDefinitionsTable.id, questId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "cms quest delete error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── BATTLE PASS ADMIN ────────────────────────────────────────────────────────

router.get("/admin/cms/battle-pass", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [stats] = await db.select({
      totalUsers: sql<number>`count(*)::int`,
      avgTier: sql<number>`round(avg(${battlePassProgressTable.tier}), 1)::float`,
      avgXp: sql<number>`round(avg(${battlePassProgressTable.seasonXp}), 0)::float`,
      premiumCount: sql<number>`count(*) filter (where ${battlePassProgressTable.premiumUnlocked} = true)::int`,
      maxTier: sql<number>`max(${battlePassProgressTable.tier})::int`,
    }).from(battlePassProgressTable);

    const tierDist = await db.select({
      tier: battlePassProgressTable.tier,
      count: sql<number>`count(*)::int`,
    }).from(battlePassProgressTable).groupBy(battlePassProgressTable.tier).orderBy(battlePassProgressTable.tier);

    res.json({ stats, tierDistribution: tierDist });
  } catch (err) {
    logger.error({ err }, "cms battle pass get error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── EMAIL / NOTIFICATION BLAST ───────────────────────────────────────────────

router.post("/admin/cms/notify-all", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, message, type } = req.body as { title?: string; message?: string; type?: string };
  if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.isGuest, false));

    if (users.length === 0) { res.json({ ok: true, sent: 0 }); return; }

    const notifValues = users.map(u => ({
      userId: u.id,
      type: (type ?? "system") as string,
      title,
      message,
      read: false,
    }));

    const chunkSize = 100;
    let sent = 0;
    for (let i = 0; i < notifValues.length; i += chunkSize) {
      const chunk = notifValues.slice(i, i + chunkSize);
      await db.insert(notificationsTable).values(chunk).onConflictDoNothing();
      sent += chunk.length;
    }

    res.json({ ok: true, sent });
  } catch (err) {
    logger.error({ err }, "notify-all error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PLATFORM STATS FOR ADMIN OVERVIEW ───────────────────────────────────────

router.get("/admin/cms/overview", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [userStats] = await db.select({
      total: sql<number>`count(*)::int`,
      registered: sql<number>`count(*) filter (where ${usersTable.isGuest} = false)::int`,
      guests: sql<number>`count(*) filter (where ${usersTable.isGuest} = true)::int`,
      admins: sql<number>`count(*) filter (where ${usersTable.role} = 'admin')::int`,
    }).from(usersTable);

    const [walletStats] = await db.select({
      totalCoins: sql<number>`coalesce(sum(${userWalletsTable.coins}), 0)::bigint`,
      totalXp: sql<number>`coalesce(sum(${userWalletsTable.totalXp}), 0)::bigint`,
      avgCoins: sql<number>`round(avg(${userWalletsTable.coins}), 0)::float`,
      avgXp: sql<number>`round(avg(${userWalletsTable.totalXp}), 0)::float`,
    }).from(userWalletsTable);

    const [marketplaceStats] = await db.select({
      totalItems: sql<number>`count(*)::int`,
      activeItems: sql<number>`count(*) filter (where ${marketplaceItemsTable.isActive} = true)::int`,
    }).from(marketplaceItemsTable);

    const [questStats] = await db.select({
      totalQuests: sql<number>`count(*)::int`,
      activeQuests: sql<number>`count(*) filter (where ${questDefinitionsTable.isActive} = true)::int`,
    }).from(questDefinitionsTable);

    res.json({
      users: userStats,
      wallets: walletStats,
      marketplace: marketplaceStats,
      quests: questStats,
    });
  } catch (err) {
    logger.error({ err }, "cms overview error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── COIN GRANT (admin tool) ──────────────────────────────────────────────────

router.post("/admin/cms/grant-coins", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userId, amount, reason } = req.body as { userId?: string; amount?: number; reason?: string };
  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: "userId and positive amount required" }); return;
  }
  try {
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    if (!wallet) { res.status(404).json({ error: "User wallet not found" }); return; }
    const newBalance = wallet.coins + Number(amount);
    await db.update(userWalletsTable).set({ coins: newBalance }).where(eq(userWalletsTable.userId, userId));
    await db.insert(notificationsTable).values({
      userId, type: "system", read: false,
      title: "Admin Coin Grant",
      message: `An admin granted you ${amount.toLocaleString()} coins. ${reason ? `Reason: ${reason}` : ""}`,
    });
    res.json({ ok: true, newBalance });
  } catch (err) {
    logger.error({ err }, "grant coins error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PREMIUM ADMIN ────────────────────────────────────────────────────────────

router.get("/admin/cms/premium", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${premiumSubscriptionsTable.isActive} = true)::int`,
      adminGranted: sql<number>`count(*) filter (where ${premiumSubscriptionsTable.grantedByAdmin} = true)::int`,
    }).from(premiumSubscriptionsTable);

    const recent = await db.select({
      id: premiumSubscriptionsTable.id,
      userId: premiumSubscriptionsTable.userId,
      activatedAt: premiumSubscriptionsTable.activatedAt,
      expiresAt: premiumSubscriptionsTable.expiresAt,
      isActive: premiumSubscriptionsTable.isActive,
      grantedByAdmin: premiumSubscriptionsTable.grantedByAdmin,
      email: usersTable.email,
      name: usersTable.name,
    }).from(premiumSubscriptionsTable)
      .leftJoin(usersTable, eq(usersTable.id, premiumSubscriptionsTable.userId))
      .orderBy(sql`${premiumSubscriptionsTable.activatedAt} DESC`).limit(50);

    res.json({ stats, recent });
  } catch (err) {
    logger.error({ err }, "cms premium get error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/cms/premium/grant", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userId, durationDays } = req.body as { userId?: string; durationDays?: number };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const days = durationDays ?? 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await db.insert(premiumSubscriptionsTable).values({
      userId,
      expiresAt,
      coinsCost: 0,
      isActive: true,
      grantedByAdmin: true,
    }).onConflictDoUpdate({
      target: [premiumSubscriptionsTable.userId],
      set: { isActive: true, expiresAt, grantedByAdmin: true, activatedAt: new Date() },
    });

    await db.insert(notificationsTable).values({
      userId,
      type: "premium",
      title: "Premium Granted! 👑",
      message: `An admin has granted you ${days} days of Premium access. Enjoy exclusive features!`,
    }).catch(() => {});

    res.json({ ok: true, expiresAt });
  } catch (err) {
    logger.error({ err }, "cms premium grant error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/cms/premium/revoke", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  try {
    await db.update(premiumSubscriptionsTable)
      .set({ isActive: false })
      .where(eq(premiumSubscriptionsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "cms premium revoke error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── SEED ENDPOINTS ───────────────────────────────────────────────────────────

router.post("/admin/cms/seed/lootboxes", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const SEED_BOXES = [
      { id: "lb-common-1", name: "Focus Box", description: "A basic box for focused students", rarity: "common", coinCost: 100, sessionsRequired: 0, icon: "📦", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 50, weight: 40 }, { type: "xp", value: 100, weight: 40 }, { type: "streak_shield", value: 1, weight: 20 }] },
      { id: "lb-rare-1", name: "Scholar Box", description: "Rare rewards for dedicated scholars", rarity: "rare", coinCost: 300, sessionsRequired: 0, icon: "🎓", glowColor: "#3B82F6", possibleRewards: [{ type: "coins", value: 200, weight: 30 }, { type: "xp", value: 400, weight: 30 }, { type: "xp_boost", value: 1, weight: 25 }, { type: "streak_shield", value: 2, weight: 15 }] },
      { id: "lb-epic-1", name: "Epic Focus Box", description: "Legendary focus rewards", rarity: "epic", coinCost: 800, sessionsRequired: 0, icon: "🌟", glowColor: "#8B5CF6", possibleRewards: [{ type: "coins", value: 600, weight: 25 }, { type: "xp", value: 1200, weight: 25 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 }, { type: "xp_boost", value: 2, weight: 15 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-legendary-1", name: "Legendary Scholar Box", description: "For the most dedicated scholars", rarity: "legendary", coinCost: 3000, sessionsRequired: 0, icon: "👑", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 2500, weight: 20 }, { type: "xp", value: 5000, weight: 20 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 25 }, { type: "xp_boost", value: 5, weight: 20 }, { type: "battle_pass_tiers", value: 5, weight: 15 }] },
      { id: "lb-mythic-1", name: "Mythic Void Box", description: "From beyond reality", rarity: "mythic", coinCost: 15000, sessionsRequired: 0, icon: "⚫", glowColor: "#EC4899", possibleRewards: [{ type: "coins", value: 10000, weight: 15 }, { type: "xp", value: 20000, weight: 15 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 30 }, { type: "xp_boost", value: 20, weight: 20 }, { type: "battle_pass_tiers", value: 15, weight: 20 }] },
    ];

    let seeded = 0;
    for (const box of SEED_BOXES) {
      const existing = await db.select().from(lootBoxTypesTable).where(eq(lootBoxTypesTable.id, box.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(lootBoxTypesTable).values(box).catch(() => {});
        seeded++;
      }
    }
    res.json({ ok: true, seeded, total: SEED_BOXES.length });
  } catch (err) {
    logger.error({ err }, "seed lootboxes error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminCmsRouter };
