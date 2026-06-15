-- FocusArx Missing Tables Recovery Migration
-- Add missing tables that are defined in schema but not in production migration
-- Run this script to add the missing tables to the production database

-- =============================================
-- MISSING TABLE 1: premium_subscriptions
-- =============================================
CREATE TABLE IF NOT EXISTS "premium_subscriptions" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "activated_at" timestamp DEFAULT now() NOT NULL,
    "expires_at" timestamp,
    "coins_cost" integer DEFAULT 9000,
    "benefits" jsonb DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "granted_by_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create unique constraint for user_id if not exists
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "premium_subscriptions_user_id_unique" ON "premium_subscriptions" ("user_id");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create user index
CREATE INDEX IF NOT EXISTS "premium_subscriptions_user_idx" ON "premium_subscriptions" ("user_id");

-- =============================================
-- MISSING TABLE 2: email_logs
-- =============================================
CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "recipient_id" text,
    "recipient_email" text NOT NULL,
    "template" text NOT NULL,
    "subject" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "provider_id" text,
    "sent_at" timestamp,
    "opened_at" timestamp,
    "clicked_at" timestamp,
    "bounced" boolean DEFAULT false,
    "error" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for email_logs
CREATE INDEX IF NOT EXISTS "email_logs_recipient_idx" ON "email_logs" ("recipient_id");
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" ("created_at");

-- =============================================
-- MISSING TABLE 3: focus_cities
-- =============================================
CREATE TABLE IF NOT EXISTS "focus_cities" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "population" integer DEFAULT 0 NOT NULL,
    "buildings" jsonb DEFAULT '[]'::jsonb,
    "last_activity" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "focus_cities_user_idx" ON "focus_cities" ("user_id");

