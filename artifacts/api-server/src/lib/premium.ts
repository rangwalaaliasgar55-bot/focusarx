import { db, premiumSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Single source of truth for whether a user currently has active Premium.
 * A subscription counts only when `isActive` and not past `expiresAt`.
 * Use this everywhere a premium entitlement is gated so ownership stays
 * consistent across the app (battle pass, cosmetics, features, …).
 */
export async function isPremiumActive(userId: string): Promise<boolean> {
  const [sub] = await db
    .select({ isActive: premiumSubscriptionsTable.isActive, expiresAt: premiumSubscriptionsTable.expiresAt })
    .from(premiumSubscriptionsTable)
    .where(eq(premiumSubscriptionsTable.userId, userId))
    .limit(1);
  if (!sub || !sub.isActive) return false;
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) return false;
  return true;
}
