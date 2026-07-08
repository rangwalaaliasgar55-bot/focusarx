-- ============================================================
-- FOCUSARX — Complete Neon DB Schema
-- Run this against your Neon PostgreSQL database.
-- Requires pgcrypto extension for gen_random_uuid().
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE USER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "hashed_password" text,
  "guest_key" text UNIQUE,
  "is_guest" boolean NOT NULL DEFAULT false,
  "role" text NOT NULL DEFAULT 'user',
  "onboarding_completed" boolean NOT NULL DEFAULT false,
  "onboarding_data" jsonb,
  "bio" text,
  "timezone" text DEFAULT 'UTC',
  "productivity_score" real DEFAULT 0,
  "total_focus_minutes" integer DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "focus_sessions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'focus',
  "duration_sec" integer NOT NULL DEFAULT 0,
  "planned_duration_sec" integer,
  "completed_early" boolean DEFAULT false,
  "completion_percentage" real,
  "session_status" text DEFAULT 'completed',
  "completed_at" timestamp,
  "focus_score" real,
  "focus_quality" text,
  "stability_rating" text,
  "focus_timeline" text,
  "session_insights" text,
  "category" text DEFAULT 'General',
  "productivity_score" real,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "focus_sessions_user_id_idx" ON "focus_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "focus_sessions_completed_at_idx" ON "focus_sessions"("completed_at");

CREATE TABLE IF NOT EXISTS "active_sessions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'focus',
  "seconds_left" integer NOT NULL DEFAULT 1500,
  "timer_status" text NOT NULL DEFAULT 'paused',
  "active_seconds" integer NOT NULL DEFAULT 0,
  "focus_score" real,
  "focus_quality" text,
  "focus_state" text,
  "distraction_count" integer DEFAULT 0,
  "last_seen_face_at" text,
  "focus_timeline" text DEFAULT '[]',
  "monitor_enabled" boolean DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_streaks" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "last_study_date" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "completed" boolean NOT NULL DEFAULT false,
  "order" integer DEFAULT 0,
  "estimated_minutes" integer,
  "category" text DEFAULT 'General',
  "priority" text DEFAULT 'medium',
  "tags" jsonb DEFAULT '[]'::jsonb,
  "due_date" text,
  "recurring" text,
  "completed_at" timestamp,
  "status" text DEFAULT 'active',
  "missed_at" timestamp,
  "miss_count" integer DEFAULT 0,
  "archived_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks"("user_id");

CREATE TABLE IF NOT EXISTS "goals" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "completed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_wallets" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "coins" integer NOT NULL DEFAULT 0,
  "total_xp" integer NOT NULL DEFAULT 0,
  "weekly_xp" integer NOT NULL DEFAULT 0,
  "weekly_xp_reset_at" timestamp DEFAULT now(),
  "level" integer NOT NULL DEFAULT 1,
  "prestige" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "badge_id" text NOT NULL,
  "unlocked_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- MISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "missions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "mission_key" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL DEFAULT 'daily',
  "category" text NOT NULL DEFAULT 'focus',
  "xp_reward" integer NOT NULL DEFAULT 100,
  "coin_reward" integer NOT NULL DEFAULT 50,
  "target_value" integer NOT NULL DEFAULT 1,
  "unit" text NOT NULL DEFAULT 'sessions',
  "icon" text NOT NULL DEFAULT '🎯',
  "difficulty" text NOT NULL DEFAULT 'easy',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_mission_progress" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mission_key" text NOT NULL,
  "period_start" text NOT NULL,
  "current_value" integer NOT NULL DEFAULT 0,
  "completed" boolean NOT NULL DEFAULT false,
  "completed_at" timestamp,
  "reward_claimed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mission_progress_user_period_idx" ON "user_mission_progress"("user_id", "period_start");

-- ============================================================
-- SOCIAL
-- ============================================================

