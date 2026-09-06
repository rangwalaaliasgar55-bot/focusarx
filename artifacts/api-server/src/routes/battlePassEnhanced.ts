import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { battlePasses, battlePassRewards, battlePassProgressTable } from "@workspace/db";
import { battlePassClaimsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { earnTokens, getTokenBalance } from "../lib/tokenLedger";
import { logger } from "../lib/logger";
import { requiredXpForTier, eligibleTiersForXp, currentTierForXp } from "../lib/battlePassTiers";

const router = Router();

// Helper to get current season — 28-30 day seasons
function getCurrentSeason(): { start: Date; end: Date; seasonId: string } {
  const now = new Date();
  // Season is month-based: e.g., 2025-08
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  // Extend to 28-30 days minimum — month naturally is 28-31
  const seasonId = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { start, end, seasonId };
}

// Live season XP: session completion credits battle_pass_progress (the
// user_battle_pass_progress table this route used to read has no writers).
async function getSeasonXp(userId: string): Promise<number> {
  const [p] = await db.select({ seasonXp: battlePassProgressTable.seasonXp }).from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  return p?.seasonXp ?? 0;
}

// GET /api/battle-pass/current — enhanced with 30-50 tiers, free+premium, countdown, grace
router.get("/battle-pass/current", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { start, end, seasonId } = getCurrentSeason();
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    const graceEnd = new Date(end.getTime() + 3 * 86400000); // 3 day grace
    const inGrace = now > end && now < graceEnd;

    // Try to load battle pass definition, fallback to generated tiers
    const [bp] = await db.select().from(battlePasses).where(eq(battlePasses.isActive, true)).orderBy(desc(battlePasses.createdAt)).limit(1);
    let tiers: any[] = [];
    if (bp) {
      const rewards = await db.select().from(battlePassRewards).where(eq(battlePassRewards.battlePassId, bp.id)).orderBy(battlePassRewards.tier);
      tiers = rewards.map((r: any) => ({
        tier: r.tier,
        xpRequired: r.requiredXp,
        freeReward: { type: r.freeRewardType, value: r.freeRewardValue, label: r.freeRewardLabel, coins: r.freeRewardCoins ?? 0, xp: r.freeRewardXp ?? 0 },
        premiumReward: { type: r.premiumRewardType, value: r.premiumRewardValue, label: r.premiumRewardLabel, coins: r.premiumRewardCoins ?? 0, xp: r.premiumRewardXp ?? 0 },
      }));
    } else {
      // Generate 30 tiers
      tiers = Array.from({ length: 30 }, (_, i) => {
        const tier = i + 1;
        const xpReq = tier * 500 + Math.floor(tier / 5) * 500;
        const isMilestone = tier % 5 === 0;
        return {
          tier,
          xpRequired: xpReq,
          freeReward: {
            type: isMilestone ? "bundle" : tier % 2 === 0 ? "coins" : "xp",
            value: 50 + tier * 10,
            label: isMilestone ? `${100 + tier * 20} tokens milestone` : `${50 + tier * 5} tokens`,
            coins: isMilestone ? 100 + tier * 20 : tier % 2 === 0 ? 50 + tier * 5 : 0,
            xp: isMilestone ? 200 + tier * 10 : tier % 2 === 1 ? 100 + tier * 5 : 0,
            tokenAmount: isMilestone ? 100 + tier * 5 : 25 + tier * 2,
          },
          premiumReward: {
            type: "bundle",
            value: 100 + tier * 20,
            label: isMilestone ? `Premium: ${200 + tier * 30} tokens + pet + cosmetic` : `Premium: ${100 + tier * 10} tokens`,
            coins: 100 + tier * 20,
            xp: 200 + tier * 15,
            tokenAmount: isMilestone ? 200 + tier * 10 : 50 + tier * 5,
            cosmeticId: isMilestone ? `premium_tier_${tier}_cosmetic` : undefined,
            petId: tier === 30 ? "legendary_phoenix" : undefined,
          },
        };
      });
    }

    // User progress (live season XP from battle_pass_progress)
    const seasonXp = await getSeasonXp(req.userId!);
    const currentTier = currentTierForXp(seasonXp, (t) => requiredXpForTier(tiers.find(x => x.tier === t), t));

    // Claims
    const claims = await db.select().from(battlePassClaimsTable).where(and(eq(battlePassClaimsTable.userId, req.userId!), eq(battlePassClaimsTable.battlePassId, bp?.id ?? seasonId)));
    const claimedFree = new Set(claims.filter(c => !c.isPremiumReward).map(c => c.tier));
    const claimedPremium = new Set(claims.filter(c => c.isPremiumReward).map(c => c.tier));

    const isPremium = await isUserPremium(req.userId!);
    const balance = await getTokenBalance(req.userId!);

    res.json({
      seasonId: bp?.id ?? seasonId,
      name: bp?.title ?? `Season ${seasonId}`,
      startDate: bp?.startDate ?? start,
      endDate: bp?.endDate ?? end,
      daysLeft,
      graceEndsAt: graceEnd,
      inGracePeriod: inGrace,
      tiers,
      progress: { seasonXp, currentTier, claimedFree: Array.from(claimedFree), claimedPremium: Array.from(claimedPremium) },
      isPremium,
      tokenBalance: balance,
      countdown: { endsAt: end, graceEndsAt: graceEnd },
    });
  } catch (err) {
    logger.error({ err }, "battle pass current error");
    res.status(500).json({ error: "Failed to load battle pass" });
  }
});

