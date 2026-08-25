/**
 * Streak endangerment (Workstream K) — a serverless, lazy, idempotent tick
 * that warns a user whose streak is at risk of dying at midnight IST.
 *
 * Pattern (no cron, per repo rules): any authenticated request that touches
 * /api/streak runs this check for that user. Conditions:
 *   - streak >= 2 days (a 1-day streak isn't worth an interrupt)
 *   - last study day is NOT today (IST)
 *   - it's after 16:00 IST (less than 8h left before the streak dies)
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
import { istDayStartUtc, istHour, istToday } from "./istDate";

const DANGER_HOUR_IST = 16;

export async function ensureStreakEndangerment(userId: string): Promise<void> {
  try {
    const now = new Date();
    if (istHour(now) < DANGER_HOUR_IST) return;
    const today = istToday(now);

    const [streak] = await db
      .select({
        currentStreak: studyStreaksTable.currentStreak,
        lastStudyDate: studyStreaksTable.lastStudyDate,
      })
      .from(studyStreaksTable)
      .where(eq(studyStreaksTable.userId, userId))
      .limit(1);

    if (!streak || streak.currentStreak < 2) return;
    if (streak.lastStudyDate === today) return; // already focused today

    // Throttle: one nudge per user per IST day.
    const startOfIstToday = istDayStartUtc(today);
    const startOfIstTomorrow = startOfIstToday + 24 * 60 * 60 * 1000;
    const [alreadySent] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          eq(notificationsTable.type, "streak_endangerment"),
          gte(notificationsTable.createdAt, new Date(startOfIstToday)),
          lt(notificationsTable.createdAt, new Date(startOfIstTomorrow)),
        )
      )
      .limit(1);
    if (alreadySent) return;

    const title = `Your ${streak.currentStreak}-day streak is in danger`;
    const message =
      streak.currentStreak >= 7
        ? `One focus session keeps your ${streak.currentStreak}-day streak alive. It resets at midnight IST.`
        : `Complete one session before midnight IST to keep your ${streak.currentStreak}-day streak going.`;

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
