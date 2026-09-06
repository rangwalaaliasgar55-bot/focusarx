import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  focusSessionsTable, tasksTable, studyStreaksTable,
  productivityLogsTable, userWalletsTable,
} from "@workspace/db";
import { isUserPremium } from "../lib/premiumCheck";
import { generateAi } from "../lib/aiProvider";
import { eq, and, desc, sql } from "drizzle-orm";
import { clockInZone, dayKeyInZone, shiftDayKey } from "../lib/timezone";
import { userZone } from "../lib/userZone";

export const aiInsightsRouter = Router();

const daysAgoStr = (n: number, zone: string) => shiftDayKey(dayKeyInZone(Date.now(), zone), -n);

async function gatherUserStats(userId: string) {
  const zone = await userZone(userId);
  const weekAgo = daysAgoStr(7, zone);
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), sql`completed_at >= ${weekAgo}`))
    .orderBy(desc(focusSessionsTable.completedAt)).limit(100);

  const [taskStats] = await db.select({
    total: sql<number>`count(*)`,
    completed: sql<number>`count(*) filter (where completed = true)`,
  }).from(tasksTable).where(eq(tasksTable.userId, userId));

  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1);
  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  const logs = await db.select().from(productivityLogsTable)
    .where(and(eq(productivityLogsTable.userId, userId), sql`date >= ${weekAgo}`))
    .orderBy(desc(productivityLogsTable.date)).limit(7);

  const totalMinutes = sessions.reduce((s, r) => s + Math.round((r.durationSec ?? 0) / 60), 0);
  const avgScore = sessions.length ? sessions.reduce((s, r) => s + (r.focusScore ?? 0), 0) / sessions.length : 0;
  const hourBuckets: Record<number, number> = {};
  sessions.forEach(s => {
    if (s.completedAt) {
      const h = clockInZone(s.completedAt, zone).hour;
      hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
    }
  });
  const peakHour = Object.entries(hourBuckets).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];

  return {
    totalSessions: sessions.length,
    totalMinutes,
    avgFocusScore: Math.round(avgScore),
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    level: wallet?.level ?? 1,
    totalXp: wallet?.totalXp ?? 0,
    tasksTotal: Number(taskStats?.total ?? 0),
    tasksCompleted: Number(taskStats?.completed ?? 0),
    peakHour: peakHour !== undefined ? Number(peakHour) : null,
    dailyLogs: logs,
  };
}

function generateFallbackReport(stats: Awaited<ReturnType<typeof gatherUserStats>>) {
  const lines: string[] = [];
  lines.push("## This Week's Performance");
  if (stats.totalSessions === 0) {
    lines.push("No focus sessions logged this week. Let's change that — even one 25-minute session builds momentum.");
  } else {
    lines.push(`You completed ${stats.totalSessions} focus session${stats.totalSessions > 1 ? "s" : ""} totalling ${stats.totalMinutes} minutes. ${stats.avgFocusScore > 80 ? "Outstanding focus quality!" : stats.avgFocusScore > 60 ? "Solid concentration." : "Keep working on reducing distractions."}`);
  }
  lines.push("\n## Strengths Identified");
  if (stats.currentStreak > 1) lines.push(`✅ Consistency — ${stats.currentStreak}-day streak shows strong habit formation.`);
  if (stats.avgFocusScore > 75) lines.push(`✅ Focus quality — ${stats.avgFocusScore}% average is excellent.`);
  if (stats.tasksCompleted > 0) lines.push(`✅ Task execution — ${stats.tasksCompleted} tasks completed.`);
  if (lines[lines.length - 1].startsWith("\n")) lines.push("✅ You showed up — that's always the first step.");
  lines.push("\n## Growth Opportunities");
  if (stats.totalMinutes < 120) lines.push("📈 Increase weekly focus time to at least 2 hours for meaningful progress.");
  if (stats.avgFocusScore < 70 && stats.totalSessions > 0) lines.push("📈 Minimize distractions — try enabling the webcam monitor.");
  if (!stats.currentStreak) lines.push("📈 Build a streak — even 5 minutes daily compounds.");
  if (stats.tasksCompleted < stats.tasksTotal) lines.push(`📈 Clear your task backlog — ${stats.tasksTotal - stats.tasksCompleted} tasks pending.`);
  lines.push("\n## Next Week's Challenge");
  const target = Math.max(stats.totalSessions + 2, 5);
  lines.push(`🎯 Complete ${target} focus sessions next week with an average score above ${Math.max(stats.avgFocusScore, 70)}%.`);
  return lines.join("\n");
}

