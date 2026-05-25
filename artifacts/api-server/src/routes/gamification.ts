import { Router } from "express";
import { db, userWalletsTable, userBadgesTable, usersTable, focusSessionsTable, studyStreaksTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: "time" | "streak" | "sessions" | "quality" | "special";
  icon: string;
  threshold: number;
  unit: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first_hour",    name: "First Hour",       description: "Accumulate 1 hour of focus",        tier: "bronze",    category: "time",     icon: "⏱️", threshold: 60,    unit: "totalMinutes" },
  { id: "ten_hours",     name: "Ten Hour Club",     description: "Accumulate 10 hours of focus",      tier: "silver",    category: "time",     icon: "📚", threshold: 600,   unit: "totalMinutes" },
  { id: "century",       name: "Century Club",      description: "Accumulate 100 hours of focus",     tier: "gold",      category: "time",     icon: "🏅", threshold: 6000,  unit: "totalMinutes" },
  { id: "millennium",    name: "Millennium Sage",   description: "Reach 1000 hours of focus",         tier: "legendary", category: "time",     icon: "🧙", threshold: 60000, unit: "totalMinutes" },
  { id: "spark",         name: "Spark",             description: "Maintain a 3-day study streak",     tier: "bronze",    category: "streak",   icon: "✨", threshold: 3,     unit: "streak" },
  { id: "flame",         name: "Flame",             description: "Maintain a 7-day study streak",     tier: "silver",    category: "streak",   icon: "🔥", threshold: 7,     unit: "streak" },
  { id: "inferno",       name: "Inferno",           description: "Maintain a 30-day study streak",    tier: "gold",      category: "streak",   icon: "🌋", threshold: 30,    unit: "streak" },
  { id: "eternal_flame", name: "Eternal Flame",     description: "Maintain a 100-day study streak",   tier: "legendary", category: "streak",   icon: "☀️", threshold: 100,   unit: "streak" },
  { id: "on_target",     name: "On Target",         description: "Complete your first focus session", tier: "bronze",    category: "sessions", icon: "🎯", threshold: 1,     unit: "sessions" },
  { id: "consistent",   name: "Consistent",        description: "Complete 10 focus sessions",        tier: "silver",    category: "sessions", icon: "💪", threshold: 10,    unit: "sessions" },
  { id: "dedicated",     name: "Dedicated",         description: "Complete 50 focus sessions",        tier: "gold",      category: "sessions", icon: "⚡", threshold: 50,    unit: "sessions" },
  { id: "iron_will",     name: "Iron Will",         description: "Complete 200 focus sessions",       tier: "legendary", category: "sessions", icon: "🦾", threshold: 200,   unit: "sessions" },
  { id: "focused",       name: "Focused",           description: "Score 70+ on a session",            tier: "bronze",    category: "quality",  icon: "🎖️",threshold: 70,    unit: "maxScore" },
  { id: "sharp_mind",    name: "Sharp Mind",        description: "Score 85+ on a session",            tier: "silver",    category: "quality",  icon: "🧠", threshold: 85,    unit: "maxScore" },
  { id: "flow_state",    name: "Flow State",        description: "Score 95+ on a session",            tier: "gold",      category: "quality",  icon: "🌊", threshold: 95,    unit: "maxScore" },
  { id: "perfect",       name: "Perfect Focus",     description: "Achieve 5 sessions with score 95+", tier: "legendary", category: "quality",  icon: "💎", threshold: 5,     unit: "perfectSessions" },
  { id: "night_owl",     name: "Night Owl",         description: "Study after midnight",              tier: "bronze",    category: "special",  icon: "🦉", threshold: 1,     unit: "nightSessions" },
  { id: "early_bird",    name: "Early Bird",        description: "Study before 7 AM",                 tier: "bronze",    category: "special",  icon: "🌅", threshold: 1,     unit: "earlySessions" },
  { id: "marathon",      name: "Marathon",          description: "Complete a 2-hour+ session",        tier: "silver",    category: "special",  icon: "🏃", threshold: 120,   unit: "maxSessionMinutes" },
  { id: "daily_champ",   name: "Daily Champion",    description: "Focus for 5 hours in a single day", tier: "gold",      category: "special",  icon: "🏆", threshold: 300,   unit: "maxDayMinutes" },
];

