/**
 * FocusArx AI Coach Message Templates
 *
 * 10 handcrafted message templates for different trigger conditions.
 * These serve as:
 *   1. Fallback messages when the Groq API is unavailable (offline / rate-limited)
 *   2. Starting-point templates for the AI coach prompt engineering
 *   3. Push notification copy for automated nudges
 *
 * Each template has:
 *   - trigger: when to fire the message
 *   - message: concise, actionable copy (≤ 60 words)
 *   - cta: optional button label for in-app display
 *   - tone: the emotional register of the message
 */

export interface CoachMessage {
  id: string;
  trigger: string;
  message: string;
  cta?: string;
  tone: "celebratory" | "motivational" | "gentle" | "analytical" | "encouraging";
}

// ─── 1. After a Full Focus Session (Normal Completion) ──────────────────────
// Trigger: session.mode === "focus" && session.durationSeconds >= plannedDuration
export const MESSAGE_SESSION_COMPLETE: CoachMessage = {
  id: "session_complete",
  trigger: "User completed a full planned focus session",
  message: "That session is in the books. Every minute of focused work is a deposit into your expertise account. Your brain just got better at something. What's the next block?",
  cta: "Start Next Session",
  tone: "celebratory",
};

// ─── 2. After a Short/Partial Session (< 50% completion) ───────────────────
// Trigger: completionPercentage < 50
export const MESSAGE_SESSION_SHORT: CoachMessage = {
  id: "session_short",
  trigger: "User completed less than 50% of their planned session",
  message: "15 minutes of real focus still beats 2 hours of distracted studying. Don't count it as a failure — count it as data. What made it hard to stay in? Remove that obstacle before your next session.",
  cta: "Log a Distraction",
  tone: "encouraging",
};

// ─── 3. After Habit Check-In ────────────────────────────────────────────────
// Trigger: user marks a habit as complete for the day
export const MESSAGE_HABIT_CHECKED: CoachMessage = {
  id: "habit_checked",
  trigger: "User completed their daily habit check-in",
  message: "Checked. Small actions done daily create permanent change. Your future self is being built right now, one check-in at a time. Don't break the chain.",
  tone: "motivational",
};

// ─── 4. Weekly Summary (Good Week: ≥ 5 sessions) ───────────────────────────
// Trigger: Sunday, user completed ≥ 5 sessions this week
export const MESSAGE_WEEKLY_GOOD: CoachMessage = {
  id: "weekly_good",
  trigger: "User had a productive week (5+ sessions)",
  message: "Strong week. Five sessions means you showed up five times when it would have been easier not to. That consistency — not intelligence, not talent — is what separates people who achieve from people who intend to.",
  cta: "See My Weekly Report",
  tone: "celebratory",
};

// ─── 5. Weekly Summary (Slow Week: < 3 sessions) ───────────────────────────
// Trigger: Sunday, user completed < 3 sessions this week
export const MESSAGE_WEEKLY_SLOW: CoachMessage = {
  id: "weekly_slow",
  trigger: "User had a slow week (less than 3 sessions)",
  message: "Quiet week. Life happens. What matters is that you're here and the next week is a clean slate. One thing: name one specific time slot this week where you'll do your first session. Time-blocking beats motivation every time.",
  cta: "Plan My Week",
  tone: "gentle",
};

// ─── 6. Streak Milestone (7, 14, 21, 30 days) ──────────────────────────────
// Trigger: currentStreak reaches 7, 14, 21, or 30
export const MESSAGE_STREAK_MILESTONE: CoachMessage = {
  id: "streak_milestone",
  trigger: "User reached a streak milestone (7/14/21/30 days)",
  message: "{{STREAK_DAYS}} days in a row. That's not motivation — that's identity. You're no longer someone trying to build a focus habit. You're someone who has one. Guard this streak fiercely.",
  tone: "celebratory",
};