CREATE TABLE IF NOT EXISTS "friendships" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "requester_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "addressee_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "friendships_requester_idx" ON "friendships"("requester_id");
CREATE INDEX IF NOT EXISTS "friendships_addressee_idx" ON "friendships"("addressee_id");

-- ============================================================
-- PRODUCTIVITY LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS "productivity_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "focus_minutes" integer NOT NULL DEFAULT 0,
  "sessions_completed" integer NOT NULL DEFAULT 0,
  "tasks_completed" integer NOT NULL DEFAULT 0,
  "avg_focus_score" real,
  "productivity_score" real,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "productivity_logs_user_date_idx" ON "productivity_logs"("user_id", "date");

-- ============================================================
-- READINESS & DISTRACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "readiness_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "sleep" integer NOT NULL,
  "stress" integer NOT NULL,
  "energy" integer NOT NULL,
  "score" integer NOT NULL,
  "session_length_rec" integer NOT NULL,
  "hrv" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "distraction_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_id" text,
  "reason" text NOT NULL,
  "worth_it" boolean NOT NULL DEFAULT false,
  "hour" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- FOCUS PROFILES, DNA, GHOSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "focus_profiles" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "ssid" text,
  "blocked_domains" jsonb DEFAULT '[]'::jsonb,
  "whitelist" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "focus_dna" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "archetype" text NOT NULL,
  "description" text NOT NULL,
  "color_primary" text NOT NULL,
  "color_secondary" text NOT NULL,
  "icon" text NOT NULL,
  "top_focus_hour" integer,
  "avg_session_min" integer,
  "strongest_day" text,
  "biggest_weakness" text,
  "session_count_at_generation" integer NOT NULL DEFAULT 0,
  "generated_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session_ghosts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_category" text NOT NULL DEFAULT 'General',
  "best_duration_sec" integer NOT NULL DEFAULT 0,
  "best_unbroken_sec" integer NOT NULL DEFAULT 0,
  "session_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- CONSEQUENCE CONTRACTS & FREEZE TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS "consequence_contracts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start" text NOT NULL,
  "contract_type" text NOT NULL,
  "target_minutes" integer NOT NULL DEFAULT 0,
  "charity_name" text,
  "charity_amount" integer,
  "achieved" boolean NOT NULL DEFAULT false,
  "consequence_triggered" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "freeze_tokens" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "tokens_available" integer NOT NULL DEFAULT 0,
  "tokens_used" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTH TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- ROADMAPS, BREAK FREE, NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "roadmaps" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subject" text NOT NULL,
  "data" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "break_free_streaks" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "start_date" text NOT NULL,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "relapse_count" integer NOT NULL DEFAULT 0,
  "last_relapse_date" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "break_free_moods" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mood" integer NOT NULL,
  "date" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "break_free_pledges" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "message" text NOT NULL,
  "posted_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "data" jsonb,
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");

CREATE TABLE IF NOT EXISTS "login_rewards" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "last_claimed_date" text,
  "claim_streak" integer NOT NULL DEFAULT 0,
  "total_claimed" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- STUDY GROUPS & MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS "study_groups" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL,
  "description" text,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_xp" integer NOT NULL DEFAULT 0,
  "group_level" integer NOT NULL DEFAULT 1,
  "is_public" boolean NOT NULL DEFAULT true,
  "invite_code" text NOT NULL UNIQUE,
  "max_members" integer NOT NULL DEFAULT 20,
  "avatar_emoji" text NOT NULL DEFAULT '🎯',
  "tags" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "group_members" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "group_id" text NOT NULL REFERENCES "study_groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "xp_contribution" integer NOT NULL DEFAULT 0,
  "joined_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_members_group_idx" ON "group_members"("group_id");
CREATE INDEX IF NOT EXISTS "group_members_user_idx" ON "group_members"("user_id");

-- ============================================================
-- BATTLE PASS PROGRESS (legacy)
-- ============================================================

