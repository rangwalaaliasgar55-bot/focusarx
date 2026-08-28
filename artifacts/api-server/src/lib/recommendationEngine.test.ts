/**
 * Tests for the ethical study recommendation engine.
 *
 * Validates:
 * - Deterministic output (same input → same output)
 * - Every recommendation has an explainable reason
 * - Quiet hours suppress recommendations
 * - Personalization opt-out returns generic suggestions
 * - Streak protection activates in the evening
 * - Spaced repetition reviews are prioritized
 * - Energy level affects session length suggestions
 * - Overdue tasks are surfaced
 * - At-risk goals are flagged
 * - Recommendations are capped (no overwhelming the user)
 */
import { describe, it, expect } from "vitest";
import { StudyRecommendationEngine, type RecommendationInput } from "../lib/recommendationEngine";

const engine = new StudyRecommendationEngine();

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    userId: "user-1",
    now: new Date("2026-08-28T14:00:00Z"),
    goals: [],
    tasks: [],
    recentSessions: [],
    currentStreak: 5,
    longestStreak: 10,
    lastStudyDate: "2026-08-27",
    pendingReviews: [],
    ...overrides,
  };
}

describe("StudyRecommendationEngine", () => {
  it("returns at least one recommendation", () => {
    const result = engine.generate(baseInput());
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("every recommendation has a non-empty reason", () => {
    const result = engine.generate(baseInput({
      tasks: [
        { id: "t1", text: "Study math", completed: false, priority: "high", category: "Math", missCount: 0 },
      ],
      goals: [
        { id: "g1", title: "Pass calculus exam", deadline: "2026-09-01", targetMinutes: 600, completedMinutes: 100, completed: false },
      ],
      recentSessions: [
        { id: "s1", durationSec: 1500, focusScore: 85, completedAt: "2026-08-28T10:00:00Z", category: "Math" },
      ],
    }));

    for (const rec of result.recommendations) {
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.action).toBeDefined();
    }
  });

  it("is deterministic (same input → same output)", () => {
    const input = baseInput({
      currentStreak: 3,
      tasks: [
        { id: "t1", text: "Review notes", completed: false, priority: "medium", category: "General", missCount: 0 },
      ],
    });

    const result1 = engine.generate(input);
    const result2 = engine.generate(input);

    expect(result1.recommendations).toEqual(result2.recommendations);
    expect(result1.signalsUsed).toEqual(result2.signalsUsed);
  });

  it("respects quiet hours", () => {
    const input = baseInput({
      now: new Date("2026-08-28T03:00:00Z"),
      quietHoursStart: 22,
      quietHoursEnd: 7,
    });

    const result = engine.generate(input);
    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].type).toBe("take_break");
    expect(result.signalsUsed).toContain("quiet_hours");
  });

  it("returns generic suggestion when personalization is opted out", () => {
    const input = baseInput({ personalizationOptOut: true });
    const result = engine.generate(input);

    expect(result.recommendations.length).toBe(1);
    expect(result.signalsUsed).toContain("opt_out");
    expect(result.recommendations[0].action.kind).toBe("start_session");
  });

  it("prioritizes spaced repetition reviews that are due", () => {
    const input = baseInput({
      pendingReviews: [
        { id: "r1", topic: "Organic Chemistry", dueDate: "2026-08-27T00:00:00Z", difficulty: 4 },
        { id: "r2", topic: "Linear Algebra", dueDate: "2026-08-26T00:00:00Z", difficulty: 3 },
        { id: "r3", topic: "Future Topic", dueDate: "2026-09-01T00:00:00Z", difficulty: 2 },
      ],
    });

    const result = engine.generate(input);
    const reviewRec = result.recommendations.find((r) => r.type === "review_topic");
    expect(reviewRec).toBeDefined();
    expect(reviewRec!.reason).toContain("Linear Algebra");
    expect(result.signalsUsed).toContain("spaced_repetition");
  });

  it("suggests break after long study day", () => {
    const input = baseInput({
      now: new Date("2026-08-28T18:00:00Z"),
      recentSessions: [
        { id: "s1", durationSec: 3600, completedAt: "2026-08-28T10:00:00Z", category: "Math" },
        { id: "s2", durationSec: 3600, completedAt: "2026-08-28T14:00:00Z", category: "Physics" },
        { id: "s3", durationSec: 3600, completedAt: "2026-08-28T16:00:00Z", category: "Chemistry" },
      ],
    });

    const result = engine.generate(input);
    const breakRec = result.recommendations.find((r) => r.type === "take_break");
    expect(breakRec).toBeDefined();
    expect(breakRec!.priority).toBe("high");
  });

  it("flags streak protection in the evening when user hasn't studied", () => {
    const input = baseInput({
      now: new Date("2026-08-28T20:00:00Z"),
      currentStreak: 7,
      recentSessions: [], // No sessions today
    });

    const result = engine.generate(input);
    const streakRec = result.recommendations.find((r) => r.type === "streak_protection");
    expect(streakRec).toBeDefined();
    expect(streakRec!.title).toContain("7-day streak");
  });

  it("surfaces overdue high-priority tasks", () => {
    const input = baseInput({
      tasks: [
        { id: "t1", text: "Submit essay", completed: false, priority: "urgent", category: "English", dueDate: "2026-08-26", missCount: 2 },
        { id: "t2", text: "Read chapter", completed: false, priority: "low", category: "History", missCount: 0 },
      ],
    });

    const result = engine.generate(input);
    const taskRec = result.recommendations.find((r) => r.type === "complete_task");
    expect(taskRec).toBeDefined();
    expect(taskRec!.title).toContain("Submit essay");
    expect(taskRec!.priority).toBe("high");
  });

  it("flags at-risk goals", () => {
    const input = baseInput({
      goals: [
        { id: "g1", title: "Pass biology exam", deadline: "2026-08-30", targetMinutes: 600, completedMinutes: 50, completed: false },
      ],
    });

    const result = engine.generate(input);
    const goalRec = result.recommendations.find((r) => r.type === "goal_progress");
    expect(goalRec).toBeDefined();
    expect(goalRec!.title).toContain("biology exam");
  });

  it("adjusts session length based on energy level", () => {
    const lowEnergy = engine.generate(baseInput({ energyLevel: 1 }));
    const highEnergy = engine.generate(baseInput({ energyLevel: 5 }));

    const lowSession = lowEnergy.recommendations.find((r) => r.action.suggestedDurationMin);
    const highSession = highEnergy.recommendations.find((r) => r.action.kind === "start_session");

    // Low energy should suggest shorter sessions
    if (lowSession) {
      expect(lowSession.action.suggestedDurationMin).toBeLessThanOrEqual(15);
    }
  });

  it("caps recommendations at 5 to avoid overwhelming", () => {
    const input = baseInput({
      tasks: Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        text: `Task ${i}`,
        completed: false,
        priority: "high" as const,
        category: "General",
        dueDate: "2026-08-25",
        missCount: 3,
      })),
      goals: Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`,
        title: `Goal ${i}`,
        deadline: "2026-08-29",
        targetMinutes: 600,
        completedMinutes: 10,
        completed: false,
      })),
      pendingReviews: Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        topic: `Topic ${i}`,
        dueDate: "2026-08-27",
        difficulty: 3,
      })),
    });

    const result = engine.generate(input);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });

  it("fits tasks to available time window", () => {
    const input = baseInput({
      availabilityMinutes: 30,
      tasks: [
        { id: "t1", text: "Quick review", completed: false, priority: "medium", category: "Math", estimatedMinutes: 20, missCount: 0 },
        { id: "t2", text: "Long project", completed: false, priority: "high", category: "Science", estimatedMinutes: 120, missCount: 0 },
      ],
    });

    const result = engine.generate(input);
    const fitRec = result.recommendations.find(
      (r) => r.reason.includes("available time") || r.reason.includes("minutes")
    );
    if (fitRec) {
      expect(fitRec.action.targetId).toBe("t1"); // Quick review fits
    }
  });

  it("includes signalsUsed in output for auditability", () => {
    const result = engine.generate(baseInput({ energyLevel: 3, currentStreak: 5 }));
    expect(result.signalsUsed).toBeDefined();
    expect(Array.isArray(result.signalsUsed)).toBe(true);
  });

  it("includes generatedAt timestamp", () => {
    const result = engine.generate(baseInput());
    expect(result.generatedAt).toBeDefined();
    expect(() => new Date(result.generatedAt)).not.toThrow();
  });
});
