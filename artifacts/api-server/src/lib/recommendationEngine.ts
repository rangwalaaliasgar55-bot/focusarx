/**
 * Ethical Study Engagement / Recommendation Engine
 *
 * A transparent, deterministic recommendation service that helps users study
 * consistently and effectively. Inspired by successful recommendation systems
 * but designed to optimize for learning outcomes, not screen time.
 *
 * Design principles:
 * - Every recommendation is explainable with a short reason.
 * - No infinite scroll, manipulative notifications, or dark patterns.
 * - Users can opt out of personalization entirely.
 * - No inference of sensitive personal attributes.
 * - Respects quiet hours, break preferences, and availability windows.
 *
 * Signals used:
 * - User-selected goals and deadlines
 * - Task priority and estimated time
 * - Historical completion rate and focus quality
 * - Self-reported energy and confidence
 * - Spaced-repetition review intervals
 * - Time of day and user availability
 * - Recent missed sessions
 * - Session quality feedback
 *
 * The engine is deterministic (same inputs → same output) so it can be
 * unit-tested thoroughly and its behavior is auditable.
 */


// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationInput {
  userId: string;
  now: Date;

  // User preferences
  quietHoursStart?: number; // 0-23
  quietHoursEnd?: number;   // 0-23
  availabilityMinutes?: number; // How much time the user has right now
  personalizationOptOut?: boolean;
  breakReminderMinutes?: number;

  // Goals
  goals: GoalInput[];

  // Tasks
  tasks: TaskInput[];

  // Recent sessions (last 30 days)
  recentSessions: SessionInput[];

  // Streak info
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null; // YYYY-MM-DD

  // Readiness (optional, from check-in)
  energyLevel?: number; // 1-5
  stressLevel?: number; // 1-5
  sleepQuality?: number; // 1-5

  // Flashcard review queue
  pendingReviews: ReviewInput[];

  // User timezone offset in minutes
  timezoneOffset?: number;
}

export interface GoalInput {
  id: string;
  title: string;
  deadline?: string; // ISO date
  targetMinutes?: number;
  completedMinutes?: number;
  completed: boolean;
}

export interface TaskInput {
  id: string;
  text: string;
  completed: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  estimatedMinutes?: number;
  dueDate?: string; // ISO date
  missCount: number;
  completedAt?: string;
}

export interface SessionInput {
  id: string;
  durationSec: number;
  focusScore?: number;
  completedAt: string;
  category: string;
}

export interface ReviewInput {
  id: string;
  topic: string;
  dueDate: string; // ISO date
  difficulty: number; // 1-5
  lastReviewed?: string;
}

// ─── Recommendation Output ────────────────────────────────────────────────────

export interface Recommendation {
  type: RecommendationType;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  action: RecommendationAction;
  metadata?: Record<string, unknown>;
}

export type RecommendationType =
  | "study_subject"
  | "schedule_session"
  | "take_break"
  | "review_topic"
  | "complete_task"
  | "goal_progress"
  | "streak_protection"
  | "achievement_nearby";