async function computeUserStats(userId: string) {
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), eq(focusSessionsTable.mode, "focus")));
  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));

  const totalMinutes = Math.round(sessions.reduce((acc, s) => acc + s.durationSec, 0) / 60);
  const maxScore = sessions.reduce((max, s) => Math.max(max, s.focusScore ?? 0), 0);
  const perfectSessions = sessions.filter((s) => (s.focusScore ?? 0) >= 95).length;
  const maxSessionMinutes = Math.round(sessions.reduce((max, s) => Math.max(max, s.durationSec), 0) / 60);

  const dayTotals: Record<string, number> = {};
  let nightSessions = 0;
  let earlySessions = 0;
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const date = s.completedAt.toISOString().split("T")[0]!;
    dayTotals[date] = (dayTotals[date] ?? 0) + Math.round(s.durationSec / 60);
    const hour = s.completedAt.getHours();
    if (hour >= 0 && hour < 4) nightSessions++;
    if (hour < 7) earlySessions++;
  }
  const maxDayMinutes = Math.max(0, ...Object.values(dayTotals));

  return {
    totalMinutes,
    sessions: sessions.length,
    streak: streak?.longestStreak ?? 0,
    maxScore,
    perfectSessions,
    maxSessionMinutes,
    maxDayMinutes,
    nightSessions,
    earlySessions,
  };
}

router.get("/gamification/wallet", authMiddleware, async (req: any, res) => {
  try {
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));
    if (!wallet) {
      res.json({ coins: 0, totalXp: 0, weeklyXp: 0, rank: null });
      return;
    }
    const higher = await db.select({ cnt: sql<number>`count(*)` }).from(userWalletsTable)
      .where(sql`${userWalletsTable.weeklyXp} > ${wallet.weeklyXp}`);
    const rank = Number(higher[0]?.cnt ?? 0) + 1;
    res.json({ coins: wallet.coins, totalXp: wallet.totalXp, weeklyXp: wallet.weeklyXp, rank });
  } catch (err) {
    logger.error({ err }, "wallet error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/leaderboard", authMiddleware, async (req: any, res) => {
  try {
    const wallets = await db
      .select({
        userId: userWalletsTable.userId,
        coins: userWalletsTable.coins,
        totalXp: userWalletsTable.totalXp,
        weeklyXp: userWalletsTable.weeklyXp,
        name: usersTable.name,
        email: usersTable.email,
        isGuest: usersTable.isGuest,
      })
      .from(userWalletsTable)
      .leftJoin(usersTable, eq(userWalletsTable.userId, usersTable.id))
      .orderBy(desc(userWalletsTable.weeklyXp))
      .limit(50);

    const streaks = await db.select().from(studyStreaksTable);
    const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

    const leaderboard = wallets.map((w, idx) => ({
      rank: idx + 1,
      userId: w.userId,
      name: w.isGuest ? "Anonymous" : (w.name || w.email?.split("@")[0] || "User"),
      weeklyXp: w.weeklyXp,
      totalXp: w.totalXp,
      coins: w.coins,
      streak: streakMap.get(w.userId) ?? 0,
      isCurrentUser: w.userId === req.userId,
    }));

    res.json({ leaderboard });
  } catch (err) {
    logger.error({ err }, "leaderboard error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/badges", authMiddleware, async (req: any, res) => {
  try {
    const stats = await computeUserStats(req.userId);
    const unlockedRows = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, req.userId));
    const unlockedMap = new Map(unlockedRows.map((r) => [r.badgeId, r.unlockedAt]));

    const statMap: Record<string, number> = {
      totalMinutes:       stats.totalMinutes,
      sessions:           stats.sessions,
      streak:             stats.streak,
      maxScore:           stats.maxScore,
      perfectSessions:    stats.perfectSessions,
      maxSessionMinutes:  stats.maxSessionMinutes,
      maxDayMinutes:      stats.maxDayMinutes,
      nightSessions:      stats.nightSessions,
      earlySessions:      stats.earlySessions,
    };

    const newlyUnlocked: string[] = [];
    for (const badge of BADGE_DEFS) {
      const progress = statMap[badge.unit] ?? 0;
      if (progress >= badge.threshold && !unlockedMap.has(badge.id)) {
        await db.insert(userBadgesTable).values({ userId: req.userId, badgeId: badge.id });
        unlockedMap.set(badge.id, new Date());
        newlyUnlocked.push(badge.id);
      }
    }

    const badges = BADGE_DEFS.map((b) => ({
      ...b,
      unlocked: unlockedMap.has(b.id),
      unlockedAt: unlockedMap.get(b.id)?.toISOString() ?? null,
      progress: Math.min(statMap[b.unit] ?? 0, b.threshold),
      newlyUnlocked: newlyUnlocked.includes(b.id),
    }));

    res.json({ badges, stats });
  } catch (err) {
    logger.error({ err }, "badges error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as gamificationRouter };
