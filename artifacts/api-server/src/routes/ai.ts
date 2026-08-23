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
  milestone?: string;
  resources?: Array<{ title: string; url: string; type: string }>;
  progressCheck?: string;
}

async function generateRoadmapWithGemini(
  goal: string,
  dailyHours: number,
  level: string,
  numDays: number,
  currentProgress?: string,
  premium = false,
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
${premium ? `- "milestone": a measurable outcome for the day
- "progressCheck": a concrete self-test
- "resources": 1–3 reputable public learning links, each with title, full https URL, and type` : ""}

Make each day progressively build on the previous. ${premium ? "This is a Premium roadmap: make it more detailed, measurable, resource-rich, and adaptive." : "Keep the free roadmap concise."} Be specific to the goal, not generic. No markdown, no explanation — pure JSON array only.`;

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
  premium = false,
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
      focusSessions: Array.from({ length: pomodoros }, (_, index) => `${levelLabel}: ${topic} block ${index + 1}`),
      tasks: Array.from({ length: tasksPerDay }, (_, index) => `${index + 1}. Complete a measurable ${topic} practice task`),
      estimatedTime: pomodoros * 25,
      ...(premium ? {
        milestone: `Explain and apply day ${d}'s ${topic} concept without notes`,
        progressCheck: `Score at least 80% on a short self-test for day ${d}`,
        resources: [],
      } : {}),
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
    const premium = Boolean((req as AuthRequest & { isPremium?: boolean }).isPremium);
    const roadmap = await generateRoadmapWithGemini(goal.trim(), hours, level ?? "intermediate", numDays, currentProgress, premium);
    res.json({ roadmap: roadmap ?? buildRoadmapFallback(goal.trim(), hours, level ?? "intermediate", numDays, currentProgress, premium), tier: premium ? "premium" : "free" });
  } catch (err) {
    logger.error({ err }, "ai/roadmap error");
    res.status(500).json({ error: "Failed to generate roadmap" });
  }
});

export { router as aiRouter };