// POST /api/battle-pass/claim — idempotent claim per tier
router.post("/battle-pass/claim", authMiddleware, async (req: AuthRequest, res) => {
  const { tier, isPremiumReward, battlePassId } = req.body as { tier: number; isPremiumReward?: boolean; battlePassId?: string };
  if (!tier || tier < 1 || tier > 50) return res.status(400).json({ error: "Invalid tier" });
  try {
    const { seasonId } = getCurrentSeason();
    const bpId = battlePassId ?? seasonId;

    // Check if already claimed — idempotent
    const [existing] = await db.select().from(battlePassClaimsTable).where(and(
      eq(battlePassClaimsTable.battlePassId, bpId),
      eq(battlePassClaimsTable.userId, req.userId!),
      eq(battlePassClaimsTable.tier, tier),
      eq(battlePassClaimsTable.isPremiumReward, !!isPremiumReward),
    )).limit(1);
    if (existing) {
      return res.json({ claimed: existing, alreadyClaimed: true });
    }

    // Check progression (live season XP from battle_pass_progress)
    const seasonXp = await getSeasonXp(req.userId!);

    // Load tier requirement
    const [bp] = await db.select().from(battlePasses).where(eq(battlePasses.id, bpId)).limit(1);
    let requiredXp = tier * 500;
    if (bp) {
      const [reward] = await db.select().from(battlePassRewards).where(and(eq(battlePassRewards.battlePassId, bp.id), eq(battlePassRewards.tier, tier))).limit(1);
      if (reward) requiredXp = reward.requiredXp;
    }
    if (seasonXp < requiredXp) {
      return res.status(400).json({ error: "Tier not yet unlocked", requiredXp, currentXp: seasonXp });
    }

    if (isPremiumReward) {
      const premium = await isUserPremium(req.userId!);
      if (!premium) return res.status(403).json({ error: "Premium track requires Premium membership", requiresPremium: true });
    }

    // Determine reward tokens
    const tokenReward = isPremiumReward ? 50 + tier * 5 : 25 + tier * 2;

    // Insert claim idempotently
    const rewardId = `${isPremiumReward ? "premium" : "free"}_tier_${tier}`;
    let claim;
    try {
      const [c] = await db.insert(battlePassClaimsTable).values({
        battlePassId: bpId,
        userId: req.userId!,
        tier,
        rewardId,
        isPremiumReward: !!isPremiumReward,
      }).returning();
      claim = c;
    } catch (e: any) {
      // unique violation — already claimed, fetch existing
      const [dup] = await db.select().from(battlePassClaimsTable).where(and(
        eq(battlePassClaimsTable.battlePassId, bpId),
        eq(battlePassClaimsTable.userId, req.userId!),
        eq(battlePassClaimsTable.tier, tier),
        eq(battlePassClaimsTable.rewardId, rewardId),
      )).limit(1);
      if (dup) return res.json({ claimed: dup, alreadyClaimed: true });
      throw e;
    }

    // Award tokens idempotently
    const idempotencyKey = `bp_${bpId}_${req.userId}_${tier}_${isPremiumReward ? "premium" : "free"}`;
    let tokenResult;
    try {
      tokenResult = await earnTokens(req.userId!, "battle_pass", idempotencyKey, { description: `bp ${bpId} tier ${tier} premium ${isPremiumReward}` }, tokenReward);
    } catch {
      // token already awarded — still success
    }

    res.json({ claimed: claim, tokenReward, balanceAfter: tokenResult?.balanceAfter });
  } catch (err) {
    logger.error({ err }, "battle pass claim error");
    res.status(500).json({ error: "Failed to claim reward" });
  }
});

