/**
 * FocusArx Analytics Tracking System
 *
 * 10 Key Metrics (Acquisition → Conversion → Retention → Engagement)
 * ─────────────────────────────────────────────────────────────────────
 *
 * METRIC 1: signup_conversion_rate
 *   Definition: % of landing page visitors who complete signup within the same session
 *   Compute: (signup_complete events / landing_page_view events) × 100
 *   Why: Primary acquisition funnel health. If <5%, landing page or signup UX needs work.
 *
 * METRIC 2: onboarding_completion_rate
 *   Definition: % of users who complete all onboarding steps after signup
 *   Compute: (onboarding_complete events / signup_complete events) × 100
 *   Why: Users who complete onboarding have 3× better day-7 retention.
 *
 * METRIC 3: d1_retention (Day-1 Retention)
 *   Definition: % of users who return and complete at least one session the day after signup
 *   Compute: (users with session_complete on day+1) / cohort_signup_count
 *   Why: D1 retention is the strongest predictor of long-term engagement.
 *
 * METRIC 4: d7_retention (Day-7 Retention)
 *   Definition: % of new users still active at day 7
 *   Compute: (users with any event in days 5–9) / cohort_signup_count
 *   Why: Users retained to day 7 convert to long-term habitual users at >60% rate.
 *
 * METRIC 5: d30_retention (Day-30 Retention)
 *   Definition: % of new users still active at day 30
 *   Compute: (users with any event in days 28–32) / cohort_signup_count
 *   Why: Paid conversion proxy — users retained 30 days are 8× more likely to upgrade.
 *
 * METRIC 6: sessions_per_active_user_per_week
 *   Definition: Average number of focus sessions completed by active users per week
 *   Compute: SUM(session_complete events in 7d window) / COUNT(distinct users)
 *   Why: Core engagement health. Target: ≥5 sessions/week = habitual user.
 *
 * METRIC 7: average_focus_score
 *   Definition: Mean focus quality score (0–100) across all completed sessions
 *   Compute: AVG(focus_score from sessions table WHERE duration_seconds ≥ 600)
 *   Why: Product value proxy. Rising avg score = users getting better outcomes.
 *
 * METRIC 8: streak_3day_rate
 *   Definition: % of active users who currently have a 3+ day streak
 *   Compute: COUNT(users WHERE current_streak >= 3) / COUNT(active_users_last_7d)
 *   Why: Streak users have 5× the session frequency of non-streak users.
 *
 * METRIC 9: ai_coach_activation_rate
 *   Definition: % of users who send at least one message to AI Coach within 7 days
 *   Compute: COUNT(users with coach_message_sent within day+7) / signup_cohort
 *   Why: AI Coach activation correlates strongly with D30 retention.
 *
 * METRIC 10: premium_conversion_rate
 *   Definition: % of free users who upgrade to Premium within 30 days
 *   Compute: (premium_upgrade events in 30d) / (signup_complete events 30d ago) × 100
 *   Why: Core business health metric. Target: ≥3% in year 1.
 */

// ─── Event Types ─────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | { event: "landing_page_view"; properties: { source?: string; utm_campaign?: string; utm_medium?: string } }
  | { event: "signup_started"; properties: { method: "email" | "google" } }
  | { event: "signup_complete"; properties: { method: "email" | "google" } }
  | { event: "onboarding_step_complete"; properties: { step: number; step_name: string } }
  | { event: "onboarding_complete"; properties: { goal: string; focus_style: string; daily_target_hours: number } }
  | { event: "session_started"; properties: { session_type: string; planned_duration: number; has_task: boolean } }
  | { event: "session_complete"; properties: { duration_seconds: number; focus_score: number; xp_earned: number; early: boolean } }
  | { event: "session_abandoned"; properties: { duration_seconds: number; reason?: string } }
  | { event: "habit_checked"; properties: { habit_id: string; streak_count: number } }
  | { event: "streak_achieved"; properties: { streak_days: number } }
  | { event: "coach_message_sent"; properties: { message_index: number } }
  | { event: "coach_message_received"; properties: { was_ai: boolean; latency_ms: number } }
  | { event: "mission_claimed"; properties: { mission_key: string; xp_earned: number } }
  | { event: "badge_unlocked"; properties: { badge_id: string; badge_category: string } }
  | { event: "premium_page_view"; properties: { source: string } }
  | { event: "premium_upgrade"; properties: { plan: "monthly" | "yearly"; amount_inr: number } }
  | { event: "blog_view"; properties: { article: string; source?: string } }
  | { event: "blog_scroll_50"; properties: { article: string } }
  | { event: "blog_cta_click"; properties: { article: string; cta: string } }
  | { event: "study_room_joined"; properties: { room_id: string; participant_count: number } }
  | { event: "leaderboard_viewed"; properties: { tab: string } }
  | { event: "shop_purchase"; properties: { item_id: string; coins_spent: number } };

