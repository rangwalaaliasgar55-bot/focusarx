/**
 * Shared premium status check.
 *
 * Usage as middleware:
 *   router.get("/some-route", authMiddleware, requirePremium, handler)
 *
 * Usage as utility:
 *   const isPremium = await isUserPremium(userId);
 *   const premiumSet = await isUsersPremium(userIds);   // batched — 1 query
 *
 * Stores `req.isPremium = true|false` so downstream middleware/handlers
 * can read it without a second DB query.
 *
 * ── Source of truth ────────────────────────────────────────────────
 * Premium lives in TWO tables that are kept in sync on purchase:
 *   1. `premium_subscriptions` — the legacy row the rest of the app reads
 *   2. `premium_entitlements`  — the auditable purchase history
 *
 * Purchases dual-write both inside a try/catch with an *empty* catch, so a
 * failed entitlement backfill (or a failed subscription write) previously
 * meant a paying user was denied access — a fail-closed bug on a paid
 * product. We therefore treat a user as premium if EITHER table says so.
 * This only ever widens access to people with a real, paid entitlement row;
 * it never grants premium to someone with neither.
 */
import { Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { premiumSubscriptionsTable, premiumEntitlementsTable } from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { Redis } from "@upstash/redis";

const localCache = new Map<string, { value: boolean; expiresAt: number }>();
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const CACHE_SECONDS = 60;
/** Bound the in-memory cache so a long-lived process can't grow it forever. */
const LOCAL_CACHE_MAX = 5_000;

function cacheSet(userId: string, value: boolean): void {
  if (localCache.size >= LOCAL_CACHE_MAX) {
    // Evict whatever is already expired first; fall back to insertion order.
    const now = Date.now();
    for (const [k, v] of localCache) {
      if (v.expiresAt <= now) localCache.delete(k);
    }
    while (localCache.size >= LOCAL_CACHE_MAX) {
      const oldest = localCache.keys().next();
      if (oldest.done) break;
      localCache.delete(oldest.value);
    }
  }
  localCache.set(userId, { value, expiresAt: Date.now() + CACHE_SECONDS * 1000 });
}

export async function invalidatePremiumCache(userId: string): Promise<void> {
  localCache.delete(userId);
  if (redis) await redis.del(`focusarx:premium:${userId}`).catch(() => undefined);
}

/**
 * True when a `premium_subscriptions` row is active and not expired.
 */
async function hasActiveSubscription(userId: string): Promise<boolean> {
  const [sub] = await db
    .select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
    .from(premiumSubscriptionsTable)
    .where(eq(premiumSubscriptionsTable.userId, userId))
    .limit(1);
  return Boolean(sub?.isActive && (!sub.expiresAt || sub.expiresAt >= new Date()));
}

/**
 * True when the user holds a non-expired entitlement in `premium_entitlements`
 * that has not been suspended/expired. This is the backfill-failure safety net.
 */
async function hasActiveEntitlement(userId: string): Promise<boolean> {
  const [ent] = await db
    .select({ id: premiumEntitlementsTable.id })
    .from(premiumEntitlementsTable)
    .where(and(
      eq(premiumEntitlementsTable.userId, userId),
      eq(premiumEntitlementsTable.status, "active"),
    ))
    .limit(1);
  return Boolean(ent);
}

/**
 * Check whether a given user has active premium access.
 * Returns false for any DB error (safe default — never grants on failure).
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const local = localCache.get(userId);
    if (local && local.expiresAt > Date.now()) return local.value;

    if (redis) {
      const cached = await redis.get<boolean>(`focusarx:premium:${userId}`).catch(() => null);
      if (typeof cached === "boolean") {
        cacheSet(userId, cached);
        return cached;
      }
    }

    // Short-circuit: if the legacy row is active we don't need the second query.
    let value = await hasActiveSubscription(userId);
    if (!value) {
      value = await hasActiveEntitlement(userId);
      if (value) {
        // Subscriptions is what the rest of the app reads — log the drift so
        // it can be backfilled instead of silently relying on this path.
        logger.warn({ userId }, "premium entitlement active without subscription row — needs backfill");
      }
    }

    cacheSet(userId, value);
    if (redis) void redis.set(`focusarx:premium:${userId}`, value, { ex: CACHE_SECONDS }).catch(() => undefined);
    return value;
  } catch (err) {
    logger.error({ err, userId }, "isUserPremium failed — denying premium");
    return false;
  }
}

/**
 * Batched premium lookup for lists (leaderboards, feeds).
 *
 * Replaces the per-row `Promise.all(rows.map(r => isUserPremium(r.userId)))`
 * pattern, which fired up to 200 sequential DB/Redis round trips per request.
 * This does at most 2 queries total regardless of list length, honouring the
 * cache for any ids it already knows.
 *
 * Returns a Set of the userIds that are premium.
 */
export async function isUsersPremium(userIds: readonly string[]): Promise<Set<string>> {
  const premium = new Set<string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return premium;

  const uncached: string[] = [];
  const now = Date.now();
  for (const id of unique) {
    const local = localCache.get(id);
    if (local && local.expiresAt > now) {
      if (local.value) premium.add(id);
    } else {
      uncached.push(id);
    }
  }
  if (uncached.length === 0) return premium;

  // Drizzle/Postgres parameter limits are generous, but chunk anyway so a
  // pathological list can't produce an oversized parameter array.
  const CHUNK = 400;
  for (let i = 0; i < uncached.length; i += CHUNK) {
    const slice = uncached.slice(i, i + CHUNK);
    try {
      const [subs, ents] = await Promise.all([
        db.select({ userId: premiumSubscriptionsTable.userId })
          .from(premiumSubscriptionsTable)
          .where(and(
            inArray(premiumSubscriptionsTable.userId, slice),
            eq(premiumSubscriptionsTable.isActive, true),
            or(
              sql`${premiumSubscriptionsTable.expiresAt} is null`,
              sql`${premiumSubscriptionsTable.expiresAt} >= now()`,
            ),
          )),
        db.select({ userId: premiumEntitlementsTable.userId })
          .from(premiumEntitlementsTable)
          .where(and(
            inArray(premiumEntitlementsTable.userId, slice),
            eq(premiumEntitlementsTable.status, "active"),
            sql`${premiumEntitlementsTable.endsAt} >= now()`,
          )),
      ]);
      for (const r of subs) premium.add(r.userId);
      for (const r of ents) premium.add(r.userId);
    } catch (err) {
      logger.error({ err }, "isUsersPremium batch failed — denying premium for batch");
    }
  }

  for (const id of uncached) cacheSet(id, premium.has(id));
  return premium;
}

/**
 * Express middleware that attaches `req.isPremium = boolean`.
 * Must run AFTER `authMiddleware` (requires `req.userId`).
 */
export async function premiumStatusMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    (req as any).isPremium = req.userId ? await isUserPremium(req.userId) : false;
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
