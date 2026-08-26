import { Router } from "express";
import { logger } from "../lib/logger";
import { aiRoadmapLimiter } from "../lib/rateLimiter";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { premiumStatusMiddleware, requirePremium } from "../lib/premiumCheck";
import { getActivePlans } from "../lib/premiumPlans";
import { getTokenBalance } from "../lib/tokenLedger";
import { checkBudget, recordCall, recordRateLimit, userPurposeCalls } from "../lib/aiBudget";
import { sanitizeAiInput, detectPromptInjection, checkIpLimit, isSafeFallbackError } from "../lib/aiGuardrails";
import { z } from "zod";

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

const roadmapRequestSchema = z.object({
  goal: z.string().min(3).max(500),
  dailyHours: z.number().min(0.5).max(12).optional().default(2),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().default("intermediate"),
  currentProgress: z.string().max(1000).optional(),
});

const roadmapDaySchema = z.object({
  day: z.number().int().min(1).max(365),
  focusSessions: z.array(z.string().max(200)).max(20),
  tasks: z.array(z.string().max(300)).max(10),
  estimatedTime: z.number().int().min(0).max(1440),
  milestone: z.string().max(500).optional(),
  progressCheck: z.string().max(500).optional(),
  resources: z.array(z.object({
    title: z.string().max(200),
    url: z.string().url().max(500),
    type: z.string().max(50),
  })).max(5).optional(),
});

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

  // Budget check
  try {
    const budget = await checkBudget("gemini");
    if (!budget.available) {
      logger.warn({ budget }, "gemini budget exhausted");
      return null;
    }
  } catch {
    // continue, budget check is best-effort
  }

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

  const start = Date.now();
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

    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      if (resp.status === 429) {
        await recordRateLimit("gemini").catch(() => {});
        await recordCall({
          provider: "gemini",
          model: "gemini-2.5-flash",
          purpose: "roadmap",
          status: "rate_limited",
          latencyMs,
        }).catch(() => {});
      }
      logger.warn({ status: resp.status }, "Gemini API error");
      return null;
    }

    const data = await resp.json() as any;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RoadmapDay[];

    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Validate with Zod
    const validated: RoadmapDay[] = [];
    for (const day of parsed.slice(0, numDays)) {
      const v = roadmapDaySchema.safeParse(day);
      if (v.success) validated.push(v.data);
    }

    if (validated.length === 0) return null;

    await recordCall({
      provider: "gemini",
      model: "gemini-2.5-flash",
      purpose: "roadmap",
      tokensIn: data.usageMetadata?.promptTokenCount,
      tokensOut: data.usageMetadata?.candidatesTokenCount,
      latencyMs,
      status: "ok",
    }).catch(() => {});

    return validated;
  } catch (err) {
    const fallbackReason = isSafeFallbackError(err);
    if (fallbackReason) {
      logger.warn({ err, fallbackReason }, "Gemini roadmap safe fallback");
    } else {
      logger.warn({ err }, "Gemini roadmap generation failed — not a safe fallback");
    }
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

router.post("/ai/roadmap", authMiddleware, premiumStatusMiddleware, aiRoadmapLimiter, async (req: AuthRequest, res) => {
  const ip = req.ip ?? "unknown";
  if (!checkIpLimit(ip)) {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Daily AI limit for this IP reached" } });
    return;
  }

  const parsed = roadmapRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.errors } });
    return;
  }

  const { goal, dailyHours, level, currentProgress } = parsed.data;

  // Prompt injection protection
  if (detectPromptInjection(goal) || (currentProgress && detectPromptInjection(currentProgress))) {
    logger.warn({ userId: req.userId, goal: goal.slice(0, 100) }, "prompt injection detected in roadmap");
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "Input contains disallowed content" } });
    return;
  }

  const sanitizedGoal = sanitizeAiInput(goal);
  const sanitizedProgress = currentProgress ? sanitizeAiInput(currentProgress) : undefined;

  if (sanitizedGoal.length < 3) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Goal too short after sanitization" } });
    return;
  }

  const hours = Math.min(12, Math.max(0.5, Number(dailyHours) || 2));
  const numDays = 7;

  try {
    const premium = Boolean((req as AuthRequest & { isPremium?: boolean }).isPremium);

    // Per-user daily limit
    if (!premium) {
      const used = await userPurposeCalls(req.userId, "roadmap");
      if (used >= 10) {
        res.status(429).json({ error: { code: "BUDGET_EXCEEDED", message: "Daily roadmap limit reached (10/day). Upgrade for unlimited." } });
        return;
      }
    }

    let roadmap: any = null;
    if (premium) {
      roadmap = await generateRoadmapWithGemini(sanitizedGoal, hours, level ?? "intermediate", numDays, sanitizedProgress, premium);
    }
    const finalRoadmap = roadmap ?? buildRoadmapFallback(sanitizedGoal, hours, level ?? "intermediate", numDays, sanitizedProgress, premium);

    // Final validation before sending to frontend
    const validated = finalRoadmap.filter((d: any) => roadmapDaySchema.safeParse(d).success);

    res.json({
      roadmap: validated.length > 0 ? validated : finalRoadmap,
      tier: premium ? "premium" : "free",
      fallback: !roadmap,
    });
  } catch (err) {
    logger.error({ err }, "ai/roadmap error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate roadmap" } });
  }
});

export { router as aiRouter };
