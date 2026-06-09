import { Router } from "express";
import { extractUserId } from "./auth";
import { db } from "@workspace/db";
import { loginRewardsTable, userWalletsTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.user = { id: userId };
  next();
}

export const dailyRewardRouter = Router();

const STREAK_REWARDS = [
  { day: 1, coins: 25,  xp: 50,  label: "Day 1",   icon: "🌟" },
  { day: 2, coins: 30,  xp: 75,  label: "Day 2",   icon: "⭐" },
  { day: 3, coins: 40,  xp: 100, label: "Day 3",   icon: "🔥" },
  { day: 4, coins: 50,  xp: 125, label: "Day 4",   icon: "💫" },
  { day: 5, coins: 75,  xp: 175, label: "Day 5",   icon: "✨" },
  { day: 6, coins: 100, xp: 200, label: "Day 6",   icon: "🏅" },
  { day: 7, coins: 200, xp: 400, label: "Week 🎉", icon: "🏆" },
];

function getToday() { return new Date().toISOString().split("T")[0]; }
function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

dailyRewardRouter.get("/daily-reward/status", auth, async (req: any, res) => {
  try {
    let [reward] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, req.user.id)).limit(1);
    const today = getToday();

    if (!reward) {
      [reward] = await db.insert(loginRewardsTable).values({ userId: req.user.id }).returning();
    }

    const alreadyClaimed = reward.lastClaimedDate === today;
    const streak = reward.claimStreak;
    const nextReward = STREAK_REWARDS[(streak % 7)] ?? STREAK_REWARDS[0];

    res.json({ alreadyClaimed, streak, nextReward, rewards: STREAK_REWARDS, totalClaimed: reward.totalClaimed });
  } catch {
    res.status(500).json({ error: "Failed to get status" });
  }
});

dailyRewardRouter.post("/daily-reward/claim", auth, async (req: any, res) => {
  try {
    let [reward] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, req.user.id)).limit(1);
    const today = getToday();

    if (!reward) {
      [reward] = await db.insert(loginRewardsTable).values({ userId: req.user.id }).returning();
    }

    if (reward.lastClaimedDate === today) {
      return res.status(400).json({ error: "Already claimed today" });
    }

    const isConsecutive = reward.lastClaimedDate === yesterday();
    const newStreak = isConsecutive ? (reward.claimStreak + 1) : 1;
    const rewardDef = STREAK_REWARDS[(newStreak - 1) % 7] ?? STREAK_REWARDS[0];

    await db.update(loginRewardsTable).set({
      lastClaimedDate: today,
      claimStreak: newStreak,
      totalClaimed: (reward.totalClaimed ?? 0) + 1,
      updatedAt: new Date(),
    }).where(eq(loginRewardsTable.userId, req.user.id));

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.user.id)).limit(1);
    if (w) {
      await db.update(userWalletsTable).set({
        coins: w.coins + rewardDef.coins,
        totalXp: w.totalXp + rewardDef.xp,
      }).where(eq(userWalletsTable.userId, req.user.id));
    }

    await db.insert(notificationsTable).values({
      userId: req.user.id,
      type: "daily_reward",
      title: `Daily Reward — ${rewardDef.label}`,
      message: `You earned ${rewardDef.coins} coins and ${rewardDef.xp} XP! Streak: ${newStreak} days.`,
    }).catch(() => {});

    res.json({ success: true, streak: newStreak, reward: rewardDef });
  } catch {
    res.status(500).json({ error: "Failed to claim reward" });
  }
});
