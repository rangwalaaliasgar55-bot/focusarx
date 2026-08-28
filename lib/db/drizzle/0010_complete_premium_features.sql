ALTER TABLE IF EXISTS "focus_cities" ADD COLUMN IF NOT EXISTS "selected_skin" text DEFAULT 'classic' NOT NULL;
ALTER TABLE IF EXISTS "seasonal_events" ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;
ALTER TABLE IF EXISTS "push_subscriptions" ADD COLUMN IF NOT EXISTS "priority_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE IF EXISTS "push_subscriptions" ADD COLUMN IF NOT EXISTS "sound" text DEFAULT 'default' NOT NULL;

CREATE TABLE IF NOT EXISTS "user_emotes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emote_id" text NOT NULL,
  "equipped" boolean DEFAULT false NOT NULL,
  "unlocked_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_emotes_user_emote_unique" ON "user_emotes" ("user_id", "emote_id");
CREATE INDEX IF NOT EXISTS "user_emotes_user_idx" ON "user_emotes" ("user_id");

-- Seed cosmic season (skip if table missing or row already exists)
DO $$
BEGIN
  IF to_regclass('public.seasonal_events') IS NOT NULL THEN
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
  END IF;
END $$;
