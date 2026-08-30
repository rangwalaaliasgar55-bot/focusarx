import { pgTable, text, integer, boolean, timestamp, real, index } from "drizzle-orm/pg-core";
import { usersTable as users } from "./focusarx";

/**
 * Flashcard decks — user-created study decks (e.g. "Spanish verbs", "Anatomy").
 */
export const flashcardDecksTable = pgTable("flashcard_decks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("flashcard_decks_user_idx").on(t.userId),
]);

export type FlashcardDeck = typeof flashcardDecksTable.$inferSelect;

/**
 * Flashcards with a simple spaced-repetition scheduler.
 * `box` is the Leitner box (1..5); `nextReviewAt` drives which cards are due.
 * Rating a card "again" resets box to 1, "hard" keeps it, "good"/"easy" advance it.
 */
export const flashcardsTable = pgTable("flashcards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deckId: text("deck_id").notNull().references(() => flashcardDecksTable.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  // Leitner box system (legacy, kept for backward compatibility)
  box: integer("box").notNull().default(1),
  nextReviewAt: timestamp("next_review_at").defaultNow().notNull(),
  correctCount: integer("correct_count").notNull().default(0),
  incorrectCount: integer("incorrect_count").notNull().default(0),
  // FSRS-4.5 fields (Blueprint: Scientific Focus Engine)
  fsrsDifficulty: real("fsrs_difficulty").default(0),
  fsrsStability: real("fsrs_stability").default(0),
  fsrsReps: integer("fsrs_reps").default(0),
  fsrsLapses: integer("fsrs_lapses").default(0),
  fsrsLastReview: timestamp("fsrs_last_review"),
  fsrsDueDate: timestamp("fsrs_due_date").defaultNow(),
  fsrsInterval: integer("fsrs_interval").default(0),
  fsrsState: text("fsrs_state").default("new"), // new, learning, review, relearning
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("flashcards_deck_idx").on(t.deckId),
  index("flashcards_fsrs_due_idx").on(t.nextReviewAt),
]);

export type Flashcard = typeof flashcardsTable.$inferSelect;

/**
 * Flashcard review log — tracks every review with FSRS state transitions.
 * Enables analytics and debugging of scheduling accuracy.
 */
export const flashcardReviewsTable = pgTable("flashcard_reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cardId: text("card_id").notNull().references(() => flashcardsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
  intervalBefore: integer("interval_before"),
  intervalAfter: integer("interval_after"),
  stabilityBefore: real("stability_before"),
  stabilityAfter: real("stability_after"),
  elapsedDays: real("elapsed_days"),
  reviewDurationMs: integer("review_duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("flashcard_reviews_card_idx").on(t.cardId),
  index("flashcard_reviews_user_date_idx").on(t.userId, t.createdAt),
]);
