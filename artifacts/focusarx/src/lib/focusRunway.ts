/**
 * Focus Runway is a web-native day planner. It makes the task list actionable
 * without pretending a browser can manage a desktop calendar or other apps.
 *
 * A plan is intentionally a small, deterministic local artifact: it can be
 * regenerated at any point, is saved per browser day, and never needs to send
 * a user's proposed schedule to an AI provider just to put tasks in order.
 */

export type RunwayTask = {
  id: string;
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  estimatedPomodoros?: number;
  dueDate?: string | null;
};

export type RunwayBlock = {
  id: string;
  kind: "focus" | "reset";
  taskId: string | null;
  title: string;
  minutes: number;
  startsAtMinute: number;
  endsAtMinute: number;
};

export type FocusRunwayPlan = {
  version: 1;
  day: string;
  generatedAt: number;
  blocks: RunwayBlock[];
  unscheduledTaskIds: string[];
};

export const FOCUS_RUNWAY_STORAGE_KEY = "focusarx-focus-runway-v1";
const DAY_START = 9 * 60;
const DAY_END = 19 * 60;
const BREAK_AFTER_MINUTES = 90;
const RESET_MINUTES = 10;

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function roundUpToFive(minute: number): number {
  return Math.ceil(minute / 5) * 5;
}

export function formatRunwayTime(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function priorityWeight(priority: RunwayTask["priority"]): number {
  if (priority === "urgent") return -1;
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function taskLength(task: RunwayTask): number {
  // A task should be approachable. Split very large estimates across later
  // auto-plans rather than putting a three-hour wall in front of the user.
  return Math.max(25, Math.min(90, (task.estimatedPomodoros ?? 1) * 25));
}

/** Order urgent/due-today work before routine work, with a stable title tie-break. */
export function sortRunwayTasks(tasks: RunwayTask[], day: string): RunwayTask[] {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueDate === day ? 0 : 1;
    const bDue = b.dueDate === day ? 0 : 1;
    return aDue - bDue || priorityWeight(a.priority) - priorityWeight(b.priority) || a.title.localeCompare(b.title);
  });
}

/**
 * Build a realistic workday rather than a packed calendar: insert a short reset
 * after 90 focus minutes and retain any overflow as an honest unscheduled list.
 */
export function buildFocusRunway(tasks: RunwayTask[], options: { day?: string; startAtMinute?: number; generatedAt?: number } = {}): FocusRunwayPlan {
  const day = options.day ?? localDayKey();
  let cursor = Math.max(DAY_START, roundUpToFive(options.startAtMinute ?? DAY_START));
  let focusSinceReset = 0;
  const blocks: RunwayBlock[] = [];
  const unscheduledTaskIds: string[] = [];

  for (const task of sortRunwayTasks(tasks, day)) {
    const minutes = taskLength(task);
    if (focusSinceReset > 0 && focusSinceReset + minutes > BREAK_AFTER_MINUTES) {
      if (cursor + RESET_MINUTES > DAY_END) { unscheduledTaskIds.push(task.id); continue; }
      blocks.push({
        id: `reset-${blocks.length}-${cursor}`,
        kind: "reset",
        taskId: null,
        title: "Step away and reset",
        minutes: RESET_MINUTES,
        startsAtMinute: cursor,
        endsAtMinute: cursor + RESET_MINUTES,
      });
      cursor += RESET_MINUTES;
      focusSinceReset = 0;
    }
    if (cursor + minutes > DAY_END) { unscheduledTaskIds.push(task.id); continue; }
    blocks.push({
      id: `focus-${task.id}-${cursor}`,
      kind: "focus",
      taskId: task.id,
      title: task.title,
      minutes,
      startsAtMinute: cursor,
      endsAtMinute: cursor + minutes,
    });
    cursor += minutes;
    focusSinceReset += minutes;
  }

  return { version: 1, day, generatedAt: options.generatedAt ?? Date.now(), blocks, unscheduledTaskIds };
}

export type RunwayStatus = "done" | "running" | "up-next" | "missed" | "planned";

/** Derive live labels from the clock and current task completion, not stale writes. */
export function runwayStatus(block: RunwayBlock, nowMinute: number, completedTaskIds: Set<string>): RunwayStatus {
  if (block.kind === "focus" && block.taskId && completedTaskIds.has(block.taskId)) return "done";
  if (nowMinute >= block.startsAtMinute && nowMinute < block.endsAtMinute) return "running";
  if (nowMinute >= block.endsAtMinute) return "missed";
  return "planned";
}

/** The first future / active block becomes the single clear next action. */
export function nextRunwayBlock(blocks: RunwayBlock[], nowMinute: number, completedTaskIds: Set<string>): RunwayBlock | null {
  return blocks.find((block) => {
    const status = runwayStatus(block, nowMinute, completedTaskIds);
    return status === "running" || status === "planned";
  }) ?? null;
}

export function readFocusRunway(day = localDayKey()): FocusRunwayPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOCUS_RUNWAY_STORAGE_KEY) ?? "null") as Partial<FocusRunwayPlan> | null;
    if (!parsed || parsed.version !== 1 || parsed.day !== day || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.unscheduledTaskIds)) return null;
    return parsed as FocusRunwayPlan;
  } catch { return null; }
}

export function saveFocusRunway(plan: FocusRunwayPlan): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FOCUS_RUNWAY_STORAGE_KEY, JSON.stringify(plan)); } catch { /* storage is optional */ }
}
