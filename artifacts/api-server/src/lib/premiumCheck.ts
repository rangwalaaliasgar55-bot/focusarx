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
import { Redis } from "@upstash/redis";

const localCache = new Map<string, { value: boolean; expiresAt: number }>();
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const CACHE_SECONDS = 60;

export async function invalidatePremiumCache(userId: string): Promise<void> {
  localCache.delete(userId);
  if (redis) await redis.del(`focusarx:premium:${userId}`).catch(() => undefined);
}

/**
 * Check whether a given user has an active, non-expired premium subscription.
 * Returns false for any DB error (safe default).
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const local = localCache.get(userId);
    if (local && local.expiresAt > Date.now()) return local.value;
    if (redis) {
      const cached = await redis.get<boolean>(`focusarx:premium:${userId}`).catch(() => null);
      if (typeof cached === "boolean") {
        localCache.set(userId, { value: cached, expiresAt: Date.now() + CACHE_SECONDS * 1000 });
        return cached;
      }
    }
    const [sub] = await db
      .select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
      .from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, userId))
      .limit(1);

    const value = Boolean(sub?.isActive && (!sub.expiresAt || sub.expiresAt >= new Date()));
    localCache.set(userId, { value, expiresAt: Date.now() + CACHE_SECONDS * 1000 });
    if (redis) void redis.set(`focusarx:premium:${userId}`, value, { ex: CACHE_SECONDS }).catch(() => undefined);
    return value;
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
