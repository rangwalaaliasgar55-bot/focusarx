import { Router } from "express";
import { db, focusSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

function getAnthropicConfig(): { apiKey: string; baseUrl: string } | null {
  const replitKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const replitBase = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (replitKey && replitBase) {
    return { apiKey: replitKey, baseUrl: replitBase.replace(/\/$/, "") };
  }
  const directKey = process.env.ANTHROPIC_API_KEY;
  if (directKey) {
    return { apiKey: directKey, baseUrl: "https://api.anthropic.com" };
  }
  return null;
}

async function callClaude(prompt: string): Promise<string | null> {
  const config = getAnthropicConfig();
  if (!config) return null;
  try {
    const resp = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
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
    try {
      timeline = JSON.parse(session.focusTimeline ?? "[]");
    } catch { /* empty */ }

    const durationMin = Math.round(session.durationSec / 60);
    const distractions = timeline.filter((t) => t.type === "distraction").length;
    const pauses = timeline.filter((t) => t.type === "pause" || t.type === "paused").length;

    let longestStreak = 0;
    let currentStreak = 0;
    let peakFlowAt = 0;
    let lastDistractionAt = 0;

    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i]!;
      if (item.type === "focus" || item.type === "running") {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          peakFlowAt = Math.round(item.ts / 60);
        }
      } else {
        currentStreak = 0;
        if (item.type === "distraction") lastDistractionAt = Math.round(item.ts / 60);
      }
    }

    const prompt = `Write a 2-3 sentence session recap (no markdown, no bullet points) for a focus session with these stats:
- Total duration: ${durationMin} minutes
- Distractions logged: ${distractions}
- Pauses: ${pauses}
- Longest unbroken focus streak: ~${longestStreak} intervals
- Peak flow moment: around minute ${peakFlowAt}
${lastDistractionAt > 0 ? `- Last distraction: around minute ${lastDistractionAt}` : ""}
${session.focusScore != null ? `- Focus score: ${session.focusScore}/100` : ""}

Write it like a sports commentator reviewing a performance — specific, honest, motivating. Start with the best thing that happened.`;

    const caption = await callClaude(prompt)
      ?? `You focused for ${durationMin} minutes with ${distractions} distraction${distractions !== 1 ? "s" : ""}. ${longestStreak > 0 ? `Your best unbroken stretch was impressive.` : "Every session builds the habit."}`;

    res.json({ caption, durationMin, distractions, pauses, peakFlowAt, longestStreak, lastDistractionAt });
  } catch (err) {
    logger.error({ err }, "session-replay caption error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as sessionReplayRouter };