CREATE TABLE IF NOT EXISTS "battle_pass_progress" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "season" integer NOT NULL DEFAULT 1,
  "tier" integer NOT NULL DEFAULT 0,
  "season_xp" integer NOT NULL DEFAULT 0,
  "premium_unlocked" boolean NOT NULL DEFAULT false,
  "claimed_tiers" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "details" jsonb,
  "ip" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs"("user_id");

-- ============================================================
-- DREAMS & PETS
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_dreams" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "dream_type" text NOT NULL DEFAULT 'custom',
  "custom_goal" text,
  "target_date" text,
  "daily_target_minutes" integer DEFAULT 120,
  "total_minutes_logged" integer DEFAULT 0,
  "start_date" text,
  "emoji" text DEFAULT '🎯',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_pets" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "pet_type" text NOT NULL DEFAULT 'owl',
  "pet_name" text,
  "pet_level" integer NOT NULL DEFAULT 1,
  "pet_xp" integer NOT NULL DEFAULT 0,
  "evolution_stage" integer NOT NULL DEFAULT 1,
  "mood" text DEFAULT 'happy',
  "accessories" jsonb DEFAULT '[]'::jsonb,
  "last_fed_at" timestamp,
  "happiness" integer DEFAULT 100,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- MARKETPLACE & INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS "marketplace_items" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL,
  "description" text,
  "type" text NOT NULL DEFAULT 'avatar',
  "cost_coins" integer NOT NULL DEFAULT 100,
  "rarity" text DEFAULT 'common',
  "emoji" text DEFAULT '🎁',
  "data" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_inventory" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL REFERENCES "marketplace_items"("id") ON DELETE CASCADE,
  "acquired_at" timestamp NOT NULL DEFAULT now(),
  "equipped" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "user_inventory_user_idx" ON "user_inventory"("user_id");

-- ============================================================
-- WRAPPED SNAPSHOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "wrapped_snapshots" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "period" text NOT NULL,
  "period_type" text NOT NULL DEFAULT 'monthly',
  "data" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wrapped_user_period_idx" ON "wrapped_snapshots"("user_id", "period");

-- ============================================================
-- FOLLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS "follows" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "follower_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "following_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows"("follower_id");
CREATE INDEX IF NOT EXISTS "follows_following_idx" ON "follows"("following_id");

-- ============================================================
-- HABITS
-- ============================================================

CREATE TABLE IF NOT EXISTS "habits" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "icon" text NOT NULL DEFAULT '⭐',
  "color" text NOT NULL DEFAULT '#7C3AED',
  "frequency" text NOT NULL DEFAULT 'daily',
  "target_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "total_completions" integer NOT NULL DEFAULT 0,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "habits_user_idx" ON "habits"("user_id");

CREATE TABLE IF NOT EXISTS "habit_completions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "habit_id" text NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "note" text,
  "completed_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "habit_completions_habit_idx" ON "habit_completions"("habit_id");
CREATE INDEX IF NOT EXISTS "habit_completions_user_date_idx" ON "habit_completions"("user_id", "date");

-- ============================================================
-- STUDY ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS "study_rooms" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL,
  "group_id" text REFERENCES "study_groups"("id") ON DELETE CASCADE,
  "host_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'silent',
  "status" text NOT NULL DEFAULT 'active',
  "max_participants" integer NOT NULL DEFAULT 50,
  "timer_duration" integer NOT NULL DEFAULT 1500,
  "ambiance" text NOT NULL DEFAULT 'silence',
  "is_public" boolean DEFAULT true,
  "invite_code" text NOT NULL,
  "scheduled_for" timestamp,
  "ended_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "study_rooms_host_idx" ON "study_rooms"("host_id");
CREATE INDEX IF NOT EXISTS "study_rooms_status_idx" ON "study_rooms"("status");

CREATE TABLE IF NOT EXISTS "study_room_members" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "room_id" text NOT NULL REFERENCES "study_rooms"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  "left_at" timestamp,
  "focus_minutes" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS "study_room_members_room_idx" ON "study_room_members"("room_id");

