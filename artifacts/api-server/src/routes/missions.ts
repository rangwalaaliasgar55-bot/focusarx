import { Response, Router } from "express";
import { db, userMissionProgressTable, userWalletsTable, usersTable, platformMetaTable } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { mintCoins } from "../lib/coinLedger";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { dayKeyInZone, shiftDayKey, resolveUserZone, LEGACY_FALLBACK_ZONE } from "../lib/timezone";
import { generateAi } from "../lib/aiProvider";

const router = Router();

export interface MissionDef {
  key: string;
  title: string;
  description: string;
  type: "daily" | "weekly";
  category: "focus" | "tasks" | "streak" | "quality" | "social" | "special";
  xpReward: number;
  coinReward: number;
  targetValue: number;
  unit: "sessions" | "minutes" | "tasks" | "streak_days" | "score" | "days";
  icon: string;
  difficulty: "easy" | "medium" | "hard" | "epic";
}

export const DAILY_MISSIONS: MissionDef[] = [
  { key: "daily_first_session",   title: "First Strike",         description: "Complete your first focus session today",           type: "daily",  category: "focus",   xpReward: 150,  coinReward: 75,  targetValue: 1,   unit: "sessions", icon: "⚡", difficulty: "easy"   },
  { key: "daily_two_sessions",    title: "Double Down",          description: "Complete 2 focus sessions today",                   type: "daily",  category: "focus",   xpReward: 250,  coinReward: 100, targetValue: 2,   unit: "sessions", icon: "🔥", difficulty: "easy"   },
  { key: "daily_three_sessions",  title: "Hat Trick",            description: "Complete 3 focus sessions today",                   type: "daily",  category: "focus",   xpReward: 400,  coinReward: 150, targetValue: 3,   unit: "sessions", icon: "🎩", difficulty: "medium" },
  { key: "daily_five_sessions",   title: "Power Hour Champion",  description: "Complete 5 focus sessions today",                   type: "daily",  category: "focus",   xpReward: 700,  coinReward: 300, targetValue: 5,   unit: "sessions", icon: "💪", difficulty: "hard"   },
  { key: "daily_30_minutes",      title: "Warm Up",              description: "Accumulate 30 minutes of focus time today",        type: "daily",  category: "focus",   xpReward: 200,  coinReward: 80,  targetValue: 30,  unit: "minutes",  icon: "⏱️", difficulty: "easy"   },
  { key: "daily_60_minutes",      title: "Deep Worker",          description: "Accumulate 60 minutes of focus time today",        type: "daily",  category: "focus",   xpReward: 400,  coinReward: 160, targetValue: 60,  unit: "minutes",  icon: "🧠", difficulty: "medium" },
  { key: "daily_120_minutes",     title: "Flow State",           description: "Accumulate 2 hours of focus time today",           type: "daily",  category: "focus",   xpReward: 750,  coinReward: 300, targetValue: 120, unit: "minutes",  icon: "🌊", difficulty: "hard"   },
  { key: "daily_task_1",          title: "Task Starter",         description: "Complete 1 task today",                            type: "daily",  category: "tasks",   xpReward: 100,  coinReward: 40,  targetValue: 1,   unit: "tasks",    icon: "✅", difficulty: "easy"   },
  { key: "daily_task_3",          title: "Task Crusher",         description: "Complete 3 tasks today",                           type: "daily",  category: "tasks",   xpReward: 300,  coinReward: 120, targetValue: 3,   unit: "tasks",    icon: "🎯", difficulty: "medium" },
  { key: "daily_task_5",          title: "Productivity Machine", description: "Complete 5 tasks today",                           type: "daily",  category: "tasks",   xpReward: 500,  coinReward: 200, targetValue: 5,   unit: "tasks",    icon: "🤖", difficulty: "hard"   },
  { key: "daily_quality_80",      title: "Quality Focus",        description: "Achieve an 80+ focus score in any session",        type: "daily",  category: "quality", xpReward: 350,  coinReward: 150, targetValue: 80,  unit: "score",    icon: "⭐", difficulty: "medium" },
  { key: "daily_quality_90",      title: "Elite Focus",          description: "Achieve a 90+ focus score in any session",         type: "daily",  category: "quality", xpReward: 600,  coinReward: 250, targetValue: 90,  unit: "score",    icon: "💎", difficulty: "hard"   },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { key: "weekly_sessions_5",     title: "Weekly Warrior",       description: "Complete 5 focus sessions this week",              type: "weekly", category: "focus",   xpReward: 500,  coinReward: 200,  targetValue: 5,   unit: "sessions", icon: "⚔️", difficulty: "easy"   },
  { key: "weekly_sessions_15",    title: "Consistency King",     description: "Complete 15 focus sessions this week",             type: "weekly", category: "focus",   xpReward: 1200, coinReward: 500,  targetValue: 15,  unit: "sessions", icon: "👑", difficulty: "medium" },
  { key: "weekly_sessions_30",    title: "Unstoppable Force",    description: "Complete 30 focus sessions this week",             type: "weekly", category: "focus",   xpReward: 2500, coinReward: 1000, targetValue: 30,  unit: "sessions", icon: "🌪️", difficulty: "hard"   },
  { key: "weekly_minutes_300",    title: "5-Hour Week",          description: "Accumulate 5 hours of focus this week",            type: "weekly", category: "focus",   xpReward: 800,  coinReward: 350,  targetValue: 300, unit: "minutes",  icon: "⏰", difficulty: "easy"   },
  { key: "weekly_minutes_600",    title: "10-Hour Week",         description: "Accumulate 10 hours of focus this week",           type: "weekly", category: "focus",   xpReward: 1800, coinReward: 750,  targetValue: 600, unit: "minutes",  icon: "🔥", difficulty: "medium" },
  { key: "weekly_minutes_1200",   title: "20-Hour Ultra",        description: "Accumulate 20 hours of focus this week",           type: "weekly", category: "focus",   xpReward: 4000, coinReward: 1500, targetValue: 1200,unit: "minutes",  icon: "🚀", difficulty: "epic"   },
  { key: "weekly_tasks_10",       title: "Task Master",          description: "Complete 10 tasks this week",                      type: "weekly", category: "tasks",   xpReward: 600,  coinReward: 250,  targetValue: 10,  unit: "tasks",    icon: "📋", difficulty: "easy"   },
  { key: "weekly_tasks_25",       title: "Task Legend",          description: "Complete 25 tasks this week",                      type: "weekly", category: "tasks",   xpReward: 1500, coinReward: 600,  targetValue: 25,  unit: "tasks",    icon: "🏆", difficulty: "hard"   },
  { key: "weekly_streak_5",       title: "Streak Keeper",        description: "Study 5 different days this week",                 type: "weekly", category: "streak",  xpReward: 1000, coinReward: 400,  targetValue: 5,   unit: "days",     icon: "📅", difficulty: "medium" },
  { key: "weekly_streak_7",       title: "Perfect Week",         description: "Study every single day this week",                 type: "weekly", category: "streak",  xpReward: 3000, coinReward: 1200, targetValue: 7,   unit: "days",     icon: "✨", difficulty: "epic"   },
];

