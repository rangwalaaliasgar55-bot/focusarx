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

// ---------------------------------------------------------------------------
// Gemini 2.5 Flash — structured JSON roadmap generation
// ---------------------------------------------------------------------------

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
    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
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

// ---------------------------------------------------------------------------
// Smart built-in fallback — no API key required
// ---------------------------------------------------------------------------

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

  const stopWords = new Set(["a", "an", "the", "to", "of", "in", "on", "and", "for", "with", "how", "my", "i", "we"]);
  const topic = goal
    .split(/\s+/)
    .filter((w) => !stopWords.has(w.toLowerCase()))
    .slice(0, 4)
    .join(" ");

  const levelLabel = level === "beginner" ? "Foundations" : level === "advanced" ? "Advanced" : "Core";
  const phases: [string, string][] = [
    ["Research & planning", "Map out the key concepts"],
    [levelLabel + " concepts", "Deep-dive into core material"],
    ["Hands-on practice", "Build a small working example"],
    ["Review & consolidate", "Reinforce yesterday's learning"],
    ["Problem solving", "Work through exercises and edge cases"],
    ["Project work", "Apply skills to your real goal"],
    ["Reflect & iterate", "Review progress, adjust the plan"],
  ];
  const taskBanks: string[][] = [
    [`List 5 sub-topics for: "${topic}"`, "Set up your workspace / tools", "Find 2 reference resources", "Write a one-sentence success definition"],
    [`Study the fundamentals of ${topic}`, "Take structured notes on key ideas", "Summarise in your own words", `Identify the hardest part of ${topic}`],
    [`Build a minimal demo related to ${topic}`, "Experiment — break something and fix it", "Commit your practice code / notes", "List 3 things that didn't work and why"],
    ["Re-read your notes from the past 2 days", "Explain the concept out loud", "Fill in any gaps you noticed", "Write a short summary you could share"],
    [`Solve 2–3 exercises related to ${topic}`, "Time-box each problem to one Pomodoro", "Review solutions and note alternative approaches", "Add tricky problems to a spaced-repetition list"],
    [`Extend your demo with one new feature`, "Write or update a README / notes doc", "Test your work against the original goal", "Identify the next small step for tomorrow"],
    ["Review the whole week's progress", "Update your roadmap based on what you learned", "Celebrate wins — note what clicked this week", "Plan the top 3 priorities for next week"],
  ];

  function sessionTitle(phaseIdx: number, slotIdx: number, dayNum: number): string {
    const [phaseLabel] = phases[phaseIdx % phases.length]!;
    if (slotIdx === 0) return `${phaseLabel} — ${topic}`;
    if (slotIdx === 1) return `Deep work block ${dayNum}-${slotIdx}: ${topic}`;
    if (slotIdx === 2) return `Practice block ${dayNum}-${slotIdx} — ${topic}`;
    return `Review & consolidate (${dayNum}-${slotIdx}) — ${topic}`;
  }

  const roadmap: RoadmapDay[] = [];
  for (let d = 1; d <= numDays; d++) {
    const phaseIdx = (d - 1) % phases.length;
    const focusSessions = Array.from({ length: pomodoros }, (_, i) => sessionTitle(phaseIdx, i, d));
    const bank = taskBanks[phaseIdx % taskBanks.length]!;
    const tasks = bank.slice(0, tasksPerDay);
    if (d === 1 && currentProgress?.trim()) {
      tasks.unshift(`Pick up from: "${currentProgress.trim().slice(0, 80)}"`);
      tasks.splice(tasksPerDay + 1);
    }
    roadmap.push({ day: d, focusSessions, tasks, estimatedTime: pomodoros * 25 + (pomodoros - 1) * 5 });
  }
  return roadmap;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post("/ai/roadmap", authMiddleware, async (req: any, res) => {
  const { goal, dailyHours, level, deadline, currentProgress } = req.body as {
    goal?: string;
    dailyHours?: number;
    level?: string;
    deadline?: string;
    currentProgress?: string;
  };

  if (!goal?.trim()) {
    res.status(400).json({ error: "Goal is required" });
    return;
  }

  const hours = Math.min(12, Math.max(0.5, Number(dailyHours) || 2));

  let numDays = 7;
  if (deadline?.trim()) {
    const parsed = new Date(deadline.trim());
    if (!isNaN(parsed.getTime())) {
      const diff = Math.ceil((parsed.getTime() - Date.now()) / 86400000);
      if (diff > 0) numDays = Math.min(14, Math.max(3, diff));
    }
  }

  try {
    const geminiRoadmap = await generateRoadmapWithGemini(
      goal.trim(),
      hours,
      level ?? "intermediate",
      numDays,
      currentProgress,
    );

    const roadmap = geminiRoadmap ?? buildRoadmapFallback(
      goal.trim(),
      hours,
      level ?? "intermediate",
      numDays,
      currentProgress,
    );

    res.json({ roadmap, aiPowered: !!geminiRoadmap });
  } catch (err) {
    logger.error({ err }, "ai/roadmap error");
    res.status(500).json({ error: "Failed to generate roadmap" });
  }
});

export { router as aiRouter };
