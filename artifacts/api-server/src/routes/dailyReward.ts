import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { extractUserId } from "./auth";
import { db, loginRewardsTable, userWalletsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { mintCoins } from "../lib/coinLedger";
import { istToday } from "../lib/istDate";

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

// IST day keys — the canonical calendar shared with session streaks,
// missions and the retention login-reward endpoint (lib/istDate.ts).
function getToday() { return istToday(); }
function yesterday() { return istToday(new Date(Date.now() - 86_400_000)); }

dailyRewardRouter.get("/daily-reward/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let [reward] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, req.userId)).limit(1);
    const today = getToday();

    if (!reward) {
      [reward] = await db.insert(loginRewardsTable).values({ userId: req.userId }).returning();
    }

    const alreadyClaimed = reward.lastClaimedDate === today;
    const streak = reward.claimStreak;
    const nextReward = STREAK_REWARDS[(streak % 7)] ?? STREAK_REWARDS[0];

    res.json({ alreadyClaimed, streak, nextReward, rewards: STREAK_REWARDS, totalClaimed: reward.totalClaimed });
  } catch {
    res.status(500).json({ error: "Failed to get status" });
  }
});

dailyRewardRouter.post("/daily-reward/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Transaction + row lock: concurrent claims (double-click, second tab, or
    // the parallel /retention/login-reward/claim endpoint on the same row)
    // serialize; the loser sees the already-claimed date and 400s.
    const claimed = await db.transaction(async (tx) => {
      let [reward] = await tx.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, req.userId)).limit(1).for("update");
      const today = getToday();

      if (!reward) {
        [reward] = await tx.insert(loginRewardsTable).values({ userId: req.userId }).returning();
      }

      if (reward.lastClaimedDate === today) return null;

      const isConsecutive = reward.lastClaimedDate === yesterday();
      const newStreak = isConsecutive ? (reward.claimStreak + 1) : 1;
      const rewardDef = STREAK_REWARDS[(newStreak - 1) % 7] ?? STREAK_REWARDS[0];

      await tx.update(loginRewardsTable).set({
        lastClaimedDate: today,
        claimStreak: newStreak,
        totalClaimed: (reward.totalClaimed ?? 0) + 1,
        updatedAt: new Date(),
      }).where(eq(loginRewardsTable.userId, req.userId));

      // Coins via the ledger (every mint writes coin_transactions), inside the tx.
      if (rewardDef.coins > 0) {
        await mintCoins(req.userId, rewardDef.coins, "daily_reward", {
          description: `Daily reward (streak ${newStreak}): +${rewardDef.coins} coins`,
          metadata: { streak: newStreak },
        }, tx);
      }
      const [w] = await tx.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1).for("update");
      if (w) {
        await tx.update(userWalletsTable).set({
          totalXp: w.totalXp + rewardDef.xp,
          updatedAt: new Date(),
        }).where(eq(userWalletsTable.userId, req.userId));
      }

      await tx.insert(notificationsTable).values({
        userId: req.userId,
        type: "daily_reward",
        title: `Daily Reward — ${rewardDef.label}`,
        message: `You earned ${rewardDef.coins} coins and ${rewardDef.xp} XP! Streak: ${newStreak} days.`,
      });

      return { newStreak, rewardDef };
    });

    if (!claimed) return res.status(400).json({ error: "Already claimed today" });

    res.json({ success: true, streak: claimed.newStreak, reward: claimed.rewardDef });
  } catch (err) {
    res.status(500).json({ error: "Failed to claim reward" });
  }
});
