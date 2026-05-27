import { Router } from "express";
import { extractUserId } from "./auth";

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
// Built-in smart planner — no external API required
// ---------------------------------------------------------------------------

function buildRoadmap(
  goal: string,
  dailyHours: number,
  level: string,
  numDays: number,
  currentProgress?: string,
): RoadmapDay[] {
  const hours = Math.min(12, Math.max(0.5, dailyHours));
  const pomodoros = Math.max(1, Math.round((hours * 60) / 25));
  const tasksPerDay = pomodoros <= 2 ? 2 : pomodoros <= 4 ? 3 : 4;

  // Derive a short topic from the goal (first ~4 meaningful words)
  const stopWords = new Set(["a", "an", "the", "to", "of", "in", "on", "and", "for", "with", "how", "my", "i", "we"]);
  const topic = goal
    .split(/\s+/)
    .filter((w) => !stopWords.has(w.toLowerCase()))
    .slice(0, 4)
    .join(" ");

  const levelLabel = level === "beginner" ? "Foundations" : level === "advanced" ? "Advanced" : "Core";

  // Phase labels that rotate across days to give structure
  const phases: [string, string][] = [
    ["Research & planning", "Map out the key concepts"],
    [levelLabel + " concepts", "Deep-dive into core material"],
    ["Hands-on practice", "Build a small working example"],
    ["Review & consolidate", "Reinforce yesterday's learning"],
    ["Problem solving", "Work through exercises and edge cases"],
    ["Project work", "Apply skills to your real goal"],
    ["Reflect & iterate", "Review progress, adjust the plan"],
  ];

  // Generic task banks keyed by phase index
  const taskBanks: string[][] = [
    // 0 — Research & planning
    [
      `List 5 sub-topics needed to reach: "${topic}"`,
      "Set up your workspace / tools",
      "Find 2 reference resources (docs, videos, books)",
      "Write a one-sentence success definition",
    ],
    // 1 — Core concepts
    [
      `Study the fundamentals of ${topic}`,
      "Take structured notes on key ideas",
      "Summarise what you learned in your own words",
      `Identify the hardest part of ${topic} so far`,
    ],
    // 2 — Hands-on practice
    [
      `Build a minimal working demo related to ${topic}`,
      "Experiment — break something and fix it",
      "Commit your practice code / notes",
      "List 3 things that didn't work and why",
    ],
    // 3 — Review & consolidate
    [
      "Re-read your notes from the past 2 days",
      "Explain the concept out loud (rubber-duck method)",
      "Fill in any gaps you noticed",
      "Write a short summary you could share with a friend",
    ],
    // 4 — Problem solving
    [
      `Solve 2–3 exercises related to ${topic}`,
      "Time-box each problem to one Pomodoro",
      "Review solutions and note alternative approaches",
      "Add tricky problems to a spaced-repetition list",
    ],
    // 5 — Project work
    [
      `Extend your demo with one new feature toward your goal`,
      "Write or update a README / notes doc",
      "Test your work against the original goal definition",
      "Identify the next small step for tomorrow",
    ],
    // 6 — Reflect & iterate
    [
      "Review the whole week's progress",
      "Update your roadmap based on what you learned",
      "Celebrate wins — note what clicked this week",
      "Plan the top 3 priorities for the next week",
    ],
  ];

  // Build session titles for each pomodoro slot
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
    const focusSessions = Array.from({ length: pomodoros }, (_, i) =>
      sessionTitle(phaseIdx, i, d),
    );

    const bank = taskBanks[phaseIdx % taskBanks.length]!;
    const tasks = bank.slice(0, tasksPerDay);

    // On day 1 prepend a progress-aware task if currentProgress was given
    if (d === 1 && currentProgress?.trim()) {
      tasks.unshift(`Pick up from: "${currentProgress.trim().slice(0, 80)}"`);
      tasks.splice(tasksPerDay + 1); // keep count consistent
    }

    const estimatedTime = pomodoros * 25 + (pomodoros - 1) * 5; // sessions + short breaks

    roadmap.push({ day: d, focusSessions, tasks, estimatedTime });
  }

  return roadmap;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post("/ai/roadmap", authMiddleware, (req: any, res) => {
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

  // Work out how many days to plan
  let numDays = 7;
  if (deadline?.trim()) {
    const parsed = new Date(deadline.trim());
    if (!isNaN(parsed.getTime())) {
      const diff = Math.ceil((parsed.getTime() - Date.now()) / 86400000);
      if (diff > 0) numDays = Math.min(14, Math.max(3, diff));
    }
  }

  const roadmap = buildRoadmap(
    goal.trim(),
    hours,
    level ?? "intermediate",
    numDays,
    currentProgress,
  );

  res.json({ roadmap });
});

export { router as aiRouter };
