import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
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
  box: integer("box").notNull().default(1),
  nextReviewAt: timestamp("next_review_at").defaultNow().notNull(),
  correctCount: integer("correct_count").notNull().default(0),
  incorrectCount: integer("incorrect_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("flashcards_deck_idx").on(t.deckId),
]);

export type Flashcard = typeof flashcardsTable.$inferSelect;
