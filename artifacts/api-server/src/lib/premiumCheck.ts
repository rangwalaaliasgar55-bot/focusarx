/**
 * Shared premium status check.
 *
 * Usage as middleware:
 *   router.get("/some-route", authMiddleware, requirePremium, handler)
 *
 * Usage as utility:
 *   const isPremium = await isUserPremium(userId);
 *
 * Stores `req.isPremium = true|false` so downstream middleware/handlers
 * can read it without a second DB query.
 */
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { premiumSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

/**
 * Check whether a given user has an active, non-expired premium subscription.
 * Returns false for any DB error (safe default).
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const [sub] = await db
      .select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
      .from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, userId))
      .limit(1);

    if (!sub?.isActive) return false;
    if (sub.expiresAt && sub.expiresAt < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Express middleware that attaches `req.isPremium = boolean`.
 * Must run AFTER `authMiddleware` (requires `req.userId`).
 */
export async function premiumStatusMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.userId) {
      (req as any).isPremium = await isUserPremium(req.userId);
    } else {
      (req as any).isPremium = false;
    }
  } catch {
    (req as any).isPremium = false;
  }
  next();
}

/**
 * Express middleware that returns 403 if user is not premium.
 * Must run AFTER `authMiddleware` and preferably after `premiumStatusMiddleware`
 * (to avoid a duplicate DB query).
 */
export async function requirePremium(req: AuthRequest, res: Response, next: NextFunction) {
  if ((req as any).isPremium) {
    next();
    return;
  }
  // If premiumStatusMiddleware hasn't run yet, check directly
  if (req.userId) {
    const premium = await isUserPremium(req.userId);
    if (premium) {
      (req as any).isPremium = true;
      next();
      return;
    }
  }
  res.status(403).json({ error: "This feature requires Premium" });
}
