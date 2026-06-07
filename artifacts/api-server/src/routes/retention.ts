import { Router } from "express";
import { db } from "@workspace/db";
import {
  loginRewardsTable, userWalletsTable, studyStreaksTable,
  freezeTokensTable, notificationsTable, battlePassProgressTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
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

retentionRouter.get("/api/retention/login-reward", auth, async (req, res) => {
  const userId = req.userId!;
  const today = todayStr();
  let [record] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, userId)).limit(1);
  const alreadyClaimed = record?.lastClaimedDate === today;
  const streak = record?.claimStreak ?? 0;
  const nextDay = ((streak % 7) + 1);
  const reward = DAILY_REWARDS[nextDay - 1] ?? DAILY_REWARDS[0];
  res.json({ alreadyClaimed, claimStreak: streak, totalClaimed: record?.totalClaimed ?? 0, nextReward: reward, calendar: DAILY_REWARDS });
});

retentionRouter.post("/api/retention/login-reward/claim", auth, async (req, res) => {
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

retentionRouter.get("/api/retention/streak-freeze", auth, async (req, res) => {
  const userId = req.userId!;
  let [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  res.json({
    tokensAvailable: record?.tokensAvailable ?? 0,
    tokensUsed: record?.tokensUsed ?? 0,
    freezeCost: 500,
    coinsBalance: wallet?.coins ?? 0,
  });
});

retentionRouter.post("/api/retention/streak-freeze/buy", auth, async (req, res) => {
  const userId = req.userId!;
  const COST = 500;
  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  if (!wallet || wallet.coins < COST) return res.status(400).json({ error: "Not enough coins. Need 500." });

  await db.update(userWalletsTable).set({ coins: sql`coins - ${COST}`, updatedAt: new Date() }).where(eq(userWalletsTable.userId, userId));

  const [existing] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  if (existing) {
    await db.update(freezeTokensTable).set({ tokensAvailable: sql`tokens_available + 1`, updatedAt: new Date() }).where(eq(freezeTokensTable.userId, userId));
  } else {
    await db.insert(freezeTokensTable).values({ userId, tokensAvailable: 1, tokensUsed: 0 });
  }

  res.json({ ok: true, coinsSpent: COST });
});

retentionRouter.post("/api/retention/streak-freeze/use", auth, async (req, res) => {
  const userId = req.userId!;
  const [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  if (!record || record.tokensAvailable < 1) return res.status(400).json({ error: "No freeze tokens available" });

  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1);
  if (!streak) return res.status(400).json({ error: "No streak to protect" });

  const today = todayStr();
  await db.update(studyStreaksTable).set({ lastStudyDate: today, updatedAt: new Date() }).where(eq(studyStreaksTable.userId, userId));
  await db.update(freezeTokensTable).set({
    tokensAvailable: sql`tokens_available - 1`,
    tokensUsed: sql`tokens_used + 1`,
    updatedAt: new Date(),
  }).where(eq(freezeTokensTable.userId, userId));

  res.json({ ok: true, streakProtected: streak.currentStreak });
});

const BATTLE_PASS_CURRENT_SEASON = 1;
const BATTLE_PASS_TIERS = Array.from({ length: 50 }, (_, i) => ({
  tier: i + 1,
  xpRequired: (i + 1) * 200,
  freeReward: i % 5 === 4 ? { coins: 100, xp: 200, item: "chest" } : { coins: 25, xp: 50, item: "coins" },
  premiumReward: i % 5 === 4 ? { coins: 300, xp: 500, item: "legendary_chest" } : { coins: 75, xp: 150, item: "premium_coins" },
}));

retentionRouter.get("/api/retention/battle-pass", auth, async (req, res) => {
  const userId = req.userId!;
  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  if (!progress) {
    [progress] = await db.insert(battlePassProgressTable).values({ userId, season: BATTLE_PASS_CURRENT_SEASON }).returning();
  }
  const currentTier = BATTLE_PASS_TIERS.find(t => t.xpRequired > (progress?.seasonXp ?? 0));
  res.json({
    season: progress?.season,
    tier: progress?.tier,
    seasonXp: progress?.seasonXp,
    premiumUnlocked: progress?.premiumUnlocked,
    claimedTiers: progress?.claimedTiers ?? [],
    nextTierXp: currentTier?.xpRequired ?? 10000,
    tiers: BATTLE_PASS_TIERS,
    endsAt: "2026-09-30",
  });
});

retentionRouter.post("/api/retention/battle-pass/claim", auth, async (req, res) => {
  const userId = req.userId!;
  const { tier, track } = req.body as { tier: number; track: "free" | "premium" };

  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  if (!progress) return res.status(400).json({ error: "No battle pass progress" });
  if (track === "premium" && !progress.premiumUnlocked) return res.status(403).json({ error: "Premium track not unlocked" });

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

retentionRouter.post("/api/retention/battle-pass/advance", auth, async (req, res) => {
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
