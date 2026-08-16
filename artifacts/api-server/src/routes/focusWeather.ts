import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, readinessLogsTable, focusSessionsTable, studyStreaksTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

type WeatherState =
  | "clear_skies"
  | "flow_state_incoming"
  | "partly_cloudy"
  | "fog"
  | "storm_warning";

interface WeatherForecast {
  state: WeatherState;
  emoji: string;
  label: string;
  tagline: string;
  recommendedSessionMin: number;
  recommendedBlocks: number;
  color: string;
}

const WEATHER_MAP: Record<WeatherState, Omit<WeatherForecast, "recommendedSessionMin" | "recommendedBlocks">> = {
  clear_skies: {
    state: "clear_skies",
    emoji: "☀️",
    label: "Clear Skies",
    tagline: "Peak performance conditions. Push hard today.",
    color: "#F59E0B",
  },
  flow_state_incoming: {
    state: "flow_state_incoming",
    emoji: "🌈",
    label: "Flow State Incoming",
    tagline: "Conditions are perfect for deep work. Don't waste it.",
    color: "#8B5CF6",
  },
  partly_cloudy: {
    state: "partly_cloudy",
    emoji: "⛅",
    label: "Partly Cloudy",
    tagline: "Scattered focus. Use structured blocks.",
    color: "#60A5FA",
  },
  fog: {
    state: "fog",
    emoji: "🌫",
    label: "Mental Fog",
    tagline: "Low energy today. Gentle mode activated.",
    color: "#94A3B8",
  },
  storm_warning: {
    state: "storm_warning",
    emoji: "🌩",
    label: "Storm Warning",
    tagline: "High distraction risk. Stay disciplined.",
    color: "#EF4444",
  },
};

router.get("/focus-weather", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const dayOfWeek = new Date().getDay(); // 0=Sun

    const [readiness] = await db
      .select()
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));

    const [streak] = await db
      .select()
      .from(studyStreaksTable)
      .where(eq(studyStreaksTable.userId, req.userId));

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const recentSessions = await db
      .select({ durationSec: focusSessionsTable.durationSec, createdAt: focusSessionsTable.createdAt })
      .from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.userId, req.userId),
        gte(focusSessionsTable.createdAt, sevenDaysAgo),
      ))
      .orderBy(desc(focusSessionsTable.createdAt))
      .limit(20);

    const { meetings = 0 } = req.query as { meetings?: number };

    const readinessScore = readiness?.score ?? 50;
    const currentStreak = streak?.currentStreak ?? 0;
    const avgSessionMin = recentSessions.length > 0
      ? Math.round(recentSessions.reduce((s, r) => s + r.durationSec, 0) / recentSessions.length / 60)
      : 25;
    const recentCount = recentSessions.length;
    const meetingCount = Number(meetings) || 0;

    // Scoring logic to determine weather
    let score = 0;
    score += Math.round((readinessScore / 100) * 40); // up to 40 pts from readiness
    score += Math.min(20, currentStreak * 2);          // up to 20 pts from streak
    score += recentCount >= 5 ? 20 : recentCount * 4;  // up to 20 pts from recent activity
    score -= meetingCount * 5;                          // -5 per meeting
    // Weekday bonus (Mon-Fri)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) score += 5;
    // Weekend penalty
    if (dayOfWeek === 0 || dayOfWeek === 6) score -= 5;

    let state: WeatherState;
    if (score >= 80) state = "flow_state_incoming";
    else if (score >= 65) state = "clear_skies";
    else if (score >= 45) state = "partly_cloudy";
    else if (score >= 30) state = "fog";
    else state = "storm_warning";

    let recommendedSessionMin: number;
    let recommendedBlocks: number;

    switch (state) {
      case "flow_state_incoming":
        recommendedSessionMin = 90;
        recommendedBlocks = 3;
        break;
      case "clear_skies":
        recommendedSessionMin = 50;
        recommendedBlocks = 4;
        break;
      case "partly_cloudy":
        recommendedSessionMin = 25;
        recommendedBlocks = 4;
        break;
      case "fog":
        recommendedSessionMin = 15;
        recommendedBlocks = 3;
        break;
      case "storm_warning":
        recommendedSessionMin = 10;
        recommendedBlocks = 2;
        break;
    }

    const forecast: WeatherForecast = {
      ...WEATHER_MAP[state],
      recommendedSessionMin,
      recommendedBlocks,
    };

    res.json({ forecast, score, readinessScore, currentStreak, meetingCount, avgSessionMin });
  } catch (err) {
    logger.error({ err }, "focus-weather error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as focusWeatherRouter };
