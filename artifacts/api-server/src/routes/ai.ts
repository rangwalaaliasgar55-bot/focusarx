import { Router } from "express";
import { logger } from "../lib/logger";
import { aiRoadmapLimiter } from "../lib/rateLimiter";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { premiumStatusMiddleware } from "../lib/premiumCheck";

const router = Router();

interface RoadmapDay {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
}

async function generateRoadmapWithGemini(
  goal: string,
  dailyHours: number,
  level: string,
  numDays: number,
  currentProgress?: string,
): Promise<RoadmapDay[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const pomodoros = Math.max(1, Math.round((dailyHours * 60) / 25));
  const prompt = `You are an expert study planner. Create a ${numDays}-day structured study roadmap.

Goal: "${goal}"
Level: ${level}
Daily study hours: ${dailyHours} (= ${pomodoros} Pomodoro sessions of 25 min per day)
${currentProgress?.trim() ? `Current progress: "${currentProgress}"` : ""}

Return ONLY a JSON array with exactly ${numDays} objects. Each object must have:
- "day": number (1 to ${numDays})
- "focusSessions": array of exactly ${pomodoros} short descriptive session titles (max 8 words each, specific to the goal)
- "tasks": array of 3–4 concrete actionable tasks for that day (specific, measurable, tied to the goal)
- "estimatedTime": number (total minutes = ${pomodoros * 25 + (pomodoros - 1) * 5})

Make each day progressively build on the previous. Be specific to the goal, not generic. No markdown, no explanation — pure JSON array only.`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
            maxOutputTokens: 4096,
          },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "Gemini API error");
      return null;
    }
    const data = await resp.json() as any;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoadmapDay[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (err) {
    logger.warn({ err }, "Gemini roadmap generation failed");
    return null;
  }
}

function buildRoadmapFallback(
  goal: string,
  dailyHours: number,
  level: string,
  numDays: number,
  currentProgress?: string,
): RoadmapDay[] {
  const hours = Math.min(12, Math.max(0.5, dailyHours));
  const pomodoros = Math.max(1, Math.round((hours * 60) / 25));
  const tasksPerDay = pomodoros <= 2 ? 2 : pomodoros <= 4 ? 3 : 4;

  const topic = goal.split(/\s+/).slice(0, 4).join(" ");
  const levelLabel = level === "beginner" ? "Foundations" : level === "advanced" ? "Advanced" : "Core";
  
  const roadmap: RoadmapDay[] = [];
  for (let d = 1; d <= numDays; d++) {
    roadmap.push({
      day: d,
      focusSessions: [`${levelLabel} Session ${d}`],
      tasks: [`Task 1 for ${topic}`, `Task 2 for ${topic}`],
      estimatedTime: pomodoros * 25
    });
  }
  return roadmap;
}

// premiumStatusMiddleware runs before aiRoadmapLimiter — sets req.isPremium
// so premium users bypass the rate limit entirely (unlimited roadmap generation)
router.post("/ai/roadmap", authMiddleware, premiumStatusMiddleware, aiRoadmapLimiter, async (req: AuthRequest, res) => {
  const { goal, dailyHours, level, deadline, currentProgress } = req.body;

  if (!goal?.trim()) {
    res.status(400).json({ error: "Goal is required" });
    return;
  }

  const hours = Math.min(12, Math.max(0.5, Number(dailyHours) || 2));
  let numDays = 7;

  try {
    const roadmap = await generateRoadmapWithGemini(goal.trim(), hours, level ?? "intermediate", numDays, currentProgress);
    res.json({ roadmap: roadmap ?? buildRoadmapFallback(goal.trim(), hours, level ?? "intermediate", numDays, currentProgress) });
  } catch (err) {
    logger.error({ err }, "ai/roadmap error");
    res.status(500).json({ error: "Failed to generate roadmap" });
  }
});

export { router as aiRouter };
