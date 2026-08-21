import { Router } from "express";
import {
  db,
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
} from "@workspace/db";
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
  const { itemId } = req.params as { itemId: string };
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
  const { itemId } = req.params as { itemId: string };
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
  const { typeId } = req.params as { typeId: string };
  const { name, description, coinCost, icon, glowColor } = req.body as any;
  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (coinCost !== undefined) updates.coinCost = Number(coinCost);
    if (icon !== undefined) updates.icon = icon;
    if (glowColor !== undefined) updates.glowColor = glowColor;
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
  const { title, description, type, metric, target, xpReward, coinReward, icon, difficulty } = req.body as any;
  if (!title || !type || !metric || target === undefined) {
    res.status(400).json({ error: "title, type, metric, target required" }); return;
  }
  try {
    const autoId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [quest] = await db.insert(questDefinitionsTable).values({
      id: autoId,
      title, description: description ?? "", type,
      metric,
      target: Number(target),
      difficulty: difficulty ?? "easy",
      xpReward: Number(xpReward ?? 0), coinReward: Number(coinReward ?? 0),
      icon: icon ?? "⭐", isActive: true,
    }).returning();
    res.json({ ok: true, quest });
  } catch (err) {
    logger.error({ err }, "cms quest create error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/admin/cms/quests/:questId", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { questId } = req.params as { questId: string };
  const { title, description, type, metric, target, xpReward, coinReward, icon, isActive, difficulty } = req.body as any;
  try {
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (metric !== undefined) updates.metric = metric;
    if (target !== undefined) updates.target = Number(target);
    if (xpReward !== undefined) updates.xpReward = Number(xpReward);
    if (coinReward !== undefined) updates.coinReward = Number(coinReward);
    if (icon !== undefined) updates.icon = icon;
    if (isActive !== undefined) updates.isActive = isActive;
    if (difficulty !== undefined) updates.difficulty = difficulty;
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
  const { questId } = req.params as { questId: string };
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

// ─── BULK USER ACTIONS (admin tool) ──────────────────────────────────────────

// Bulk grant coins to many users at once (e.g. contest winners, compensation).
router.post("/admin/cms/grant-coins/bulk", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userIds, amount, reason } = req.body as { userIds?: string[]; amount?: number; reason?: string };
  if (!Array.isArray(userIds) || userIds.length === 0 || !amount || amount <= 0) {
    res.status(400).json({ error: "userIds (non-empty array) and positive amount required" }); return;
  }
  const ids = userIds.filter((id) => typeof id === "string").slice(0, 500);
  const amt = Number(amount);
  try {
    let granted = 0;
    for (const id of ids) {
      try {
        const [wallet] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, id)).limit(1);
        if (!wallet) continue;
        await db.update(userWalletsTable).set({ coins: wallet.coins + amt }).where(eq(userWalletsTable.userId, id));
        await db.insert(notificationsTable).values({
          userId: id, type: "system", read: false,
          title: "Admin Coin Grant",
          message: `An admin granted you ${amt.toLocaleString()} coins. ${reason ? `Reason: ${reason}` : ""}`,
        });
        granted++;
      } catch { /* skip individual failures */ }
    }
    res.json({ ok: true, granted, attempted: ids.length });
  } catch (err) {
    logger.error({ err }, "bulk grant coins error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Bulk delete users.
router.post("/admin/users/bulk-delete", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { userIds } = req.body as { userIds?: string[] };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: "userIds required" }); return;
  }
  const ids = userIds.filter((id) => typeof id === "string").slice(0, 500);
  try {
    let deleted = 0;
    for (const id of ids) {
      // Never allow deleting an admin via bulk action.
      const [u] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
      if (!u || u.role === "admin") continue;
      await db.delete(usersTable).where(eq(usersTable.id, id));
      deleted++;
    }
    res.json({ ok: true, deleted, attempted: ids.length });
  } catch (err) {
    logger.error({ err }, "bulk delete users error");
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
      // COMMON (10)
      { id: "lb-c-1", name: "Study Starter Box", description: "Every journey begins somewhere", rarity: "common", coinCost: 100, sessionsRequired: 0, icon: "📦", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 50, weight: 40 }, { type: "xp", value: 100, weight: 40 }, { type: "streak_shield", value: 1, weight: 20 }] },
      { id: "lb-c-2", name: "Beginner's Chest", description: "A chest for new scholars", rarity: "common", coinCost: 80, sessionsRequired: 0, icon: "🗃️", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 40, weight: 50 }, { type: "xp", value: 80, weight: 50 }] },
      { id: "lb-c-3", name: "Daily Reward Box", description: "Claim your daily reward", rarity: "common", coinCost: 0, sessionsRequired: 1, icon: "📬", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 60, weight: 45 }, { type: "xp", value: 120, weight: 45 }, { type: "streak_shield", value: 1, weight: 10 }] },
      { id: "lb-c-4", name: "Focus Drop", description: "A small drop of focus rewards", rarity: "common", coinCost: 120, sessionsRequired: 0, icon: "💧", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 70, weight: 45 }, { type: "xp", value: 130, weight: 45 }, { type: "streak_shield", value: 1, weight: 10 }] },
      { id: "lb-c-5", name: "Pocket Box", description: "Small but reliable", rarity: "common", coinCost: 90, sessionsRequired: 0, icon: "🎒", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 55, weight: 50 }, { type: "xp", value: 110, weight: 50 }] },
      { id: "lb-c-6", name: "Session Chest", description: "Earned through sessions", rarity: "common", coinCost: 0, sessionsRequired: 3, icon: "⏱️", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 75, weight: 40 }, { type: "xp", value: 150, weight: 40 }, { type: "streak_shield", value: 1, weight: 20 }] },
      { id: "lb-c-7", name: "Bronze Crate", description: "Basic but honest rewards", rarity: "common", coinCost: 110, sessionsRequired: 0, icon: "📤", glowColor: "#92400E", possibleRewards: [{ type: "coins", value: 65, weight: 50 }, { type: "xp", value: 125, weight: 50 }] },
      { id: "lb-c-8", name: "Learner's Pack", description: "Every expert was once a beginner", rarity: "common", coinCost: 95, sessionsRequired: 0, icon: "📚", glowColor: "#6B7280", possibleRewards: [{ type: "coins", value: 60, weight: 45 }, { type: "xp", value: 110, weight: 45 }, { type: "streak_shield", value: 1, weight: 10 }] },
      { id: "lb-c-9", name: "Sunrise Box", description: "Start your day with rewards", rarity: "common", coinCost: 100, sessionsRequired: 0, icon: "🌅", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 55, weight: 50 }, { type: "xp", value: 120, weight: 50 }] },
      { id: "lb-c-10", name: "Spark Box", description: "Small sparks start big fires", rarity: "common", coinCost: 85, sessionsRequired: 0, icon: "✨", glowColor: "#FCD34D", possibleRewards: [{ type: "coins", value: 50, weight: 50 }, { type: "xp", value: 100, weight: 50 }] },
      // UNCOMMON (10)
      { id: "lb-u-1", name: "Scholar's Cache", description: "For the dedicated student", rarity: "uncommon", coinCost: 200, sessionsRequired: 0, icon: "🎒", glowColor: "#10B981", possibleRewards: [{ type: "coins", value: 150, weight: 35 }, { type: "xp", value: 300, weight: 35 }, { type: "xp_boost", value: 1, weight: 20 }, { type: "streak_shield", value: 2, weight: 10 }] },
      { id: "lb-u-2", name: "Focus Capsule", description: "Concentrated focus rewards", rarity: "uncommon", coinCost: 250, sessionsRequired: 0, icon: "💊", glowColor: "#10B981", possibleRewards: [{ type: "coins", value: 180, weight: 35 }, { type: "xp", value: 350, weight: 35 }, { type: "xp_boost", value: 1, weight: 20 }, { type: "streak_shield", value: 2, weight: 10 }] },
      { id: "lb-u-3", name: "Silver Chest", description: "Silver-tier scholar rewards", rarity: "uncommon", coinCost: 220, sessionsRequired: 0, icon: "🪙", glowColor: "#9CA3AF", possibleRewards: [{ type: "coins", value: 160, weight: 40 }, { type: "xp", value: 320, weight: 40 }, { type: "streak_shield", value: 2, weight: 20 }] },
      { id: "lb-u-4", name: "Study Drop", description: "Rewards from hours of study", rarity: "uncommon", coinCost: 0, sessionsRequired: 5, icon: "📖", glowColor: "#10B981", possibleRewards: [{ type: "coins", value: 200, weight: 30 }, { type: "xp", value: 400, weight: 30 }, { type: "xp_boost", value: 1, weight: 25 }, { type: "streak_shield", value: 2, weight: 15 }] },
      { id: "lb-u-5", name: "Night Owl Box", description: "For those who study late", rarity: "uncommon", coinCost: 230, sessionsRequired: 0, icon: "🦉", glowColor: "#1D4ED8", possibleRewards: [{ type: "coins", value: 175, weight: 35 }, { type: "xp", value: 340, weight: 35 }, { type: "xp_boost", value: 1, weight: 20 }, { type: "streak_shield", value: 2, weight: 10 }] },
      { id: "lb-u-6", name: "Streak Box", description: "Keep the streak alive", rarity: "uncommon", coinCost: 200, sessionsRequired: 0, icon: "🔥", glowColor: "#EF4444", possibleRewards: [{ type: "coins", value: 160, weight: 30 }, { type: "xp", value: 300, weight: 30 }, { type: "streak_shield", value: 3, weight: 30 }, { type: "xp_boost", value: 1, weight: 10 }] },
      { id: "lb-u-7", name: "Jade Chest", description: "Balanced uncommon rewards", rarity: "uncommon", coinCost: 240, sessionsRequired: 0, icon: "🟢", glowColor: "#10B981", possibleRewards: [{ type: "coins", value: 190, weight: 38 }, { type: "xp", value: 360, weight: 38 }, { type: "xp_boost", value: 1, weight: 24 }] },
      { id: "lb-u-8", name: "Achievement Box", description: "For those pushing their limits", rarity: "uncommon", coinCost: 260, sessionsRequired: 0, icon: "🏅", glowColor: "#D97706", possibleRewards: [{ type: "coins", value: 200, weight: 35 }, { type: "xp", value: 380, weight: 35 }, { type: "xp_boost", value: 1, weight: 20 }, { type: "streak_shield", value: 2, weight: 10 }] },
      { id: "lb-u-9", name: "Dawn Box", description: "Early risers rewarded", rarity: "uncommon", coinCost: 210, sessionsRequired: 0, icon: "🌄", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 170, weight: 40 }, { type: "xp", value: 330, weight: 40 }, { type: "streak_shield", value: 2, weight: 20 }] },
      { id: "lb-u-10", name: "Wisdom Cache", description: "Knowledge is power", rarity: "uncommon", coinCost: 215, sessionsRequired: 0, icon: "📜", glowColor: "#10B981", possibleRewards: [{ type: "coins", value: 165, weight: 38 }, { type: "xp", value: 325, weight: 38 }, { type: "xp_boost", value: 1, weight: 24 }] },
      // RARE (10)
      { id: "lb-r-1", name: "Scholar Box", description: "Rare rewards for dedicated scholars", rarity: "rare", coinCost: 500, sessionsRequired: 0, icon: "🎓", glowColor: "#3B82F6", possibleRewards: [{ type: "coins", value: 400, weight: 30 }, { type: "xp", value: 800, weight: 30 }, { type: "xp_boost", value: 2, weight: 25 }, { type: "streak_shield", value: 3, weight: 15 }] },
      { id: "lb-r-2", name: "Blue Crystal Box", description: "Crystalline blue rewards", rarity: "rare", coinCost: 550, sessionsRequired: 0, icon: "💎", glowColor: "#3B82F6", possibleRewards: [{ type: "coins", value: 450, weight: 30 }, { type: "xp", value: 900, weight: 30 }, { type: "marketplace_item", value: "uncommon", rarity: "uncommon", weight: 25 }, { type: "xp_boost", value: 2, weight: 15 }] },
      { id: "lb-r-3", name: "Focus Elite Box", description: "Elite focus session rewards", rarity: "rare", coinCost: 0, sessionsRequired: 10, icon: "⚡", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 500, weight: 25 }, { type: "xp", value: 1000, weight: 25 }, { type: "xp_boost", value: 2, weight: 25 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 }] },
      { id: "lb-r-4", name: "Sapphire Chest", description: "Blue gem rewards", rarity: "rare", coinCost: 520, sessionsRequired: 0, icon: "🔷", glowColor: "#2563EB", possibleRewards: [{ type: "coins", value: 420, weight: 30 }, { type: "xp", value: 850, weight: 30 }, { type: "xp_boost", value: 2, weight: 25 }, { type: "streak_shield", value: 3, weight: 15 }] },
      { id: "lb-r-5", name: "Storm Box", description: "Charged with electric rewards", rarity: "rare", coinCost: 480, sessionsRequired: 0, icon: "⛈️", glowColor: "#6366F1", possibleRewards: [{ type: "coins", value: 380, weight: 35 }, { type: "xp", value: 760, weight: 35 }, { type: "xp_boost", value: 2, weight: 20 }, { type: "streak_shield", value: 3, weight: 10 }] },
      { id: "lb-r-6", name: "Quantum Box", description: "Superposition of rewards", rarity: "rare", coinCost: 600, sessionsRequired: 0, icon: "🔬", glowColor: "#06B6D4", possibleRewards: [{ type: "coins", value: 500, weight: 28 }, { type: "xp", value: 1000, weight: 28 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 28 }, { type: "xp_boost", value: 2, weight: 16 }] },
      { id: "lb-r-7", name: "Mind Palace Box", description: "Unlock your mental fortress", rarity: "rare", coinCost: 540, sessionsRequired: 0, icon: "🏰", glowColor: "#3B82F6", possibleRewards: [{ type: "coins", value: 440, weight: 30 }, { type: "xp", value: 880, weight: 30 }, { type: "xp_boost", value: 2, weight: 25 }, { type: "streak_shield", value: 4, weight: 15 }] },
      { id: "lb-r-8", name: "Aurora Box", description: "Northern lights of rewards", rarity: "rare", coinCost: 560, sessionsRequired: 0, icon: "🌌", glowColor: "#8B5CF6", possibleRewards: [{ type: "coins", value: 460, weight: 30 }, { type: "xp", value: 920, weight: 30 }, { type: "marketplace_item", value: "uncommon", rarity: "uncommon", weight: 25 }, { type: "xp_boost", value: 2, weight: 15 }] },
      { id: "lb-r-9", name: "Valor Chest", description: "For the courageous scholar", rarity: "rare", coinCost: 510, sessionsRequired: 0, icon: "🛡️", glowColor: "#3B82F6", possibleRewards: [{ type: "coins", value: 410, weight: 32 }, { type: "xp", value: 820, weight: 32 }, { type: "xp_boost", value: 2, weight: 22 }, { type: "streak_shield", value: 3, weight: 14 }] },
      { id: "lb-r-10", name: "Prism Box", description: "Refracted into pure rewards", rarity: "rare", coinCost: 530, sessionsRequired: 0, icon: "🔆", glowColor: "#06D6A0", possibleRewards: [{ type: "coins", value: 430, weight: 30 }, { type: "xp", value: 860, weight: 30 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 }, { type: "xp_boost", value: 2, weight: 15 }] },
      // EPIC (10)
      { id: "lb-e-1", name: "Epic Focus Box", description: "Epic focus rewards", rarity: "epic", coinCost: 1200, sessionsRequired: 0, icon: "🌟", glowColor: "#8B5CF6", possibleRewards: [{ type: "coins", value: 1000, weight: 25 }, { type: "xp", value: 2000, weight: 25 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 }, { type: "xp_boost", value: 3, weight: 15 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-e-2", name: "Violet Storm Box", description: "Purple lightning rewards", rarity: "epic", coinCost: 1400, sessionsRequired: 0, icon: "💜", glowColor: "#7C3AED", possibleRewards: [{ type: "coins", value: 1200, weight: 22 }, { type: "xp", value: 2400, weight: 22 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 28 }, { type: "xp_boost", value: 3, weight: 18 }, { type: "battle_pass_tiers", value: 3, weight: 10 }] },
      { id: "lb-e-3", name: "Galaxy Box", description: "Rewards from the cosmos", rarity: "epic", coinCost: 0, sessionsRequired: 25, icon: "🌠", glowColor: "#4F46E5", possibleRewards: [{ type: "coins", value: 1500, weight: 20 }, { type: "xp", value: 3000, weight: 20 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 30 }, { type: "xp_boost", value: 4, weight: 18 }, { type: "battle_pass_tiers", value: 3, weight: 12 }] },
      { id: "lb-e-4", name: "Phoenix Crate", description: "Rise from the ashes", rarity: "epic", coinCost: 1300, sessionsRequired: 0, icon: "🔥", glowColor: "#DC2626", possibleRewards: [{ type: "coins", value: 1100, weight: 23 }, { type: "xp", value: 2200, weight: 23 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 27 }, { type: "xp_boost", value: 3, weight: 17 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-e-5", name: "Arcane Chest", description: "Magical academic rewards", rarity: "epic", coinCost: 1350, sessionsRequired: 0, icon: "🔮", glowColor: "#9333EA", possibleRewards: [{ type: "coins", value: 1150, weight: 22 }, { type: "xp", value: 2300, weight: 22 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 28 }, { type: "xp_boost", value: 3, weight: 18 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-e-6", name: "Thunder Box", description: "Power of the storm", rarity: "epic", coinCost: 1250, sessionsRequired: 0, icon: "⚡", glowColor: "#B45309", possibleRewards: [{ type: "coins", value: 1050, weight: 25 }, { type: "xp", value: 2100, weight: 25 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 }, { type: "xp_boost", value: 3, weight: 15 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-e-7", name: "Void Fragment", description: "From beyond the veil", rarity: "epic", coinCost: 1500, sessionsRequired: 0, icon: "🌑", glowColor: "#1E1B4B", possibleRewards: [{ type: "coins", value: 1300, weight: 20 }, { type: "xp", value: 2600, weight: 20 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 30 }, { type: "xp_boost", value: 4, weight: 20 }, { type: "battle_pass_tiers", value: 3, weight: 10 }] },
      { id: "lb-e-8", name: "Celestial Box", description: "Rewards from the heavens", rarity: "epic", coinCost: 1450, sessionsRequired: 0, icon: "✨", glowColor: "#7C3AED", possibleRewards: [{ type: "coins", value: 1250, weight: 22 }, { type: "xp", value: 2500, weight: 22 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 28 }, { type: "xp_boost", value: 4, weight: 18 }, { type: "battle_pass_tiers", value: 3, weight: 10 }] },
      { id: "lb-e-9", name: "Titan Chest", description: "Titan-strength rewards", rarity: "epic", coinCost: 1380, sessionsRequired: 0, icon: "🗿", glowColor: "#374151", possibleRewards: [{ type: "coins", value: 1180, weight: 23 }, { type: "xp", value: 2350, weight: 23 }, { type: "marketplace_item", value: "epic", rarity: "epic", weight: 27 }, { type: "xp_boost", value: 3, weight: 17 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      { id: "lb-e-10", name: "Scholar's Sanctum", description: "Sacred scholar rewards", rarity: "epic", coinCost: 1280, sessionsRequired: 0, icon: "🏛️", glowColor: "#D97706", possibleRewards: [{ type: "coins", value: 1080, weight: 24 }, { type: "xp", value: 2160, weight: 24 }, { type: "marketplace_item", value: "rare", rarity: "rare", weight: 26 }, { type: "xp_boost", value: 3, weight: 16 }, { type: "battle_pass_tiers", value: 2, weight: 10 }] },
      // LEGENDARY (10)
      { id: "lb-l-1", name: "Legendary Scholar Box", description: "For the most dedicated scholars", rarity: "legendary", coinCost: 5000, sessionsRequired: 0, icon: "👑", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 4000, weight: 20 }, { type: "xp", value: 8000, weight: 20 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 25 }, { type: "xp_boost", value: 7, weight: 20 }, { type: "battle_pass_tiers", value: 7, weight: 15 }] },
      { id: "lb-l-2", name: "Golden Phoenix Box", description: "Born from golden flames", rarity: "legendary", coinCost: 6000, sessionsRequired: 0, icon: "🦅", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 5000, weight: 18 }, { type: "xp", value: 10000, weight: 18 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 30 }, { type: "xp_boost", value: 10, weight: 20 }, { type: "battle_pass_tiers", value: 10, weight: 14 }] },
      { id: "lb-l-3", name: "Cosmic Chest", description: "Forged in cosmic fire", rarity: "legendary", coinCost: 0, sessionsRequired: 50, icon: "🌌", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 6000, weight: 16 }, { type: "xp", value: 12000, weight: 16 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 32 }, { type: "xp_boost", value: 10, weight: 20 }, { type: "battle_pass_tiers", value: 10, weight: 16 }] },
      { id: "lb-l-4", name: "Sol Box", description: "Power of the sun", rarity: "legendary", coinCost: 5500, sessionsRequired: 0, icon: "☀️", glowColor: "#FCD34D", possibleRewards: [{ type: "coins", value: 4500, weight: 20 }, { type: "xp", value: 9000, weight: 20 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 28 }, { type: "xp_boost", value: 8, weight: 18 }, { type: "battle_pass_tiers", value: 8, weight: 14 }] },
      { id: "lb-l-5", name: "Eternity Vault", description: "Open the vault of eternity", rarity: "legendary", coinCost: 7000, sessionsRequired: 0, icon: "🔐", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 6000, weight: 16 }, { type: "xp", value: 12000, weight: 16 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 32 }, { type: "xp_boost", value: 12, weight: 20 }, { type: "battle_pass_tiers", value: 12, weight: 16 }] },
      { id: "lb-l-6", name: "Nebula Box", description: "Star nursery of rewards", rarity: "legendary", coinCost: 5200, sessionsRequired: 0, icon: "🌠", glowColor: "#A855F7", possibleRewards: [{ type: "coins", value: 4300, weight: 20 }, { type: "xp", value: 8600, weight: 20 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 26 }, { type: "xp_boost", value: 8, weight: 20 }, { type: "battle_pass_tiers", value: 7, weight: 14 }] },
      { id: "lb-l-7", name: "Dragon Hoard", description: "A dragon's collected wisdom", rarity: "legendary", coinCost: 6500, sessionsRequired: 0, icon: "🐲", glowColor: "#DC2626", possibleRewards: [{ type: "coins", value: 5500, weight: 18 }, { type: "xp", value: 11000, weight: 18 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 30 }, { type: "xp_boost", value: 10, weight: 20 }, { type: "battle_pass_tiers", value: 9, weight: 14 }] },
      { id: "lb-l-8", name: "Omega Chest", description: "The final form of reward", rarity: "legendary", coinCost: 8000, sessionsRequired: 0, icon: "⚜️", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 7000, weight: 15 }, { type: "xp", value: 14000, weight: 15 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 35 }, { type: "xp_boost", value: 15, weight: 22 }, { type: "battle_pass_tiers", value: 13, weight: 13 }] },
      { id: "lb-l-9", name: "Starfall Box", description: "Rewards from falling stars", rarity: "legendary", coinCost: 5800, sessionsRequired: 0, icon: "⭐", glowColor: "#FCD34D", possibleRewards: [{ type: "coins", value: 4800, weight: 19 }, { type: "xp", value: 9600, weight: 19 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 28 }, { type: "xp_boost", value: 9, weight: 19 }, { type: "battle_pass_tiers", value: 8, weight: 15 }] },
      { id: "lb-l-10", name: "Mythbreaker Box", description: "Break the limits of legend", rarity: "legendary", coinCost: 9000, sessionsRequired: 0, icon: "🔱", glowColor: "#F59E0B", possibleRewards: [{ type: "coins", value: 8000, weight: 14 }, { type: "xp", value: 16000, weight: 14 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 36 }, { type: "xp_boost", value: 15, weight: 22 }, { type: "battle_pass_tiers", value: 14, weight: 14 }] },
      // MYTHIC (5)
      { id: "lb-m-1", name: "Mythic Void Box", description: "From beyond reality", rarity: "mythic", coinCost: 15000, sessionsRequired: 0, icon: "⚫", glowColor: "#EC4899", possibleRewards: [{ type: "coins", value: 12000, weight: 15 }, { type: "xp", value: 24000, weight: 15 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 30 }, { type: "xp_boost", value: 20, weight: 20 }, { type: "battle_pass_tiers", value: 15, weight: 20 }] },
      { id: "lb-m-2", name: "Primordial Chest", description: "From the dawn of time", rarity: "mythic", coinCost: 20000, sessionsRequired: 0, icon: "🌋", glowColor: "#B91C1C", possibleRewards: [{ type: "coins", value: 18000, weight: 13 }, { type: "xp", value: 36000, weight: 13 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 34 }, { type: "xp_boost", value: 25, weight: 22 }, { type: "battle_pass_tiers", value: 20, weight: 18 }] },
      { id: "lb-m-3", name: "God Box", description: "Touched by the divine", rarity: "mythic", coinCost: 25000, sessionsRequired: 0, icon: "👁️", glowColor: "#7C3AED", possibleRewards: [{ type: "coins", value: 22000, weight: 12 }, { type: "xp", value: 44000, weight: 12 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 36 }, { type: "xp_boost", value: 30, weight: 22 }, { type: "battle_pass_tiers", value: 25, weight: 18 }] },
      { id: "lb-m-4", name: "Singularity Box", description: "Contains a universe of rewards", rarity: "mythic", coinCost: 0, sessionsRequired: 100, icon: "🕳️", glowColor: "#1E1B4B", possibleRewards: [{ type: "coins", value: 25000, weight: 12 }, { type: "xp", value: 50000, weight: 12 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 36 }, { type: "xp_boost", value: 30, weight: 22 }, { type: "battle_pass_tiers", value: 25, weight: 18 }] },
      { id: "lb-m-5", name: "Infinity Chest", description: "Infinite potential within", rarity: "mythic", coinCost: 50000, sessionsRequired: 0, icon: "♾️", glowColor: "#EC4899", possibleRewards: [{ type: "coins", value: 40000, weight: 10 }, { type: "xp", value: 80000, weight: 10 }, { type: "marketplace_item", value: "legendary", rarity: "legendary", weight: 40 }, { type: "xp_boost", value: 50, weight: 22 }, { type: "battle_pass_tiers", value: 40, weight: 18 }] },
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

