import { Router } from "express";
import { db } from "@workspace/db";
import {
  loginRewardsTable, userWalletsTable, studyStreaksTable,
  freezeTokensTable, notificationsTable, battlePassProgressTable,
  usersTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { isPremiumActive } from "../lib/premium";
import { eq, sql } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const retentionRouter = Router();

const DAILY_REWARDS = [
  { day: 1, coins: 50, xp: 100, label: "Day 1", icon: "🎁" },
  { day: 2, coins: 75, xp: 150, label: "Day 2", icon: "🎁" },
  { day: 3, coins: 100, xp: 200, label: "Day 3", icon: "🎁" },
  { day: 4, coins: 125, xp: 250, label: "Day 4", icon: "🌟" },
  { day: 5, coins: 150, xp: 300, label: "Day 5", icon: "🌟" },
  { day: 6, coins: 175, xp: 350, label: "Day 6", icon: "💎" },
  { day: 7, coins: 500, xp: 1000, label: "Day 7 MEGA!", icon: "🏆" },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

retentionRouter.get("/retention/login-reward", auth, async (req, res) => {
  const userId = req.userId!;
  const today = todayStr();
  let [record] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, userId)).limit(1);
  const alreadyClaimed = record?.lastClaimedDate === today;
  const streak = record?.claimStreak ?? 0;
  const nextDay = ((streak % 7) + 1);
  const reward = DAILY_REWARDS[nextDay - 1] ?? DAILY_REWARDS[0];
  res.json({ alreadyClaimed, claimStreak: streak, totalClaimed: record?.totalClaimed ?? 0, nextReward: reward, calendar: DAILY_REWARDS });
});

retentionRouter.post("/retention/login-reward/claim", auth, async (req, res) => {
  const userId = req.userId!;
  const today = todayStr();
  let [record] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, userId)).limit(1);
  if (record?.lastClaimedDate === today) return res.status(400).json({ error: "Already claimed today" });

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const continued = record?.lastClaimedDate === yStr;
  const newStreak = continued ? (record!.claimStreak + 1) : 1;
  const dayIndex = ((newStreak - 1) % 7);
  const reward = DAILY_REWARDS[dayIndex];

  if (record) {
    await db.update(loginRewardsTable).set({ lastClaimedDate: today, claimStreak: newStreak, totalClaimed: (record.totalClaimed ?? 0) + 1, updatedAt: new Date() })
      .where(eq(loginRewardsTable.userId, userId));
  } else {
    await db.insert(loginRewardsTable).values({ userId, lastClaimedDate: today, claimStreak: 1, totalClaimed: 1 });
  }

  let [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  if (!wallet) {
    [wallet] = await db.insert(userWalletsTable).values({ userId }).returning();
  }
  await db.update(userWalletsTable).set({
    coins: sql`coins + ${reward.coins}`,
    totalXp: sql`total_xp + ${reward.xp}`,
    weeklyXp: sql`weekly_xp + ${reward.xp}`,
    updatedAt: new Date(),
  }).where(eq(userWalletsTable.userId, userId));

  await db.insert(notificationsTable).values({
    userId, type: "daily_reward",
    title: `Day ${newStreak} reward claimed!`,
    message: `+${reward.coins} coins, +${reward.xp} XP`,
    data: { reward, streak: newStreak },
  });

  res.json({ ok: true, reward, newStreak, coins: reward.coins, xp: reward.xp });
});