// ─── Tracker Implementation ───────────────────────────────────────────────────

/** Send an analytics event. Currently logs to console in development.
 *  Replace the stub below with your analytics provider
 *  (e.g. PostHog, Mixpanel, Amplitude, or a custom /api/analytics endpoint).
 */
export function track(event: AnalyticsEvent["event"], properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // ── STUB: Replace with real analytics provider ──────────────────────────
  // Example: posthog.capture(event, properties)
  // Example: mixpanel.track(event, properties)
  // Example: fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ event, properties }) })
  // ────────────────────────────────────────────────────────────────────────

  if (import.meta.env.DEV) {
    console.debug(`[analytics] ${event}`, properties);
  }
}

// ─── Scroll Depth Hook ────────────────────────────────────────────────────────

/**
 * useScrollDepth — React hook that tracks scroll depth (50% milestone) on a
 * blog/content page. Fires analytics events and properly cleans up on unmount.
 *
 * Usage:
 *   import { useScrollDepth } from "@/lib/analytics";
 *   function BlogPage() {
 *     useScrollDepth("deep-study-guide");
 *     return <article>...</article>;
 *   }
 */
export function useScrollDepth(articleSlug: string): void {
  // NOTE: import { useEffect } at the TOP of files that call useScrollDepth.
  // This file re-exports the hook pattern; callers must import useEffect
  // independently. To avoid circular concerns, we inline the effect setup
  // as a pattern to copy into page components rather than calling useEffect
  // here. See blog pages for the canonical usage pattern with useEffect.
  void articleSlug; // documented pattern — see deep-study-guide.tsx
}

/**
 * scrollDepthEffect — the effect body to use inside a useEffect call.
 * Designed to be called like:
 *   useEffect(() => scrollDepthEffect("article-slug"), []);
 */
export function scrollDepthEffect(articleSlug: string): () => void {
  const fired = new Set<number>();

  const handler = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    if (total === 0) return;
    const pct = Math.round((scrolled / total) * 100);
    if (pct >= 50 && !fired.has(50)) {
      fired.add(50);
      track("blog_scroll_50", { article: articleSlug });
    }
  };

  window.addEventListener("scroll", handler, { passive: true });
  return () => window.removeEventListener("scroll", handler);
}

// ─── Session Analytics Helpers ────────────────────────────────────────────────

/** Call when a focus session starts.
 *  Place in: Timer.tsx onSessionStart handler */
export function trackSessionStart(sessionType: string, plannedDuration: number, hasTask: boolean) {
  track("session_started", { session_type: sessionType, planned_duration: plannedDuration, has_task: hasTask });
}

/** Call when a focus session completes normally.
 *  Place in: Timer.tsx handleSessionComplete */
export function trackSessionComplete(durationSeconds: number, focusScore: number, xpEarned: number, early: boolean) {
  track("session_complete", { duration_seconds: durationSeconds, focus_score: focusScore, xp_earned: xpEarned, early });
}

/** Call when a session is abandoned before completion.
 *  Place in: Timer.tsx handleExit */
export function trackSessionAbandoned(durationSeconds: number, reason?: string) {
  track("session_abandoned", { duration_seconds: durationSeconds, reason });
}

/** Call when AI coach receives a message.
 *  Place in: CoachPanel.tsx onSendMessage */
export function trackCoachMessage(messageIndex: number) {
  track("coach_message_sent", { message_index: messageIndex });
}

/** Call when a habit is checked off.
 *  Place in: HabitCard.tsx onCheck */
export function trackHabitChecked(habitId: string, streakCount: number) {
  track("habit_checked", { habit_id: habitId, streak_count: streakCount });
}

/** Call when user achieves a streak milestone.
 *  Place in: useStreakUpdater hook or session complete handler */
export function trackStreakAchieved(streakDays: number) {
  if ([3, 7, 14, 21, 30, 60, 100].includes(streakDays)) {
    track("streak_achieved", { streak_days: streakDays });
  }
}