-- ============================================================
-- SOCIAL POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "type" text NOT NULL DEFAULT 'general',
  "image_urls" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb,
  "group_id" text REFERENCES "study_groups"("id") ON DELETE SET NULL,
  "is_public" boolean DEFAULT true,
  "view_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_posts_user_idx" ON "social_posts"("user_id");
CREATE INDEX IF NOT EXISTS "social_posts_created_at_idx" ON "social_posts"("created_at");

CREATE TABLE IF NOT EXISTS "post_reactions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "post_id" text NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reaction" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "post_reactions_post_idx" ON "post_reactions"("post_id");

CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "post_id" text NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "parent_id" text,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "post_comments_post_idx" ON "post_comments"("post_id");

CREATE TABLE IF NOT EXISTS "post_saves" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "post_id" text NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "post_saves_post_user_idx" ON "post_saves"("post_id", "user_id");

-- ============================================================
-- BUDDY REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "buddy_requests" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "receiver_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "buddy_requests_receiver_idx" ON "buddy_requests"("receiver_id");

-- ============================================================
-- COIN TRANSACTIONS (WALLET AUDIT TRAIL)
-- ============================================================

CREATE TABLE IF NOT EXISTS "coin_transactions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "reason" text NOT NULL,
  "description" text NOT NULL,
  "balance_after" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "coin_tx_user_idx" ON "coin_transactions"("user_id");

-- ============================================================
-- USER PROFILE EXTRAS
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_profile_extras" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "banner_url" text,
  "banner_gradient" text,
  "social_links" jsonb DEFAULT '{}'::jsonb,
  "featured_post_ids" jsonb DEFAULT '[]'::jsonb,
  "pinned_badge_ids" jsonb DEFAULT '[]'::jsonb,
  "is_private" boolean NOT NULL DEFAULT false,
  "custom_status" text,
  "status_emoji" text,
  "creator_tier" text NOT NULL DEFAULT 'learner',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "push_sub_user_idx" ON "push_subscriptions"("user_id");

-- ============================================================
-- APP FEEDBACK
-- ============================================================

CREATE TABLE IF NOT EXISTS "app_feedback" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "rating" integer NOT NULL,
  "message" text,
  "category" text DEFAULT 'general',
  "session_count" integer DEFAULT 0,
  "user_level" integer DEFAULT 1,
  "device" text,
  "app_version" text DEFAULT '1.0',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "app_feedback_user_idx" ON "app_feedback"("user_id");

-- ============================================================
-- ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS "visitors" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "visitor_id" text NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "first_seen" timestamp NOT NULL DEFAULT now(),
  "last_seen" timestamp NOT NULL DEFAULT now(),
  "visit_count" integer NOT NULL DEFAULT 0,
  "device_type" text,
  "browser" text,
  "os" text,
  "country" text,
  "city" text,
  "is_bot" boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_visitor_id_idx" ON "visitors"("visitor_id");