// POST /api/battle-pass/claim-all — claim all eligible
router.post("/battle-pass/claim-all", authMiddleware, async (req: AuthRequest, res) => {
  const { battlePassId } = req.body as { battlePassId?: string };
  try {
    const { seasonId } = getCurrentSeason();
    const bpId = battlePassId ?? seasonId;
    const seasonXp = await getSeasonXp(req.userId!);
    const isPremium = await isUserPremium(req.userId!);

    // Same requirement resolution as POST /claim (DB thresholds when a pass
    // definition exists, tier * 500 otherwise)
    const [bp] = await db.select().from(battlePasses).where(eq(battlePasses.id, bpId)).limit(1);
    const rewards = bp
      ? await db.select().from(battlePassRewards).where(eq(battlePassRewards.battlePassId, bp.id))
      : [];
    const requirementFor = (t: number) => requiredXpForTier(rewards.find(r => r.tier === t), t);
    const tiers = eligibleTiersForXp(seasonXp, requirementFor);

    const claims = await db.select().from(battlePassClaimsTable).where(and(eq(battlePassClaimsTable.userId, req.userId!), eq(battlePassClaimsTable.battlePassId, bpId)));
    const claimedSet = new Set(claims.map(c => `${c.tier}_${c.isPremiumReward ? "p" : "f"}`));

    const toClaim = [];
    for (const tier of tiers) {
      if (!claimedSet.has(`${tier}_f`)) toClaim.push({ tier, isPremium: false });
      if (isPremium && !claimedSet.has(`${tier}_p`)) toClaim.push({ tier, isPremium: true });
    }

    const results = [];
    for (const { tier, isPremium: isPrem } of toClaim) {
      try {
        const rewardId = `${isPrem ? "premium" : "free"}_tier_${tier}`;
        const [c] = await db.insert(battlePassClaimsTable).values({
          battlePassId: bpId,
          userId: req.userId!,
          tier,
          rewardId,
          isPremiumReward: isPrem,
        }).onConflictDoNothing().returning();
        if (c) {
          const tokenReward = isPrem ? 50 + tier * 5 : 25 + tier * 2;
          const idempotencyKey = `bp_${bpId}_${req.userId}_${tier}_${isPrem ? "premium" : "free"}`;
          try { await earnTokens(req.userId!, "battle_pass", idempotencyKey, { description: `bp ${bpId} tier ${tier} premium ${isPrem}` }, tokenReward); } catch {}
          results.push(c);
        }
      } catch {}
    }

    res.json({ claimedCount: results.length, claims: results });
  } catch (err) {
    logger.error({ err }, "battle pass claim-all error");
    res.status(500).json({ error: "Failed to claim all" });
  }
});

export { router as battlePassEnhancedRouter };