export interface RecommendationAction {
  kind: "start_session" | "open_task" | "review_flashcard" | "take_break" | "view_goal" | "dismiss";
  targetId?: string;
  suggestedDurationMin?: number;
  suggestedCategory?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  generatedAt: string;
  signalsUsed: string[];
  userId: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class StudyRecommendationEngine {
  /**
   * Generate recommendations for the current moment.
   * This is deterministic: same input → same output.
   */
  generate(input: RecommendationInput): RecommendationResult {
    const signalsUsed: string[] = [];
    const recommendations: Recommendation[] = [];

    // If user opted out, return a minimal generic suggestion.
    if (input.personalizationOptOut) {
      return {
        recommendations: [{
          type: "study_subject",
          title: "Ready to focus?",
          reason: "Start a focus session on any subject you'd like to work on.",
          priority: "low",
          action: { kind: "start_session", suggestedDurationMin: 25 },
        }],
        generatedAt: new Date().toISOString(),
        signalsUsed: ["opt_out"],
        userId: input.userId,
      };
    }

    const now = input.now;
    const hour = now.getHours();

    // ── 1. Quiet hours check ───────────────────────────────────────
    if (this.isQuietHours(hour, input.quietHoursStart, input.quietHoursEnd)) {
      signalsUsed.push("quiet_hours");
      return {
        recommendations: [{
          type: "take_break",
          title: "It's your quiet hours",
          reason: `You've set quiet hours until ${input.quietHoursEnd}:00. Rest well — your study streak is safe.`,
          priority: "low",
          action: { kind: "dismiss" },
        }],
        generatedAt: now.toISOString(),
        signalsUsed,
        userId: input.userId,
      };
    }

    // ── 2. Break recommendation (if user has been studying a lot) ──
    const recentSessionToday = this.getTodaySessions(input.recentSessions, now);
    const totalMinutesToday = recentSessionToday.reduce((sum, s) => sum + s.durationSec / 60, 0);
    const breakThreshold = input.breakReminderMinutes ?? 120;

    if (totalMinutesToday >= breakThreshold) {
      signalsUsed.push("total_minutes_today", "break_threshold");
      recommendations.push({
        type: "take_break",
        title: "Time for a break",
        reason: `You've focused for ${Math.round(totalMinutesToday)} minutes today. A 10-minute break will help consolidate what you've learned.`,
        priority: "high",
        action: { kind: "take_break" },
        metadata: { totalMinutesToday: Math.round(totalMinutesToday) },
      });
    }

    // ── 3. Energy-based session length recommendation ─────────────
    let suggestedDuration = 25; // default Pomodoro
    if (input.energyLevel !== undefined) {
      signalsUsed.push("energy_level");
      if (input.energyLevel <= 2) {
        suggestedDuration = 15;
        recommendations.push({
          type: "schedule_session",
          title: "Low energy detected",
          reason: "Try a shorter 15-minute session — it's easier to start small when tired.",
          priority: "medium",
          action: { kind: "start_session", suggestedDurationMin: 15 },
        });
      } else if (input.energyLevel >= 4) {
        suggestedDuration = 45;
      }
    }

    // ── 4. Spaced repetition reviews due ──────────────────────────
    const dueReviews = input.pendingReviews.filter(
      (r) => new Date(r.dueDate) <= now
    );
    if (dueReviews.length > 0) {
      signalsUsed.push("spaced_repetition");
      const mostUrgent = dueReviews.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0];

      recommendations.push({
        type: "review_topic",
        title: `${dueReviews.length} review${dueReviews.length > 1 ? "s" : ""} due`,
        reason: `"${mostUrgent.topic}" is due for review. Spaced repetition works best when reviews are done on time.`,
        priority: dueReviews.length > 5 ? "high" : "medium",
        action: { kind: "review_flashcard", targetId: mostUrgent.id },
        metadata: { dueCount: dueReviews.length },
      });
    }

    // ── 5. At-risk goals ──────────────────────────────────────────
    const atRiskGoals = this.getAtRiskGoals(input.goals, now);
    for (const goal of atRiskGoals.slice(0, 2)) {
      signalsUsed.push("goal_deadline");
      const remaining = (goal.targetMinutes ?? 0) - (goal.completedMinutes ?? 0);
      const daysUntilDeadline = this.daysUntil(goal.deadline!, now);

      recommendations.push({
        type: "goal_progress",
        title: `Goal at risk: ${goal.title}`,
        reason: `${remaining} minutes remaining with ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} until deadline.`,
        priority: daysUntilDeadline <= 2 ? "high" : "medium",
        action: { kind: "view_goal", targetId: goal.id },
        metadata: { remainingMinutes: remaining, daysUntilDeadline },
      });
    }

    // ── 6. High-priority overdue tasks ────────────────────────────
    const overdueTasks = input.tasks.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
    ).sort((a, b) => {
      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
    });

