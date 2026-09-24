import { Router } from "express";
import { logger } from "../lib/logger";
import { aiRoadmapLimiter } from "../lib/rateLimiter";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { premiumStatusMiddleware } from "../lib/premiumCheck";
import { userPurposeCalls } from "../lib/aiBudget";
import { generateAi } from "../lib/aiProvider";
import { sanitizeAiInput, detectPromptInjection, checkIpLimit } from "../lib/aiGuardrails";
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

/**
 * Ask a real model for the roadmap.
 *
 * This used to be called only when `premium` was true, and it called Gemini
 * directly with a hardcoded model ID. The two together meant that for a free
 * account — which is every account until 9,000 coins are earned — the page
 * **never contacted an AI at all**, and for a premium account it contacted a
 * model Google retired in September 2025. Both roads ended at
 * `buildRoadmapFallback`, whose output is the same four placeholder sentences
 * with the goal's first four words pasted in: "Foundations: learn X block 1",
 * "Complete a measurable X practice task". That is why the roadmap read as if
 * the AI ignored the request.
 *
 * Now: everyone gets a real attempt through the unified gateway (budget-checked,
 * 8s timeout, Gemini→Groq fallback, logged), the response is validated with the
 * same Zod schema the client expects, and templates are what happens when *no*
 * provider could serve — not what happens by default.
 *
 * The free/premium difference moves to what the prompt asks for (depth,
 * milestones, resources) and to the retry budget, which is where it belongs.
 */
async function generateRoadmapWithAi(
  goal: string,
  dailyHours: number,
  level: string,
  numDays: number,
  currentProgress?: string,
  premium = false,
): Promise<RoadmapDay[] | null> {
  const pomodoros = Math.max(1, Math.round((dailyHours * 60) / 25));

  const prompt = `You are an expert study planner. Create a ${numDays}-day structured study roadmap for this specific goal.

Goal: "${goal}"
Level: ${level}
Daily study hours: ${dailyHours} (= ${pomodoros} Pomodoro sessions of 25 min per day)
${currentProgress?.trim() ? `Current progress: "${currentProgress}"` : "Current progress: none stated"}

Return ONLY a JSON array with exactly ${numDays} objects — no prose, no markdown fence, no explanation. Each object:
- "day": number (1 to ${numDays})
- "focusSessions": array of exactly ${pomodoros} short session titles, max 8 words each, naming the actual topic for that day (not "study session")
- "tasks": array of 3-4 concrete tasks for that day, each something the person can finish and verify
- "estimatedTime": number (${pomodoros * 25 + (pomodoros - 1) * 5})
${premium
  ? `- "milestone": a measurable outcome for the day
- "progressCheck": a concrete self-test
- "resources": 1-3 reputable public learning links, each with title, full https URL, and type`
  : ""}

Rules that matter more than style:
- Name real topics, techniques, chapters or problem types for THIS goal — never generic filler.
- Never ask the user a question and never request clarification. There is no follow-up turn: produce the finished ${numDays}-day plan now.
- Each day must build on the previous one.
${premium ? "This is a Premium roadmap: make it more detailed, measurable, resource-rich, and adaptive." : "Keep the free roadmap concise but concrete."}`;

  const result = await generateAi({
    purpose: "roadmap",
    prompt,
    json: true,
    maxTokens: premium ? 4096 : 3000,
    userId: null,
    system:
      "You output only valid JSON. You never ask clarifying questions — you complete the request in one reply, using concrete domain-specific detail.",
  });
  if (!result) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(result.text));
  } catch (err) {
    logger.warn({ err, model: result.model }, "roadmap: provider returned unparseable JSON");
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const validated: RoadmapDay[] = [];
  for (const day of parsed.slice(0, numDays)) {
    const v = roadmapDaySchema.safeParse(day);
    if (v.success) validated.push(v.data);
  }
  // A roadmap with holes is worse than an honest fallback: a user cannot tell a
  // truncated plan from a complete one, and the missing days are the ones that
  // would have carried the goal to the end.
  if (validated.length < numDays) {
    logger.warn({ got: validated.length, want: numDays }, "roadmap: model returned an incomplete plan");
    return null;
  }
  return validated;
}

/**
 * Models wrap JSON in a markdown fence often enough that treating that as a
 * failure would throw away usable answers. Take the outermost array.
 */
function extractJsonArray(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = trimmed.indexOf("[");
  const last = trimmed.lastIndexOf("]");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
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

    // Everyone gets a real attempt — see generateRoadmapWithAi. `premium` now
    // buys a richer prompt, not the difference between AI and no AI.
    const roadmap = await generateRoadmapWithAi(
      sanitizedGoal,
      hours,
      level ?? "intermediate",
      numDays,
      sanitizedProgress,
      premium,
    );
    const finalRoadmap = roadmap ?? buildRoadmapFallback(sanitizedGoal, hours, level ?? "intermediate", numDays, sanitizedProgress, premium);

    // Final validation before sending to frontend
    const validated = finalRoadmap.filter((d) => roadmapDaySchema.safeParse(d).success);

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