// ─── 7. Missed Day Warning (Streak at Risk) ─────────────────────────────────
// Trigger: user hasn't opened the app for 23+ hours and has a streak ≥ 2 days
export const MESSAGE_MISSED_DAY: CoachMessage = {
  id: "missed_day",
  trigger: "User hasn't studied today and has an active streak",
  message: "Hey — your streak is still alive, but the clock is ticking. You don't need a perfect session. Open the app, set a 25-minute timer, and start. That's all. Future you will be grateful.",
  cta: "Save My Streak",
  tone: "gentle",
};

// ─── 8. Streak Lost (After Missing a Day) ───────────────────────────────────
// Trigger: user's streak resets to 0
export const MESSAGE_STREAK_LOST: CoachMessage = {
  id: "streak_lost",
  trigger: "User's streak was reset to 0 after missing a day",
  message: "Streak reset. It hurts — and that's good, because it means it mattered. Your XP, your level, your progress — all still here. The only thing that matters now is what you do in the next 24 hours.",
  cta: "Start Rebuilding",
  tone: "encouraging",
};

// ─── 9. First Session of the Day ────────────────────────────────────────────
// Trigger: user starts their first focus session of the day
export const MESSAGE_FIRST_SESSION: CoachMessage = {
  id: "first_session",
  trigger: "User starts their first focus session of the day",
  message: "The hardest session is always the first. You've already won by starting. Close everything else. For the next {{DURATION}} minutes, this task is your entire world.",
  tone: "motivational",
};

// ─── 10. Low Readiness Day ──────────────────────────────────────────────────
// Trigger: readiness score < 40 when user opens the timer
export const MESSAGE_LOW_READINESS: CoachMessage = {
  id: "low_readiness",
  trigger: "User's readiness score is below 40 — they reported low energy",
  message: "Low energy today. That's data, not failure. Reduce your session target by 25%. Do the easiest task first to build momentum. A mediocre session is infinitely better than no session — and often turns into a great one.",
  cta: "Start a Shorter Session",
  tone: "analytical",
};

// ─── Exported collection ─────────────────────────────────────────────────────

export const ALL_COACH_MESSAGES: CoachMessage[] = [
  MESSAGE_SESSION_COMPLETE,
  MESSAGE_SESSION_SHORT,
  MESSAGE_HABIT_CHECKED,
  MESSAGE_WEEKLY_GOOD,
  MESSAGE_WEEKLY_SLOW,
  MESSAGE_STREAK_MILESTONE,
  MESSAGE_MISSED_DAY,
  MESSAGE_STREAK_LOST,
  MESSAGE_FIRST_SESSION,
  MESSAGE_LOW_READINESS,
];

/** Resolve template variables in a message string.
 *
 * Example:
 *   resolveTemplate(MESSAGE_STREAK_MILESTONE.message, { STREAK_DAYS: "21" })
 *   → "21 days in a row..."
 */
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, value]) => msg.replace(new RegExp(`{{${key}}}`, "g"), value),
    template
  );
}

/** Get the best fallback message for a given trigger context.
 *  Used when Groq API is unavailable.
 */
export function getCoachFallback(context: {
  completionPercentage?: number;
  streakDays?: number;
  streakLost?: boolean;
  missedDay?: boolean;
  isFirstSession?: boolean;
  readinessScore?: number;
  sessionDuration?: number;
}): CoachMessage {
  if (context.streakLost) return MESSAGE_STREAK_LOST;
  if (context.missedDay) return MESSAGE_MISSED_DAY;
  if (context.streakDays && [7, 14, 21, 30, 60, 100].includes(context.streakDays)) return MESSAGE_STREAK_MILESTONE;
  if (context.isFirstSession) return MESSAGE_FIRST_SESSION;
  if (context.readinessScore !== undefined && context.readinessScore < 40) return MESSAGE_LOW_READINESS;
  if (context.completionPercentage !== undefined && context.completionPercentage < 50) return MESSAGE_SESSION_SHORT;
  return MESSAGE_SESSION_COMPLETE;
}