    if (overdueTasks.length > 0) {
      signalsUsed.push("overdue_tasks");
      const task = overdueTasks[0];
      recommendations.push({
        type: "complete_task",
        title: `Overdue: ${task.text.slice(0, 50)}`,
        reason: `This ${task.priority}-priority task is past its due date. Would you like to focus on it now?`,
        priority: task.priority === "urgent" ? "high" : "medium",
        action: { kind: "start_session", targetId: task.id, suggestedDurationMin: task.estimatedMinutes ?? suggestedDuration, suggestedCategory: task.category },
      });
    }

    // ── 7. Streak protection ──────────────────────────────────────
    const today = this.toDateStr(now);
    const studiedToday = recentSessionToday.length > 0;
    if (!studiedToday && input.currentStreak > 0 && hour >= 18) {
      signalsUsed.push("streak_protection", "time_of_day");
      recommendations.push({
        type: "streak_protection",
        title: `Keep your ${input.currentStreak}-day streak alive`,
        reason: `You haven't studied today yet. Even a short 15-minute session will keep your streak going.`,
        priority: "medium",
        action: { kind: "start_session", suggestedDurationMin: 15 },
      });
    }

    // ── 8. Most-studied category suggestion (balance) ─────────────
    if (input.availabilityMinutes && input.availabilityMinutes > 0) {
      signalsUsed.push("availability");
      const incompleteTasks = input.tasks.filter((t) => !t.completed);
      const fittingTask = incompleteTasks.find(
        (t) => (t.estimatedMinutes ?? 25) <= input.availabilityMinutes!
      );
      if (fittingTask && !recommendations.some((r) => r.action.targetId === fittingTask.id)) {
        recommendations.push({
          type: "complete_task",
          title: `You have ${input.availabilityMinutes} minutes`,
          reason: `"${fittingTask.text.slice(0, 40)}" fits your available time window.`,
          priority: "low",
          action: { kind: "start_session", targetId: fittingTask.id, suggestedDurationMin: fittingTask.estimatedMinutes ?? 25, suggestedCategory: fittingTask.category },
        });
      }
    }

    // ── 9. If no recommendations, suggest a general session ────────
    if (recommendations.length === 0) {
      const recentCategory = this.getMostRecentCategory(input.recentSessions);
      recommendations.push({
        type: "study_subject",
        title: "Ready to focus?",
        reason: recentCategory
          ? `Continue building momentum on ${recentCategory}.`
          : "Start a focus session to build your streak.",
        priority: "low",
        action: { kind: "start_session", suggestedDurationMin: suggestedDuration, suggestedCategory: recentCategory ?? undefined },
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Cap at 5 recommendations to avoid overwhelming the user
    return {
      recommendations: recommendations.slice(0, 5),
      generatedAt: now.toISOString(),
      signalsUsed: [...new Set(signalsUsed)],
      userId: input.userId,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private isQuietHours(hour: number, start?: number, end?: number): boolean {
    if (start === undefined || end === undefined) return false;
    if (start < end) return hour >= start && hour < end;
    // Wraps midnight (e.g., 22:00 to 07:00)
    return hour >= start || hour < end;
  }

  private getTodaySessions(sessions: SessionInput[], now: Date): SessionInput[] {
    const todayStr = this.toDateStr(now);
    return sessions.filter((s) => this.toDateStr(new Date(s.completedAt)) === todayStr);
  }

  private toDateStr(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getAtRiskGoals(goals: GoalInput[], now: Date): GoalInput[] {
    return goals.filter((g) => {
      if (g.completed) return false;
      if (!g.deadline) return false;
      const daysLeft = this.daysUntil(g.deadline, now);
      if (daysLeft < 0) return true; // already overdue
      const remaining = (g.targetMinutes ?? 0) - (g.completedMinutes ?? 0);
      if (remaining <= 0) return false;
      // At risk if more than 60% of work remains with less than 30% of time left
      const progress = g.targetMinutes ? (g.completedMinutes ?? 0) / g.targetMinutes : 1;
      return progress < 0.4 && daysLeft < 7;
    });
  }

  private daysUntil(isoDate: string, now: Date): number {
    const target = new Date(isoDate);
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private getMostRecentCategory(sessions: SessionInput[]): string | null {
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    return sorted[0].category || null;
  }
}

// Singleton instance
export const recommendationEngine = new StudyRecommendationEngine();