export const ALL_MISSIONS = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS];

/**
 * Period keys in the user's own calendar zone — the same zone streaks and
 * productivity logs use. Before this the server's UTC date was used, so a
 * user in India lost their daily missions at 05:30 in the morning and a user
 * in California saw "today" roll over at 4-5 pm.
 */
function getPeriodStart(type: "daily" | "weekly", zone: string, now: number = Date.now()): string {
  const today = dayKeyInZone(now, zone);
  if (type === "daily") return today;
  let weekday = 1;
  try {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(new Date(now));
    weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[day] ?? 1;
  } catch { /* Monday */ }
  return shiftDayKey(today, -(weekday - 1));
}

async function zoneFor(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ timezone: usersTable.timezone }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return resolveUserZone(user?.timezone);
  } catch {
    return LEGACY_FALLBACK_ZONE;
  }
}

/**
 * The mission everybody is pointed at today.
 *
 * A list of twelve missions is a menu, and a menu is not leadership — nobody
 * races a menu. One mission is featured for the whole platform, Gemini picks
 * which one and says why in a line, and the response carries how many learners
 * have already finished it today. That is the "everyone is on this one"
 * feeling, and it doubles as the answer to "what should I do right now?".
 *
 * Chosen once per IST day and cached in `platform_meta`, so the pick is stable
 * across refreshes and across the fleet. Gemini's answer is validated against
 * the mission catalogue; anything unrecognised falls back to a deterministic
 * daily rotation, which is also the path with no AI key configured.
 */
