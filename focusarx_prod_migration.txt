-- ============================================================
-- FOCUSARX — CANONICAL PRODUCTION DATABASE MIGRATION (82 tables)
--
-- This file is the single source of truth for the FocusArx database.
-- It is generated from and verified against the Drizzle schema in
-- lib/db/src/schema/: after applying it, `drizzle-kit push` reports a
-- fully synchronized schema with zero structural drift.
--
-- WHAT THIS FIXES (drift found in production):
--   • social_posts was missing moderation_status / moderation_reason
--   • site_settings table was missing
--   • flashcard_decks + flashcards tables were missing
--   • content seeds (missions/quests/city/loot boxes/marketplace) safe
--     to re-run: they never overwrite existing rows
--
-- Safe to run repeatedly — every statement is idempotent:
--   CREATE ... IF NOT EXISTS · guarded ADD CONSTRAINT ·
--   ADD COLUMN IF NOT EXISTS · INSERT ... ON CONFLICT DO NOTHING
-- It NEVER drops a table, column, or row. Existing data is preserved
-- (verified with sentinel-row tests on a copy of the production dump).
--
-- Apply in: Supabase SQL Editor · Neon SQL Editor · psql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. TABLES (full current shape; no-ops where tables already exist)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "active_sessions" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'focus'::text NOT NULL,
	"seconds_left" integer DEFAULT 1500 NOT NULL,
	"timer_status" text DEFAULT 'paused'::text NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"focus_score" real,
	"focus_quality" text,
	"focus_state" text,
	"distraction_count" integer DEFAULT 0,
	"last_seen_face_at" text,
	"focus_timeline" text DEFAULT '[]'::text,
	"monitor_enabled" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" text NOT NULL PRIMARY KEY,
	"event_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
	"id" text NOT NULL PRIMARY KEY,
	"visitor_id" text NOT NULL,
	"session_start" timestamp DEFAULT now() NOT NULL,
	"session_end" timestamp,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"focus_sessions_started" integer DEFAULT 0 NOT NULL,
	"tasks_created" integer DEFAULT 0 NOT NULL,
	"roadmaps_generated" integer DEFAULT 0 NOT NULL,
	"ai_features_used" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_feedback" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text,
	"rating" integer NOT NULL,
	"message" text,
	"category" text DEFAULT 'general'::text,
	"session_count" integer DEFAULT 0,
	"user_level" integer DEFAULT 1,
	"device" text,
	"app_version" text DEFAULT '1.0'::text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text,
	"action" text NOT NULL,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "battle_pass_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"season_xp" integer DEFAULT 0 NOT NULL,
	"premium_unlocked" boolean DEFAULT false NOT NULL,
	"claimed_tiers" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "battle_pass_progress_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "battle_pass_rewards" (
	"id" text NOT NULL PRIMARY KEY,
	"battle_pass_id" text NOT NULL,
	"tier" integer NOT NULL,
	"type" text NOT NULL,
	"value" jsonb,
	"required_xp" integer NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "battle_passes" (
	"id" text NOT NULL PRIMARY KEY,
	"season" text NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "battle_passes_season_unique" UNIQUE("season")
);

