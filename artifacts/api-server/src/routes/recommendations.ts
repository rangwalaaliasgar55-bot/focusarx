/**
 * GET /api/recommendations
 *
 * Generates personalized study recommendations for the authenticated user.
 * The recommendation engine is deterministic and explainable — every
 * recommendation includes a reason the user can understand.
 *
 * This endpoint respects:
 * - Quiet hours (no recommendations during rest time)
 * - Personalization opt-out (returns generic suggestion)
 * - User availability (fits tasks to available time)
 * - Spaced repetition (prioritizes due reviews)
 * - Streak protection (reminds before streak breaks)
 */

import { Router, type IRouter } from "express";
import {
  db, tasksTable, goalsTable, focusSessionsTable, studyStreaksTable,
  readinessLogsTable, flashcardsTable, flashcardDecksTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { recommendationEngine, type RecommendationInput } from "../lib/recommendationEngine";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/recommendations", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all required data in parallel
    const [userTasks, userGoals, recentSessions, streak, latestReadiness, dueFlashcards] = await Promise.all([
      // Incomplete tasks
      db.select().from(tasksTable)
        .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, false)))
        .limit(50),

      // Active goals
      db.select().from(goalsTable)
        .where(and(eq(goalsTable.userId, userId), eq(goalsTable.completed, false)))
        .limit(20),

      // Recent sessions (last 30 days)
      db.select().from(focusSessionsTable)
        .where(and(
          eq(focusSessionsTable.userId, userId),
          gte(focusSessionsTable.createdAt, thirtyDaysAgo),
        ))
        .orderBy(desc(focusSessionsTable.createdAt))
        .limit(100),

      // Study streak
      db.select().from(studyStreaksTable)
        .where(eq(studyStreaksTable.userId, userId))
        .limit(1),

      // Latest readiness check-in
      db.select().from(readinessLogsTable)
        .where(eq(readinessLogsTable.userId, userId))
        .orderBy(desc(readinessLogsTable.createdAt))
        .limit(1),

      // Due flashcards — scoped to this user's decks (Leitner spaced review).
      // `nextReviewAt <= now` is the card the scheduler says is due.
      db.select({
        id: flashcardsTable.id,
        front: flashcardsTable.front,
        nextReviewAt: flashcardsTable.nextReviewAt,
        box: flashcardsTable.box,
      })
        .from(flashcardsTable)
        .innerJoin(flashcardDecksTable, eq(flashcardsTable.deckId, flashcardDecksTable.id))
        .where(and(eq(flashcardDecksTable.userId, userId), lte(flashcardsTable.nextReviewAt, now)))
        .orderBy(flashcardsTable.nextReviewAt)
        .limit(20),
    ]);

    const streakData = streak[0];
    const readiness = latestReadiness[0];

    const input: RecommendationInput = {
      userId,
      now,
      goals: userGoals.map((g: typeof goalsTable.$inferSelect) => ({
        id: g.id,
        title: g.title,
        completed: g.completed,
      })),
      tasks: userTasks.map((t: typeof tasksTable.$inferSelect) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        priority: (t.priority as "low" | "medium" | "high" | "urgent") ?? "medium",
        category: t.category ?? "General",
        estimatedMinutes: t.estimatedMinutes ?? undefined,
        dueDate: t.dueDate ?? undefined,
        missCount: t.missCount ?? 0,
      })),
      recentSessions: recentSessions.map((s: typeof focusSessionsTable.$inferSelect) => ({
        id: s.id,
        durationSec: s.durationSec,
        focusScore: s.focusScore ?? undefined,
        completedAt: s.completedAt?.toISOString() ?? s.createdAt.toISOString(),
        category: s.category ?? "General",
      })),
      currentStreak: streakData?.currentStreak ?? 0,
      longestStreak: streakData?.longestStreak ?? 0,
      lastStudyDate: streakData?.lastStudyDate ?? null,
      energyLevel: readiness?.energy ?? undefined,
      stressLevel: readiness?.stress ?? undefined,
      sleepQuality: readiness?.sleep ?? undefined,
      pendingReviews: dueFlashcards.map((c) => ({
        id: c.id,
        topic: c.front,
        dueDate: c.nextReviewAt.toISOString(),
        // Leitner box (1-5) is a reasonable 1-5 difficulty/urgency signal.
        difficulty: Math.min(5, Math.max(1, c.box)),
        lastReviewed: c.nextReviewAt.toISOString(),
      })),
    };

    const result = recommendationEngine.generate(input);

    res.json(result);
  } catch (err) {
    logger.error({ err, userId }, "Failed to generate recommendations");
    // Graceful degradation: return a generic recommendation on error
    res.json({
      recommendations: [{
        type: "study_subject" as const,
        title: "Ready to focus?",
        reason: "Start a focus session on any subject.",
        priority: "low" as const,
        action: { kind: "start_session" as const, suggestedDurationMin: 25 },
      }],
      generatedAt: new Date().toISOString(),
      signalsUsed: ["fallback"],
      userId,
    });
  }
});

export { router as recommendationsRouter };