router.post("/admin/cms/seed/quests", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const SEED_QUESTS = [
      // DAILY QUESTS
      { id: "q-daily-focus-30", title: "Quick Focus", description: "Complete 30 minutes of focused study", type: "daily", difficulty: "easy", target: 30, metric: "focus_minutes", xpReward: 150, coinReward: 50, icon: "⏱️", rotationWeight: 20 },
      { id: "q-daily-focus-60", title: "Hour of Power", description: "Complete 60 minutes of focused study", type: "daily", difficulty: "medium", target: 60, metric: "focus_minutes", xpReward: 300, coinReward: 100, icon: "🔥", rotationWeight: 18 },
      { id: "q-daily-focus-90", title: "Deep Work Block", description: "Complete 90 minutes of focused study", type: "daily", difficulty: "hard", target: 90, metric: "focus_minutes", xpReward: 500, coinReward: 175, icon: "⚡", rotationWeight: 15 },
      { id: "q-daily-sessions-1", title: "First Session", description: "Complete 1 focus session today", type: "daily", difficulty: "easy", target: 1, metric: "session_count", xpReward: 100, coinReward: 40, icon: "🎯", rotationWeight: 20 },
      { id: "q-daily-sessions-2", title: "Double Session", description: "Complete 2 focus sessions today", type: "daily", difficulty: "medium", target: 2, metric: "session_count", xpReward: 250, coinReward: 80, icon: "🌟", rotationWeight: 17 },
      { id: "q-daily-sessions-3", title: "Triple Threat", description: "Complete 3 focus sessions today", type: "daily", difficulty: "hard", target: 3, metric: "session_count", xpReward: 400, coinReward: 130, icon: "🏆", rotationWeight: 14 },
      { id: "q-daily-tasks-3", title: "Task Trio", description: "Complete 3 tasks today", type: "daily", difficulty: "easy", target: 3, metric: "tasks_completed", xpReward: 200, coinReward: 70, icon: "✅", rotationWeight: 18 },
      { id: "q-daily-tasks-5", title: "Task Master", description: "Complete 5 tasks today", type: "daily", difficulty: "medium", target: 5, metric: "tasks_completed", xpReward: 350, coinReward: 110, icon: "📝", rotationWeight: 15 },
      { id: "q-daily-streak-keep", title: "Keep the Streak", description: "Maintain your study streak for 1 more day", type: "daily", difficulty: "easy", target: 1, metric: "streak_days", xpReward: 200, coinReward: 75, icon: "🔥", rotationWeight: 20 },
      { id: "q-daily-xp-500", title: "XP Rush", description: "Earn 500 XP today", type: "daily", difficulty: "medium", target: 500, metric: "xp_earned", xpReward: 300, coinReward: 100, icon: "⭐", rotationWeight: 16 },
      // WEEKLY QUESTS
      { id: "q-weekly-focus-300", title: "5-Hour Focus Week", description: "Accumulate 300 minutes of focus this week", type: "weekly", difficulty: "medium", target: 300, metric: "focus_minutes", xpReward: 1000, coinReward: 350, icon: "📅", rotationWeight: 15 },
      { id: "q-weekly-focus-600", title: "10-Hour Elite", description: "Accumulate 600 minutes of focus this week", type: "weekly", difficulty: "hard", target: 600, metric: "focus_minutes", xpReward: 2000, coinReward: 700, icon: "🏅", rotationWeight: 12 },
      { id: "q-weekly-sessions-10", title: "10-Session Champion", description: "Complete 10 focus sessions this week", type: "weekly", difficulty: "medium", target: 10, metric: "session_count", xpReward: 1200, coinReward: 400, icon: "🎯", rotationWeight: 15 },
      { id: "q-weekly-sessions-20", title: "20-Session Legend", description: "Complete 20 focus sessions this week", type: "weekly", difficulty: "hard", target: 20, metric: "session_count", xpReward: 2500, coinReward: 850, icon: "👑", rotationWeight: 10 },
      { id: "q-weekly-streak-5", title: "5-Day Streak Week", description: "Maintain a 5-day study streak this week", type: "weekly", difficulty: "hard", target: 5, metric: "streak_days", xpReward: 1500, coinReward: 500, icon: "🔥", rotationWeight: 13 },
    ];

    let seeded = 0;
    for (const q of SEED_QUESTS) {
      const existing = await db.select().from(questDefinitionsTable).where(eq(questDefinitionsTable.id, q.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(questDefinitionsTable).values({ ...q, isActive: true }).catch(() => {});
        seeded++;
      }
    }
    res.json({ ok: true, seeded, total: SEED_QUESTS.length });
  } catch (err) {
    logger.error({ err }, "seed quests error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminCmsRouter };
