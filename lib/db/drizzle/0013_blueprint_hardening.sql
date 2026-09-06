-- FSRS additions to the existing flashcard schema.
-- The previous, unjournaled version referred to nonexistent tables (streaks,
-- ghost_data, user_quests, etc.) and attempted to create a second, integer-ID
-- flashcard model. Match lib/db/src/schema/flashcards.ts instead; keep all
-- existing text IDs, decks, cards and Leitner scheduling data intact.

ALTER TABLE "flashcards"
  ADD COLUMN IF NOT EXISTS "fsrs_difficulty" real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fsrs_stability" real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fsrs_reps" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fsrs_lapses" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fsrs_last_review" timestamp,
  ADD COLUMN IF NOT EXISTS "fsrs_due_date" timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "fsrs_interval" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fsrs_state" text DEFAULT 'new';

CREATE INDEX IF NOT EXISTS "flashcards_fsrs_due_idx" ON "flashcards" ("next_review_at");

CREATE TABLE IF NOT EXISTS "flashcard_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "card_id" text NOT NULL,
  "user_id" text NOT NULL,
  "grade" integer NOT NULL,
  "interval_before" integer,
  "interval_after" integer,
  "stability_before" real,
  "stability_after" real,
  "elapsed_days" real,
  "review_duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcard_reviews'::regclass AND conname = 'flashcard_reviews_card_id_flashcards_id_fk') THEN
    ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_card_id_flashcards_id_fk"
      FOREIGN KEY ("card_id") REFERENCES "flashcards"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcard_reviews'::regclass AND conname = 'flashcard_reviews_user_id_users_id_fk') THEN
    ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "flashcard_reviews_card_idx" ON "flashcard_reviews" ("card_id");
CREATE INDEX IF NOT EXISTS "flashcard_reviews_user_date_idx" ON "flashcard_reviews" ("user_id", "created_at");
