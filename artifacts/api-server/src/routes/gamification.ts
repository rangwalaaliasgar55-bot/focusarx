import { Router } from "express";
import { db, userWalletsTable, userBadgesTable, usersTable, focusSessionsTable, studyStreaksTable, tasksTable, coinTransactionsTable } from "@workspace/db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

function optionalAuthMiddleware(req: any, _res: any, next: any) {
  req.userId = extractUserId(req) ?? null;
  next();
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: "time" | "streak" | "sessions" | "quality" | "special" | "tasks" | "social" | "milestones";
  icon: string;
  threshold: number;
  unit: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  // ── TIME BADGES ──────────────────────────────────────────────────────────────
  { id: "first_hour",      name: "First Hour",          description: "Accumulate 1 hour of focus",             tier: "bronze",    category: "time",       icon: "⏱️",  threshold: 60,     unit: "totalMinutes"     },
  { id: "five_hours",      name: "Five Hour Club",      description: "Accumulate 5 hours of focus",            tier: "bronze",    category: "time",       icon: "📖",  threshold: 300,    unit: "totalMinutes"     },
  { id: "ten_hours",       name: "Ten Hour Club",       description: "Accumulate 10 hours of focus",           tier: "silver",    category: "time",       icon: "📚",  threshold: 600,    unit: "totalMinutes"     },
  { id: "twenty_five_h",   name: "Quarter Century",     description: "Accumulate 25 hours of focus",           tier: "silver",    category: "time",       icon: "🎖️",  threshold: 1500,   unit: "totalMinutes"     },
  { id: "fifty_hours",     name: "Fifty Hour Legend",   description: "Accumulate 50 hours of focus",           tier: "gold",      category: "time",       icon: "🌟",  threshold: 3000,   unit: "totalMinutes"     },
  { id: "century",         name: "Century Club",        description: "Accumulate 100 hours of focus",          tier: "gold",      category: "time",       icon: "🏅",  threshold: 6000,   unit: "totalMinutes"     },
  { id: "two_fifty_h",     name: "Deep Work Master",    description: "Accumulate 250 hours of focus",          tier: "gold",      category: "time",       icon: "🧘",  threshold: 15000,  unit: "totalMinutes"     },
  { id: "five_hundred_h",  name: "Half Millennium",     description: "Accumulate 500 hours of focus",          tier: "legendary", category: "time",       icon: "👁️",  threshold: 30000,  unit: "totalMinutes"     },
  { id: "millennium",      name: "Millennium Sage",     description: "Reach 1000 hours of focus",              tier: "legendary", category: "time",       icon: "🧙",  threshold: 60000,  unit: "totalMinutes"     },

  // ── STREAK BADGES ────────────────────────────────────────────────────────────
  { id: "spark",           name: "Spark",               description: "Maintain a 3-day study streak",          tier: "bronze",    category: "streak",     icon: "✨",  threshold: 3,      unit: "streak"           },
  { id: "week_warrior",    name: "Week Warrior",        description: "Maintain a 5-day study streak",          tier: "bronze",    category: "streak",     icon: "🛡️",  threshold: 5,      unit: "streak"           },
  { id: "flame",           name: "Flame",               description: "Maintain a 7-day study streak",          tier: "silver",    category: "streak",     icon: "🔥",  threshold: 7,      unit: "streak"           },
  { id: "fortnight",       name: "Fortnight Force",     description: "Maintain a 14-day study streak",         tier: "silver",    category: "streak",     icon: "⚡",  threshold: 14,     unit: "streak"           },
  { id: "month_master",    name: "Month Master",        description: "Maintain a 21-day study streak",         tier: "gold",      category: "streak",     icon: "📅",  threshold: 21,     unit: "streak"           },
  { id: "inferno",         name: "Inferno",             description: "Maintain a 30-day study streak",         tier: "gold",      category: "streak",     icon: "🌋",  threshold: 30,     unit: "streak"           },
  { id: "sixty_streak",    name: "60-Day Titan",        description: "Maintain a 60-day study streak",         tier: "gold",      category: "streak",     icon: "⚔️",  threshold: 60,     unit: "streak"           },
  { id: "eternal_flame",   name: "Eternal Flame",       description: "Maintain a 100-day study streak",        tier: "legendary", category: "streak",     icon: "☀️",  threshold: 100,    unit: "streak"           },
  { id: "immortal",        name: "Immortal",            description: "Maintain a 365-day study streak",        tier: "legendary", category: "streak",     icon: "👑",  threshold: 365,    unit: "streak"           },

  // ── SESSION COUNT BADGES ──────────────────────────────────────────────────────
  { id: "on_target",       name: "On Target",           description: "Complete your first focus session",      tier: "bronze",    category: "sessions",   icon: "🎯",  threshold: 1,      unit: "sessions"         },
  { id: "five_sessions",   name: "Getting Started",     description: "Complete 5 focus sessions",              tier: "bronze",    category: "sessions",   icon: "🌱",  threshold: 5,      unit: "sessions"         },
  { id: "consistent",      name: "Consistent",          description: "Complete 10 focus sessions",             tier: "silver",    category: "sessions",   icon: "💪",  threshold: 10,     unit: "sessions"         },
  { id: "twenty_five_s",   name: "Quarter Century",     description: "Complete 25 focus sessions",             tier: "silver",    category: "sessions",   icon: "🎗️",  threshold: 25,     unit: "sessions"         },
  { id: "dedicated",       name: "Dedicated",           description: "Complete 50 focus sessions",             tier: "gold",      category: "sessions",   icon: "⚡",  threshold: 50,     unit: "sessions"         },
  { id: "centurion",       name: "Centurion",           description: "Complete 100 focus sessions",            tier: "gold",      category: "sessions",   icon: "🏛️",  threshold: 100,    unit: "sessions"         },
  { id: "iron_will",       name: "Iron Will",           description: "Complete 200 focus sessions",            tier: "gold",      category: "sessions",   icon: "🦾",  threshold: 200,    unit: "sessions"         },
  { id: "five_hundred_s",  name: "Five Hundred Strong", description: "Complete 500 focus sessions",            tier: "legendary", category: "sessions",   icon: "💥",  threshold: 500,    unit: "sessions"         },
  { id: "thousand_sess",   name: "Thousand Warrior",    description: "Complete 1000 focus sessions",           tier: "legendary", category: "sessions",   icon: "🌌",  threshold: 1000,   unit: "sessions"         },

  // ── QUALITY BADGES ────────────────────────────────────────────────────────────
  { id: "focused",         name: "Focused",             description: "Score 70+ on a session",                 tier: "bronze",    category: "quality",    icon: "🎖️",  threshold: 70,     unit: "maxScore"         },
  { id: "sharp_mind",      name: "Sharp Mind",          description: "Score 85+ on a session",                 tier: "silver",    category: "quality",    icon: "🧠",  threshold: 85,     unit: "maxScore"         },
  { id: "flow_state",      name: "Flow State",          description: "Score 95+ on a session",                 tier: "gold",      category: "quality",    icon: "🌊",  threshold: 95,     unit: "maxScore"         },
  { id: "perfect",         name: "Perfect Focus",       description: "Achieve 5 sessions with score 95+",      tier: "gold",      category: "quality",    icon: "💎",  threshold: 5,      unit: "perfectSessions"  },
  { id: "perfect_10",      name: "Perfection Habit",    description: "Achieve 10 sessions with score 95+",     tier: "legendary", category: "quality",    icon: "🌠",  threshold: 10,     unit: "perfectSessions"  },
  { id: "perfect_25",      name: "Elite Performer",     description: "Achieve 25 sessions with score 95+",     tier: "legendary", category: "quality",    icon: "🏆",  threshold: 25,     unit: "perfectSessions"  },

  // ── SPECIAL / TIME-OF-DAY BADGES ─────────────────────────────────────────────
  { id: "night_owl",       name: "Night Owl",           description: "Study after midnight",                   tier: "bronze",    category: "special",    icon: "🦉",  threshold: 1,      unit: "nightSessions"    },
  { id: "night_owl_10",    name: "Night Owl Pro",       description: "Study after midnight 10 times",          tier: "silver",    category: "special",    icon: "🌙",  threshold: 10,     unit: "nightSessions"    },
  { id: "early_bird",      name: "Early Bird",          description: "Study before 7 AM",                      tier: "bronze",    category: "special",    icon: "🌅",  threshold: 1,      unit: "earlySessions"    },
  { id: "early_bird_10",   name: "Dawn Warrior",        description: "Study before 7 AM 10 times",             tier: "silver",    category: "special",    icon: "☀️",  threshold: 10,     unit: "earlySessions"    },
  { id: "marathon",        name: "Marathon",            description: "Complete a 2-hour+ session",             tier: "silver",    category: "special",    icon: "🏃",  threshold: 120,    unit: "maxSessionMinutes"},
  { id: "ultra_marathon",  name: "Ultra Marathon",      description: "Complete a 3-hour+ session",             tier: "gold",      category: "special",    icon: "🦅",  threshold: 180,    unit: "maxSessionMinutes"},
  { id: "daily_champ",     name: "Daily Champion",      description: "Focus for 5 hours in a single day",      tier: "gold",      category: "special",    icon: "🏆",  threshold: 300,    unit: "maxDayMinutes"    },
  { id: "ultra_day",       name: "Ultra Day",           description: "Focus for 8 hours in a single day",      tier: "legendary", category: "special",    icon: "🔱",  threshold: 480,    unit: "maxDayMinutes"    },
  { id: "weekend_warrior", name: "Weekend Warrior",     description: "Study 10 sessions on weekends",          tier: "silver",    category: "special",    icon: "⚔️",  threshold: 10,     unit: "weekendSessions"  },
  { id: "lunch_learner",   name: "Lunch Learner",       description: "Study during lunch hours (11AM-1PM) 5x", tier: "bronze",    category: "special",    icon: "🥗",  threshold: 5,      unit: "lunchSessions"    },

  // ── TASK BADGES ───────────────────────────────────────────────────────────────
  { id: "task_starter",    name: "Task Starter",        description: "Complete your first task",               tier: "bronze",    category: "tasks",      icon: "✅",  threshold: 1,      unit: "totalTasks"       },
  { id: "task_ten",        name: "Task Achiever",       description: "Complete 10 tasks",                      tier: "bronze",    category: "tasks",      icon: "📝",  threshold: 10,     unit: "totalTasks"       },
  { id: "task_fifty",      name: "Task Crusher",        description: "Complete 50 tasks",                      tier: "silver",    category: "tasks",      icon: "💼",  threshold: 50,     unit: "totalTasks"       },
  { id: "task_hundred",    name: "Task Master",         description: "Complete 100 tasks",                     tier: "gold",      category: "tasks",      icon: "🎯",  threshold: 100,    unit: "totalTasks"       },
  { id: "task_five_hundo", name: "Task Legend",         description: "Complete 500 tasks",                     tier: "legendary", category: "tasks",      icon: "🏆",  threshold: 500,    unit: "totalTasks"       },

  // ── MILESTONE BADGES ──────────────────────────────────────────────────────────
  { id: "level_5",         name: "Apprentice",          description: "Reach Level 5",                          tier: "bronze",    category: "milestones", icon: "📈",  threshold: 5,      unit: "level"            },
  { id: "level_10",        name: "Journeyman",          description: "Reach Level 10",                         tier: "silver",    category: "milestones", icon: "🚀",  threshold: 10,     unit: "level"            },
  { id: "level_25",        name: "Expert",              description: "Reach Level 25",                         tier: "silver",    category: "milestones", icon: "🧩",  threshold: 25,     unit: "level"            },
  { id: "level_50",        name: "Master",              description: "Reach Level 50",                         tier: "gold",      category: "milestones", icon: "🌟",  threshold: 50,     unit: "level"            },
  { id: "level_100",       name: "Grandmaster",         description: "Reach Level 100",                        tier: "legendary", category: "milestones", icon: "👑",  threshold: 100,    unit: "level"            },
  { id: "xp_1k",           name: "XP Hunter",           description: "Earn 1,000 total XP",                    tier: "bronze",    category: "milestones", icon: "💫",  threshold: 1000,   unit: "totalXp"          },
  { id: "xp_10k",          name: "XP Collector",        description: "Earn 10,000 total XP",                   tier: "silver",    category: "milestones", icon: "⭐",  threshold: 10000,  unit: "totalXp"          },
  { id: "xp_50k",          name: "XP Champion",         description: "Earn 50,000 total XP",                   tier: "gold",      category: "milestones", icon: "🌟",  threshold: 50000,  unit: "totalXp"          },
  { id: "xp_100k",         name: "XP Legend",           description: "Earn 100,000 total XP",                  tier: "legendary", category: "milestones", icon: "💎",  threshold: 100000, unit: "totalXp"          },
  { id: "coin_1k",         name: "Coin Collector",      description: "Accumulate 1,000 coins",                 tier: "bronze",    category: "milestones", icon: "🪙",  threshold: 1000,   unit: "totalCoins"       },
  { id: "coin_10k",        name: "Coin Hoarder",        description: "Accumulate 10,000 coins",                tier: "silver",    category: "milestones", icon: "💰",  threshold: 10000,  unit: "totalCoins"       },
  { id: "coin_50k",        name: "Coin Mogul",          description: "Accumulate 50,000 coins",                tier: "gold",      category: "milestones", icon: "🏦",  threshold: 50000,  unit: "totalCoins"       },
];