aiInsightsRouter.get("/ai/weekly-report", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const premium = await isUserPremium(userId);

  // Free users get a basic non-AI fallback report
  if (!premium) {
    const stats = await gatherUserStats(userId);
    return res.json({
      report: generateFallbackReport(stats),
      stats,
      generatedAt: new Date().toISOString(),
      aiPowered: false,
      isPremium: false,
    });
  }

  const stats = await gatherUserStats(userId);
  const prompt = `Generate a personalized weekly productivity report. Stats: ${stats.totalSessions} sessions, ${stats.totalMinutes} min, ${stats.avgFocusScore}% avg score, ${stats.currentStreak} day streak, ${stats.tasksCompleted}/${stats.tasksTotal} tasks. Peak hour: ${stats.peakHour !== null ? `${stats.peakHour}:00` : "unknown"}. Level ${stats.level}. Write 4 sections: Performance, Strengths, Opportunities, Next Week Challenge. 250 words max. Motivating and data-driven.`;

  const aiResult = await generateAi({
    purpose: "weekly_report",
    prompt,
    system: "You are FocusArx AI Coach powered by Google Gemini. Write a concise, motivating productivity report in clean markdown without preamble.",
    maxTokens: 400,
    userId,
  });

  const aiReport = aiResult?.text ?? null;

  res.json({
    report: aiReport ?? generateFallbackReport(stats),
    stats,
    generatedAt: new Date().toISOString(),
    aiPowered: !!aiReport,
    isPremium: true,
  });
});

aiInsightsRouter.get("/ai/performance-insights", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const stats = await gatherUserStats(userId);

  const insights = [];
  if (stats.peakHour !== null) {
    const timeLabel = stats.peakHour < 12 ? "morning" : stats.peakHour < 17 ? "afternoon" : "evening";
    insights.push({ type: "peak_time", icon: "⏰", title: "Peak Focus Time", value: `${stats.peakHour}:00`, description: `You do your best work in the ${timeLabel}. Schedule deep work then.` });
  }
  if (stats.avgFocusScore > 0) {
    insights.push({ type: "focus_score", icon: "🧠", title: "Average Focus Score", value: `${stats.avgFocusScore}%`, description: stats.avgFocusScore > 80 ? "Elite focus quality." : stats.avgFocusScore > 60 ? "Good. Push toward 80%+ for optimal learning." : "Significant distraction. Enable webcam monitoring." });
  }
  if (stats.currentStreak > 0) {
    insights.push({ type: "streak", icon: "🔥", title: "Current Streak", value: `${stats.currentStreak} days`, description: stats.currentStreak >= 7 ? "Incredible consistency! You're building an unbreakable habit." : "Keep going — 7 days is where habits form." });
  }
  const rate = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
  insights.push({ type: "task_rate", icon: "✅", title: "Task Completion Rate", value: `${rate}%`, description: rate >= 80 ? "Excellent. You finish what you start." : rate >= 50 ? "Decent completion." : "Low rate. Break tasks into smaller pieces." });
  insights.push({ type: "level", icon: "⚡", title: "Current Level", value: `Level ${stats.level}`, description: `${stats.totalXp.toLocaleString()} total XP earned. Keep grinding!` });

  res.json({ insights, stats, generatedAt: new Date().toISOString() });
});

aiInsightsRouter.get("/ai/habit-analysis", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const zone = await userZone(userId);
  const monthAgo = daysAgoStr(30, zone);
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), sql`completed_at >= ${monthAgo}`))
    .orderBy(desc(focusSessionsTable.completedAt));

  const dayBuckets: Record<string, number[]> = {};
  sessions.forEach(s => {
    if (s.completedAt) {
      const day = dayKeyInZone(s.completedAt, zone);
      if (!dayBuckets[day]) dayBuckets[day] = [];
      dayBuckets[day].push(s.durationSec ?? 0);
    }
  });

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  sessions.forEach(s => { if (s.completedAt) weekdayMap[dayNames[clockInZone(s.completedAt, zone).weekday]!]!++; });

  const activeDays = Object.keys(dayBuckets).length;
  const longestSession = sessions.reduce((max, s) => Math.max(max, s.durationSec ?? 0), 0);
  const totalSeconds = sessions.reduce((s, r) => s + (r.durationSec ?? 0), 0);

  res.json({
    activeDaysLast30: activeDays,
    consistencyScore: Math.round((activeDays / 30) * 100),
    weekdayDistribution: weekdayMap,
    longestSessionMinutes: Math.round(longestSession / 60),
    avgDailyMinutes: activeDays > 0 ? Math.round(totalSeconds / 60 / activeDays) : 0,
    totalSessions: sessions.length,
    monthlyGoalProgress: Math.min(100, Math.round((activeDays / 20) * 100)),
  });
});

