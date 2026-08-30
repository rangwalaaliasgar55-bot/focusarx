import { Router } from "express";
import { db, focusSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { sendUnauthorized } from "../lib/httpErrors";
import { generateAi } from "../lib/aiProvider";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { sendUnauthorized(res); return; }
  req.userId = userId;
  next();
}

router.get("/session-replay", auth, async (req: any, res) => {
  try {
    const sessions = await db
      .select()
      .from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, req.userId))
      .orderBy(desc(focusSessionsTable.createdAt))
      .limit(50);
    res.json({ sessions });
  } catch (err) {
    logger.error({ err }, "session-replay list error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/session-replay/:id/caption", auth, async (req: any, res) => {
  try {
    const [session] = await db
      .select()
      .from(focusSessionsTable)
      .where(eq(focusSessionsTable.id, req.params.id as string));

    if (!session || session.userId !== req.userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    let timeline: Array<{ type: string; ts: number }> = [];
    try { timeline = JSON.parse(session.focusTimeline ?? "[]"); } catch { /* empty */ }

    const durationMin = Math.round(session.durationSec / 60);
    const distractions = timeline.filter((t) => t.type === "distraction").length;
    const pauses = timeline.filter((t) => t.type === "pause" || t.type === "paused").length;

    let longestStreak = 0, currentStreak = 0, peakFlowAt = 0, lastDistractionAt = 0;
    for (const item of timeline) {
      if (item.type === "focus" || item.type === "running") {
        currentStreak++;
        if (currentStreak > longestStreak) { longestStreak = currentStreak; peakFlowAt = Math.round(item.ts / 60); }
      } else {
        currentStreak = 0;
        if (item.type === "distraction") lastDistractionAt = Math.round(item.ts / 60);
      }
    }

    const prompt = `Write a 2-3 sentence session recap (no markdown, no bullet points) for a focus session:
- Duration: ${durationMin} minutes
- Distractions: ${distractions}, Pauses: ${pauses}
- Longest unbroken focus streak: ~${longestStreak} intervals
- Peak flow: around minute ${peakFlowAt}
${lastDistractionAt > 0 ? `- Last distraction: minute ${lastDistractionAt}` : ""}
${session.focusScore != null ? `- Focus score: ${session.focusScore}/100` : ""}
Write like a sports commentator — specific, honest, motivating. Start with the best thing that happened.`;

    const aiResult = await generateAi({
      purpose: "session_replay_caption",
      prompt,
      system: "You are a witty, analytical sports commentator for deep work sessions in FocusArx powered by Google Gemini. Keep it punchy, motivating, and strictly under 3 sentences.",
      maxTokens: 150,
      userId: req.userId,
    });

    const caption = aiResult?.text?.trim()
      ?? `You focused for ${durationMin} minutes with ${distractions} distraction${distractions !== 1 ? "s" : ""}. ${longestStreak > 0 ? "Your best unbroken stretch was impressive." : "Every session builds the habit."}`;

    res.json({ caption, durationMin, distractions, pauses, peakFlowAt, longestStreak, lastDistractionAt, provider: aiResult?.provider ?? "template" });
  } catch (err) {
    logger.error({ err }, "session-replay caption error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as sessionReplayRouter };