async function featuredMissionForToday(today: string): Promise<{ key: string; reason: string; source: string }> {
  const metaKey = `mission_of_day_${today}`;
  try {
    const [existing] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable).where(eq(platformMetaTable.key, metaKey)).limit(1);
    const cached = existing?.value as { key?: string; reason?: string; source?: string } | undefined;
    if (cached?.key && ALL_MISSIONS.some(m => m.key === cached.key)) {
      return { key: cached.key, reason: cached.reason ?? "", source: cached.source ?? "cache" };
    }
  } catch { /* fall through to a fresh pick */ }

  const fallbackIndex = Number(today.replace(/-/g, "")) % ALL_MISSIONS.length;
  let pick = { key: ALL_MISSIONS[fallbackIndex]!.key, reason: "Today's rotation pick — steady, repeatable progress.", source: "rotation" };

  try {
    const menu = ALL_MISSIONS.map(m => ({ key: m.key, title: m.title, description: m.description, type: m.type, xp: m.xpReward }));
    const result = await generateAi({
      purpose: "mission_of_day",
      prompt: `You are the daily mission officer for FocusArx, a focus app for Indian exam aspirants (JEE/NEET/UPSC/CA/boards). Pick exactly ONE mission from the menu for every learner today. Return ONLY JSON: {"key": "<mission key from the menu>", "reason": "<one motivating line, <=120 chars, why today>"}.\nMENU: ${JSON.stringify(menu)}`,
      maxTokens: 200,
    });
    if (result) {
      const start = result.text.indexOf("{");
      const end = result.text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(result.text.slice(start, end + 1)) as { key?: string; reason?: string };
        if (parsed.key && ALL_MISSIONS.some(m => m.key === parsed.key)) {
          pick = {
            key: parsed.key,
            reason: (parsed.reason ?? "").trim().slice(0, 160) || pick.reason,
            source: result.provider,
          };
        }
      }
    }
  } catch { /* keep the rotation pick */ }

  try {
    await db.insert(platformMetaTable).values({ key: metaKey, value: pick }).onConflictDoNothing();
  } catch { /* the pick still counts for this request */ }
  return pick;
}

