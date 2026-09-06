/**
 * Premium plans and entitlements — token-based membership
 * No real-money payments, only Focus Tokens
 */

import { db } from "@workspace/db";
import {
  premiumPlansTable,
  premiumEntitlementsTable,
  premiumSubscriptionsTable,
} from "@workspace/db";
import { and, eq, desc, gte, lt } from "drizzle-orm";
import { logger } from "./logger";
import { spendTokens } from "./tokenLedger";
import { invalidatePremiumCache } from "./premiumCheck";
import { userWalletsTable } from "@workspace/db";

export interface PremiumPlanConfig {
  id?: string;
  name: string;
  slug: string;
  description: string;
  durationDays: number;
  tokenCost: number;
  benefits: string[];
  isActive?: boolean;
  sortOrder?: number;
}

// Default plans — balanced after inspecting XP values (20 XP/min, 10 coins/5min)
// 30 days = 10k tokens (~200 sessions), 90 days = 25k (~500 sessions), 365 days = 80k (~1600 sessions)
const DEFAULT_PLANS: PremiumPlanConfig[] = [
  {
    slug: "premium_30",
    name: "30-Day Premium",
    description: "Unlock all premium features for 30 days using Focus Tokens",
    durationDays: 30,
    tokenCost: 10000,
    benefits: [
      "ai_coach",
      "premium_timer_rituals",
      "advanced_analytics",
      "premium_focus_city",
      "premium_profile",
      "premium_convenience",
      "exclusive_pets",
      "premium_battle_pass",
    ],
    sortOrder: 1,
  },
  {
    slug: "premium_90",
    name: "90-Day Premium",
    description: "Best value — 90 days of premium, save 17%",
    durationDays: 90,
    tokenCost: 25000,
    benefits: [
      "ai_coach",
      "premium_timer_rituals",
      "advanced_analytics",
      "premium_focus_city",
      "premium_profile",
      "premium_convenience",
      "exclusive_pets",
      "premium_battle_pass",
      "bonus_cosmetic",
    ],
    sortOrder: 2,
  },
  {
    slug: "premium_365",
    name: "365-Day Premium",
    description: "Year of focus mastery — save 33%",
    durationDays: 365,
    tokenCost: 80000,
    benefits: [
      "ai_coach",
      "premium_timer_rituals",
      "advanced_analytics",
      "premium_focus_city",
      "premium_profile",
      "premium_convenience",
      "exclusive_pets",
      "premium_battle_pass",
      "bonus_cosmetic",
      "founder_badge",
      "early_access",
    ],
    sortOrder: 3,
  },
];

/**
 * Seed default plans if not exist
 */
export async function seedPremiumPlans(): Promise<void> {
  try {
    const existing = await db.select({ slug: premiumPlansTable.slug }).from(premiumPlansTable);
    const existingSlugs = new Set(existing.map((p) => p.slug));
    for (const plan of DEFAULT_PLANS) {
      if (!existingSlugs.has(plan.slug)) {
        await db.insert(premiumPlansTable).values({
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          durationDays: plan.durationDays,
          tokenCost: plan.tokenCost,
          benefits: plan.benefits,
          isActive: true,
          sortOrder: plan.sortOrder,
        });
        logger.info({ slug: plan.slug }, "seeded premium plan");
      }
    }
  } catch (err) {
    logger.warn({ err }, "failed to seed premium plans");
  }
}

/**
 * Get all active plans
 */