async function computeUserStats(userId: string) {
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), eq(focusSessionsTable.mode, "focus")));
  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));
  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));

  const allTasks = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, true)));

  const totalMinutes = Math.round(sessions.reduce((acc, s) => acc + s.durationSec, 0) / 60);
  const maxScore = sessions.reduce((max, s) => Math.max(max, s.focusScore ?? 0), 0);
  const perfectSessions = sessions.filter((s) => (s.focusScore ?? 0) >= 95).length;
  const maxSessionMinutes = Math.round(sessions.reduce((max, s) => Math.max(max, s.durationSec), 0) / 60);

  const dayTotals: Record<string, number> = {};
  let nightSessions = 0;
  let earlySessions = 0;
  let weekendSessions = 0;
  let lunchSessions = 0;

  for (const s of sessions) {
    if (!s.completedAt) continue;
    const date = s.completedAt.toISOString().split("T")[0]!;
    dayTotals[date] = (dayTotals[date] ?? 0) + Math.round(s.durationSec / 60);
    const hour = s.completedAt.getHours();
    const dow = s.completedAt.getDay();
    if (hour >= 0 && hour < 4) nightSessions++;
    if (hour < 7) earlySessions++;
    if (dow === 0 || dow === 6) weekendSessions++;
    if (hour >= 11 && hour < 13) lunchSessions++;
  }
  const maxDayMinutes = Math.max(0, ...Object.values(dayTotals));

  const currentLevel = wallet ? (Math.floor(Math.sqrt(wallet.totalXp / 100)) + 1) : 1;

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
    weekendSessions,
    lunchSessions,
    totalTasks: allTasks.length,
    level: currentLevel,
    totalXp: wallet?.totalXp ?? 0,
    totalCoins: wallet?.coins ?? 0,
  };
}