CREATE INDEX IF NOT EXISTS "visitors_last_seen_idx" ON "visitors"("last_seen");
CREATE INDEX IF NOT EXISTS "visitors_user_id_idx" ON "visitors"("user_id");

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "visitor_id" text NOT NULL,
  "session_start" timestamp NOT NULL DEFAULT now(),
  "session_end" timestamp,
  "duration_sec" integer NOT NULL DEFAULT 0,
  "page_views" integer NOT NULL DEFAULT 0,
  "focus_sessions_started" integer NOT NULL DEFAULT 0,
  "tasks_created" integer NOT NULL DEFAULT 0,
  "roadmaps_generated" integer NOT NULL DEFAULT 0,
  "ai_features_used" integer NOT NULL DEFAULT 0,
  "last_activity_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_id_idx" ON "analytics_sessions"("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_last_activity_idx" ON "analytics_sessions"("last_activity_at");

CREATE TABLE IF NOT EXISTS "page_views" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "visitor_id" text NOT NULL,
  "session_id" text NOT NULL,
  "page" text NOT NULL,
  "viewed_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "page_views_visitor_id_idx" ON "page_views"("visitor_id");
CREATE INDEX IF NOT EXISTS "page_views_session_id_idx" ON "page_views"("session_id");
CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views"("viewed_at");

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "event_id" text NOT NULL,
  "visitor_id" text NOT NULL,
  "session_id" text,
  "event_type" text NOT NULL,
  "event_data" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_event_id_idx" ON "analytics_events"("event_id");
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events"("created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_visitor_id_idx" ON "analytics_events"("visitor_id");

-- ============================================================
-- GAMIFICATION — BATTLE PASSES (rebuilt)
-- ============================================================

CREATE TABLE IF NOT EXISTS "battle_passes" (
  "id" text PRIMARY KEY,
  "season" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "battle_pass_rewards" (
  "id" text PRIMARY KEY,
  "battle_pass_id" text NOT NULL REFERENCES "battle_passes"("id") ON DELETE CASCADE,
  "tier" integer NOT NULL,
  "type" text NOT NULL,
  "value" jsonb,
  "required_xp" integer NOT NULL,
  "is_premium" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "user_battle_pass_progress" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "battle_pass_id" text NOT NULL REFERENCES "battle_passes"("id") ON DELETE CASCADE,
  "current_xp" integer NOT NULL DEFAULT 0,
  "current_tier" integer NOT NULL DEFAULT 0,
  "claimed_rewards" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_battle_pass_user_pass_idx" ON "user_battle_pass_progress"("user_id", "battle_pass_id");

-- ============================================================
-- GAMIFICATION — STUDY BUDDIES, SHARED GOALS, LEADERBOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS "study_buddies" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "buddy_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "study_buddies_user_buddy_idx" ON "study_buddies"("user_id", "buddy_id");

CREATE TABLE IF NOT EXISTS "shared_goals" (
  "id" text PRIMARY KEY,
  "group_id" text,
  "creator_id" text NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "description" text,
  "target_value" integer NOT NULL,
  "current_value" integer NOT NULL DEFAULT 0,
  "deadline" timestamp,
  "status" text DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "shared_goals_group_idx" ON "shared_goals"("group_id");

CREATE TABLE IF NOT EXISTS "leaderboard_snapshots" (
  "id" text PRIMARY KEY,
  "period" text NOT NULL,
  "category" text NOT NULL,
  "scope" text DEFAULT 'global',
  "group_id" text,
  "data" jsonb NOT NULL,
  "generated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "leaderboard_snapshots_period_category_idx" ON "leaderboard_snapshots"("period", "category");

-- ============================================================
-- FOCUS CITY
-- ============================================================

CREATE TABLE IF NOT EXISTS "focus_cities" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "tier" text NOT NULL DEFAULT 'hamlet',
  "tier_name" text NOT NULL DEFAULT 'Study Hamlet',
  "population" integer NOT NULL DEFAULT 5,
  "total_buildings" integer NOT NULL DEFAULT 0,
  "total_sessions" integer NOT NULL DEFAULT 0,
  "unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb,
  "buildings" jsonb DEFAULT '{}'::jsonb,
  "atmosphere" text NOT NULL DEFAULT 'day',
  "weather" text NOT NULL DEFAULT 'clear',
  "weather_updated_at" timestamp DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "focus_cities_user_idx" ON "focus_cities"("user_id");

CREATE TABLE IF NOT EXISTS "city_building_definitions" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "district" text NOT NULL,
  "category" text NOT NULL,
  "unlock_level" integer NOT NULL DEFAULT 1,
  "unlock_sessions" integer NOT NULL DEFAULT 0,
  "coin_cost" integer NOT NULL DEFAULT 0,
  "population_bonus" integer NOT NULL DEFAULT 10,
  "xp_bonus_per_session" integer NOT NULL DEFAULT 0,
  "coin_bonus_per_session" integer NOT NULL DEFAULT 0,
  "icon" text NOT NULL,
  "tier" text NOT NULL DEFAULT 'hamlet',
  "sort_order" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "city_building_slug_idx" ON "city_building_definitions"("slug");

-- ============================================================
-- LOOT BOXES
-- ============================================================

CREATE TABLE IF NOT EXISTS "loot_box_types" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "rarity" text NOT NULL,
  "coin_cost" integer NOT NULL DEFAULT 0,
  "sessions_required" integer NOT NULL DEFAULT 0,
  "icon" text NOT NULL,
  "glow_color" text NOT NULL DEFAULT '#7C3AED',
  "possible_rewards" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_loot_boxes" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "box_type_id" text NOT NULL REFERENCES "loot_box_types"("id"),
  "status" text NOT NULL DEFAULT 'unopened',
  "reward_type" text,
  "reward_value" jsonb,
  "earned_reason" text,
  "opened_at" timestamp,
  "earned_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_loot_boxes_user_idx" ON "user_loot_boxes"("user_id");

-- ============================================================
-- QUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "quest_definitions" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "difficulty" text NOT NULL DEFAULT 'easy',
  "target" integer NOT NULL,
  "metric" text NOT NULL,
  "xp_reward" integer NOT NULL DEFAULT 0,
  "coin_reward" integer NOT NULL DEFAULT 0,
  "icon" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "rotation_weight" integer NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS "user_quest_progress" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quest_id" text NOT NULL REFERENCES "quest_definitions"("id"),
  "period" text NOT NULL,
  "current" integer NOT NULL DEFAULT 0,
  "completed" boolean NOT NULL DEFAULT false,
  "claimed_at" timestamp,
  "assigned_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("user_id", "quest_id", "period")
);
CREATE INDEX IF NOT EXISTS "user_quest_progress_user_idx" ON "user_quest_progress"("user_id");

-- ============================================================
-- SEASONAL EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "seasonal_events" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text NOT NULL,
  "theme" text NOT NULL,
  "banner_color" text NOT NULL DEFAULT '#7C3AED',
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "xp_multiplier" real NOT NULL DEFAULT 1.0,
  "coin_multiplier" real NOT NULL DEFAULT 1.0,
  "special_missions" jsonb DEFAULT '[]'::jsonb,
  "exclusive_rewards" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "seasonal_events_slug_idx" ON "seasonal_events"("slug");

CREATE TABLE IF NOT EXISTS "user_seasonal_progress" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_id" text NOT NULL REFERENCES "seasonal_events"("id"),
  "points" integer NOT NULL DEFAULT 0,
  "completed_missions" jsonb DEFAULT '[]'::jsonb,
  "rewards_claimed" jsonb DEFAULT '[]'::jsonb,
  "rank" integer,
  UNIQUE("user_id", "event_id")
);
CREATE INDEX IF NOT EXISTS "user_seasonal_progress_user_idx" ON "user_seasonal_progress"("user_id");

-- ============================================================
-- SOCIAL (legacy posts table — backward compat)
-- ============================================================

CREATE TABLE IF NOT EXISTS "posts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "type" text NOT NULL DEFAULT 'general',
  "image_urls" jsonb DEFAULT '[]'::jsonb,
  "achievement_data" jsonb,
  "study_log_data" jsonb,
  "is_public" boolean DEFAULT true,
  "group_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "posts_user_idx" ON "posts"("user_id");
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts"("created_at");

CREATE TABLE IF NOT EXISTS "post_likes" (
  "id" text PRIMARY KEY,
  "post_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "post_likes_post_user_idx" ON "post_likes"("post_id", "user_id");

-- ============================================================
-- GROUPS EXTENSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "group_invitations" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invitee_email" text,
  "invitee_id" text REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_invitations_group_idx" ON "group_invitations"("group_id");

CREATE TABLE IF NOT EXISTS "group_audit_logs" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "actor_id" text NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "target_id" text,
  "details" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_audit_logs_group_idx" ON "group_audit_logs"("group_id");

CREATE TABLE IF NOT EXISTS "group_challenges" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "creator_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "target_value" integer NOT NULL DEFAULT 1,
  "unit" text NOT NULL DEFAULT 'sessions',
  "xp_reward" integer NOT NULL DEFAULT 500,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_challenges_group_idx" ON "group_challenges"("group_id");

CREATE TABLE IF NOT EXISTS "group_challenge_progress" (
  "id" text PRIMARY KEY,
  "challenge_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "progress" integer NOT NULL DEFAULT 0,
  "completed_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_challenge_progress_chal_user_idx" ON "group_challenge_progress"("challenge_id", "user_id");

-- ============================================================
-- CHAT
-- ============================================================

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL DEFAULT 'direct',
  "name" text,
  "group_id" text,
  "last_message_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversations_group_idx" ON "conversations"("group_id");

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "last_read_at" timestamp,
  "is_admin" boolean NOT NULL DEFAULT false,
  "joined_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conv_participants_conv_user_idx" ON "conversation_participants"("conversation_id", "user_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL,
  "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "type" text DEFAULT 'text',
  "reply_to_id" text,
  "is_edited" boolean NOT NULL DEFAULT false,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "messages_conv_idx" ON "messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");

CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id" text PRIMARY KEY,
  "message_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "message_reactions_msg_user_idx" ON "message_reactions"("message_id", "user_id");

-- ============================================================
-- PREMIUM SUBSCRIPTIONS (Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS "premium_subscriptions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "activated_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp,
  "coins_cost" integer DEFAULT 9000,
  "benefits" jsonb DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "granted_by_admin" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "premium_subscriptions_user_idx" ON "premium_subscriptions"("user_id");

-- ============================================================
-- EMAIL LOGS (Phase 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipient_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_email" text NOT NULL,
  "template" text NOT NULL,
  "subject" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "provider_id" text,
  "sent_at" timestamp,
  "opened_at" timestamp,
  "clicked_at" timestamp,
  "bounced" boolean DEFAULT false,
  "error" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_logs_recipient_idx" ON "email_logs"("recipient_id");
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs"("created_at");

-- ============================================================
-- SEED: 22 DEFAULT MISSIONS
-- ============================================================

INSERT INTO "missions" ("mission_key","title","description","type","category","xp_reward","coin_reward","target_value","unit","icon","difficulty")
VALUES
  ('daily_1session','First Session','Complete 1 focus session today','daily','focus',100,50,1,'sessions','🎯','easy'),
  ('daily_3sessions','Triple Focus','Complete 3 focus sessions today','daily','focus',250,100,3,'sessions','🔥','medium'),
  ('daily_30min','30 Min Focus','Focus for at least 30 minutes today','daily','focus',150,75,30,'minutes','⏱️','easy'),
  ('daily_60min','Hour of Power','Focus for 60 minutes today','daily','focus',300,150,60,'minutes','⚡','medium'),
  ('daily_task','Task Crusher','Complete at least 1 task today','daily','tasks',100,50,1,'tasks','✅','easy'),
  ('daily_3tasks','Productive Day','Complete 3 tasks today','daily','tasks',200,100,3,'tasks','📋','medium'),
  ('daily_nolate','Early Bird','Complete a session before 9 AM','daily','streak',200,100,1,'sessions','🌅','hard'),
  ('daily_5sessions','Focus Marathon','Complete 5 sessions in one day','daily','focus',400,200,5,'sessions','🏆','hard'),
  ('daily_habit','Habit Keeper','Complete a habit today','daily','habits',100,50,1,'habits','🌱','easy'),
  ('daily_streak','Keep it Going','Maintain your streak today','daily','streak',150,75,1,'days','🔥','easy'),
  ('daily_1hour','60 Focused Minutes','Accumulate 60 minutes of focus today','daily','focus',200,100,60,'minutes','🕐','medium'),
  ('daily_quality','High Focus','Get a focus score above 80','daily','focus',300,150,80,'score','🧠','hard'),
  ('weekly_10sessions','Session Warrior','Complete 10 sessions this week','weekly','focus',500,250,10,'sessions','⚔️','easy'),
  ('weekly_20sessions','Focus Master','Complete 20 sessions this week','weekly','focus',1000,500,20,'sessions','🏅','medium'),
  ('weekly_5hours','5 Hour Focus Week','Focus for 5 hours this week','weekly','focus',600,300,300,'minutes','⏰','easy'),
  ('weekly_10hours','10 Hour Focus Week','Focus for 10 hours this week','weekly','focus',1200,600,600,'minutes','💪','medium'),
  ('weekly_20tasks','Task Titan','Complete 20 tasks this week','weekly','tasks',800,400,20,'tasks','📌','medium'),
  ('weekly_7streak','Week Streak','Maintain a 7-day streak','weekly','streak',1000,500,7,'days','🗓️','hard'),
  ('weekly_50tasks','Productivity God','Complete 50 tasks this week','weekly','tasks',2000,1000,50,'tasks','🌟','hard'),
  ('weekly_15hours','15 Hour Legend','Focus for 15 hours this week','weekly','focus',2000,1000,900,'minutes','👑','hard'),
  ('weekly_habit7','Habit Hero','Complete a habit 7 days in a row','weekly','habits',1000,500,7,'days','🌿','hard'),
  ('weekly_social','Team Player','Help a study buddy this week','weekly','social',500,250,1,'interactions','🤝','medium')
ON CONFLICT (mission_key) DO NOTHING;

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

INSERT INTO "marketplace_items" ("name","description","type","cost_coins","rarity","emoji","is_active")
VALUES
  ('Golden Scholar','Radiant gold profile frame for top achievers','frame',500,'rare','🏆',true),
  ('Nebula Frame','Cosmic purple nebula profile frame','frame',750,'epic','🌌',true),
  ('Fire Ring','Burning fire profile frame','frame',300,'uncommon','🔥',true),
  ('Diamond Edge','Shimmering diamond profile frame','frame',1000,'legendary','💎',true),
  ('Study Ninja','Stealth mode: activated','avatar',400,'rare','🥷',true),
  ('Knowledge Wizard','Ancient wisdom in your avatar','avatar',350,'uncommon','🧙',true),
  ('AI Scholar','Future of learning','avatar',600,'epic','🤖',true),
  ('Space Explorer','Reach for the stars','avatar',800,'legendary','👨‍🚀',true),
  ('Sparkle Aura','Sparkling effects on your sessions','effect',200,'common','✨',true),
  ('Lightning Focus','Electric aura during focus','effect',450,'rare','⚡',true),
  ('Aurora Effect','Northern lights follow your studies','effect',900,'legendary','🌅',true),
  ('Royal Crown','A crown fit for a scholar king','accessory',300,'rare','👑',true),
  ('Study Glasses','Bookworm glasses for your pet','accessory',150,'common','🤓',true),
  ('Hero Cape','Your pet, the hero','accessory',250,'uncommon','🦸',true),
  ('Zen Garden','A peaceful garden for your Focus City','decoration',200,'common','🌸',true),
  ('Crystal Fountain','A shimmering fountain in your city','decoration',400,'rare','⛲',true),
  ('Knowledge Tower','Tallest building in your city','decoration',800,'epic','🗼',true),
  ('XP Booster 24h','2× XP for the next 24 hours','booster',500,'rare','⬆️',true),
  ('Coin Doubler 48h','2× coins for the next 48 hours','booster',600,'epic','🪙',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