export async function getActivePlans() {
  try {
    const plans = await db
      .select()
      .from(premiumPlansTable)
      .where(eq(premiumPlansTable.isActive, true))
      .orderBy(premiumPlansTable.sortOrder);
    return plans;
  } catch {
    // Fallback to defaults if table not yet migrated
    return DEFAULT_PLANS.map((p, i) => ({
      id: `fallback_${p.slug}`,
      name: p.name,
      slug: p.slug,
      description: p.description,
      durationDays: p.durationDays,
      tokenCost: p.tokenCost,
      benefits: p.benefits,
      isActive: true,
      sortOrder: p.sortOrder ?? i,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;
  }
}

/**
 * Get plan by ID or slug
 */
export async function getPlanById(idOrSlug: string) {
  try {
    const [byId] = await db
      .select()
      .from(premiumPlansTable)
      .where(eq(premiumPlansTable.id, idOrSlug))
      .limit(1);
    if (byId) return byId;
    const [bySlug] = await db
      .select()
      .from(premiumPlansTable)
      .where(eq(premiumPlansTable.slug, idOrSlug))
      .limit(1);
    return bySlug ?? null;
  } catch {
    const fallback = DEFAULT_PLANS.find((p) => p.slug === idOrSlug || p.slug === idOrSlug);
    if (!fallback) return null;
    return {
      id: `fallback_${fallback.slug}`,
      name: fallback.name,
      slug: fallback.slug,
      description: fallback.description,
      durationDays: fallback.durationDays,
      tokenCost: fallback.tokenCost,
      benefits: fallback.benefits,
      isActive: true,
      sortOrder: fallback.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }
}

/**
 * Check if user has active premium entitlement
 */
export async function hasActivePremium(userId: string): Promise<{ active: boolean; entitlement?: any; expiresAt?: Date }> {
  try {
    const now = new Date();
    const [entitlement] = await db
      .select()
      .from(premiumEntitlementsTable)
      .where(and(eq(premiumEntitlementsTable.userId, userId), eq(premiumEntitlementsTable.status, "active"), gte(premiumEntitlementsTable.endsAt, now)))
      .orderBy(desc(premiumEntitlementsTable.endsAt))
      .limit(1);

    if (entitlement) {
      return { active: true, entitlement, expiresAt: entitlement.endsAt };
    }

    // Fallback to old premiumSubscriptionsTable for backward compatibility
    const [oldSub] = await db
      .select()
      .from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, userId))
      .limit(1);
    if (oldSub?.isActive && (!oldSub.expiresAt || oldSub.expiresAt >= now)) {
      return { active: true, entitlement: oldSub, expiresAt: oldSub.expiresAt ?? undefined };
    }

    return { active: false };
  } catch (err) {
    logger.warn({ err }, "hasActivePremium check failed");
    return { active: false };
  }
}

/**
 * Purchase premium with tokens — atomic, idempotent
 */
export async function purchasePremiumWithTokens(
  userId: string,
  planIdOrSlug: string,
  idempotencyKey: string
): Promise<{ success: boolean; entitlement?: any; error?: string; newBalance?: number }> {
  const plan = await getPlanById(planIdOrSlug);
  if (!plan) {
    return { success: false, error: "Plan not found" };
  }
  if (!plan.isActive) {
    return { success: false, error: "Plan is not active" };
  }

  // Check existing idempotency
  try {
    const [existing] = await db.select().from(premiumEntitlementsTable).where(eq(premiumEntitlementsTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) {
      const [wallet] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
      return { success: true, entitlement: existing, newBalance: wallet?.coins ?? 0 };
    }
  } catch {}

  // Atomic transaction: spend tokens + create entitlement
  try {
    const result = await db.transaction(async (tx) => {
      // Spend tokens first — fails if insufficient
      const spendResult = await spendTokens(userId, plan.tokenCost, "premium_purchase", `premium_${idempotencyKey}`, {
        description: `Premium purchase: ${plan.name} (${plan.durationDays} days)`,
        relatedEntityId: plan.id,
        metadata: { planId: plan.id, planSlug: plan.slug, durationDays: plan.durationDays },
      }, tx as any);

      if (!spendResult) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      // Check if user has active entitlement — extend it instead of overlapping
      const [active] = await tx
        .select()
        .from(premiumEntitlementsTable)
        .where(and(eq(premiumEntitlementsTable.userId, userId), eq(premiumEntitlementsTable.status, "active"), gte(premiumEntitlementsTable.endsAt, now)))
        .orderBy(desc(premiumEntitlementsTable.endsAt))
        .limit(1);

      let finalEndsAt = endsAt;
      if (active) {
        // Extend existing entitlement
        finalEndsAt = new Date(active.endsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
        await tx
          .update(premiumEntitlementsTable)
          .set({ endsAt: finalEndsAt, updatedAt: new Date(), status: "active" })
          .where(eq(premiumEntitlementsTable.id, active.id));

        // Also update old table for backward compat
        await tx
          .update(premiumSubscriptionsTable)
          .set({ expiresAt: finalEndsAt, isActive: true })
          .where(eq(premiumSubscriptionsTable.userId, userId))
          .catch(() => {});

        return { entitlement: { ...active, endsAt: finalEndsAt }, balanceAfter: spendResult.balanceAfter, extended: true };
      }

      // Create new entitlement
      const [entitlement] = await tx
        .insert(premiumEntitlementsTable)
        .values({
          userId,
          planId: plan.id.startsWith("fallback_") ? null : plan.id,
          source: "token_unlock",
          status: "active",
          startsAt: now,
          endsAt: finalEndsAt,
          tokenCost: plan.tokenCost,
          idempotencyKey,
        })
        .returning();

      // Backward compat: update old table
      try {
        const [old] = await tx.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, userId)).limit(1);
        if (old) {
          await tx
            .update(premiumSubscriptionsTable)
            .set({ isActive: true, activatedAt: now, expiresAt: finalEndsAt, coinsCost: plan.tokenCost, benefits: plan.benefits })
            .where(eq(premiumSubscriptionsTable.userId, userId));
        } else {
          await tx.insert(premiumSubscriptionsTable).values({
            userId,
            expiresAt: finalEndsAt,
            coinsCost: plan.tokenCost,
            benefits: plan.benefits,
            isActive: true,
          });
        }
      } catch {}

      return { entitlement, balanceAfter: spendResult.balanceAfter, extended: false };
    });

    await invalidatePremiumCache(userId);
    logger.info({ userId, planId: plan.id, cost: plan.tokenCost }, "premium purchased");

    return { success: true, entitlement: result.entitlement, newBalance: result.balanceAfter };
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return { success: false, error: `Insufficient Focus Tokens. Need ${plan.tokenCost.toLocaleString()} tokens.` };
    }
    if (err.code === "23505" || err.message?.includes("duplicate") || err.message?.includes("unique")) {
      // Idempotency race — fetch existing
      try {
        const [existing] = await db.select().from(premiumEntitlementsTable).where(eq(premiumEntitlementsTable.idempotencyKey, idempotencyKey)).limit(1);
        if (existing) {
          return { success: true, entitlement: existing };
        }
      } catch {}
      return { success: false, error: "Purchase already processed" };
    }
    logger.error({ err, userId, planId: plan.id }, "premium purchase failed");
    return { success: false, error: "Failed to purchase premium" };
  }
}

/**
 * Grant premium via admin — with audit
 */
export async function grantPremiumAdmin(
  userId: string,
  durationDays: number,
  adminId: string,
  reason: string,
  idempotencyKey: string
) {
  return await db.transaction(async (tx) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const [entitlement] = await tx
      .insert(premiumEntitlementsTable)
      .values({
        userId,
        planId: null,
        source: "admin_grant",
        status: "active",
        startsAt: now,
        endsAt,
        tokenCost: 0,
        idempotencyKey,
        grantedByAdminId: adminId,
        adminReason: reason,
      })
      .returning();

    // Backward compat
    try {
      const [old] = await tx.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, userId)).limit(1);
      if (old) {
        await tx.update(premiumSubscriptionsTable).set({ isActive: true, activatedAt: now, expiresAt: endsAt, grantedByAdmin: true }).where(eq(premiumSubscriptionsTable.userId, userId));
      } else {
        await tx.insert(premiumSubscriptionsTable).values({ userId, expiresAt: endsAt, isActive: true, grantedByAdmin: true });
      }
    } catch {}

    await invalidatePremiumCache(userId);
    return entitlement;
  });
}

/**
 * Get entitlement history
 */
export async function getEntitlementHistory(userId: string) {
  try {
    const history = await db
      .select()
      .from(premiumEntitlementsTable)
      .where(eq(premiumEntitlementsTable.userId, userId))
      .orderBy(desc(premiumEntitlementsTable.createdAt))
      .limit(50);
    return history;
  } catch {
    return [];
  }
}

/**
 * Expire old entitlements — should be called periodically
 */
export async function expireOldEntitlements() {
  try {
    const now = new Date();
    await db
      .update(premiumEntitlementsTable)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(premiumEntitlementsTable.status, "active"), lt(premiumEntitlementsTable.endsAt, now)));

    await db
      .update(premiumSubscriptionsTable)
      .set({ isActive: false })
      .where(and(eq(premiumSubscriptionsTable.isActive, true), lt(premiumSubscriptionsTable.expiresAt, now)));
  } catch (err) {
    logger.warn({ err }, "expireOldEntitlements failed");
  }
}
