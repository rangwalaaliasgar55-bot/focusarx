import { Router } from "express";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

interface RoadmapDay {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
}

router.post("/ai/roadmap", authMiddleware, async (req: any, res) => {
  const { goal, dailyHours, level, deadline, currentProgress } = req.body as {
    goal?: string; dailyHours?: number; level?: string;
    deadline?: string; currentProgress?: string;
  };

  if (!goal?.trim()) { res.status(400).json({ error: "Goal is required" }); return; }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "AI service not configured. Add ANTHROPIC_API_KEY to env secrets." });
    return;
  }

  const hours = Math.min(12, Math.max(0.5, Number(dailyHours) || 2));
  const pomodoroCount = Math.round(hours * 60 / 25);
  const numDays = Math.min(14, Math.max(3, Math.round(7 / (hours / 2))));

  const systemPrompt = `You are a Pomodoro-based study coach. Generate a concrete, day-by-day focus plan.
Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "roadmap": [
    {
      "day": 1,
      "focusSessions": ["25-min session title 1", "25-min session title 2"],
      "tasks": ["concrete task 1", "concrete task 2", "concrete task 3"],
      "estimatedTime": 90
    }
  ]
}`;

  const userPrompt = `Goal: ${goal}
Level: ${level ?? "intermediate"}
Daily available hours: ${hours}h (≈${pomodoroCount} Pomodoros)
${deadline ? `Deadline: ${deadline}` : ""}
${currentProgress ? `Current progress: ${currentProgress}` : ""}
Generate a ${numDays}-day plan. Each day should have ${pomodoroCount} 25-minute focus session titles and 2-4 concrete actionable tasks. estimatedTime is in minutes.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ err, status: response.status }, "anthropic error");
      res.status(502).json({ error: `AI service error (${response.status})` });
      return;
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: { roadmap?: RoadmapDay[] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? text) as typeof parsed;
    } catch {
      logger.error({ text }, "failed to parse ai response");
      res.status(502).json({ error: "AI returned invalid JSON. Please try again." });
      return;
    }

    if (!Array.isArray(parsed.roadmap) || parsed.roadmap.length === 0) {
      res.status(502).json({ error: "AI returned empty roadmap. Please try again." });
      return;
    }

    res.json({ roadmap: parsed.roadmap });
  } catch (err) {
    logger.error({ err }, "ai roadmap error");
    res.status(500).json({ error: "Internal error generating roadmap" });
  }
});

export { router as aiRouter };
