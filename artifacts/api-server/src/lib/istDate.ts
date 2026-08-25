/**
 * IST (Asia/Kolkata, UTC+5:30) calendar helpers — pure, no DB, unit testable.
 * The product is India-first: streaks, daily missions and end-of-day nudges
 * all key off the IST calendar day, never the UTC one.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Current calendar day in IST, as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Current hour (0–23) in IST. */
export function istHour(now: Date = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
}

/** UTC instant of the start of the given IST day (YYYY-MM-DD). */
export function istDayStartUtc(istDay: string): number {
  return new Date(`${istDay}T00:00:00+05:30`).getTime();
}
