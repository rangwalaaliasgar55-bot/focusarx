/**
 * Quest progression.
 *
 * Quests were assigned (`/quests` picks three daily definitions per user) and
 * claimable, but nothing ever advanced `user_quest_progress.current` — every
 * quest sat at 0/target forever and the claim endpoint could never fire. This
 * module is the missing half: session completion, task completion, streak
 * changes and coin/XP credits all report here, and the matching metric's rows
 * for the current daily and weekly periods move forward.
 *
 * Metrics match the admin Quest Builder (`AdminQuestsPanel.REQ_TYPES`):
 *   focus_minutes  — cumulative, adds `value`
 *   session_count  — cumulative, adds `value`
 *   coins_earned   — cumulative, adds `value`
 *   xp_earned      — cumulative, adds `value`
 *   streak_days    — a level, not a sum: `current = max(current, value)`
 *
 * Period keys mirror `routes/quests.ts` (`YYYY-MM-DD` / `week-YYYY-MM-DD`) and
 * are computed in the user's own calendar zone, the same zone streaks and
 * productivity logs use, so a quest that says "today" means the user's today.
 */
import { db, questDefinitionsTable, userQuestProgressTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { dayKeyInZone, shiftDayKey } from "./timezone";

export type QuestMetric =
  | "focus_minutes"
  | "session_count"
  | "coins_earned"
  | "xp_earned"
  | "streak_days";

export const QUEST_METRICS: readonly QuestMetric[] = [
  "focus_minutes",
  "session_count",
  "coins_earned",
  "xp_earned",
  "streak_days",
];

const LEVEL_METRICS: ReadonlySet<QuestMetric> = new Set(["streak_days"]);

/** Daily period key for `now` in `zone`. */
export function questDailyPeriod(now: number | Date, zone: string): string {
  return dayKeyInZone(now, zone);
}

/** Weekly period key (`week-<monday>`) for `now` in `zone`. */
export function questWeeklyPeriod(now: number | Date, zone: string): string {
  const today = dayKeyInZone(now, zone);
  let weekday = 1;
  try {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(
      typeof now === "number" ? new Date(now) : now,
    );
    weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[day] ?? 1;
  } catch {
    /* fall through to Monday */
  }
  return `week-${shiftDayKey(today, -(weekday - 1))}`;
}

/** Pure progression rule — exported so it can be unit-tested without a DB. */
export function nextQuestValue(metric: QuestMetric, current: number, value: number): number {
  if (LEVEL_METRICS.has(metric)) return Math.max(current, value);
  return current + value;
}

/**
 * Advance every assigned, unclaimed quest of `metric` for the user in the
 * current daily and weekly periods. Best-effort: never throws to the caller,
 * because quest bookkeeping must not fail a session completion.
 */
export async function updateQuestProgress(
  userId: string,
  metric: QuestMetric,
  value: number,
  zone: string,
  now: number = Date.now(),
): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) return;
  try {
    const periods = [questDailyPeriod(now, zone), questWeeklyPeriod(now, zone)];
    const rows = await db
      .select({
        id: userQuestProgressTable.id,
        questId: userQuestProgressTable.questId,
        current: userQuestProgressTable.current,
        completed: userQuestProgressTable.completed,
        claimedAt: userQuestProgressTable.claimedAt,
      })
      .from(userQuestProgressTable)
      .where(and(eq(userQuestProgressTable.userId, userId), inArray(userQuestProgressTable.period, periods)));
    if (rows.length === 0) return;

    const defs = await db
      .select({ id: questDefinitionsTable.id, metric: questDefinitionsTable.metric, target: questDefinitionsTable.target })
      .from(questDefinitionsTable)
      .where(inArray(questDefinitionsTable.id, rows.map((r) => r.questId)));
    const defById = new Map(defs.map((d) => [d.id, d]));

    for (const row of rows) {
      const def = defById.get(row.questId);
      if (!def || def.metric !== metric || row.claimedAt) continue;
      const next = nextQuestValue(metric, row.current, value);
      if (next === row.current) continue;
      const completed = row.completed || next >= def.target;
      await db
        .update(userQuestProgressTable)
        .set({ current: next, completed })
        .where(eq(userQuestProgressTable.id, row.id));
    }
  } catch (err) {
    logger.error({ err, userId, metric }, "updateQuestProgress error");
  }
}
