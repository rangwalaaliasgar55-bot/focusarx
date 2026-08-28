-- Flashcards with spaced repetition (Leitner boxes).
CREATE TABLE IF NOT EXISTS "flashcard_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "flashcard_decks_user_idx" ON "flashcard_decks" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"next_review_at" timestamp DEFAULT now() NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "flashcards_deck_idx" ON "flashcards" USING btree ("deck_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcard_decks_user_id_users_id_fk') THEN
    ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_deck_id_flashcard_decks_id_fk') THEN
    ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "flashcard_decks"("id") ON DELETE cascade;
  END IF;
END $$;
