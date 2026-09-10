/**
 * Streak endangerment (Workstream K) — a serverless, lazy, idempotent tick
 * that warns a user whose streak is at risk of dying at their local midnight.
 *
 * Pattern (no cron, per repo rules): any authenticated request that touches
 * /api/streak runs this check for that user. Conditions:
 *   - streak >= 2 days (a 1-day streak isn't worth an interrupt)
 *   - last study day is NOT today (user-local)
 *   - it's after 16:00 user-local (less than 8h left before the streak dies)
 *   - no endangerment nudge sent yet today (notifications table acts as the
 *     throttle)
 *
 * Sends an in-app notification plus a Web Push if the user has subscriptions.
 * Every step is best-effort: a failure here must never break /api/streak.
 */
import { db, studyStreaksTable, notificationsTable } from "@workspace/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { sendPush } from "./pushSender";
import { logger } from "./logger";
import { clockInZone, dayKeyInZone, dayStartInZone, shiftDayKey } from "./timezone";
import { userZone } from "./userZone";

const DANGER_HOUR_LOCAL = 16;

export type EndangermentInput = {
  now?: Date;
  zone: string;
  currentStreak: number;
  lastStudyDate: string | null;
};

/**
 * Pure nudge decision, unit-tested. All calendar math is in the user's own
 * IANA zone; users without an adopted zone resolve to the legacy IST
 * calendar via `userZone`, preserving today's behaviour for them.
 */
export function endangermentDue(input: EndangermentInput): { due: boolean; today: string } {
  const now = input.now ?? new Date();
  const today = dayKeyInZone(now, input.zone);
  if (input.currentStreak < 2) return { due: false, today };
  if (input.lastStudyDate === today) return { due: false, today }; // already focused today
  if (clockInZone(now, input.zone).hour < DANGER_HOUR_LOCAL) return { due: false, today };
  return { due: true, today };
}

export async function ensureStreakEndangerment(userId: string): Promise<void> {
  try {
    const now = new Date();
    const zone = await userZone(userId);

    const [streak] = await db
      .select({
        currentStreak: studyStreaksTable.currentStreak,
        lastStudyDate: studyStreaksTable.lastStudyDate,
      })
      .from(studyStreaksTable)
      .where(eq(studyStreaksTable.userId, userId))
      .limit(1);

    if (!streak) return;
    const { due, today } = endangermentDue({
      now,
      zone,
      currentStreak: streak.currentStreak,
      lastStudyDate: streak.lastStudyDate,
    });
    if (!due) return;

    // Throttle: one nudge per user per local day. Both window edges are real
    // midnights in-zone (DST-safe), not ±24 h arithmetic.
    const windowStart = dayStartInZone(today, zone);
    const windowEnd = dayStartInZone(shiftDayKey(today, 1), zone);
    const [alreadySent] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          eq(notificationsTable.type, "streak_endangerment"),
          gte(notificationsTable.createdAt, windowStart),
          lt(notificationsTable.createdAt, windowEnd),
        )
      )
      .limit(1);
    if (alreadySent) return;

    const title = `Your ${streak.currentStreak}-day streak is in danger`;
    const message =
      streak.currentStreak >= 7
        ? `One focus session keeps your ${streak.currentStreak}-day streak alive. It resets at midnight.`
        : `Complete one session before midnight to keep your ${streak.currentStreak}-day streak going.`;

    await db.insert(notificationsTable).values({
      userId,
      type: "streak_endangerment",
      title,
      message,
      data: { streak: streak.currentStreak, day: today },
    });

    void sendPush(userId, { title, body: message, url: "/" }).catch(() => {});
    logger.info({ streak: streak.currentStreak }, "streak endangerment nudge sent");
  } catch {
    // Never break the streak endpoint for a nudge.
  }
}