retentionRouter.get("/retention/freeze-tokens", auth, async (req, res) => {
  const userId = req.userId!;
  const [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  res.json({ tokens: record?.tokensAvailable ?? 0, used: record?.tokensUsed ?? 0 });
});

retentionRouter.post("/retention/freeze-tokens/use", auth, async (req, res) => {
  const userId = req.userId!;
  const [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  if (!record || (record.tokensAvailable ?? 0) <= 0) return res.status(400).json({ error: "No freeze tokens" });
  await db.update(freezeTokensTable).set({ tokensAvailable: sql`tokens_available - 1`, tokensUsed: sql`tokens_used + 1`, updatedAt: new Date() }).where(eq(freezeTokensTable.userId, userId));
  res.json({ ok: true });
});

const BATTLE_PASS_CURRENT_SEASON = 1;

const BATTLE_PASS_TIERS = [
  { tier: 1, xpRequired: 0,    freeReward: { coins: 50,  xp: 0,   label: "50 coins" },        premiumReward: { coins: 100, xp: 200, label: "100 coins + 200 XP" } },
  { tier: 2, xpRequired: 500,  freeReward: { coins: 75,  xp: 0,   label: "75 coins" },        premiumReward: { coins: 150, xp: 300, label: "150 coins + 300 XP" } },
  { tier: 3, xpRequired: 1200, freeReward: { coins: 100, xp: 0,   label: "100 coins" },       premiumReward: { coins: 200, xp: 500, label: "200 coins + 500 XP" } },
  { tier: 4, xpRequired: 2000, freeReward: { coins: 0,   xp: 500, label: "500 XP" },          premiumReward: { coins: 300, xp: 800, label: "300 coins + 800 XP" } },
  { tier: 5, xpRequired: 3000, freeReward: { coins: 150, xp: 0,   label: "150 coins" },       premiumReward: { coins: 500, xp: 1000, label: "500 coins + 1000 XP" } },
  { tier: 6, xpRequired: 4500, freeReward: { coins: 0,   xp: 750, label: "750 XP" },          premiumReward: { coins: 400, xp: 1200, label: "400 coins + 1200 XP" } },
  { tier: 7, xpRequired: 6000, freeReward: { coins: 200, xp: 0,   label: "200 coins" },       premiumReward: { coins: 600, xp: 1500, label: "600 coins + 1500 XP" } },
  { tier: 8, xpRequired: 8000, freeReward: { coins: 250, xp: 500, label: "250 coins + 500 XP" }, premiumReward: { coins: 1000, xp: 2000, label: "1000 coins + 2000 XP" } },
];

retentionRouter.get("/retention/battle-pass", auth, async (req, res) => {
  const userId = req.userId!;
  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  const currentTierDef = progress ? BATTLE_PASS_TIERS.find(t => t.tier > (progress?.tier ?? 0)) : BATTLE_PASS_TIERS[0];
  // Premium battle-pass access is granted by EITHER a direct pass purchase
  // (progress.premiumUnlocked) OR an active premium subscription.
  const premiumUnlocked = (progress?.premiumUnlocked ?? false) || await isPremiumActive(userId);
  res.json({
    season: BATTLE_PASS_CURRENT_SEASON,
    tier: progress?.tier ?? 0,
    seasonXp: progress?.seasonXp,
    premiumUnlocked,
    claimedTiers: progress?.claimedTiers ?? [],
    nextTierXp: currentTierDef?.xpRequired ?? 10000,
    tiers: BATTLE_PASS_TIERS,
    endsAt: "2026-09-30",
  });
});

retentionRouter.post("/retention/battle-pass/claim", auth, async (req, res) => {
  const userId = req.userId!;
  const { tier, track } = req.body as { tier: number; track: "free" | "premium" };

  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  if (!progress) return res.status(400).json({ error: "No battle pass progress" });
  const premiumUnlocked = progress.premiumUnlocked || await isPremiumActive(userId);
  if (track === "premium" && !premiumUnlocked) return res.status(403).json({ error: "Premium track not unlocked" });

  const tierDef = BATTLE_PASS_TIERS.find(t => t.tier === tier);
  if (!tierDef) return res.status(400).json({ error: "Invalid tier" });
  if ((progress.claimedTiers ?? []).includes(tier)) return res.status(400).json({ error: "Already claimed" });
  if (progress.tier < tier) return res.status(400).json({ error: "Tier not reached" });

  const reward = track === "premium" ? tierDef.premiumReward : tierDef.freeReward;
  const newClaimed = [...(progress.claimedTiers ?? []), tier];
  await db.update(battlePassProgressTable).set({ claimedTiers: newClaimed, updatedAt: new Date() }).where(eq(battlePassProgressTable.userId, userId));
  await db.update(userWalletsTable).set({
    coins: sql`coins + ${reward.coins}`,
    totalXp: sql`total_xp + ${reward.xp}`,
    updatedAt: new Date(),
  }).where(eq(userWalletsTable.userId, userId));

  res.json({ ok: true, reward });
});

retentionRouter.post("/retention/battle-pass/advance", auth, async (req, res) => {
  const userId = req.userId!;
  const { xp } = req.body as { xp: number };
  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  if (!progress) {
    [progress] = await db.insert(battlePassProgressTable).values({ userId, season: BATTLE_PASS_CURRENT_SEASON }).returning();
  }
  const newXp = (progress.seasonXp ?? 0) + xp;
  const newTier = BATTLE_PASS_TIERS.filter(t => t.xpRequired <= newXp).length;
  await db.update(battlePassProgressTable).set({ seasonXp: newXp, tier: newTier, updatedAt: new Date() }).where(eq(battlePassProgressTable.userId, userId));
  res.json({ ok: true, newTier, newXp });
});

// ─── REFERRAL SYSTEM ──────────────────────────────────────────────────────────

function makeReferralCode(userId: string): string {
  const base36 = parseInt(userId.replace(/-/g, "").slice(0, 8), 16).toString(36).toUpperCase();
  return `FAX-${base36.slice(0, 6)}`;
}

retentionRouter.get("/referral/my-code", auth, async (req, res) => {
  const userId = req.userId!;
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const code = makeReferralCode(userId);
  const shareUrl = `${process.env["APP_URL"] || "https://focusarx.replit.app"}/?ref=${code}`;
  res.json({ code, shareUrl, name: user.name || user.email?.split("@")[0] || "You" });
});

retentionRouter.post("/referral/apply", auth, async (req, res) => {
  const userId = req.userId!;
  const { code } = req.body as { code?: string };
  if (!code?.startsWith("FAX-")) return res.status(400).json({ error: "Invalid referral code" });

  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  if (!wallet) return res.status(400).json({ error: "Wallet not found" });

  // Reward the person applying the code
  await db.update(userWalletsTable).set({
    coins: sql`coins + 200`,
    totalXp: sql`total_xp + 500`,
    updatedAt: new Date(),
  }).where(eq(userWalletsTable.userId, userId));

  await db.insert(notificationsTable).values({
    userId, type: "referral",
    title: "Referral bonus applied! 🎉",
    message: "+200 coins and +500 XP for joining with a friend's code",
    data: { code },
  });

  // Find and reward the referrer by scanning all users and matching their derived code
  try {
    const allUsers = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).limit(5000);
    const referrer = allUsers.find(u => u.id !== userId && makeReferralCode(u.id) === code);
    if (referrer) {
      const [referrerWallet] = await db.select().from(userWalletsTable)
        .where(eq(userWalletsTable.userId, referrer.id)).limit(1);
      if (referrerWallet) {
        await db.update(userWalletsTable).set({
          coins: sql`coins + 500`,
          totalXp: sql`total_xp + 1000`,
          weeklyXp: sql`weekly_xp + 1000`,
          updatedAt: new Date(),
        }).where(eq(userWalletsTable.userId, referrer.id));
        await db.insert(notificationsTable).values({
          userId: referrer.id, type: "referral",
          title: "Someone used your referral code! 🎉",
          message: "+500 coins and +1000 XP — thanks for spreading the word!",
          data: { code, newUserId: userId },
        });
      }
    }
  } catch { /* referrer reward is non-critical */ }

  res.json({ ok: true, coins: 200, xp: 500 });
});