CREATE TABLE IF NOT EXISTS "break_free_moods" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"mood" integer NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "break_free_pledges" (
	"id" text NOT NULL PRIMARY KEY,
	"message" text NOT NULL,
	"posted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "break_free_streaks" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"start_date" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"relapse_count" integer DEFAULT 0 NOT NULL,
	"last_relapse_date" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "break_free_streaks_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "buddy_requests" (
	"id" text NOT NULL PRIMARY KEY,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" text DEFAULT 'pending'::text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "city_building_definitions" (
	"id" text NOT NULL PRIMARY KEY,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"district" text NOT NULL,
	"category" text NOT NULL,
	"unlock_level" integer DEFAULT 1 NOT NULL,
	"unlock_sessions" integer DEFAULT 0 NOT NULL,
	"coin_cost" integer DEFAULT 0 NOT NULL,
	"population_bonus" integer DEFAULT 10 NOT NULL,
	"xp_bonus_per_session" integer DEFAULT 0 NOT NULL,
	"coin_bonus_per_session" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"tier" text DEFAULT 'hamlet'::text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "city_building_definitions_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "coin_transactions" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"balance_after" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "consequence_contracts" (
	"id" text NOT NULL PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS "conversation_participants" (
	"id" text NOT NULL PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp,
	"is_admin" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" text NOT NULL PRIMARY KEY,
	"type" text DEFAULT 'direct'::text NOT NULL,
	"name" text,
	"group_id" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "distraction_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_id" text,
	"reason" text NOT NULL,
	"worth_it" boolean DEFAULT false NOT NULL,
	"hour" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"recipient_id" text,
	"recipient_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending'::text NOT NULL,
	"provider_id" text,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced" boolean DEFAULT false,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcard_decks" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General'::text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" text NOT NULL PRIMARY KEY,
	"deck_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"next_review_at" timestamp DEFAULT now() NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_cities" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"tier" text DEFAULT 'hamlet'::text NOT NULL,
	"tier_name" text DEFAULT 'Study Hamlet'::text NOT NULL,
	"population" integer DEFAULT 5 NOT NULL,
	"total_buildings" integer DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb,
	"buildings" jsonb DEFAULT '{}'::jsonb,
	"atmosphere" text DEFAULT 'day'::text NOT NULL,
	"weather" text DEFAULT 'clear'::text NOT NULL,
	"weather_updated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_cities_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "focus_dna" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"archetype" text NOT NULL,
	"description" text NOT NULL,
	"color_primary" text NOT NULL,
	"color_secondary" text NOT NULL,
	"icon" text NOT NULL,
	"top_focus_hour" integer,
	"avg_session_min" integer,
	"strongest_day" text,
	"biggest_weakness" text,
	"session_count_at_generation" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_dna_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "focus_profiles" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"ssid" text,
	"blocked_domains" jsonb DEFAULT '[]'::jsonb,
	"whitelist" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_sessions" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'focus'::text NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"planned_duration_sec" integer,
	"completed_early" boolean DEFAULT false,
	"completion_percentage" real,
	"session_status" text DEFAULT 'completed'::text,
	"completed_at" timestamp,
	"focus_score" real,
	"focus_quality" text,
	"stability_rating" text,
	"focus_timeline" text,
	"session_insights" text,
	"category" text DEFAULT 'General'::text,
	"productivity_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "follows" (
	"id" text NOT NULL PRIMARY KEY,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "freeze_tokens" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"tokens_available" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "freeze_tokens_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "friendships" (
	"id" text NOT NULL PRIMARY KEY,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text DEFAULT 'pending'::text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "goals" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_audit_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"group_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_challenge_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"challenge_id" text NOT NULL,
	"user_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_challenges" (
	"id" text NOT NULL PRIMARY KEY,
	"group_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sessions'::text NOT NULL,
	"xp_reward" integer DEFAULT 500 NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'active'::text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_invitations" (
	"id" text NOT NULL PRIMARY KEY,
	"group_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_email" text,
	"invitee_id" text,
	"status" text DEFAULT 'pending'::text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_members" (
	"id" text NOT NULL PRIMARY KEY,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member'::text NOT NULL,
	"xp_contribution" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habit_completions" (
	"id" text NOT NULL PRIMARY KEY,
	"habit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habits" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '⭐'::text NOT NULL,
	"color" text DEFAULT '#7C3AED'::text NOT NULL,
	"frequency" text DEFAULT 'daily'::text NOT NULL,
	"target_days" jsonb DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_completions" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leaderboard_snapshots" (
	"id" text NOT NULL PRIMARY KEY,
	"period" text NOT NULL,
	"category" text NOT NULL,
	"scope" text DEFAULT 'global'::text,
	"group_id" text,
	"data" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "login_rewards" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"last_claimed_date" text,
	"claim_streak" integer DEFAULT 0 NOT NULL,
	"total_claimed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_rewards_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "loot_box_types" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rarity" text NOT NULL,
	"coin_cost" integer DEFAULT 0 NOT NULL,
	"sessions_required" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"glow_color" text DEFAULT '#7C3AED'::text NOT NULL,
	"possible_rewards" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "marketplace_items" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'avatar'::text NOT NULL,
	"cost_coins" integer DEFAULT 100 NOT NULL,
	"rarity" text DEFAULT 'common'::text,
	"emoji" text DEFAULT '🎁'::text,
	"data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" text NOT NULL PRIMARY KEY,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" text NOT NULL PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text'::text,
	"reply_to_id" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "missions" (
	"id" text NOT NULL PRIMARY KEY,
	"mission_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text DEFAULT 'daily'::text NOT NULL,
	"category" text DEFAULT 'focus'::text NOT NULL,
	"xp_reward" integer DEFAULT 100 NOT NULL,
	"coin_reward" integer DEFAULT 50 NOT NULL,
	"target_value" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sessions'::text NOT NULL,
	"icon" text DEFAULT '🎯'::text NOT NULL,
	"difficulty" text DEFAULT 'easy'::text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "missions_mission_key_unique" UNIQUE("mission_key")
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "page_views" (
	"id" text NOT NULL PRIMARY KEY,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"page" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "post_comments" (
	"id" text NOT NULL PRIMARY KEY,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_likes" (
	"id" text NOT NULL PRIMARY KEY,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_reactions" (
	"id" text NOT NULL PRIMARY KEY,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_saves" (
	"id" text NOT NULL PRIMARY KEY,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "posts" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'general'::text NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"achievement_data" jsonb,
	"study_log_data" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"group_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "premium_subscriptions" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"coins_cost" integer DEFAULT 9000,
	"benefits" jsonb DEFAULT '["exclusive_pets", "premium_loot_boxes", "premium_themes", "xp_multiplier", "coin_multiplier", "premium_analytics", "profile_badge", "premium_battle_pass"]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"granted_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_subscriptions_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "productivity_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"focus_minutes" integer DEFAULT 0 NOT NULL,
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"avg_focus_score" real,
	"productivity_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quest_definitions" (
	"id" text NOT NULL PRIMARY KEY,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"difficulty" text DEFAULT 'easy'::text NOT NULL,
	"target" integer NOT NULL,
	"metric" text NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"coin_reward" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rotation_weight" integer DEFAULT 10 NOT NULL
);

CREATE TABLE IF NOT EXISTS "readiness_logs" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"sleep" integer NOT NULL,
	"stress" integer NOT NULL,
	"energy" integer NOT NULL,
	"score" integer NOT NULL,
	"session_length_rec" integer NOT NULL,
	"hrv" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roadmaps" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seasonal_events" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"banner_color" text DEFAULT '#7C3AED'::text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"xp_multiplier" real DEFAULT 1 NOT NULL,
	"coin_multiplier" real DEFAULT 1 NOT NULL,
	"special_missions" jsonb DEFAULT '[]'::jsonb,
	"exclusive_rewards" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasonal_events_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "session_ghosts" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"task_category" text DEFAULT 'General'::text NOT NULL,
	"best_duration_sec" integer DEFAULT 0 NOT NULL,
	"best_unbroken_sec" integer DEFAULT 0 NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shared_goals" (
	"id" text NOT NULL PRIMARY KEY,
	"group_id" text,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp,
	"status" text DEFAULT 'active'::text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_settings" (
	"id" text NOT NULL PRIMARY KEY,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"announcement_enabled" boolean DEFAULT false NOT NULL,
	"announcement_title" text,
	"announcement_text" text,
	"announcement_emoji" text,
	"branding_name" text DEFAULT 'FocusArx'::text NOT NULL,
	"branding_tagline" text,
	"hero_title" text,
	"hero_subtitle" text,
	"hero_cta_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "social_posts" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'general'::text NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"group_id" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"moderation_status" text DEFAULT 'approved'::text NOT NULL,
	"moderation_reason" text
);

CREATE TABLE IF NOT EXISTS "study_buddies" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"buddy_id" text NOT NULL,
	"status" text DEFAULT 'active'::text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_groups" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"group_xp" integer DEFAULT 0 NOT NULL,
	"group_level" integer DEFAULT 1 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"invite_code" text NOT NULL,
	"max_members" integer DEFAULT 20 NOT NULL,
	"avatar_emoji" text DEFAULT '🎯'::text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_groups_invite_code_unique" UNIQUE("invite_code")
);

CREATE TABLE IF NOT EXISTS "study_room_members" (
	"id" text NOT NULL PRIMARY KEY,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"focus_minutes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_rooms" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"group_id" text,
	"host_id" text NOT NULL,
	"mode" text DEFAULT 'silent'::text NOT NULL,
	"status" text DEFAULT 'active'::text NOT NULL,
	"max_participants" integer DEFAULT 50 NOT NULL,
	"timer_duration" integer DEFAULT 1500 NOT NULL,
	"ambiance" text DEFAULT 'silence'::text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"invite_code" text NOT NULL,
	"scheduled_for" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_streaks" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_study_date" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_streaks_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0,
	"estimated_minutes" integer,
	"category" text DEFAULT 'General'::text,
	"priority" text DEFAULT 'medium'::text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"due_date" text,
	"recurring" text,
	"completed_at" timestamp,
	"status" text DEFAULT 'active'::text,
	"missed_at" timestamp,
	"miss_count" integer DEFAULT 0,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_badges" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_battle_pass_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"battle_pass_id" text NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"current_tier" integer DEFAULT 0 NOT NULL,
	"claimed_rewards" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_dreams" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"dream_type" text DEFAULT 'custom'::text NOT NULL,
	"custom_goal" text,
	"target_date" text,
	"daily_target_minutes" integer DEFAULT 120,
	"total_minutes_logged" integer DEFAULT 0,
	"start_date" text,
	"emoji" text DEFAULT '🎯'::text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_dreams_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_inventory" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_loot_boxes" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"box_type_id" text NOT NULL,
	"status" text DEFAULT 'unopened'::text NOT NULL,
	"reward_type" text,
	"reward_value" jsonb,
	"earned_reason" text,
	"opened_at" timestamp,
	"earned_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_mission_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"mission_key" text NOT NULL,
	"period_start" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"reward_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_pets" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"pet_type" text DEFAULT 'owl'::text NOT NULL,
	"pet_name" text,
	"pet_level" integer DEFAULT 1 NOT NULL,
	"pet_xp" integer DEFAULT 0 NOT NULL,
	"evolution_stage" integer DEFAULT 1 NOT NULL,
	"mood" text DEFAULT 'happy'::text,
	"accessories" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_pets_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_profile_extras" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"banner_url" text,
	"banner_gradient" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"featured_post_ids" jsonb DEFAULT '[]'::jsonb,
	"pinned_badge_ids" jsonb DEFAULT '[]'::jsonb,
	"is_private" boolean DEFAULT false NOT NULL,
	"custom_status" text,
	"status_emoji" text,
	"creator_tier" text DEFAULT 'learner'::text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_extras_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_quest_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"period" text NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_quest_progress_unique" UNIQUE("user_id", "quest_id", "period")
);

CREATE TABLE IF NOT EXISTS "user_seasonal_progress" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"completed_missions" jsonb DEFAULT '[]'::jsonb,
	"rewards_claimed" jsonb DEFAULT '[]'::jsonb,
	"rank" integer,
	CONSTRAINT "user_seasonal_progress_unique" UNIQUE("user_id", "event_id")
);

CREATE TABLE IF NOT EXISTS "user_wallets" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"weekly_xp" integer DEFAULT 0 NOT NULL,
	"weekly_xp_reset_at" timestamp DEFAULT now(),
	"level" integer DEFAULT 1 NOT NULL,
	"prestige" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_wallets_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" text NOT NULL PRIMARY KEY,
	"email" text NOT NULL,
	"name" text,
	"hashed_password" text,
	"guest_key" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'user'::text NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_data" jsonb,
	"bio" text,
	"timezone" text DEFAULT 'UTC'::text,
	"productivity_score" real DEFAULT 0,
	"total_focus_minutes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_guest_key_unique" UNIQUE("guest_key")
);

CREATE TABLE IF NOT EXISTS "visitors" (
	"id" text NOT NULL PRIMARY KEY,
	"visitor_id" text NOT NULL,
	"user_id" text,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"device_type" text,
	"browser" text,
	"os" text,
	"country" text,
	"city" text,
	"is_bot" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "wrapped_snapshots" (
	"id" text NOT NULL PRIMARY KEY,
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"period_type" text DEFAULT 'monthly'::text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- ──────────────────────────────────────────────────────────────
-- 2. COLUMN DRIFT REPAIR (adds any column missing on legacy DBs)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'focus'::text NOT NULL;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "seconds_left" integer DEFAULT 1500 NOT NULL;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "timer_status" text DEFAULT 'paused'::text NOT NULL;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "active_seconds" integer DEFAULT 0 NOT NULL;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "focus_score" real;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "focus_quality" text;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "focus_state" text;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "distraction_count" integer DEFAULT 0;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "last_seen_face_at" text;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "focus_timeline" text DEFAULT '[]'::text;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "monitor_enabled" boolean DEFAULT false;
ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "event_id" text;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "visitor_id" text;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "event_type" text;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "event_data" jsonb;
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "visitor_id" text;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "session_start" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "session_end" timestamp;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "duration_sec" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "page_views" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "focus_sessions_started" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "tasks_created" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "roadmaps_generated" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "ai_features_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "rating" integer;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general'::text;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "session_count" integer DEFAULT 0;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "user_level" integer DEFAULT 1;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "device" text;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "app_version" text DEFAULT '1.0'::text;
ALTER TABLE "app_feedback" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "details" jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "season" integer DEFAULT 1 NOT NULL;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "tier" integer DEFAULT 0 NOT NULL;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "season_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "premium_unlocked" boolean DEFAULT false NOT NULL;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "claimed_tiers" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "battle_pass_progress" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "battle_pass_id" text;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "tier" integer;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "value" jsonb;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "required_xp" integer;
ALTER TABLE "battle_pass_rewards" ADD COLUMN IF NOT EXISTS "is_premium" boolean DEFAULT false NOT NULL;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "season" text;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "start_date" timestamp;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "end_date" timestamp;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "battle_passes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "break_free_moods" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "break_free_moods" ADD COLUMN IF NOT EXISTS "mood" integer;
ALTER TABLE "break_free_moods" ADD COLUMN IF NOT EXISTS "date" text;
ALTER TABLE "break_free_moods" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "break_free_pledges" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "break_free_pledges" ADD COLUMN IF NOT EXISTS "posted_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "start_date" text;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "current_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "longest_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "relapse_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "last_relapse_date" text;
ALTER TABLE "break_free_streaks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "sender_id" text;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "receiver_id" text;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "buddy_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "district" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "unlock_level" integer DEFAULT 1 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "unlock_sessions" integer DEFAULT 0 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "coin_cost" integer DEFAULT 0 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "population_bonus" integer DEFAULT 10 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "xp_bonus_per_session" integer DEFAULT 0 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "coin_bonus_per_session" integer DEFAULT 0 NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'hamlet'::text NOT NULL;
ALTER TABLE "city_building_definitions" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "amount" integer;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "balance_after" integer DEFAULT 0 NOT NULL;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "week_start" text;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "contract_type" text;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "target_minutes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "charity_name" text;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "charity_amount" integer;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "achieved" boolean DEFAULT false NOT NULL;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "consequence_triggered" boolean DEFAULT false NOT NULL;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "consequence_contracts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "conversation_id" text;
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "last_read_at" timestamp;
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'direct'::text NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message_at" timestamp;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "worth_it" boolean DEFAULT false NOT NULL;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "hour" integer;
ALTER TABLE "distraction_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipient_id" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipient_email" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "template" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "provider_id" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "opened_at" timestamp;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clicked_at" timestamp;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "bounced" boolean DEFAULT false;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "error" text;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General'::text;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "deck_id" text;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "front" text;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "back" text;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "box" integer DEFAULT 1 NOT NULL;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "next_review_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "correct_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "incorrect_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'hamlet'::text NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "tier_name" text DEFAULT 'Study Hamlet'::text NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "population" integer DEFAULT 5 NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "total_buildings" integer DEFAULT 0 NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "total_sessions" integer DEFAULT 0 NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "buildings" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "atmosphere" text DEFAULT 'day'::text NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "weather" text DEFAULT 'clear'::text NOT NULL;
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "weather_updated_at" timestamp DEFAULT now();
ALTER TABLE "focus_cities" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "archetype" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "color_primary" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "color_secondary" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "top_focus_hour" integer;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "avg_session_min" integer;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "strongest_day" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "biggest_weakness" text;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "session_count_at_generation" integer DEFAULT 0 NOT NULL;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "generated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "focus_dna" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "ssid" text;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "blocked_domains" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "whitelist" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false NOT NULL;
ALTER TABLE "focus_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'focus'::text NOT NULL;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "duration_sec" integer DEFAULT 0 NOT NULL;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "planned_duration_sec" integer;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "completed_early" boolean DEFAULT false;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "completion_percentage" real;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "session_status" text DEFAULT 'completed'::text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "focus_score" real;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "focus_quality" text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "stability_rating" text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "focus_timeline" text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "session_insights" text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General'::text;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "productivity_score" real;
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "follower_id" text;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "following_id" text;
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "freeze_tokens" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "freeze_tokens" ADD COLUMN IF NOT EXISTS "tokens_available" integer DEFAULT 0 NOT NULL;
ALTER TABLE "freeze_tokens" ADD COLUMN IF NOT EXISTS "tokens_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "freeze_tokens" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "requester_id" text;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "addressee_id" text;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "actor_id" text;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "target_id" text;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "details" jsonb;
ALTER TABLE "group_audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "group_challenge_progress" ADD COLUMN IF NOT EXISTS "challenge_id" text;
ALTER TABLE "group_challenge_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "group_challenge_progress" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;
ALTER TABLE "group_challenge_progress" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "group_challenge_progress" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "creator_id" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "target_value" integer DEFAULT 1 NOT NULL;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'sessions'::text NOT NULL;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "xp_reward" integer DEFAULT 500 NOT NULL;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "start_date" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "end_date" text;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text NOT NULL;
ALTER TABLE "group_challenges" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "inviter_id" text;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "invitee_email" text;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "invitee_id" text;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
ALTER TABLE "group_invitations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'member'::text NOT NULL;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "xp_contribution" integer DEFAULT 0 NOT NULL;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "habit_completions" ADD COLUMN IF NOT EXISTS "habit_id" text;
ALTER TABLE "habit_completions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "habit_completions" ADD COLUMN IF NOT EXISTS "date" text;
ALTER TABLE "habit_completions" ADD COLUMN IF NOT EXISTS "note" text;
ALTER TABLE "habit_completions" ADD COLUMN IF NOT EXISTS "completed_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT '⭐'::text NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#7C3AED'::text NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "frequency" text DEFAULT 'daily'::text NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "target_days" jsonb DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "current_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "longest_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "total_completions" integer DEFAULT 0 NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "period" text;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'global'::text;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "generated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "login_rewards" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "login_rewards" ADD COLUMN IF NOT EXISTS "last_claimed_date" text;
ALTER TABLE "login_rewards" ADD COLUMN IF NOT EXISTS "claim_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "login_rewards" ADD COLUMN IF NOT EXISTS "total_claimed" integer DEFAULT 0 NOT NULL;
ALTER TABLE "login_rewards" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "rarity" text;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "coin_cost" integer DEFAULT 0 NOT NULL;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "sessions_required" integer DEFAULT 0 NOT NULL;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "glow_color" text DEFAULT '#7C3AED'::text NOT NULL;
ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "possible_rewards" jsonb;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'avatar'::text NOT NULL;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "cost_coins" integer DEFAULT 100 NOT NULL;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "rarity" text DEFAULT 'common'::text;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "emoji" text DEFAULT '🎁'::text;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "marketplace_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "message_reactions" ADD COLUMN IF NOT EXISTS "message_id" text;
ALTER TABLE "message_reactions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "message_reactions" ADD COLUMN IF NOT EXISTS "emoji" text;
ALTER TABLE "message_reactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'text'::text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" boolean DEFAULT false NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "mission_key" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'daily'::text NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'focus'::text NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "xp_reward" integer DEFAULT 100 NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "coin_reward" integer DEFAULT 50 NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "target_value" integer DEFAULT 1 NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'sessions'::text NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT '🎯'::text NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "difficulty" text DEFAULT 'easy'::text NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read" boolean DEFAULT false NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "visitor_id" text;
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "page" text;
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "viewed_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "token" text;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "used_at" timestamp;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "post_id" text;
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "parent_id" text;
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "post_likes" ADD COLUMN IF NOT EXISTS "post_id" text;
ALTER TABLE "post_likes" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "post_likes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "post_reactions" ADD COLUMN IF NOT EXISTS "post_id" text;
ALTER TABLE "post_reactions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "post_reactions" ADD COLUMN IF NOT EXISTS "reaction" text;
ALTER TABLE "post_reactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "post_saves" ADD COLUMN IF NOT EXISTS "post_id" text;
ALTER TABLE "post_saves" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "post_saves" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'general'::text NOT NULL;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_urls" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "achievement_data" jsonb;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "study_log_data" jsonb;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "activated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "coins_cost" integer DEFAULT 9000;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "benefits" jsonb DEFAULT '["exclusive_pets", "premium_loot_boxes", "premium_themes", "xp_multiplier", "coin_multiplier", "premium_analytics", "profile_badge", "premium_battle_pass"]'::jsonb;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "granted_by_admin" boolean DEFAULT false NOT NULL;
ALTER TABLE "premium_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "date" text;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "focus_minutes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "sessions_completed" integer DEFAULT 0 NOT NULL;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "tasks_completed" integer DEFAULT 0 NOT NULL;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "avg_focus_score" real;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "productivity_score" real;
ALTER TABLE "productivity_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "difficulty" text DEFAULT 'easy'::text NOT NULL;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "target" integer;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "metric" text;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "xp_reward" integer DEFAULT 0 NOT NULL;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "coin_reward" integer DEFAULT 0 NOT NULL;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "rotation_weight" integer DEFAULT 10 NOT NULL;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "date" text;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "sleep" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "stress" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "energy" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "score" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "session_length_rec" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "hrv" integer;
ALTER TABLE "readiness_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "roadmaps" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "roadmaps" ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE "roadmaps" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "roadmaps" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "theme" text;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "banner_color" text DEFAULT '#7C3AED'::text NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "start_date" timestamp;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "end_date" timestamp;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "xp_multiplier" real DEFAULT 1 NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "coin_multiplier" real DEFAULT 1 NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "special_missions" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "exclusive_rewards" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false NOT NULL;
ALTER TABLE "seasonal_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "task_category" text DEFAULT 'General'::text NOT NULL;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "best_duration_sec" integer DEFAULT 0 NOT NULL;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "best_unbroken_sec" integer DEFAULT 0 NOT NULL;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "session_ghosts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "creator_id" text;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "target_value" integer;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "current_value" integer DEFAULT 0 NOT NULL;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text;
ALTER TABLE "shared_goals" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "maintenance_mode" boolean DEFAULT false NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "maintenance_message" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "announcement_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "announcement_title" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "announcement_text" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "announcement_emoji" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "branding_name" text DEFAULT 'FocusArx'::text NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "branding_tagline" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_title" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_subtitle" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_cta_text" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'general'::text NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "image_urls" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved'::text NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "moderation_reason" text;
ALTER TABLE "study_buddies" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "study_buddies" ADD COLUMN IF NOT EXISTS "buddy_id" text;
ALTER TABLE "study_buddies" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text;
ALTER TABLE "study_buddies" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "owner_id" text;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "group_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "group_level" integer DEFAULT 1 NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "invite_code" text;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "max_members" integer DEFAULT 20 NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "avatar_emoji" text DEFAULT '🎯'::text NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "study_groups" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "room_id" text;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "left_at" timestamp;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "focus_minutes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "study_room_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "host_id" text;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'silent'::text NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "max_participants" integer DEFAULT 50 NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "timer_duration" integer DEFAULT 1500 NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "ambiance" text DEFAULT 'silence'::text NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "invite_code" text;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "ended_at" timestamp;
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "study_streaks" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "study_streaks" ADD COLUMN IF NOT EXISTS "current_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "study_streaks" ADD COLUMN IF NOT EXISTS "longest_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "study_streaks" ADD COLUMN IF NOT EXISTS "last_study_date" text;
ALTER TABLE "study_streaks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "text" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_minutes" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General'::text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'medium'::text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_date" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurring" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "missed_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "miss_count" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_badges" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_badges" ADD COLUMN IF NOT EXISTS "badge_id" text;
ALTER TABLE "user_badges" ADD COLUMN IF NOT EXISTS "unlocked_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "battle_pass_id" text;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "current_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "current_tier" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "claimed_rewards" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_battle_pass_progress" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "dream_type" text DEFAULT 'custom'::text NOT NULL;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "custom_goal" text;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "target_date" text;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "daily_target_minutes" integer DEFAULT 120;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "total_minutes_logged" integer DEFAULT 0;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "start_date" text;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "emoji" text DEFAULT '🎯'::text;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_dreams" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_inventory" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_inventory" ADD COLUMN IF NOT EXISTS "item_id" text;
ALTER TABLE "user_inventory" ADD COLUMN IF NOT EXISTS "acquired_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_inventory" ADD COLUMN IF NOT EXISTS "equipped" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "box_type_id" text;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'unopened'::text NOT NULL;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "reward_type" text;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "reward_value" jsonb;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "earned_reason" text;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "opened_at" timestamp;
ALTER TABLE "user_loot_boxes" ADD COLUMN IF NOT EXISTS "earned_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "mission_key" text;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "period_start" text;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "current_value" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "reward_claimed" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_mission_progress" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "pet_type" text DEFAULT 'owl'::text NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "pet_name" text;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "pet_level" integer DEFAULT 1 NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "pet_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "evolution_stage" integer DEFAULT 1 NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "mood" text DEFAULT 'happy'::text;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "accessories" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_pets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "banner_url" text;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "banner_gradient" text;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "featured_post_ids" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "pinned_badge_ids" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "is_private" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "custom_status" text;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "status_emoji" text;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "creator_tier" text DEFAULT 'learner'::text NOT NULL;
ALTER TABLE "user_profile_extras" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "quest_id" text;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "period" text;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "current" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp;
ALTER TABLE "user_quest_progress" ADD COLUMN IF NOT EXISTS "assigned_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "event_id" text;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "completed_missions" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "rewards_claimed" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "user_seasonal_progress" ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "coins" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "total_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "weekly_xp" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "weekly_xp_reset_at" timestamp DEFAULT now();
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "level" integer DEFAULT 1 NOT NULL;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "prestige" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_wallets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hashed_password" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guest_key" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user'::text NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_data" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC'::text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "productivity_score" real DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_focus_minutes" integer DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "visitor_id" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "first_seen" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "last_seen" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "visit_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "device_type" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "browser" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "os" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;
ALTER TABLE "wrapped_snapshots" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "wrapped_snapshots" ADD COLUMN IF NOT EXISTS "period" text;
ALTER TABLE "wrapped_snapshots" ADD COLUMN IF NOT EXISTS "period_type" text DEFAULT 'monthly'::text NOT NULL;
ALTER TABLE "wrapped_snapshots" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "wrapped_snapshots" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. UNIQUE CONSTRAINTS (guarded — skips when already present)
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "battle_passes" ADD CONSTRAINT "battle_passes_season_unique" UNIQUE("season");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "city_building_definitions" ADD CONSTRAINT "city_building_definitions_slug_unique" UNIQUE("slug");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_cities" ADD CONSTRAINT "focus_cities_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_dna" ADD CONSTRAINT "focus_dna_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "login_rewards" ADD CONSTRAINT "login_rewards_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "missions" ADD CONSTRAINT "missions_mission_key_unique" UNIQUE("mission_key");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "seasonal_events" ADD CONSTRAINT "seasonal_events_slug_unique" UNIQUE("slug");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_invite_code_unique" UNIQUE("invite_code");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_streaks" ADD CONSTRAINT "study_streaks_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_dreams" ADD CONSTRAINT "user_dreams_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_unique" UNIQUE("user_id", "quest_id", "period");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_unique" UNIQUE("user_id", "event_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_unique" UNIQUE("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_guest_key_unique" UNIQUE("guest_key");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 4. FOREIGN KEYS (guarded — skips when already present)
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "break_free_moods" ADD CONSTRAINT "break_free_moods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "consequence_contracts" ADD CONSTRAINT "consequence_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "distraction_logs" ADD CONSTRAINT "distraction_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users" ("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."flashcard_decks" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_cities" ADD CONSTRAINT "focus_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_dna" ADD CONSTRAINT "focus_dna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_profiles" ADD CONSTRAINT "focus_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_challenge_progress" ADD CONSTRAINT "group_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_challenges" ADD CONSTRAINT "group_challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "login_rewards" ADD CONSTRAINT "login_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "productivity_logs" ADD CONSTRAINT "productivity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "readiness_logs" ADD CONSTRAINT "readiness_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "session_ghosts" ADD CONSTRAINT "session_ghosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "shared_goals" ADD CONSTRAINT "shared_goals_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups" ("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_buddy_id_users_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_room_id_study_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_streaks" ADD CONSTRAINT "study_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_dreams" ADD CONSTRAINT "user_dreams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_marketplace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_box_type_id_loot_box_types_id_fk" FOREIGN KEY ("box_type_id") REFERENCES "public"."loot_box_types" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_quest_definitions_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quest_definitions" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_event_id_seasonal_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."seasonal_events" ("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "wrapped_snapshots" ADD CONSTRAINT "wrapped_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 5. INDEXES (non-constraint; IF NOT EXISTS)
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events USING btree (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_event_id_idx ON public.analytics_events USING btree (event_id);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx ON public.analytics_events USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS analytics_sessions_last_activity_idx ON public.analytics_sessions USING btree (last_activity_at);
CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_id_idx ON public.analytics_sessions USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON public.app_feedback USING btree (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS buddy_requests_receiver_idx ON public.buddy_requests USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS city_building_slug_idx ON public.city_building_definitions USING btree (slug);
CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON public.coin_transactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS conv_participants_conv_user_idx ON public.conversation_participants USING btree (conversation_id, user_id);
CREATE INDEX IF NOT EXISTS conversations_group_idx ON public.conversations USING btree (group_id);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON public.email_logs USING btree (recipient_id);
CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx ON public.flashcard_decks USING btree (user_id);
CREATE INDEX IF NOT EXISTS flashcards_deck_idx ON public.flashcards USING btree (deck_id);
CREATE INDEX IF NOT EXISTS focus_cities_user_idx ON public.focus_cities USING btree (user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_completed_at_idx ON public.focus_sessions USING btree (completed_at);
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON public.focus_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows USING btree (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows USING btree (following_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships USING btree (addressee_id);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships USING btree (requester_id);
CREATE INDEX IF NOT EXISTS group_audit_logs_group_idx ON public.group_audit_logs USING btree (group_id);
CREATE INDEX IF NOT EXISTS group_challenge_progress_chal_user_idx ON public.group_challenge_progress USING btree (challenge_id, user_id);
CREATE INDEX IF NOT EXISTS group_challenges_group_idx ON public.group_challenges USING btree (group_id);
CREATE INDEX IF NOT EXISTS group_invitations_group_idx ON public.group_invitations USING btree (group_id);
CREATE INDEX IF NOT EXISTS group_members_group_idx ON public.group_members USING btree (group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS habit_completions_habit_idx ON public.habit_completions USING btree (habit_id);
CREATE INDEX IF NOT EXISTS habit_completions_user_date_idx ON public.habit_completions USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS habits_user_idx ON public.habits USING btree (user_id);
CREATE INDEX IF NOT EXISTS leaderboard_snapshots_period_category_idx ON public.leaderboard_snapshots USING btree (period, category);
CREATE INDEX IF NOT EXISTS message_reactions_msg_idx ON public.message_reactions USING btree (message_id);
CREATE INDEX IF NOT EXISTS message_reactions_msg_user_idx ON public.message_reactions USING btree (message_id, user_id);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages USING btree (created_at);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS page_views_session_id_idx ON public.page_views USING btree (session_id);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON public.page_views USING btree (viewed_at);
CREATE INDEX IF NOT EXISTS page_views_visitor_id_idx ON public.page_views USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments USING btree (post_id);
CREATE INDEX IF NOT EXISTS post_likes_post_user_idx ON public.post_likes USING btree (post_id, user_id);
CREATE INDEX IF NOT EXISTS post_reactions_post_idx ON public.post_reactions USING btree (post_id);
CREATE INDEX IF NOT EXISTS post_saves_post_user_idx ON public.post_saves USING btree (post_id, user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts USING btree (created_at);
CREATE INDEX IF NOT EXISTS posts_user_idx ON public.posts USING btree (user_id);
CREATE INDEX IF NOT EXISTS premium_subscriptions_user_idx ON public.premium_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS productivity_logs_user_date_idx ON public.productivity_logs USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS push_sub_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS seasonal_events_slug_idx ON public.seasonal_events USING btree (slug);
CREATE INDEX IF NOT EXISTS shared_goals_group_idx ON public.shared_goals USING btree (group_id);
CREATE INDEX IF NOT EXISTS social_posts_created_at_idx ON public.social_posts USING btree (created_at);
CREATE INDEX IF NOT EXISTS social_posts_moderation_idx ON public.social_posts USING btree (moderation_status);
CREATE INDEX IF NOT EXISTS social_posts_user_idx ON public.social_posts USING btree (user_id);
CREATE INDEX IF NOT EXISTS study_buddies_user_buddy_idx ON public.study_buddies USING btree (user_id, buddy_id);
CREATE INDEX IF NOT EXISTS study_room_members_room_idx ON public.study_room_members USING btree (room_id);
CREATE INDEX IF NOT EXISTS study_rooms_host_idx ON public.study_rooms USING btree (host_id);
CREATE INDEX IF NOT EXISTS study_rooms_status_idx ON public.study_rooms USING btree (status);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks USING btree (user_id);
CREATE INDEX IF NOT EXISTS user_battle_pass_user_pass_idx ON public.user_battle_pass_progress USING btree (user_id, battle_pass_id);
CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON public.user_inventory USING btree (user_id);
CREATE INDEX IF NOT EXISTS user_loot_boxes_user_idx ON public.user_loot_boxes USING btree (user_id);
CREATE INDEX IF NOT EXISTS mission_progress_user_period_idx ON public.user_mission_progress USING btree (user_id, period_start);
CREATE INDEX IF NOT EXISTS user_quest_progress_user_idx ON public.user_quest_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS user_seasonal_progress_user_idx ON public.user_seasonal_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON public.visitors USING btree (last_seen);
CREATE INDEX IF NOT EXISTS visitors_user_id_idx ON public.visitors USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS visitors_visitor_id_idx ON public.visitors USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS wrapped_user_period_idx ON public.wrapped_snapshots USING btree (user_id, period);

-- ──────────────────────────────────────────────────────────────
-- 6. SEED DATA ( ON CONFLICT DO NOTHING — never overwrites )
-- ──────────────────────────────────────────────────────────────

-- Ensure the singleton site settings row exists:
INSERT INTO "site_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: 22 DEFAULT MISSIONS
-- ============================================================

INSERT INTO "missions" ("id", "mission_key","title","description","type","category","xp_reward","coin_reward","target_value","unit","icon","difficulty")
VALUES
  ('msn_daily_1session', 'daily_1session','First Session','Complete 1 focus session today','daily','focus',100,50,1,'sessions','🎯','easy'),
  ('msn_daily_3sessions', 'daily_3sessions','Triple Focus','Complete 3 focus sessions today','daily','focus',250,100,3,'sessions','🔥','medium'),
  ('msn_daily_30min', 'daily_30min','30 Min Focus','Focus for at least 30 minutes today','daily','focus',150,75,30,'minutes','⏱️','easy'),
  ('msn_daily_60min', 'daily_60min','Hour of Power','Focus for 60 minutes today','daily','focus',300,150,60,'minutes','⚡','medium'),
  ('msn_daily_task', 'daily_task','Task Crusher','Complete at least 1 task today','daily','tasks',100,50,1,'tasks','✅','easy'),
  ('msn_daily_3tasks', 'daily_3tasks','Productive Day','Complete 3 tasks today','daily','tasks',200,100,3,'tasks','📋','medium'),
  ('msn_daily_nolate', 'daily_nolate','Early Bird','Complete a session before 9 AM','daily','streak',200,100,1,'sessions','🌅','hard'),
  ('msn_daily_5sessions', 'daily_5sessions','Focus Marathon','Complete 5 sessions in one day','daily','focus',400,200,5,'sessions','🏆','hard'),
  ('msn_daily_habit', 'daily_habit','Habit Keeper','Complete a habit today','daily','habits',100,50,1,'habits','🌱','easy'),
  ('msn_daily_streak', 'daily_streak','Keep it Going','Maintain your streak today','daily','streak',150,75,1,'days','🔥','easy'),
  ('msn_daily_1hour', 'daily_1hour','60 Focused Minutes','Accumulate 60 minutes of focus today','daily','focus',200,100,60,'minutes','🕐','medium'),
  ('msn_daily_quality', 'daily_quality','High Focus','Get a focus score above 80','daily','focus',300,150,80,'score','🧠','hard'),
  ('msn_weekly_10sessions', 'weekly_10sessions','Session Warrior','Complete 10 sessions this week','weekly','focus',500,250,10,'sessions','⚔️','easy'),
  ('msn_weekly_20sessions', 'weekly_20sessions','Focus Master','Complete 20 sessions this week','weekly','focus',1000,500,20,'sessions','🏅','medium'),
  ('msn_weekly_5hours', 'weekly_5hours','5 Hour Focus Week','Focus for 5 hours this week','weekly','focus',600,300,300,'minutes','⏰','easy'),
  ('msn_weekly_10hours', 'weekly_10hours','10 Hour Focus Week','Focus for 10 hours this week','weekly','focus',1200,600,600,'minutes','💪','medium'),
  ('msn_weekly_20tasks', 'weekly_20tasks','Task Titan','Complete 20 tasks this week','weekly','tasks',800,400,20,'tasks','📌','medium'),
  ('msn_weekly_7streak', 'weekly_7streak','Week Streak','Maintain a 7-day streak','weekly','streak',1000,500,7,'days','🗓️','hard'),
  ('msn_weekly_50tasks', 'weekly_50tasks','Productivity God','Complete 50 tasks this week','weekly','tasks',2000,1000,50,'tasks','🌟','hard'),
  ('msn_weekly_15hours', 'weekly_15hours','15 Hour Legend','Focus for 15 hours this week','weekly','focus',2000,1000,900,'minutes','👑','hard'),
  ('msn_weekly_habit7', 'weekly_habit7','Habit Hero','Complete a habit 7 days in a row','weekly','habits',1000,500,7,'days','🌿','hard'),
  ('msn_weekly_social', 'weekly_social','Team Player','Help a study buddy this week','weekly','social',500,250,1,'interactions','🤝','medium')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: 7 DEFAULT QUEST DEFINITIONS
-- ============================================================

INSERT INTO "quest_definitions" ("id","title","description","type","difficulty","target","metric","xp_reward","coin_reward","icon","is_active","rotation_weight")
VALUES
  ('q-focus-sprint','Focus Sprint','Complete a 25-minute focus session','daily','easy',1,'sessions',150,75,'⚡',true,10),
  ('q-deep-work','Deep Work Block','Focus for 90 unbroken minutes','daily','hard',90,'focus_minutes',500,250,'🧠',true,5),
  ('q-task-blitz','Task Blitz','Complete 5 tasks in one day','daily','medium',5,'tasks',200,100,'✅',true,8),
  ('q-streak-fire','Streak Fire','Maintain a 3-day study streak','daily','medium',3,'streak_days',300,150,'🔥',true,8),
  ('q-weekly-grind','Weekly Grinder','Complete 15 focus sessions this week','weekly','medium',15,'sessions',800,400,'💪',true,10),
  ('q-habit-lock','Habit Lock','Complete habits for 5 days straight','weekly','hard',5,'habit_days',600,300,'🌱',true,6),
  ('q-coin-collector','Coin Collector','Earn 500 coins in a week','weekly','easy',500,'coins_earned',400,200,'🪙',true,7)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: CITY BUILDING DEFINITIONS
-- ============================================================

INSERT INTO "city_building_definitions" ("id","slug","name","description","district","category","unlock_level","unlock_sessions","coin_cost","population_bonus","xp_bonus_per_session","coin_bonus_per_session","icon","tier","sort_order")
VALUES
  ('cbd-library','library','Library','A place of knowledge and wisdom. Increases XP per session.','downtown','education',1,0,0,20,5,0,'📚','hamlet',1),
  ('cbd-cafe','study-cafe','Study Cafe','A cozy café for focused work. Boosts coin earnings.','downtown','lifestyle',1,3,200,15,0,2,'☕','hamlet',2),
  ('cbd-park','focus-park','Focus Park','A serene park for mental clarity.','downtown','wellness',2,5,300,30,0,0,'🌳','village',3),
  ('cbd-hall','study-hall','Study Hall','A grand hall for group studying. +10 XP per session.','downtown','education',2,8,500,40,10,0,'🏛️','village',4),
  ('cbd-gym','mind-gym','Mind Gym','Train your mental muscles here.','uptown','wellness',3,12,700,25,8,0,'🏋️','village',5),
  ('cbd-lab','research-lab','Research Lab','Cutting-edge research boosts your productivity.','uptown','science',3,15,1000,50,15,3,'🔬','town',6),
  ('cbd-tower','focus-tower','Focus Tower','The tallest building in your city. Major XP boost.','uptown','education',4,20,1500,80,20,5,'🗼','town',7),
  ('cbd-museum','knowledge-museum','Knowledge Museum','A museum of learning. Permanent XP multiplier.','uptown','culture',4,25,2000,60,12,0,'🏛️','town',8),
  ('cbd-arena','innovation-center','Innovation Center','Where great ideas are born.','tech','science',5,35,3000,100,25,8,'💡','city',9),
  ('cbd-hub','productivity-hub','Productivity Hub','The ultimate productivity engine. Max bonuses.','tech','tech',6,50,5000,150,30,10,'🚀','metropolis',10),
  ('cbd-temple','wisdom-temple','Wisdom Temple','Ancient wisdom meets modern focus.','spiritual','wellness',5,40,4000,120,20,5,'⛩️','city',11),
  ('cbd-observatory','star-observatory','Star Observatory','Gaze at the cosmos and expand your mind.','sci','science',6,60,6000,200,35,12,'🔭','civilization',12)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: 50 LOOT BOX TYPES
-- ============================================================

INSERT INTO "loot_box_types" ("id","name","description","rarity","coin_cost","sessions_required","icon","glow_color","possible_rewards")
VALUES
('lb-common-1','Focus Box','A basic box for focused students','common',100,0,'📦','#6B7280','[{"type":"coins","value":50,"weight":40},{"type":"xp","value":100,"weight":40},{"type":"streak_shield","value":1,"weight":20}]'),
('lb-common-2','Daily Box','Reward for consistent daily study','common',150,0,'🎁','#6B7280','[{"type":"coins","value":75,"weight":35},{"type":"xp","value":150,"weight":35},{"type":"coins","value":25,"weight":30}]'),
('lb-common-3','Study Box','Basic study rewards','common',120,0,'📚','#6B7280','[{"type":"coins","value":60,"weight":40},{"type":"xp","value":120,"weight":40},{"type":"streak_shield","value":1,"weight":20}]'),
('lb-common-4','Beginner Box','Perfect for new students','common',80,0,'🌱','#6B7280','[{"type":"coins","value":40,"weight":45},{"type":"xp","value":80,"weight":45},{"type":"coins","value":20,"weight":10}]'),
('lb-common-5','Starter Pack','Get started with rewards','common',90,0,'⭐','#6B7280','[{"type":"coins","value":45,"weight":40},{"type":"xp","value":90,"weight":40},{"type":"streak_shield","value":1,"weight":20}]'),
('lb-common-6','Session Box','Earned from sessions','common',100,1,'🎯','#6B7280','[{"type":"coins","value":55,"weight":40},{"type":"xp","value":110,"weight":40},{"type":"coins","value":30,"weight":20}]'),
('lb-common-7','Morning Box','Early bird rewards','common',110,0,'🌅','#6B7280','[{"type":"coins","value":65,"weight":40},{"type":"xp","value":130,"weight":40},{"type":"streak_shield","value":1,"weight":20}]'),
('lb-common-8','Task Box','For task completers','common',100,0,'✅','#6B7280','[{"type":"coins","value":50,"weight":40},{"type":"xp","value":100,"weight":40},{"type":"coins","value":25,"weight":20}]'),
('lb-common-9','Habit Box','For habit builders','common',120,0,'🔄','#6B7280','[{"type":"coins","value":70,"weight":40},{"type":"xp","value":140,"weight":40},{"type":"streak_shield","value":1,"weight":20}]'),
('lb-common-10','Bronze Chest','A simple chest of rewards','common',130,0,'📫','#6B7280','[{"type":"coins","value":80,"weight":35},{"type":"xp","value":160,"weight":35},{"type":"coins","value":40,"weight":30}]'),
('lb-rare-1','Scholar Box','Rare rewards for dedicated scholars','rare',300,0,'🎓','#3B82F6','[{"type":"coins","value":200,"weight":30},{"type":"xp","value":400,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"streak_shield","value":2,"weight":15}]'),
('lb-rare-2','Focus Crystal','Crystallized focus energy','rare',350,0,'💎','#3B82F6','[{"type":"coins","value":250,"weight":30},{"type":"xp","value":500,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"coins","value":100,"weight":15}]'),
('lb-rare-3','Night Owl Box','For those who study late','rare',320,0,'🦉','#3B82F6','[{"type":"coins","value":220,"weight":30},{"type":"xp","value":440,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"streak_shield","value":2,"weight":15}]'),
('lb-rare-4','Momentum Box','Keep the momentum going','rare',400,0,'⚡','#3B82F6','[{"type":"coins","value":300,"weight":30},{"type":"xp","value":600,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"coins","value":150,"weight":15}]'),
('lb-rare-5','Blueprint Box','Plan your success','rare',380,0,'📋','#3B82F6','[{"type":"coins","value":280,"weight":30},{"type":"xp","value":560,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"streak_shield","value":2,"weight":15}]'),
('lb-rare-6','Dedication Box','For the truly dedicated','rare',450,0,'🏅','#3B82F6','[{"type":"coins","value":350,"weight":30},{"type":"xp","value":700,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"battle_pass_tiers","value":1,"weight":15}]'),
('lb-rare-7','Silver Chest','A chest of rare valuables','rare',500,0,'🥈','#3B82F6','[{"type":"coins","value":400,"weight":30},{"type":"xp","value":800,"weight":30},{"type":"xp_boost","value":1,"weight":20},{"type":"battle_pass_tiers","value":1,"weight":20}]'),
('lb-rare-8','Discovery Box','Discover new rewards','rare',420,0,'🔍','#3B82F6','[{"type":"coins","value":320,"weight":30},{"type":"xp","value":640,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"streak_shield","value":2,"weight":15}]'),
('lb-rare-9','Focus Flame','Harness the flame of focus','rare',480,0,'🔥','#3B82F6','[{"type":"coins","value":380,"weight":30},{"type":"xp","value":760,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"coins","value":200,"weight":15}]'),
('lb-rare-10','Wisdom Box','Ancient wisdom rewards','rare',550,0,'📖','#3B82F6','[{"type":"coins","value":450,"weight":30},{"type":"xp","value":900,"weight":30},{"type":"xp_boost","value":1,"weight":25},{"type":"battle_pass_tiers","value":1,"weight":15}]'),
('lb-epic-1','Epic Focus Box','Legendary focus rewards','epic',800,0,'🌟','#8B5CF6','[{"type":"coins","value":600,"weight":25},{"type":"xp","value":1200,"weight":25},{"type":"marketplace_item","value":"rare","rarity":"rare","weight":25},{"type":"xp_boost","value":2,"weight":15},{"type":"battle_pass_tiers","value":2,"weight":10}]'),
('lb-epic-2','Phoenix Box','Rise from the ashes','epic',900,0,'🦅','#8B5CF6','[{"type":"coins","value":700,"weight":25},{"type":"xp","value":1400,"weight":25},{"type":"marketplace_item","value":"rare","rarity":"rare","weight":25},{"type":"xp_boost","value":2,"weight":15},{"type":"battle_pass_tiers","value":2,"weight":10}]'),
('lb-epic-3','Storm Box','Harness the power of storms','epic',1000,0,'⛈️','#8B5CF6','[{"type":"coins","value":800,"weight":25},{"type":"xp","value":1600,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":2,"weight":20},{"type":"battle_pass_tiers","value":2,"weight":10}]'),
('lb-epic-4','Dragon Box','Dragon power within','epic',1200,0,'🐲','#8B5CF6','[{"type":"coins","value":1000,"weight":25},{"type":"xp","value":2000,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":3,"weight":20},{"type":"battle_pass_tiers","value":3,"weight":10}]'),
('lb-epic-5','Nebula Box','Cosmic rewards from distant galaxies','epic',1100,0,'🌌','#8B5CF6','[{"type":"coins","value":900,"weight":25},{"type":"xp","value":1800,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":2,"weight":20},{"type":"battle_pass_tiers","value":3,"weight":10}]'),
('lb-epic-6','Infinity Box','Infinite possibilities','epic',1500,0,'♾️','#8B5CF6','[{"type":"coins","value":1200,"weight":25},{"type":"xp","value":2400,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":3,"weight":15},{"type":"battle_pass_tiers","value":3,"weight":15}]'),
('lb-epic-7','Aurora Box','Northern lights of rewards','epic',1300,0,'🌅','#8B5CF6','[{"type":"coins","value":1100,"weight":25},{"type":"xp","value":2200,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":2,"weight":20},{"type":"battle_pass_tiers","value":2,"weight":10}]'),
('lb-epic-8','Thunder Box','Strike with the power of thunder','epic',1400,0,'⚡','#8B5CF6','[{"type":"coins","value":1100,"weight":25},{"type":"xp","value":2200,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":3,"weight":20},{"type":"battle_pass_tiers","value":3,"weight":10}]'),
('lb-epic-9','Galaxy Box','Rewards from across the galaxy','epic',1600,0,'🌠','#8B5CF6','[{"type":"coins","value":1300,"weight":25},{"type":"xp","value":2600,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":3,"weight":15},{"type":"battle_pass_tiers","value":3,"weight":15}]'),
('lb-epic-10','Gold Chest','A chest of pure gold','epic',2000,0,'🥇','#8B5CF6','[{"type":"coins","value":1500,"weight":25},{"type":"xp","value":3000,"weight":25},{"type":"marketplace_item","value":"epic","rarity":"epic","weight":20},{"type":"xp_boost","value":3,"weight":15},{"type":"battle_pass_tiers","value":4,"weight":15}]'),
('lb-legendary-1','Legendary Scholar Box','For the most dedicated scholars','legendary',3000,0,'👑','#F59E0B','[{"type":"coins","value":2500,"weight":20},{"type":"xp","value":5000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":5,"weight":20},{"type":"battle_pass_tiers","value":5,"weight":15}]'),
('lb-legendary-2','Celestial Box','Rewards from the heavens','legendary',3500,0,'✨','#F59E0B','[{"type":"coins","value":3000,"weight":20},{"type":"xp","value":6000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":5,"weight":20},{"type":"battle_pass_tiers","value":5,"weight":15}]'),
('lb-legendary-3','Divine Knowledge Box','The wisdom of the ages','legendary',4000,0,'📜','#F59E0B','[{"type":"coins","value":3500,"weight":20},{"type":"xp","value":7000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":7,"weight":20},{"type":"battle_pass_tiers","value":7,"weight":15}]'),
('lb-legendary-4','Titan Box','Titanic rewards for titans','legendary',5000,0,'⚔️','#F59E0B','[{"type":"coins","value":4000,"weight":20},{"type":"xp","value":8000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":7,"weight":20},{"type":"battle_pass_tiers","value":7,"weight":15}]'),
('lb-legendary-5','Cosmos Box','All the riches of the cosmos','legendary',6000,0,'🌍','#F59E0B','[{"type":"coins","value":5000,"weight":20},{"type":"xp","value":10000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":10,"weight":20},{"type":"battle_pass_tiers","value":10,"weight":15}]'),
('lb-legendary-6','Eternity Box','Rewards that last forever','legendary',7000,0,'🔮','#F59E0B','[{"type":"coins","value":5000,"weight":20},{"type":"xp","value":10000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":10,"weight":15},{"type":"battle_pass_tiers","value":10,"weight":20}]'),
('lb-legendary-7','Solar Box','Powered by the sun itself','legendary',4500,0,'☀️','#F59E0B','[{"type":"coins","value":3800,"weight":20},{"type":"xp","value":7600,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":8,"weight":20},{"type":"battle_pass_tiers","value":8,"weight":15}]'),
('lb-legendary-8','Mythic Grimoire','An ancient book of power','legendary',5500,0,'📕','#F59E0B','[{"type":"coins","value":4500,"weight":20},{"type":"xp","value":9000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":9,"weight":20},{"type":"battle_pass_tiers","value":9,"weight":15}]'),
('lb-legendary-9','Imperial Box','Fit for an emperor of focus','legendary',8000,0,'🏰','#F59E0B','[{"type":"coins","value":6000,"weight":20},{"type":"xp","value":12000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":12,"weight":20},{"type":"battle_pass_tiers","value":10,"weight":15}]'),
('lb-legendary-10','Omega Box','The ultimate reward box','legendary',10000,0,'🌀','#F59E0B','[{"type":"coins","value":8000,"weight":20},{"type":"xp","value":16000,"weight":20},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":25},{"type":"xp_boost","value":15,"weight":20},{"type":"battle_pass_tiers","value":15,"weight":15}]'),
('lb-mythic-1','Mythic Void Box','From beyond reality','mythic',15000,0,'⚫','#EC4899','[{"type":"coins","value":10000,"weight":15},{"type":"xp","value":20000,"weight":15},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":30},{"type":"xp_boost","value":20,"weight":20},{"type":"battle_pass_tiers","value":15,"weight":20}]'),
('lb-mythic-2','Primordial Box','From the beginning of time','mythic',18000,0,'🌑','#EC4899','[{"type":"coins","value":12000,"weight":15},{"type":"xp","value":24000,"weight":15},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":30},{"type":"xp_boost","value":25,"weight":20},{"type":"battle_pass_tiers","value":20,"weight":20}]'),
('lb-mythic-3','Singularity Box','A box of infinite density','mythic',20000,0,'💫','#EC4899','[{"type":"coins","value":15000,"weight":15},{"type":"xp","value":30000,"weight":15},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":30},{"type":"xp_boost","value":30,"weight":20},{"type":"battle_pass_tiers","value":20,"weight":20}]'),
('lb-mythic-4','Transcendence Box','Beyond mortal comprehension','mythic',25000,0,'🔱','#EC4899','[{"type":"coins","value":20000,"weight":15},{"type":"xp","value":40000,"weight":15},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":30},{"type":"xp_boost","value":50,"weight":20},{"type":"battle_pass_tiers","value":25,"weight":20}]'),
('lb-mythic-5','Genesis Box','The box that started it all','mythic',30000,0,'🌌','#EC4899','[{"type":"coins","value":25000,"weight":15},{"type":"xp","value":50000,"weight":15},{"type":"marketplace_item","value":"legendary","rarity":"legendary","weight":30},{"type":"xp_boost","value":100,"weight":20},{"type":"battle_pass_tiers","value":30,"weight":20}]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: DEFAULT MARKETPLACE ITEMS
-- ============================================================

INSERT INTO "marketplace_items" ("id", "name","description","type","cost_coins","rarity","emoji","is_active")
VALUES
  ('mkt_golden_scholar', 'Golden Scholar','Radiant gold profile frame for top achievers','frame',500,'rare','🏆',true),
  ('mkt_nebula_frame', 'Nebula Frame','Cosmic purple nebula profile frame','frame',750,'epic','🌌',true),
  ('mkt_fire_ring', 'Fire Ring','Burning fire profile frame','frame',300,'uncommon','🔥',true),
  ('mkt_diamond_edge', 'Diamond Edge','Shimmering diamond profile frame','frame',1000,'legendary','💎',true),
  ('mkt_study_ninja', 'Study Ninja','Stealth mode: activated','avatar',400,'rare','🥷',true),
  ('mkt_knowledge_wizard', 'Knowledge Wizard','Ancient wisdom in your avatar','avatar',350,'uncommon','🧙',true),
  ('mkt_ai_scholar', 'AI Scholar','Future of learning','avatar',600,'epic','🤖',true),
  ('mkt_space_explorer', 'Space Explorer','Reach for the stars','avatar',800,'legendary','👨‍🚀',true),
  ('mkt_sparkle_aura', 'Sparkle Aura','Sparkling effects on your sessions','effect',200,'common','✨',true),
  ('mkt_lightning_focus', 'Lightning Focus','Electric aura during focus','effect',450,'rare','⚡',true),
  ('mkt_aurora_effect', 'Aurora Effect','Northern lights follow your studies','effect',900,'legendary','🌅',true),
  ('mkt_royal_crown', 'Royal Crown','A crown fit for a scholar king','accessory',300,'rare','👑',true),
  ('mkt_study_glasses', 'Study Glasses','Bookworm glasses for your pet','accessory',150,'common','🤓',true),
  ('mkt_hero_cape', 'Hero Cape','Your pet, the hero','accessory',250,'uncommon','🦸',true),
  ('mkt_zen_garden', 'Zen Garden','A peaceful garden for your Focus City','decoration',200,'common','🌸',true),
  ('mkt_crystal_fountain', 'Crystal Fountain','A shimmering fountain in your city','decoration',400,'rare','⛲',true),
  ('mkt_knowledge_tower', 'Knowledge Tower','Tallest building in your city','decoration',800,'epic','🗼',true),
  ('mkt_xp_booster_24h', 'XP Booster 24h','2× XP for the next 24 hours','booster',500,'rare','⬆️',true),
  ('mkt_coin_doubler_48h', 'Coin Doubler 48h','2× coins for the next 48 hours','booster',600,'epic','🪙',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICATION (optional): run after applying
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_schema='public';   -- expect 82
-- ============================================================
