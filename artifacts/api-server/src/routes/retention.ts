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
import { mintCoins } from "../lib/coinLedger";
import { and, eq, isNull, sql, lt, gt, gte } from "drizzle-orm";
import {
  BATTLE_PASS_CURRENT_SEASON, BATTLE_PASS_TIERS, battlePassClaimId,
  calculateBattlePassTier, nextBattlePassThreshold,
} from "../lib/battlePass";

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
  if (reward.coins > 0) {
    await mintCoins(userId, reward.coins, "login_reward", {
      description: `Login reward: +${reward.coins} coins`,
      metadata: { claimStreak: 0 },
    });
  }
  await db.update(userWalletsTable).set({
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


retentionRouter.get("/retention/battle-pass", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  let [progress] = await db.select().from(battlePassProgressTable).where(eq(battlePassProgressTable.userId, userId)).limit(1);
  const currentTier = calculateBattlePassTier(progress?.seasonXp ?? 0);
  const nextTierXp = nextBattlePassThreshold(currentTier);
  res.json({
    season: BATTLE_PASS_CURRENT_SEASON,
    tier: currentTier,
    seasonXp: progress?.seasonXp,
    premiumUnlocked: progress?.premiumUnlocked,
    claimedTiers: progress?.claimedTiers ?? [],
    nextTierXp,
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
  const claimId = battlePassClaimId(tier, track);
  if ((progress.claimedTiers ?? []).includes(claimId)) return res.status(400).json({ error: "Already claimed" });
  if (calculateBattlePassTier(progress.seasonXp ?? 0) < tier) return res.status(400).json({ error: "Tier not reached" });

  const reward = track === "premium" ? tierDef.premiumReward : tierDef.freeReward;
  const newClaimed = [...(progress.claimedTiers ?? []), claimId];
  await db.update(battlePassProgressTable).set({ claimedTiers: newClaimed, updatedAt: new Date() }).where(eq(battlePassProgressTable.userId, userId));
  if (reward.coins > 0) {
    await mintCoins(userId, reward.coins, "battle_pass_reward", {
      description: `Battle pass tier ${tier} reward: +${reward.coins} coins`,
      metadata: { tier, track },
    });
  }
  await db.update(userWalletsTable).set({
    totalXp: sql`total_xp + ${reward.xp}`,
    updatedAt: new Date(),
  }).where(eq(userWalletsTable.userId, userId));

  res.json({ ok: true, reward });
});

// Battle-pass XP is advanced only by trusted server-side domain events.

// ─── REFERRAL SYSTEM ──────────────────────────────────────────────────────────

function createReferralCode(): string {
  return `FAX-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

retentionRouter.get("/referral/my-code", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    let [user] = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      referralCode: usersTable.referralCode,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.referralCode) {
      const [updated] = await db.update(usersTable)
        .set({ referralCode: createReferralCode() })
        .where(and(eq(usersTable.id, userId), isNull(usersTable.referralCode)))
        .returning({ referralCode: usersTable.referralCode });
      user = { ...user, referralCode: updated?.referralCode ?? user.referralCode };
    }
    if (!user.referralCode) return res.status(500).json({ error: "Unable to create referral code" });

    const baseUrl = (process.env["APP_URL"] || "https://focusarx.site").replace(/\/$/, "");
    res.json({
      code: user.referralCode,
      shareUrl: `${baseUrl}/?ref=${encodeURIComponent(user.referralCode)}`,
      name: user.name || user.email?.split("@")[0] || "You",
    });
  } catch {
    res.status(500).json({ error: "Unable to load referral code" });
  }
});

retentionRouter.post("/referral/apply", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rawCode = (req.body as { code?: unknown }).code;
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!/^FAX-[A-F0-9]{8}$/.test(code)) return res.status(400).json({ error: "Invalid referral code" });

  try {
    const result = await db.transaction(async (tx) => {
      const [referrer] = await tx.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.referralCode, code)).limit(1);
      if (!referrer || referrer.id === userId) return { error: "Invalid referral code", status: 400 } as const;

      // The conditional update is the concurrency guard: only one request can
      // transition referralAppliedAt from NULL and become eligible for rewards.
      const [applied] = await tx.update(usersTable).set({
        referredByUserId: referrer.id,
        referralAppliedAt: new Date(),
      }).where(and(eq(usersTable.id, userId), isNull(usersTable.referralAppliedAt)))
        .returning({ id: usersTable.id });
      if (!applied) return { error: "A referral code has already been applied", status: 409 } as const;

      const [applicantWallet] = await tx.select({ id: userWalletsTable.id })
        .from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
      const [referrerWallet] = await tx.select({ id: userWalletsTable.id })
        .from(userWalletsTable).where(eq(userWalletsTable.userId, referrer.id)).limit(1);
      if (!applicantWallet || !referrerWallet) throw new Error("Referral wallets are not initialized");

      // Coins + ledger rows join the outer transaction (pass tx through).
      await mintCoins(userId, 200, "referral_bonus", {
        description: "Referral bonus: +200 coins", metadata: { code },
      }, tx as never);
      await mintCoins(referrer.id, 500, "referral_bonus", {
        description: "Someone used your referral code: +500 coins", metadata: { code },
      }, tx as never);
      await tx.update(userWalletsTable).set({
        totalXp: sql`total_xp + 500`, updatedAt: new Date(),
      }).where(eq(userWalletsTable.userId, userId));
      await tx.update(userWalletsTable).set({
        totalXp: sql`total_xp + 1000`,
        weeklyXp: sql`weekly_xp + 1000`, updatedAt: new Date(),
      }).where(eq(userWalletsTable.userId, referrer.id));

      await tx.insert(notificationsTable).values([
        {
          userId, type: "referral", title: "Referral bonus applied! 🎉",
          message: "+200 coins and +500 XP for joining with a friend's code", data: { code },
        },
        {
          userId: referrer.id, type: "referral", title: "Someone used your referral code! 🎉",
          message: "+500 coins and +1000 XP — thanks for spreading the word!",
          data: { code, newUserId: userId },
        },
      ]);
      return { ok: true } as const;
    });

    if (!("ok" in result)) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, coins: 200, xp: 500 });
  } catch {
    res.status(500).json({ error: "Unable to apply referral code" });
  }
});
