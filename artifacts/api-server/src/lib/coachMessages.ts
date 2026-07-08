/**
 * FocusArx AI Coach Message Templates (Server-Side)
 *
 * Used to enrich the Groq system prompt with pre-built message guidance,
 * and as fallbacks when the AI API is unavailable.
 *
 * 10 templates covering all major user states:
 *   After session, partial session, habit check-in, weekly summary (good/slow),
 *   streak milestone, missed day, streak lost, first session, low readiness.
 */

export interface CoachMessageTemplate {
  id: string;
  trigger: string;
  message: string;
  cta?: string;
}

/** All 10 coach message templates */
export const COACH_MESSAGES: CoachMessageTemplate[] = [
  {
    id: "session_complete",
    trigger: "User completed a full focus session",
    message: "That session is in the books. Every minute of focused work is a deposit into your expertise account. Your brain just got better at something. What's next?",
    cta: "Start Next Session",
  },
  {
    id: "session_short",
    trigger: "User completed less than 50% of their planned session",
    message: "15 minutes of real focus still beats 2 hours of distracted studying. What made it hard to stay in? Remove that obstacle before your next session.",
    cta: "Log a Distraction",
  },
  {
    id: "habit_checked",
    trigger: "User marked a daily habit complete",
    message: "Checked. Small actions done daily create permanent change. Your future self is being built right now, one check-in at a time. Don't break the chain.",
  },
  {
    id: "weekly_good",
    trigger: "User had 5+ sessions this week (Sunday summary)",
    message: "Strong week. Five sessions means you showed up five times when it would have been easier not to. Consistency — not talent — is what separates achievers from intenders.",
    cta: "See My Weekly Report",
  },
  {
    id: "weekly_slow",
    trigger: "User had fewer than 3 sessions this week (Sunday summary)",
    message: "Quiet week. Life happens. Name one specific time slot this week where you'll do your first session. Time-blocking beats motivation every time.",
    cta: "Plan My Week",
  },
  {
    id: "streak_milestone",
    trigger: "User reached a streak milestone (7/14/21/30 days)",
    message: "{{STREAK_DAYS}} days in a row. That's not motivation — that's identity. You're no longer someone trying to build a focus habit. You're someone who has one.",
  },
  {
    id: "missed_day",
    trigger: "User hasn't studied today and has an active streak (23+ hours idle)",
    message: "Your streak is still alive, but the clock is ticking. You don't need a perfect session. Open the app, set a 25-minute timer, and start. Future you will be grateful.",
    cta: "Save My Streak",
  },
  {
    id: "streak_lost",
    trigger: "User's streak reset to 0",
    message: "Streak reset. It hurts — and that's good, because it means it mattered. Your XP, level, and progress are all still here. The only thing that matters now is what you do in the next 24 hours.",
    cta: "Start Rebuilding",
  },
  {
    id: "first_session",
    trigger: "User starts their first focus session of the day",
    message: "The hardest session is always the first. You've already won by starting. For the next {{DURATION}} minutes, this task is your entire world.",
  },
  {
    id: "low_readiness",
    trigger: "User's readiness score is below 40",
    message: "Low energy today — that's data, not failure. Reduce your session target by 25%. A mediocre session is infinitely better than no session, and often turns into a great one.",
    cta: "Start a Shorter Session",
  },
];

/** Resolve {{VARIABLE}} placeholders in message templates */
export function resolveCoachTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, value]) => msg.replace(new RegExp(`{{${key}}}`, "g"), value),
    template
  );
}

/** Select the best fallback message for the given user context */
export function selectCoachFallback(context: {
  completionPercentage?: number;
  streakDays?: number;
  streakLost?: boolean;
  missedDay?: boolean;
  isFirstSession?: boolean;
  readinessScore?: number;
}): CoachMessageTemplate {
  if (context.streakLost) return COACH_MESSAGES.find(m => m.id === "streak_lost")!;
  if (context.missedDay) return COACH_MESSAGES.find(m => m.id === "missed_day")!;
  if (context.streakDays && [7, 14, 21, 30, 60, 100].includes(context.streakDays))
    return COACH_MESSAGES.find(m => m.id === "streak_milestone")!;
  if (context.isFirstSession) return COACH_MESSAGES.find(m => m.id === "first_session")!;
  if (context.readinessScore !== undefined && context.readinessScore < 40)
    return COACH_MESSAGES.find(m => m.id === "low_readiness")!;
  if (context.completionPercentage !== undefined && context.completionPercentage < 50)
    return COACH_MESSAGES.find(m => m.id === "session_short")!;
  return COACH_MESSAGES.find(m => m.id === "session_complete")!;
}
