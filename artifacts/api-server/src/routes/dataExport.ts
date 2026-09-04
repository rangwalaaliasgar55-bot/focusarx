import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  focusSessionsTable,
  tasksTable,
  goalsTable,
  habitsTable,
  habitCompletionsTable,
  studyStreaksTable,
  userWalletsTable,
  productivityLogsTable,
  flashcardDecksTable,
  flashcardsTable,
  notificationsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const CAPS = {
  sessions: 5000,
  habitCompletions: 2000,
  productivityLogs: 1000,
  flashcards: 2000,
  notifications: 500,
} as const;

/**
 * GDPR/DPDP self-service export (Phase 8.8).
 *
 * GET /api/settings/data/export — one JSON document with everything the
 * product stores about the caller. Secrets (password hash, refresh tokens,
 * guest keys, reset tokens) are never included. Row caps keep the response
 * bounded for marathon accounts; counts report truncation honestly.
 */
router.get("/settings/data/export", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const decks = await db.select().from(flashcardDecksTable)
      .where(eq(flashcardDecksTable.userId, userId))
      .limit(501);
    const deckIds = decks.map((d) => d.id);
    const [profile, sessions, tasks, goals, habits, completions, streaks, wallets, logs, cards, notes] =
      await Promise.all([
        db.select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          bio: usersTable.bio,
          timezone: usersTable.timezone,
          isGuest: usersTable.isGuest,
          onboardingCompleted: usersTable.onboardingCompleted,
          totalFocusMinutes: usersTable.totalFocusMinutes,
          productivityScore: usersTable.productivityScore,
          referralCode: usersTable.referralCode,
          createdAt: usersTable.createdAt,
        }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
        db.select().from(focusSessionsTable)
          .where(eq(focusSessionsTable.userId, userId))
          .orderBy(desc(focusSessionsTable.completedAt))
          .limit(CAPS.sessions + 1),
        db.select().from(tasksTable).where(eq(tasksTable.userId, userId)).limit(1001),
        db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1001),
        db.select().from(habitsTable).where(eq(habitsTable.userId, userId)).limit(1001),
        db.select().from(habitCompletionsTable)
          .where(eq(habitCompletionsTable.userId, userId))
          .orderBy(desc(habitCompletionsTable.completedAt))
          .limit(CAPS.habitCompletions + 1),
        db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1),
        db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1),
        db.select().from(productivityLogsTable)
          .where(eq(productivityLogsTable.userId, userId))
          .orderBy(desc(productivityLogsTable.date))
          .limit(CAPS.productivityLogs + 1),
        deckIds.length
          ? db.select().from(flashcardsTable)
              .where(inArray(flashcardsTable.deckId, deckIds))
              .limit(CAPS.flashcards + 1)
          : [],
        db.select().from(notificationsTable)
          .where(eq(notificationsTable.userId, userId))
          .limit(CAPS.notifications + 1),
      ]);

    const truncate = <T,>(rows: T[], cap: number) => ({
      rows: rows.slice(0, cap),
      truncated: rows.length > cap,
      total: rows.length > cap ? `>${cap}` : rows.length,
    });

    res.setHeader("Content-Disposition", `attachment; filename="focusarx-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      profile: profile[0] ?? null,
      focusSessions: truncate(sessions, CAPS.sessions),
      tasks: truncate(tasks, 1000),
      goals: truncate(goals, 1000),
      habits: truncate(habits, 1000),
      habitCompletions: truncate(completions, CAPS.habitCompletions),
      streaks: streaks[0] ?? null,
      wallet: wallets[0] ?? null,
      productivityLogs: truncate(logs, CAPS.productivityLogs),
      flashcardDecks: truncate(decks, 500),
      flashcards: truncate(cards, CAPS.flashcards),
      notifications: truncate(notes, CAPS.notifications),
    });
  } catch (err) {
    logger.error({ err }, "data export error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Export failed" } });
  }
});

export { router as dataExportRouter };