router.get("/gamification/wallet", authMiddleware, async (req: any, res) => {
  try {
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId));
    if (!wallet) {
      res.json({ coins: 0, totalXp: 0, weeklyXp: 0, rank: null, level: 1, prestige: 0 });
      return;
    }
    const level = Math.floor(Math.sqrt(wallet.totalXp / 100)) + 1;
    const higher = await db.select({ cnt: sql<number>`count(*)` }).from(userWalletsTable)
      .where(sql`${userWalletsTable.weeklyXp} > ${wallet.weeklyXp}`);
    const rank = Number(higher[0]?.cnt ?? 0) + 1;
    const xpForCurrentLevel = (level - 1) ** 2 * 100;
    const xpForNextLevel = level ** 2 * 100;
    const xpInLevel = wallet.totalXp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    res.json({
      coins: wallet.coins,
      totalXp: wallet.totalXp,
      weeklyXp: wallet.weeklyXp,
      rank,
      level,
      prestige: wallet.prestige ?? 0,
      xpInLevel,
      xpNeeded,
      levelProgress: Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)),
    });
  } catch (err) {
    logger.error({ err }, "wallet error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/leaderboard", optionalAuthMiddleware, async (req: any, res) => {
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

    const leaderboard = wallets.map((w, idx) => {
      const xp = w.totalXp ?? 0;
      const level = Math.floor(Math.sqrt(xp / 100)) + 1;
      return {
        rank: idx + 1,
        userId: w.userId,
        name: w.isGuest ? "Anonymous" : (w.name || w.email?.split("@")[0] || "User"),
        weeklyXp: w.weeklyXp,
        totalXp: w.totalXp,
        coins: w.coins,
        streak: streakMap.get(w.userId) ?? 0,
        level,
        isCurrentUser: w.userId === req.userId,
      };
    });

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
      weekendSessions:    stats.weekendSessions,
      lunchSessions:      stats.lunchSessions,
      totalTasks:         stats.totalTasks,
      level:              stats.level,
      totalXp:            stats.totalXp,
      totalCoins:         stats.totalCoins,
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

    const unlockedCount = badges.filter((b) => b.unlocked).length;
    const completionPct = Math.round((unlockedCount / BADGE_DEFS.length) * 100);

    res.json({ badges, stats, unlockedCount, totalCount: BADGE_DEFS.length, completionPct });
  } catch (err) {
    logger.error({ err }, "badges error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/gamification/wallet/transactions", authMiddleware, async (req: any, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = Number(req.query.offset) || 0;

    const txs = await db.select().from(coinTransactionsTable)
      .where(eq(coinTransactionsTable.userId, req.userId))
      .orderBy(desc(coinTransactionsTable.createdAt))
      .limit(limit).offset(offset);

    const totalEarned = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const [wallet] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable)
      .where(eq(userWalletsTable.userId, req.userId));

    res.json({
      transactions: txs,
      totalEarned,
      totalSpent,
      currentBalance: wallet?.coins ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "wallet transactions error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as gamificationRouter };
