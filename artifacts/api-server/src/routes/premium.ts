import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, Response } from "express";
import { db } from "@workspace/db";
import {
  premiumSubscriptionsTable,
  userWalletsTable,
  notificationsTable,
  battlePassProgressTable,
  tokenLedgerTable,
  premiumEntitlementsTable,
} from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { invalidatePremiumCache } from "../lib/premiumCheck";
import { getActivePlans, getPlanById, purchasePremiumWithTokens, getEntitlementHistory, hasActivePremium, seedPremiumPlans } from "../lib/premiumPlans";
import { getTokenBalance } from "../lib/tokenLedger";
import { z } from "zod";

const router = Router();

const PREMIUM_BENEFITS = [
  "ai_coach",
  "premium_timer_rituals",
  "advanced_analytics",
  "premium_focus_city",
  "premium_profile",
  "premium_convenience",
  "exclusive_pets",
  "premium_battle_pass",
  "premium_analytics",
  "profile_badge",
  "exclusive_seasonal_events",
];

// Seed plans on startup (best effort)
void seedPremiumPlans().catch(() => {});

// GET /api/premium/plans — public list of token-based plans
router.get("/premium/plans", async (_req, res: Response) => {
  try {
    const plans = await getActivePlans();
    res.json({ plans });
  } catch (err) {
    logger.error({ err }, "premium plans error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/premium/status — includes balance, plans, entitlement
router.get("/premium/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [activeCheck, plans, balance, entitlements] = await Promise.all([
      hasActivePremium(userId),
      getActivePlans(),
      getTokenBalance(userId),
      getEntitlementHistory(userId),
    ]);

    // Also check old table for backward compat
    const [oldSub] = await db.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, userId)).limit(1);

    let isPremium = activeCheck.active;
    let expiresAt = activeCheck.expiresAt ?? oldSub?.expiresAt ?? null;
    let activatedAt = activeCheck.entitlement?.startsAt ?? oldSub?.activatedAt ?? null;
    let benefits = (activeCheck.entitlement?.benefits as string[]) ?? oldSub?.benefits ?? PREMIUM_BENEFITS;

    // Expire check
    if (expiresAt && new Date(expiresAt) < new Date()) {
      isPremium = false;
      // Mark expired in DB (best effort)
      try {
        await db.update(premiumSubscriptionsTable).set({ isActive: false }).where(eq(premiumSubscriptionsTable.userId, userId));
        await db.update(battlePassProgressTable).set({ premiumUnlocked: false, updatedAt: new Date() }).where(eq(battlePassProgressTable.userId, userId));
      } catch {}
    }

    // Determine expiring soon (within 3 days)
    let status: "active" | "expiring_soon" | "expired" | "inactive" = "inactive";
    if (isPremium && expiresAt) {
      const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 3 && daysLeft > 0) status = "expiring_soon";
      else if (daysLeft > 0) status = "active";
      else status = "expired";
    } else if (isPremium) {
      status = "active";
    }

    res.json({
      isPremium,
      status,
      activatedAt,
      expiresAt,
      benefits,
      plans,
      balance,
      entitlements: entitlements.slice(0, 10),
      // For legacy clients
      cost: plans[0]?.tokenCost ?? 10000,
    });
  } catch (err) {
    logger.error({ err }, "premium status error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/premium/purchase — token-based purchase with idempotency
const purchaseSchema = z.object({
  planId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

router.post("/premium/purchase", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    return;
  }

  const { planId, idempotencyKey } = parsed.data;
  const key = idempotencyKey ?? `premium_${req.userId}_${planId}_${Date.now()}`;

  try {
    const result = await purchasePremiumWithTokens(req.userId!, planId, key);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Notification
    try {
      await db.insert(notificationsTable).values({
        userId: req.userId!,
        type: "premium",
        title: "Welcome to Premium! 👑",
        message: `You now have Premium access until ${new Date(result.entitlement.endsAt).toLocaleDateString()}. Enjoy exclusive features!`,
      });
    } catch {}

    // Unlock battle pass premium track
    try {
      const [bp] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, req.userId!)).limit(1);
      if (bp) {
        await db.update(battlePassProgressTable).set({ premiumUnlocked: true, updatedAt: new Date() }).where(eq(battlePassProgressTable.userId, req.userId!));
      } else {
        await db.insert(battlePassProgressTable).values({
          userId: req.userId!,
          season: 1,
          seasonXp: 0,
          tier: 0,
          premiumUnlocked: true,
          claimedTiers: [],
        });
      }
    } catch (err) {
      logger.warn({ err }, "battle pass premium unlock failed");
    }

    res.json({
      ok: true,
      entitlement: result.entitlement,
      newBalance: result.newBalance,
      expiresAt: result.entitlement.endsAt,
    });
  } catch (err) {
    logger.error({ err }, "premium purchase error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Legacy endpoint — POST /api/premium/activate (for backward compat)
router.post("/premium/activate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const plans = await getActivePlans();
    const cheapest = (plans as any[]).sort((a: any, b: any) => a.tokenCost - b.tokenCost)[0];
    if (!cheapest) {
      res.status(500).json({ error: "No premium plans configured" });
      return;
    }

    const key = `legacy_${req.userId}_${Date.now()}`;
    const result = await purchasePremiumWithTokens(req.userId!, cheapest.id, key);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ ok: true, newBalance: result.newBalance, expiresAt: result.entitlement.endsAt, benefits: cheapest.benefits ?? PREMIUM_BENEFITS });
  } catch (err) {
    logger.error({ err }, "premium activate error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/premium/history — purchase history
router.get("/premium/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const history = await getEntitlementHistory(req.userId!);
    res.json({ history });
  } catch (err) {
    logger.error({ err }, "premium history error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/premium/ledger — token ledger for current user
router.get("/premium/ledger", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [entries, countRows] = await Promise.all([
      db.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.userId, req.userId!)).orderBy(desc(tokenLedgerTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.userId, req.userId!)),
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "ledger error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/premium/benefits — list benefits
router.get("/premium/benefits", async (_req, res) => {
  res.json({
    benefits: [
      { id: "ai_coach", name: "AI Focus Coach", description: "Personalized focus plans, session analysis, productivity guidance", icon: "🧠", free: false },
      { id: "premium_timer_rituals", name: "Premium Timer Rituals", description: "Unlimited custom presets, 10-180min sessions, full-screen focus, ambient mixing", icon: "⏱️", free: false },
      { id: "advanced_analytics", name: "Advanced Analytics", description: "Full history, best hours, streak consistency, export", icon: "📊", free: false },
      { id: "premium_focus_city", name: "Premium Focus City", description: "Night/sunset modes, weather, seasonal decorations, premium buildings", icon: "🏙️", free: false },
      { id: "premium_profile", name: "Premium Profile", description: "Avatar frames, animated nameplates, backgrounds, aura effects", icon: "👑", free: false },
      { id: "premium_convenience", name: "Premium Convenience", description: "More pets, presets, private rooms, quests, recovery tokens", icon: "⚡", free: false },
      { id: "exclusive_pets", name: "Exclusive Pets", description: "Rare and legendary companions", icon: "🐾", free: false },
      { id: "premium_battle_pass", name: "Premium Battle Pass", description: "Unlock premium reward track", icon: "🎟️", free: false },
    ],
    freeTier: [
      { id: "core_timer", name: "Core Focus Timer", description: "Standard presets, basic sessions" },
      { id: "tasks", name: "Task Management", description: "Basic task list" },
      { id: "streaks", name: "Streaks", description: "Basic streak tracking" },
      { id: "pet", name: "One Active Pet", description: "Starter pet companion" },
      { id: "city", name: "Starter City", description: "Basic Focus City" },
      { id: "quests", name: "Daily Quests", description: "Free daily quests" },
      { id: "battle_pass_free", name: "Free Battle Pass", description: "Free reward track" },
      { id: "study_rooms", name: "Public Study Rooms", description: "Join public rooms" },
      { id: "achievements", name: "Basic Achievements", description: "Core badges" },
      { id: "history", name: "Basic History", description: "Recent sessions" },
    ],
  });
});

export { router as premiumRouter };