// Premium-only: Monthly AI Report
aiInsightsRouter.get("/ai/monthly-report", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const premium = await isUserPremium(userId);
  if (!premium) {
    return res.status(403).json({ error: "Monthly AI Reports require Premium" });
  }

  const zone = await userZone(userId);
  const monthAgo = daysAgoStr(30, zone);
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), sql`completed_at >= ${monthAgo}`))
    .orderBy(desc(focusSessionsTable.completedAt));

  const [taskStats] = await db.select({
    total: sql<number>`count(*)`,
    completed: sql<number>`count(*) filter (where completed = true)`,
  }).from(tasksTable).where(eq(tasksTable.userId, userId));

  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1);
  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);

  const totalMinutes = sessions.reduce((s, r) => s + Math.round((r.durationSec ?? 0) / 60), 0);
  const avgScore = sessions.length ? sessions.reduce((s, r) => s + (r.focusScore ?? 0), 0) / sessions.length : 0;
  const activeDays = new Set(sessions.filter(s => s.completedAt).map(s => dayKeyInZone(s.completedAt!, zone))).size;
  const peakHourBuckets: Record<number, number> = {};
  sessions.forEach(s => { if (s.completedAt) { const h = clockInZone(s.completedAt, zone).hour; peakHourBuckets[h] = (peakHourBuckets[h] ?? 0) + 1; } });
  const peakHour = Object.entries(peakHourBuckets).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];

  const prompt = `Generate a personalized MONTHLY productivity report. Stats over 30 days: ${sessions.length} sessions, ${totalMinutes} minutes total, ${Math.round(avgScore)}% avg focus score, ${activeDays} active days, ${taskStats?.completed ?? 0}/${taskStats?.total ?? 0} tasks completed. Peak hour: ${peakHour !== undefined ? `${peakHour}:00` : "unknown"}. Level ${wallet?.level ?? 1}. Streak: ${streak?.currentStreak ?? 0} days. Write 5 sections: Monthly Overview, Focus Patterns, Strengths, Areas for Growth, Next Month Goals. 350 words max. Analytical and data-driven with actionable recommendations.`;

  const aiResult = await generateAi({
    purpose: "monthly_report",
    prompt,
    system: "You are FocusArx AI Analytics Engine powered by Google Gemini. Write a detailed monthly productivity analysis in markdown.",
    maxTokens: 600,
    userId,
  });

  const aiReport = aiResult?.text ?? null;

  res.json({
    report: aiReport ?? `## Monthly Overview\n\nOver the past 30 days, you completed ${sessions.length} focus sessions totalling ${totalMinutes} minutes with an average focus score of ${Math.round(avgScore)}%. You were active on ${activeDays} of 30 days (${Math.round((activeDays / 30) * 100)}% consistency).\n\n## Focus Patterns\n\n${peakHour !== undefined ? `Your peak focus hour is ${peakHour}:00. Schedule deep work during this window for maximum productivity.` : "Not enough data to identify your peak focus hour yet."}\n\n## Next Month Goals\n\n🎯 Maintain at least 20 active days this month\n🎯 Target ${Math.max(Math.round(avgScore), 75)}% average focus score\n🎯 Complete ${Math.max((taskStats?.completed ?? 0) + 5, 10)} tasks\n\n_Premium users receive AI-powered insights. Upgrade for personalized recommendations._`,
    stats: { totalSessions: sessions.length, totalMinutes, avgFocusScore: Math.round(avgScore), activeDays, tasksCompleted: taskStats?.completed ?? 0, tasksTotal: taskStats?.total ?? 0 },
    generatedAt: new Date().toISOString(),
    aiPowered: !!aiReport,
    isPremium: true,
  });
});
