import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  loginRewardsTable, userWalletsTable, studyStreaksTable,
  freezeTokensTable, notificationsTable, battlePassProgressTable,
  usersTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { sendPush } from "../lib/pushSender";
import { logger } from "../lib/logger";
import { eq, and, sql, lt, gt, gte } from "drizzle-orm";

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

retentionRouter.get("/retention/login-reward", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = todayStr();
  let [record] = await db.select().from(loginRewardsTable).where(eq(loginRewardsTable.userId, userId)).limit(1);
  const alreadyClaimed = record?.lastClaimedDate === today;
  const streak = record?.claimStreak ?? 0;
  const nextDay = ((streak % 7) + 1);
  const reward = DAILY_REWARDS[nextDay - 1] ?? DAILY_REWARDS[0];
  res.json({ alreadyClaimed, claimStreak: streak, totalClaimed: record?.totalClaimed ?? 0, nextReward: reward, calendar: DAILY_REWARDS });
});

retentionRouter.post("/retention/login-reward/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
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

retentionRouter.get("/retention/freeze-tokens", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  res.json({ tokens: record?.tokensAvailable ?? 0, used: record?.tokensUsed ?? 0 });
});

retentionRouter.post("/retention/freeze-tokens/use", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [record] = await db.select().from(freezeTokensTable).where(eq(freezeTokensTable.userId, userId)).limit(1);
  if (!record || (record.tokensAvailable ?? 0) <= 0) return res.status(400).json({ error: "No freeze tokens" });
  await db.update(freezeTokensTable).set({ tokensAvailable: sql`tokens_available - 1`, tokensUsed: sql`tokens_used + 1`, updatedAt: new Date() }).where(eq(freezeTokensTable.userId, userId));
  res.json({ ok: true });
});

// ─── RE-ENGAGEMENT CRON (audit Gap 1) ──────────────────────────────────
// Win-back pushes for users whose streak went cold. Designed to be hit once
// a day by Vercel Cron (see vercel.json): Vercel automatically attaches
// `Authorization: Bearer $CRON_SECRET` when that env var is set on the
// project. Safe no-op when the secret is not configured.
retentionRouter.get("/retention/reengage/run", async (req: Request, res: Response) => {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (req.headers["authorization"] !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });

  try {
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const cutoff3 = daysAgo(3);
    const cutoff7 = daysAgo(7);
    const dedupeWindowStart = new Date(Date.now() - 2 * 86_400_000);

    // At-risk users: have a real streak but nothing logged in 3+ days.
    const candidates = await db
      .select({
        userId: studyStreaksTable.userId,
        streak: studyStreaksTable.currentStreak,
        lastStudyDate: studyStreaksTable.lastStudyDate,
      })
      .from(studyStreaksTable)
      .where(and(gt(studyStreaksTable.currentStreak, 0), lt(studyStreaksTable.lastStudyDate, cutoff3)))
      .orderBy(studyStreaksTable.lastStudyDate)
      .limit(300);

    let sentAtRisk = 0;
    let sentWinBack = 0;

    for (const candidate of candidates) {
      // Never nag the same user more than once every 48 hours.
      const [recent] = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, candidate.userId),
            eq(notificationsTable.type, "reengage"),
            gte(notificationsTable.createdAt, dedupeWindowStart),
          ),
        )
        .limit(1);
      if (recent) continue;

      const longGone = !candidate.lastStudyDate || candidate.lastStudyDate <= cutoff7;
      if (longGone) {
        await sendPush(candidate.userId, {
          title: "We saved your progress \u{1F4BE}",
          body: `Your ${candidate.streak}-day streak is waiting — one 5-minute session restarts it today.`,
          url: "/",
        });
      } else {
        await sendPush(candidate.userId, {
          title: `Your ${candidate.streak}-day streak is at risk \u{1F525}`,
          body: "A short session today keeps it alive. You've got this.",
          url: "/",
        });
      }

      await db.insert(notificationsTable).values({
        userId: candidate.userId,
        type: "reengage",
        title: longGone ? "We saved your progress" : "Streak at risk",
        message: longGone
          ? `One 5-minute session restarts your ${candidate.streak}-day streak.`
          : `Complete a session today to protect your ${candidate.streak}-day streak.`,
        data: { bucket: longGone ? "winback_7plus" : "at_risk_3days", streak: candidate.streak },
      });

      if (longGone) sentWinBack += 1;
      else sentAtRisk += 1;
    }

    logger.info({ candidates: candidates.length, sentAtRisk, sentWinBack }, "reengage run complete");
    res.json({ ok: true, candidates: candidates.length, sentAtRisk, sentWinBack });
  } catch (err) {
    logger.error({ err }, "reengage run error");
    res.status(500).json({ error: "Internal error" });
  }
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

retentionRouter.get("/retention/battle-pass", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  const currentTierDef = progress ? BATTLE_PASS_TIERS.find(t => t.tier > (progress?.tier ?? 0)) : BATTLE_PASS_TIERS[0];
  res.json({
    season: BATTLE_PASS_CURRENT_SEASON,
    tier: progress?.tier ?? 0,
    seasonXp: progress?.seasonXp,
    premiumUnlocked: progress?.premiumUnlocked,
    claimedTiers: progress?.claimedTiers ?? [],
    nextTierXp: currentTierDef?.xpRequired ?? 10000,
    tiers: BATTLE_PASS_TIERS,
    endsAt: "2026-09-30",
  });
});

retentionRouter.post("/retention/battle-pass/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
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

retentionRouter.post("/retention/battle-pass/advance", authMiddleware, async (req: AuthRequest, res: Response) => {
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

retentionRouter.get("/referral/my-code", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const code = makeReferralCode(userId);
  const shareUrl = `${process.env["APP_URL"] || "https://focusarx.replit.app"}/?ref=${code}`;
  res.json({ code, shareUrl, name: user.name || user.email?.split("@")[0] || "You" });
});

retentionRouter.post("/referral/apply", authMiddleware, async (req: AuthRequest, res: Response) => {
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
