import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  premiumSubscriptionsTable,
  userWalletsTable,
  usersTable,
  notificationsTable,
  coinTransactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

const PREMIUM_COST = 9000;
const PREMIUM_BENEFITS = [
  "exclusive_pets",
  "premium_loot_boxes",
  "premium_themes",
  "premium_emotes",
  "premium_marketplace_items",
  "xp_multiplier",
  "coin_multiplier",
  "premium_focus_cities",
  "premium_battle_pass",
  "premium_analytics",
  "profile_badge",
  "exclusive_seasonal_events",
];

  req.userId = userId;
  next();
}

router.get("/premium/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [sub] = await db.select().from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, req.userId)).limit(1);

    if (!sub || !sub.isActive) {
      res.json({ isPremium: false, cost: PREMIUM_COST, benefits: PREMIUM_BENEFITS });
      return;
    }

    const expired = sub.expiresAt && sub.expiresAt < new Date();
    if (expired) {
      await db.update(premiumSubscriptionsTable)
        .set({ isActive: false })
        .where(eq(premiumSubscriptionsTable.userId, req.userId));
      res.json({ isPremium: false, cost: PREMIUM_COST, benefits: PREMIUM_BENEFITS });
      return;
    }

    res.json({
      isPremium: true,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      benefits: sub.benefits ?? PREMIUM_BENEFITS,
      cost: PREMIUM_COST,
    });
  } catch (err) {
    logger.error({ err }, "premium status error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/premium/activate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, req.userId)).limit(1);

    if (existing?.isActive) {
      res.status(400).json({ error: "Already premium" });
      return;
    }

    const [wallet] = await db.select().from(userWalletsTable)
      .where(eq(userWalletsTable.userId, req.userId)).limit(1);

    if (!wallet || wallet.coins < PREMIUM_COST) {
      res.status(400).json({ error: `Need ${PREMIUM_COST} coins to activate Premium` });
      return;
    }

    const newBalance = wallet.coins - PREMIUM_COST;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.update(userWalletsTable)
      .set({ coins: newBalance, updatedAt: new Date() })
      .where(eq(userWalletsTable.userId, req.userId));

    await db.insert(coinTransactionsTable).values({
      userId: req.userId,
      type: "spend",
      amount: -PREMIUM_COST,
      reason: "premium_activation",
      description: "Premium subscription activated (30 days)",
      balanceAfter: newBalance,
    }).catch(() => {});

    if (existing) {
      await db.update(premiumSubscriptionsTable)
        .set({ isActive: true, activatedAt: new Date(), expiresAt, benefits: PREMIUM_BENEFITS })
        .where(eq(premiumSubscriptionsTable.userId, req.userId));
    } else {
      await db.insert(premiumSubscriptionsTable).values({
        userId: req.userId,
        expiresAt,
        coinsCost: PREMIUM_COST,
        benefits: PREMIUM_BENEFITS,
        isActive: true,
      });
    }

    await db.insert(notificationsTable).values({
      userId: req.userId,
      type: "premium",
      title: "Welcome to Premium! 👑",
      message: "You now have access to all premium features. Enjoy exclusive pets, boosters, and more!",
    }).catch(() => {});

    res.json({ ok: true, newBalance, expiresAt, benefits: PREMIUM_BENEFITS });
  } catch (err) {
    logger.error({ err }, "premium activate error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as premiumRouter };
