/**
 * Pure planning logic for first-run personalisation.
 *
 * Everything here is deterministic and database-free on purpose:
 *
 *  1. **Never a blank account.** The template week and starter deck mean a new
 *     learner gets a plan with zero AI keys configured. Gemini is an upgrade on
 *     top of the templates, not a dependency.
 *  2. **Nothing a model returns lands raw.** `normalizeTasks` clamps text
 *     length, minutes and priority, so a hallucinated 900-minute task cannot
 *     appear in someone's list on day one.
 *  3. **Testable without Postgres.** The route keeps the I/O; the shape lives
 *     here, which is why `onboardingPlan.test.ts` can pin it.
 */
import { DREAM_TYPES, DREAM_SYSTEMS } from "./dreamSystems";

export interface KickoffTask {
  text: string;
  minutes: number;
  category: string;
  priority: "low" | "medium" | "high";
}

export const KICKOFF_CATEGORY = "Kickoff";

/** Clamp a request/AI value to something a human can actually do today. */
export function clampMinutes(value: unknown, fallback = 30, max = 180): number {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(max, Math.max(10, Math.round(minutes)));
}

/** Daily target: the same 30–600 band the route accepts, shared so they drift apart never. */
export function clampDailyTarget(value: unknown, fallback = 120): number {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(600, Math.max(30, Math.round(minutes)));
}

/**
 * The template week: shaped by the hours the learner said they have and by the
 * dream they picked, not by a generic checklist. Day 1–7, one action each.
 */
export function templateWeek(dreamType: string, dailyMinutes: number): KickoffTask[] {
  const system = DREAM_SYSTEMS[dreamType] ?? DREAM_SYSTEMS.custom!;
  const deep = system.blocks.find(b => b.kind === "deep") ?? system.blocks[0]!;
  const review = system.blocks.find(b => b.kind === "review") ?? system.blocks[0]!;
  const output = system.blocks.find(b => b.kind === "output") ?? system.blocks[0]!;
  const subjectList = system.subjects.map(s => s.name).join(", ");
  const padded = Math.max(25, Math.min(clampDailyTarget(dailyMinutes), 600));

  return [
    { text: `Set up your study space and block ${Math.round(padded / 60 * 10) / 10}h today — first session is ${deep.minutes} minutes of ${deep.label.toLowerCase()}`, minutes: deep.minutes, category: KICKOFF_CATEGORY, priority: "high" },
    { text: `Write your subject plan for the week: ${subjectList}`, minutes: 25, category: KICKOFF_CATEGORY, priority: "high" },
    { text: `${output.label} — produce something, however rough`, minutes: output.minutes, category: KICKOFF_CATEGORY, priority: "medium" },
    { text: `${review.label} — revisit what you made on day 1`, minutes: review.minutes, category: KICKOFF_CATEGORY, priority: "medium" },
    { text: `Run a timed practice block (${Math.max(30, Math.round(deep.minutes * 0.7))} min) with no interruptions`, minutes: Math.max(30, Math.round(deep.minutes * 0.7)), category: KICKOFF_CATEGORY, priority: "high" },
    { text: `Review the week: what actually worked, and what to drop`, minutes: 20, category: KICKOFF_CATEGORY, priority: "medium" },
    { text: `Plan next week — keep the parts that worked, replace the rest`, minutes: 30, category: KICKOFF_CATEGORY, priority: "low" },
  ];
}

/**
 * A starter deck that is genuinely useful before any AI is involved: the
 * habits that decide whether the plan survives week two.
 */
export function templateCards(dreamType: string, dailyMinutes: number): Array<{ front: string; back: string }> {
  const system = DREAM_SYSTEMS[dreamType] ?? DREAM_SYSTEMS.custom!;
  const type = DREAM_TYPES.find(d => d.id === dreamType);
  return [
    { front: `What is my plan's daily target?`, back: `${dailyMinutes} focused minutes a day (${system.blocks.map(b => `${b.minutes}m ${b.label}`).join(" · ")}).` },
    { front: `What is my daily non-negotiable habit?`, back: system.dailyHabit },
    { front: `What question should I ask myself at the end of each session?`, back: system.checkIn },
    { front: `Where does my time go, by subject?`, back: system.subjects.map(s => `${s.name} ${s.percent}%`).join(", ") },
    { front: `How does a focus session start here?`, back: "Open the timer, pick the subject, start the block. Distractions go on the parking list instead of interrupting." },
    { front: `What do I do when I miss a day?`, back: "Do the smallest possible session today. A 10-minute block keeps the streak and the identity intact — missing twice is what breaks it." },
    { front: `What never counts as progress?`, back: "Re-watching, re-reading and re-planning. Progress is a finished session, a solved problem, or a written page." },
    { front: `Why this dream?`, back: `${type?.label ?? "Your own goal"} — ${type?.desc ?? "the path you chose"}. When it gets boring, that sentence is the reason to continue.` },
  ];
}

/** Pull the first JSON array out of a model reply. */
export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const PRIORITIES = new Set(["low", "medium", "high"]);

/**
 * Turn a model reply into tasks a human can start today. Anything too vague
 * (under 8 characters), too long (over 140), or too extreme (over 180 minutes,
 * under 10) is clamped or dropped rather than trusted.
 */
export function normalizeTasks(text: string, maxTasks = 7): KickoffTask[] {
  const raw = extractJsonArray(text);
  return raw
    .map(entry => {
      const item = entry as { text?: unknown; minutes?: unknown; priority?: unknown };
      const taskText = typeof item.text === "string" ? item.text.trim().slice(0, 140) : "";
      if (taskText.length < 8) return null;
      const priority = typeof item.priority === "string" && PRIORITIES.has(item.priority)
        ? item.priority as KickoffTask["priority"]
        : "medium";
      return {
        text: taskText,
        minutes: clampMinutes(item.minutes),
        category: KICKOFF_CATEGORY,
        priority,
      } satisfies KickoffTask;
    })
    .filter((t): t is KickoffTask => t !== null)
    .slice(0, maxTasks);
}

/** A generated week replaces the template only when it is a real week. */
export const MIN_AI_TASKS = 4;

export function planBody(payload: {
  dreamType?: unknown; dailyTargetMinutes?: unknown; studyWindow?: unknown;
  targetDate?: unknown; subjects?: unknown;
}) {
  const dreamType = typeof payload.dreamType === "string" && DREAM_SYSTEMS[payload.dreamType] ? payload.dreamType : "custom";
  const studyWindow = payload.studyWindow === "morning" || payload.studyWindow === "afternoon" || payload.studyWindow === "night"
    ? payload.studyWindow
    : "morning";
  const targetDate = typeof payload.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.targetDate)
    ? payload.targetDate
    : null;
  const subjects = Array.isArray(payload.subjects)
    ? payload.subjects.filter((s): s is string => typeof s === "string").map(s => s.trim().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];
  return { dreamType, dailyTargetMinutes: clampDailyTarget(payload.dailyTargetMinutes), studyWindow, targetDate, subjects };
}