router.get("/missions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const zone = await zoneFor(req.userId);
    const today = getPeriodStart("daily", zone);
    const weekStart = getPeriodStart("weekly", zone);

    const progressRows = await db.select().from(userMissionProgressTable)
      .where(and(
        eq(userMissionProgressTable.userId, req.userId),
      ));

    const progressMap = new Map(progressRows.map((r) => [`${r.missionKey}:${r.periodStart}`, r]));

    const missions = ALL_MISSIONS.map((m) => {
      const periodStart = m.type === "daily" ? today : weekStart;
      const key = `${m.key}:${periodStart}`;
      const progress = progressMap.get(key);
      return {
        ...m,
        currentValue: progress?.currentValue ?? 0,
        completed: progress?.completed ?? false,
        completedAt: progress?.completedAt?.toISOString() ?? null,
        rewardClaimed: progress?.rewardClaimed ?? false,
        periodStart,
      };
    });

    const daily = missions.filter((m) => m.type === "daily");
    const weekly = missions.filter((m) => m.type === "weekly");

    const dailyCompleted = daily.filter((m) => m.completed).length;
    const weeklyCompleted = weekly.filter((m) => m.completed).length;

    // Mission of the day + how many people have already cleared it, so the
    // board reads as a race rather than a checklist.
    const featuredPick = await featuredMissionForToday(getPeriodStart("daily", "Asia/Kolkata"));
    const featuredDefinition = ALL_MISSIONS.find(m => m.key === featuredPick.key)!;
    let featuredCompletions = 0;
    try {
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(userMissionProgressTable)
        .where(and(
          eq(userMissionProgressTable.missionKey, featuredPick.key),
          eq(userMissionProgressTable.completed, true),
          gte(userMissionProgressTable.completedAt, new Date(Date.now() - 24 * 3600 * 1000)),
        ));
      featuredCompletions = Number(row?.value ?? 0);
    } catch { /* a count failure must not break the mission list */ }

    const featured = {
      ...featuredDefinition,
      reason: featuredPick.reason,
      source: featuredPick.source,
      completionsLast24h: featuredCompletions,
      periodStart: getPeriodStart(featuredDefinition.type as "daily" | "weekly", zone),
    };

    res.json({
      daily,
      weekly,
      featured,
      stats: { dailyCompleted, totalDaily: daily.length, weeklyCompleted, totalWeekly: weekly.length },
    });
  } catch (err) {
    logger.error({ err }, "missions fetch error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/missions/:key/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { key } = req.params as { key: string };
  try {
    const mission = ALL_MISSIONS.find((m) => m.key === key);
    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

    const periodStart = getPeriodStart(mission.type as "daily" | "weekly", await zoneFor(req.userId));

    const [progress] = await db.select().from(userMissionProgressTable).where(and(
      eq(userMissionProgressTable.userId, req.userId),
      eq(userMissionProgressTable.missionKey, key),
      eq(userMissionProgressTable.periodStart, periodStart),
    ));

    if (!progress?.completed) { res.status(400).json({ error: "Mission not completed yet" }); return; }
    if (progress.rewardClaimed) { res.status(400).json({ error: "Reward already claimed" }); return; }

    // Compare-and-set on `reward_claimed = false`: two parallel claims both
    // passed the read above and both paid out. Only the request that flips
    // the flag proceeds to mint.
    const [claimed] = await db.update(userMissionProgressTable).set({ rewardClaimed: true }).where(
      and(
        eq(userMissionProgressTable.userId, req.userId),
        eq(userMissionProgressTable.missionKey, key),
        eq(userMissionProgressTable.periodStart, periodStart),
        eq(userMissionProgressTable.rewardClaimed, false),
      )
    ).returning({ missionKey: userMissionProgressTable.missionKey });
    if (!claimed) { res.status(400).json({ error: "Reward already claimed" }); return; }

    if (mission.coinReward > 0) {
      await mintCoins(req.userId, mission.coinReward, "mission_reward", {
        description: `Mission "${mission.title}" completed: +${mission.coinReward} coins`,
        metadata: { missionKey: key, periodStart },
      });
    }
    // Upsert with atomic increments: the read-then-write it replaces could
    // overwrite XP credited by a session completing in the same instant.
    await db.insert(userWalletsTable).values({
      userId: req.userId, coins: 0, totalXp: mission.xpReward, weeklyXp: mission.xpReward,
    }).onConflictDoUpdate({
      target: userWalletsTable.userId,
      set: {
        totalXp: sql`${userWalletsTable.totalXp} + ${mission.xpReward}`,
        weeklyXp: sql`${userWalletsTable.weeklyXp} + ${mission.xpReward}`,
        updatedAt: new Date(),
      },
    });

    res.json({ ok: true, xpEarned: mission.xpReward, coinsEarned: mission.coinReward });
  } catch (err) {
    logger.error({ err }, "claim mission error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * Advance every mission measured in `unit`.
 *
 * `sessions` / `minutes` / `tasks` accumulate. `score` and `days` are levels:
 * a session's focus score is not summed across sessions, and "days studied
 * this week" is a count the caller already knows — both use `replace`, which
 * keeps the highest value seen. Before this the `score` and `days` missions
 * ("Quality Focus", "Elite Focus", "Streak Keeper", "Perfect Week") were
 * defined and listed but no code path ever reported to them.
 */
export async function updateMissionProgress(
  userId: string,
  unit: "sessions" | "minutes" | "tasks" | "score" | "days",
  value: number,
  opts?: { replace?: boolean; zone?: string }
) {
  try {
    const zone = opts?.zone ?? await zoneFor(userId);
    const replace = opts?.replace ?? (unit === "score" || unit === "days");
    const today = getPeriodStart("daily", zone);
    const weekStart = getPeriodStart("weekly", zone);

    const relevantMissions = ALL_MISSIONS.filter((m) => m.unit === unit);

    for (const mission of relevantMissions) {
      const periodStart = mission.type === "daily" ? today : weekStart;

      const [existing] = await db.select().from(userMissionProgressTable).where(and(
        eq(userMissionProgressTable.userId, userId),
        eq(userMissionProgressTable.missionKey, mission.key),
        eq(userMissionProgressTable.periodStart, periodStart),
      ));

      if (!existing) {
        const newValue = value;
        const completed = newValue >= mission.targetValue;
        await db.insert(userMissionProgressTable).values({
          userId, missionKey: mission.key, periodStart,
          currentValue: newValue, completed,
          completedAt: completed ? new Date() : null,
        });
      } else if (!existing.completed) {
        const newValue = replace ? Math.max(existing.currentValue, value) : existing.currentValue + value;
        const completed = newValue >= mission.targetValue;
        await db.update(userMissionProgressTable).set({
          currentValue: newValue, completed,
          completedAt: completed && !existing.completedAt ? new Date() : existing.completedAt,
        }).where(and(
          eq(userMissionProgressTable.userId, userId),
          eq(userMissionProgressTable.missionKey, mission.key),
          eq(userMissionProgressTable.periodStart, periodStart),
        ));
      }
    }
  } catch (err) {
    logger.error({ err }, "updateMissionProgress error");
  }
}

export { router as missionsRouter };
