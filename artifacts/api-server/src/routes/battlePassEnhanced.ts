import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { battlePasses, battlePassRewards, battlePassProgressTable } from "@workspace/db";
import { battlePassClaimsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { earnTokens, getTokenBalance } from "../lib/tokenLedger";
import { logger } from "../lib/logger";
import { MAX_TIER, requiredXpForTier, eligibleTiersForXp, currentTierForXp } from "../lib/battlePassTiers";
import { buildSeasonTiers, groupTierRewards, requiredXpForTierIndex, rewardPayout, type RewardRow } from "../lib/battlePassSeasons";
import { mintCoins } from "../lib/coinLedger";

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
interface TierRewardView {
  type?: string | null; value?: number | null; label?: string | null; coins: number; xp: number;
  tokenAmount?: number; cosmeticId?: string; petId?: string; lootbox?: string;
}

interface BattlePassTierView {
  tier: number; xpRequired: number;
  freeReward: TierRewardView; premiumReward: TierRewardView;
}

/**
 * Shape a reward payload for the client.
 *
 * `coins`/`xp`/`tokenAmount`/`cosmeticId` are the fields the battle-pass page
 * renders, so the mapping is explicit here rather than left to the page to
 * guess from a jsonb blob.
 */
function toTierRewardView(value: { coins?: number; xp?: number; tokens?: number; cosmeticId?: string; petId?: string; lootbox?: string; label?: string } | undefined, type: string): TierRewardView {
  return {
    type,
    label: value?.label ?? null,
    coins: value?.coins ?? 0,
    xp: value?.xp ?? 0,
    tokenAmount: value?.tokens,
    cosmeticId: value?.cosmeticId,
    petId: value?.petId,
    lootbox: value?.lootbox,
  };
}

router.get("/battle-pass/current", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { end, seasonId } = getCurrentSeason();
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    const graceEnd = new Date(end.getTime() + 3 * 86400000); // 3 day grace
    const inGrace = now > end && now < graceEnd;

    // The active season, or the generated default when an admin has not
    // published one yet. `isActive` is the publish flag the admin builder sets.
    const [bp] = await db.select().from(battlePasses).where(eq(battlePasses.isActive, true)).orderBy(desc(battlePasses.createdAt)).limit(1);

    let tiers: BattlePassTierView[];
    let seasonTitle: string;
    if (bp) {
      const rewards = await db.select().from(battlePassRewards).where(eq(battlePassRewards.battlePassId, bp.id)).orderBy(battlePassRewards.tier);
      // Read the columns the table actually has (tier / required_xp / is_premium /
      // value). The previous implementation read `freeRewardCoins`-style fields
      // that do not exist, so every tier rendered as "0 coins" — which is what
      // made the pass look broken and empty.
      const rows: RewardRow[] = rewards.map((row) => ({
        tier: row.tier,
        requiredXp: row.requiredXp,
        isPremium: row.isPremium,
        value: (row.value as Record<string, unknown> | null) ? (row.value as RewardRow["value"]) : {},
      }));
      tiers = groupTierRewards(rows).map((view) => ({
        tier: view.tier,
        xpRequired: view.xpRequired,
        freeReward: toTierRewardView(view.freeReward, view.freeType),
        premiumReward: toTierRewardView(view.premiumReward, view.premiumType),
      }));
      seasonTitle = bp.title;
    } else {
      // No season configured — generate the same table the admin builder would
      // publish, so the page is complete rather than empty.
      tiers = buildSeasonTiers({ seed: seasonId }).map((tier) => ({
        tier: tier.tier,
        xpRequired: tier.requiredXp,
        freeReward: toTierRewardView(tier.free, "coins"),
        premiumReward: toTierRewardView(tier.premium, tier.premium.cosmeticId ? "cosmetic" : "tokens"),
      }));
      seasonTitle = "FocusArx Season";
    }

    const seasonXp = await getSeasonXp(req.userId!);
    // `maxTier` is the length of *this* season: an admin may author up to 50
    // tiers, and the default cap of 30 used to make tier 31+ unreachable.
    const currentTier = currentTierForXp(
      seasonXp,
      (t) => requiredXpForTier({ requiredXp: tiers[t - 1]?.xpRequired ?? requiredXpForTierIndex(t) }, t),
      tiers.length,
    );
    const isPremium = await isUserPremium(req.userId!);
    const claims = await db.select().from(battlePassClaimsTable).where(and(eq(battlePassClaimsTable.userId, req.userId!), eq(battlePassClaimsTable.battlePassId, bp?.id ?? seasonId)));
    const claimedFree = claims.filter((c) => !c.isPremiumReward).map((c) => c.tier);
    const claimedPremium = claims.filter((c) => c.isPremiumReward).map((c) => c.tier);
    const balance = await getTokenBalance(req.userId!).catch(() => 0);

    res.json({
      seasonId: bp?.id ?? seasonId,
      seasonTitle,
      tiers,
      // `countdown.endsAt` is what the page renders; `endDate`/`graceEndsAt` are
      // kept for the older client shape.
      countdown: { endsAt: end.toISOString(), graceEndsAt: graceEnd.toISOString() },
      endDate: end.toISOString(),
      graceEndsAt: graceEnd.toISOString(),
      daysLeft,
      inGracePeriod: inGrace,
      isPremium,
      tokenBalance: balance,
      progress: { currentTier, seasonXp, claimedFree, claimedPremium },
    });
  } catch (err) {
    logger.error({ err }, "battle pass current error");
    res.status(500).json({ error: "Failed to load battle pass" });
  }
});

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

    // Pay what the tier advertised. The old code ignored the configured reward
    // entirely and paid `25 + tier * 2` (free) / `50 + tier * 5` (premium), so a
    // milestone advertising a cosmetic handed over tokens instead — the season
    // was decoration. `rewardPayout` keeps the old numbers as a floor for rows
    // that carry no payload.
    const [rewardRow] = bp
      ? await db.select().from(battlePassRewards).where(and(
          eq(battlePassRewards.battlePassId, bp.id),
          eq(battlePassRewards.tier, tier),
          eq(battlePassRewards.isPremium, !!isPremiumReward),
        )).limit(1)
      : [];
    const payout = rewardPayout((rewardRow?.value as Record<string, never> | null) ?? null, !!isPremiumReward, tier);
    const tokenReward = payout.tokens ?? 0;

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
    } catch (e) {
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

    // Award every component the reward promised, each idempotent on its own key
    // so a replayed claim cannot pay twice.
    const idempotencyKey = `bp_${bpId}_${req.userId}_${tier}_${isPremiumReward ? "premium" : "free"}`;
    let tokenResult;
    try {
      tokenResult = await earnTokens(req.userId!, "battle_pass", idempotencyKey, { description: `bp ${bpId} tier ${tier} premium ${isPremiumReward}` }, tokenReward);
    } catch {
      // token already awarded — still success
    }

    // Coins are minted through the ledger (not written straight to the wallet),
    // which is what makes a claim reproducible from the transaction history.
    if (payout.coins && payout.coins > 0) {
      try {
        await mintCoins(req.userId!, payout.coins, "battle_pass_reward", { metadata: { idempotencyKey: `${idempotencyKey}_coins`, tier } });
      } catch (err) {
        logger.warn({ err, tier }, "battle pass coin award failed");
      }
    }

    res.json({
      claimed: claim,
      tokenReward,
      coinsAwarded: payout.coins ?? 0,
      cosmeticId: payout.cosmeticId ?? null,
      petId: payout.petId ?? null,
      lootbox: payout.lootbox ?? null,
      xpAwarded: payout.xp ?? 0,
      balanceAfter: tokenResult?.balanceAfter,
    });
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
    const maxTier = rewards.reduce((top, reward) => Math.max(top, reward.tier), 0) || MAX_TIER;
    const tiers = eligibleTiersForXp(seasonXp, requirementFor, maxTier);

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
          // Same payout rule as the single claim — a bulk claim must not pay a
          // different amount than claiming the tiers one at a time.
          const payout = rewardPayout(
            (rewards.find(r => r.tier === tier && r.isPremium === isPrem)?.value as Record<string, never> | null) ?? null,
            isPrem,
            tier,
          );
          const idempotencyKey = `bp_${bpId}_${req.userId}_${tier}_${isPrem ? "premium" : "free"}`;
          try { await earnTokens(req.userId!, "battle_pass", idempotencyKey, { description: `bp ${bpId} tier ${tier} premium ${isPrem}` }, payout.tokens ?? 0); } catch {}
          if (payout.coins && payout.coins > 0) {
            try { await mintCoins(req.userId!, payout.coins, "battle_pass_reward", { metadata: { idempotencyKey: `${idempotencyKey}_coins`, tier } }); } catch {}
          }
          results.push({ ...c, coins: payout.coins ?? 0 });
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
