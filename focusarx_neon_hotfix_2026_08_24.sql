-- FocusArx Neon production schema hotfix — 2026-08-24
-- Run this in Neon SQL Editor if Vercel/Drizzle reports schema drift or
-- if admin live analytics/session endpoints fail with missing columns.
-- Safe to run more than once: all table/column/index additions are idempotent;
-- duplicate inventory rows are cleaned before the unique ownership index.

-- Flashcards with spaced repetition.
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcard_decks_user_id_users_id_fk') THEN
    ALTER TABLE "flashcard_decks"
      ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_deck_id_flashcard_decks_id_fk') THEN
    ALTER TABLE "flashcards"
      ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk"
      FOREIGN KEY ("deck_id") REFERENCES "flashcard_decks"("id") ON DELETE cascade;
  END IF;
END $$;

-- Referral ownership/redemption columns.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_applied_at" timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code");
CREATE INDEX IF NOT EXISTS "users_referred_by_user_id_idx" ON "users" ("referred_by_user_id");
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_referred_by_user_id_users_id_fk";
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk"
  FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- Premium marketplace/catalogue and idempotent session writes.
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;
UPDATE "marketplace_items"
SET "premium_only" = true
WHERE "id" IN ('frame-diamond', 'avatar-astronaut', 'effect-aurora', 'acc-fire-wings');

ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "client_nonce" text;
CREATE UNIQUE INDEX IF NOT EXISTS "focus_sessions_user_nonce_unique"
  ON "focus_sessions" ("user_id", "client_nonce")
  WHERE "client_nonce" IS NOT NULL;

-- Enforce one inventory ownership row per user/item after removing duplicates.
DELETE FROM "user_inventory" a
USING "user_inventory" b
WHERE a."user_id" = b."user_id"
  AND a."item_id" = b."item_id"
  AND a."id" > b."id";
CREATE UNIQUE INDEX IF NOT EXISTS "user_inventory_user_item_unique"
  ON "user_inventory" ("user_id", "item_id");

-- Active session start time used by live admin analytics/session recovery.
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;

-- Premium polish columns and emote unlocks.
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "selected_skin" text DEFAULT 'classic' NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "priority_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "sound" text DEFAULT 'default' NOT NULL;

CREATE TABLE IF NOT EXISTS "user_emotes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emote_id" text NOT NULL,
  "equipped" boolean DEFAULT false NOT NULL,
  "unlocked_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_emotes_user_emote_unique" ON "user_emotes" ("user_id", "emote_id");
CREATE INDEX IF NOT EXISTS "user_emotes_user_idx" ON "user_emotes" ("user_id");

INSERT INTO "seasonal_events" (
  "id", "name", "slug", "description", "theme", "banner_color", "start_date", "end_date",
  "xp_multiplier", "coin_multiplier", "special_missions", "exclusive_rewards", "premium_only", "is_active"
) VALUES (
  'season-cosmic-focus-2026', 'Cosmic Focus Season', 'cosmic-focus-2026',
  'A Premium season of consistency, deep minutes, and exclusive cosmic rewards.', 'cosmic', '#8B5CF6',
  '2026-08-23T00:00:00Z', '2026-09-30T23:59:59Z', 1.25, 1.15,
  '[{"id":"cosmic-10","target":10,"unit":"sessions"},{"id":"deep-300","target":300,"unit":"minutes"}]'::jsonb,
  '[{"id":"aurora-skin","type":"city_skin"},{"id":"galaxy-emote","type":"emote"}]'::jsonb,
  true, true
) ON CONFLICT ("id") DO UPDATE SET "premium_only" = true, "is_active" = true;