-- =============================================
-- MISSING TABLE 4: city_building_definitions
-- =============================================
CREATE TABLE IF NOT EXISTS "city_building_definitions" (
    "id" text PRIMARY KEY NOT NULL,
    "type" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "level_required" integer DEFAULT 1 NOT NULL,
    "xp_cost" integer DEFAULT 0 NOT NULL,
    "coin_cost" integer DEFAULT 0 NOT NULL,
    "effects" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 5: lootbox_definitions
-- =============================================
CREATE TABLE IF NOT EXISTS "lootbox_definitions" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "rarity" text NOT NULL,
    "coin_cost" integer DEFAULT 0 NOT NULL,
    "xp_cost" integer DEFAULT 0 NOT NULL,
    "is_premium" boolean DEFAULT false NOT NULL,
    "items" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 6: lootbox_rewards
-- =============================================
CREATE TABLE IF NOT EXISTS "lootbox_rewards" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "lootbox_id" text NOT NULL,
    "reward_item" jsonb NOT NULL,
    "opened_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lootbox_rewards_user_idx" ON "lootbox_rewards" ("user_id");

-- =============================================
-- MISSING TABLE 7: quest_definitions
-- =============================================
CREATE TABLE IF NOT EXISTS "quest_definitions" (
    "id" text PRIMARY KEY NOT NULL,
    "quest_key" text NOT NULL UNIQUE,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "category" text NOT NULL DEFAULT 'exploration',
    "xp_reward" integer DEFAULT 100 NOT NULL,
    "coin_reward" integer DEFAULT 50 NOT NULL,
    "badge_reward" text,
    "steps" jsonb DEFAULT '[]'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 8: user_quest_progress
-- =============================================
CREATE TABLE IF NOT EXISTS "user_quest_progress" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "quest_key" text NOT NULL,
    "current_step" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_quest_progress_user_idx" ON "user_quest_progress" ("user_id");
CREATE INDEX IF NOT EXISTS "user_quest_progress_quest_idx" ON "user_quest_progress" ("quest_key");

-- =============================================
-- MISSING TABLE 9: focus_dna
-- =============================================
CREATE TABLE IF NOT EXISTS "focus_dna" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "dna_type" text NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "experience" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "focus_dna_user_idx" ON "focus_dna" ("user_id");

-- =============================================
-- MISSING TABLE 10: session_ghosts
-- =============================================
CREATE TABLE IF NOT EXISTS "session_ghosts" (
    "id" text PRIMARY KEY NOT NULL,
    "session_id" text NOT NULL,
    "user_id" text NOT NULL,
    "ghost_data" jsonb NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_ghosts_session_idx" ON "session_ghosts" ("session_id");
CREATE INDEX IF NOT EXISTS "session_ghosts_user_idx" ON "session_ghosts" ("user_id");

-- =============================================
-- MISSING TABLE 11: consequence_contracts
-- =============================================
CREATE TABLE IF NOT EXISTS "consequence_contracts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "week_start" text NOT NULL,
    "contract_type" text NOT NULL,
    "target_minutes" integer DEFAULT 0 NOT NULL,
    "charity_name" text,
    "charity_amount" integer,
    "achieved" boolean DEFAULT false NOT NULL,
    "consequence_triggered" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 12: freeze_tokens
-- =============================================
CREATE TABLE IF NOT EXISTS "freeze_tokens" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "tokens" integer DEFAULT 3 NOT NULL,
    "last_refill" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "freeze_tokens_user_id_unique" ON "freeze_tokens" ("user_id");

-- =============================================
-- MISSING TABLE 13: battle_pass_rewards
-- =============================================
CREATE TABLE IF NOT EXISTS "battle_pass_rewards" (
    "id" text PRIMARY KEY NOT NULL,
    "tier" integer NOT NULL,
    "xp_required" integer NOT NULL,
    "free_reward" jsonb,
    "premium_reward" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 14: battle_passes
-- =============================================
CREATE TABLE IF NOT EXISTS "battle_passes" (
    "id" text PRIMARY KEY NOT NULL,
    "season" integer NOT NULL,
    "name" text NOT NULL,
    "start_date" timestamp NOT NULL,
    "end_date" timestamp NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- =============================================
-- MISSING TABLE 15: leaderboard_snapshots
-- =============================================
CREATE TABLE IF NOT EXISTS "leaderboard_snapshots" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "period" text NOT NULL,
    "category" text NOT NULL,
    "score" integer NOT NULL,
    "rank" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "leaderboard_snapshots_period_category_idx" ON "leaderboard_snapshots" ("period", "category");

-- =============================================
-- MISSING TABLE 16: shared_goals
-- =============================================
CREATE TABLE IF NOT EXISTS "shared_goals" (
    "id" text PRIMARY KEY NOT NULL,
    "group_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "target_value" integer DEFAULT 1 NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "created_by" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "shared_goals_group_idx" ON "shared_goals" ("group_id");

-- =============================================
-- MISSING TABLE 17: study_buddies
-- =============================================
CREATE TABLE IF NOT EXISTS "study_buddies" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "buddy_id" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "study_buddies_user_buddy_idx" ON "study_buddies" ("user_id", "buddy_id");

-- =============================================
-- MISSING TABLE 18: user_battle_pass_progress
-- =============================================
CREATE TABLE IF NOT EXISTS "user_battle_pass_progress" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "battle_pass_id" text NOT NULL,
    "current_tier" integer DEFAULT 0 NOT NULL,
    "current_xp" integer DEFAULT 0 NOT NULL,
    "premium_unlocked" boolean DEFAULT false NOT NULL,
    "claimed_tiers" jsonb DEFAULT '[]'::jsonb,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_battle_pass_user_pass_idx" ON "user_battle_pass_progress" ("user_id", "battle_pass_id");

-- =============================================
-- MISSING TABLE 19: group_audit_logs
-- =============================================
CREATE TABLE IF NOT EXISTS "group_audit_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "group_id" text NOT NULL,
    "user_id" text,
    "action" text NOT NULL,
    "details" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "group_audit_logs_group_idx" ON "group_audit_logs" ("group_id");

-- =============================================
-- MISSING TABLE 20: group_challenge_progress
-- =============================================
CREATE TABLE IF NOT EXISTS "group_challenge_progress" (
    "id" text PRIMARY KEY NOT NULL,
    "challenge_id" text NOT NULL,
    "user_id" text NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "group_challenge_progress_chal_user_idx" ON "group_challenge_progress" ("challenge_id", "user_id");

-- =============================================
-- MISSING TABLE 21: group_challenges
-- =============================================
CREATE TABLE IF NOT EXISTS "group_challenges" (
    "id" text PRIMARY KEY NOT NULL,
    "group_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "target_type" text NOT NULL,
    "target_value" integer DEFAULT 1 NOT NULL,
    "start_date" timestamp NOT NULL,
    "end_date" timestamp NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "group_challenges_group_idx" ON "group_challenges" ("group_id");

-- =============================================
-- MISSING TABLE 22: group_invitations
-- =============================================
CREATE TABLE IF NOT EXISTS "group_invitations" (
    "id" text PRIMARY KEY NOT NULL,
    "group_id" text NOT NULL,
    "invited_user_id" text,
    "invited_email" text,
    "role" text DEFAULT 'member' NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "expires_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "group_invitations_group_idx" ON "group_invitations" ("group_id");

-- =============================================
-- MISSING TABLE 23: posts
-- =============================================
CREATE TABLE IF NOT EXISTS "posts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "content" text NOT NULL,
    "media_urls" jsonb DEFAULT '[]'::jsonb,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "shares_count" integer DEFAULT 0 NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "posts_user_idx" ON "posts" ("user_id");
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at");

-- =============================================
-- MISSING TABLE 24: post_likes
-- =============================================
CREATE TABLE IF NOT EXISTS "post_likes" (
    "id" text PRIMARY KEY NOT NULL,
    "post_id" text NOT NULL,
    "user_id" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "post_likes_post_user_idx" ON "post_likes" ("post_id", "user_id");

-- =============================================
-- MISSING COLUMN: conversation_participants.is_admin
-- =============================================
DO $$ BEGIN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- VERIFICATION QUERIES (run separately)
-- =============================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT 'premium_subscriptions' as tbl, COUNT(*) as cnt FROM premium_subscriptions
-- UNION ALL SELECT 'email_logs', COUNT(*) FROM email_logs;
