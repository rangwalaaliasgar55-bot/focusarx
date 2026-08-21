-- FocusArx Production DB Migration
-- Run this entire script in your Neon SQL Editor.
-- All statements are idempotent — safe to run even if tables already exist.

CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
	"id" text PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS "page_views" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"page" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "visitors" (
	"id" text PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS "conversation_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp,
	"is_admin" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'direct' NOT NULL,
	"name" text,
	"group_id" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text',
	"reply_to_id" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "active_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'focus' NOT NULL,
	"seconds_left" integer DEFAULT 1500 NOT NULL,
	"timer_status" text DEFAULT 'paused' NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"focus_score" real,
	"focus_quality" text,
	"focus_state" text,
	"distraction_count" integer DEFAULT 0,
	"last_seen_face_at" text,
	"focus_timeline" text DEFAULT '[]',
	"monitor_enabled" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "battle_pass_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"season_xp" integer DEFAULT 0 NOT NULL,
	"premium_unlocked" boolean DEFAULT false NOT NULL,
	"claimed_tiers" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "battle_pass_progress_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "break_free_moods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mood" integer NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "break_free_pledges" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"posted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "break_free_streaks" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coin_transactions" (
	"id" text PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS "distraction_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"reason" text NOT NULL,
	"worth_it" boolean DEFAULT false NOT NULL,
	"hour" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_dna" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"ssid" text,
	"blocked_domains" jsonb DEFAULT '[]'::jsonb,
	"whitelist" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'focus' NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "follows" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "freeze_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tokens_available" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "freeze_tokens_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"xp_contribution" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habit_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"habit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '⭐' NOT NULL,
	"color" text DEFAULT '#7C3AED' NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"target_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_completions" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "login_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_claimed_date" text,
	"claim_streak" integer DEFAULT 0 NOT NULL,
	"total_claimed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_rewards_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text DEFAULT 'daily' NOT NULL,
	"category" text DEFAULT 'focus' NOT NULL,
	"xp_reward" integer DEFAULT 100 NOT NULL,
	"coin_reward" integer DEFAULT 50 NOT NULL,
	"target_value" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sessions' NOT NULL,
	"icon" text DEFAULT '🎯' NOT NULL,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "missions_mission_key_unique" UNIQUE("mission_key")
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "post_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_saves" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "productivity_logs" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "readiness_logs" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session_ghosts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_category" text DEFAULT 'General' NOT NULL,
	"best_duration_sec" integer DEFAULT 0 NOT NULL,
	"best_unbroken_sec" integer DEFAULT 0 NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"group_id" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"moderation_status" text DEFAULT 'approved' NOT NULL,
	"moderation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Moderation columns (idempotent ALTERs for existing databases)
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "moderation_reason" text;
CREATE INDEX IF NOT EXISTS "social_posts_moderation_idx" ON "social_posts" USING btree ("moderation_status");

CREATE TABLE IF NOT EXISTS "study_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"group_xp" integer DEFAULT 0 NOT NULL,
	"group_level" integer DEFAULT 1 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"invite_code" text NOT NULL,
	"max_members" integer DEFAULT 20 NOT NULL,
	"avatar_emoji" text DEFAULT '🎯' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_groups_invite_code_unique" UNIQUE("invite_code")
);

CREATE TABLE IF NOT EXISTS "study_room_members" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"focus_minutes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_id" text,
	"host_id" text NOT NULL,
	"mode" text DEFAULT 'silent' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"max_participants" integer DEFAULT 50 NOT NULL,
	"timer_duration" integer DEFAULT 1500 NOT NULL,
	"ambiance" text DEFAULT 'silence' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"invite_code" text NOT NULL,
	"scheduled_for" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_streaks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_study_date" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_streaks_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_badges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_mission_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_key" text NOT NULL,
	"period_start" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"reward_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_profile_extras" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"banner_url" text,
	"banner_gradient" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"featured_post_ids" jsonb DEFAULT '[]'::jsonb,
	"pinned_badge_ids" jsonb DEFAULT '[]'::jsonb,
	"is_private" boolean DEFAULT false NOT NULL,
	"custom_status" text,
	"status_emoji" text,
	"creator_tier" text DEFAULT 'learner' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_extras_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_wallets" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"hashed_password" text,
	"guest_key" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_data" jsonb,
	"bio" text,
	"timezone" text DEFAULT 'UTC',
	"productivity_score" real DEFAULT 0,
	"total_focus_minutes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_guest_key_unique" UNIQUE("guest_key")
);

CREATE TABLE IF NOT EXISTS "battle_pass_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"battle_pass_id" text NOT NULL,
	"tier" integer NOT NULL,
	"type" text NOT NULL,
	"value" jsonb,
	"required_xp" integer NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "battle_passes" (
	"id" text PRIMARY KEY NOT NULL,
	"season" text NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "battle_passes_season_unique" UNIQUE("season")
);

CREATE TABLE IF NOT EXISTS "leaderboard_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"category" text NOT NULL,
	"scope" text DEFAULT 'global',
	"group_id" text,
	"data" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shared_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_buddies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"buddy_id" text NOT NULL,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_battle_pass_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"battle_pass_id" text NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"current_tier" integer DEFAULT 0 NOT NULL,
	"claimed_rewards" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_challenge_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"challenge_id" text NOT NULL,
	"user_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sessions' NOT NULL,
	"xp_reward" integer DEFAULT 500 NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_email" text,
	"invitee_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"achievement_data" jsonb,
	"study_log_data" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"group_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "break_free_moods" ADD CONSTRAINT "break_free_moods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "consequence_contracts" ADD CONSTRAINT "consequence_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "distraction_logs" ADD CONSTRAINT "distraction_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_dna" ADD CONSTRAINT "focus_dna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_profiles" ADD CONSTRAINT "focus_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "login_rewards" ADD CONSTRAINT "login_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "productivity_logs" ADD CONSTRAINT "productivity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "readiness_logs" ADD CONSTRAINT "readiness_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "session_ghosts" ADD CONSTRAINT "session_ghosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_room_id_study_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_streaks" ADD CONSTRAINT "study_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "shared_goals" ADD CONSTRAINT "shared_goals_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_buddy_id_users_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_challenge_progress" ADD CONSTRAINT "group_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_challenges" ADD CONSTRAINT "group_challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ON "analytics_events" USING btree ("event_id");

CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "analytics_events_visitor_id_idx" ON "analytics_events" USING btree ("visitor_id");

CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_id_idx" ON "analytics_sessions" USING btree ("visitor_id");

CREATE INDEX IF NOT EXISTS "analytics_sessions_last_activity_idx" ON "analytics_sessions" USING btree ("last_activity_at");

CREATE INDEX IF NOT EXISTS "page_views_visitor_id_idx" ON "page_views" USING btree ("visitor_id");

CREATE INDEX IF NOT EXISTS "page_views_session_id_idx" ON "page_views" USING btree ("session_id");

CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views" USING btree ("viewed_at");

CREATE UNIQUE INDEX IF NOT EXISTS ON "visitors" USING btree ("visitor_id");

CREATE INDEX IF NOT EXISTS "visitors_last_seen_idx" ON "visitors" USING btree ("last_seen");

CREATE INDEX IF NOT EXISTS "visitors_user_id_idx" ON "visitors" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "conv_participants_conv_user_idx" ON "conversation_participants" USING btree ("conversation_id","user_id");

CREATE INDEX IF NOT EXISTS "conversations_group_idx" ON "conversations" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "message_reactions_msg_user_idx" ON "message_reactions" USING btree ("message_id","user_id");

CREATE INDEX IF NOT EXISTS "messages_conv_idx" ON "messages" USING btree ("conversation_id");

CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "buddy_requests_receiver_idx" ON "buddy_requests" USING btree ("receiver_id");

CREATE INDEX IF NOT EXISTS "coin_tx_user_idx" ON "coin_transactions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "focus_sessions_user_id_idx" ON "focus_sessions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "focus_sessions_completed_at_idx" ON "focus_sessions" USING btree ("completed_at");

CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows" USING btree ("follower_id");

CREATE INDEX IF NOT EXISTS "follows_following_idx" ON "follows" USING btree ("following_id");

CREATE INDEX IF NOT EXISTS "friendships_requester_idx" ON "friendships" USING btree ("requester_id");

CREATE INDEX IF NOT EXISTS "friendships_addressee_idx" ON "friendships" USING btree ("addressee_id");

CREATE INDEX IF NOT EXISTS "group_members_group_idx" ON "group_members" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "group_members_user_idx" ON "group_members" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "habit_completions_habit_idx" ON "habit_completions" USING btree ("habit_id");

CREATE INDEX IF NOT EXISTS "habit_completions_user_date_idx" ON "habit_completions" USING btree ("user_id","date");

CREATE INDEX IF NOT EXISTS "habits_user_idx" ON "habits" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "post_comments_post_idx" ON "post_comments" USING btree ("post_id");

CREATE INDEX IF NOT EXISTS "post_reactions_post_idx" ON "post_reactions" USING btree ("post_id");

CREATE INDEX IF NOT EXISTS "post_saves_post_user_idx" ON "post_saves" USING btree ("post_id","user_id");

CREATE INDEX IF NOT EXISTS "productivity_logs_user_date_idx" ON "productivity_logs" USING btree ("user_id","date");

CREATE INDEX IF NOT EXISTS "push_sub_user_idx" ON "push_subscriptions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "social_posts_user_idx" ON "social_posts" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "social_posts_created_at_idx" ON "social_posts" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "study_room_members_room_idx" ON "study_room_members" USING btree ("room_id");

CREATE INDEX IF NOT EXISTS "study_rooms_host_idx" ON "study_rooms" USING btree ("host_id");

CREATE INDEX IF NOT EXISTS "study_rooms_status_idx" ON "study_rooms" USING btree ("status");

CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "mission_progress_user_period_idx" ON "user_mission_progress" USING btree ("user_id","period_start");

CREATE INDEX IF NOT EXISTS "leaderboard_snapshots_period_category_idx" ON "leaderboard_snapshots" USING btree ("period","category");

CREATE INDEX IF NOT EXISTS "shared_goals_group_idx" ON "shared_goals" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "study_buddies_user_buddy_idx" ON "study_buddies" USING btree ("user_id","buddy_id");

CREATE INDEX IF NOT EXISTS "user_battle_pass_user_pass_idx" ON "user_battle_pass_progress" USING btree ("user_id","battle_pass_id");

CREATE INDEX IF NOT EXISTS "group_audit_logs_group_idx" ON "group_audit_logs" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "group_challenge_progress_chal_user_idx" ON "group_challenge_progress" USING btree ("challenge_id","user_id");

CREATE INDEX IF NOT EXISTS "group_challenges_group_idx" ON "group_challenges" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "group_invitations_group_idx" ON "group_invitations" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "posts_user_idx" ON "posts" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "post_likes_post_user_idx" ON "post_likes" USING btree ("post_id","user_id");

-- ─── Site settings (maintenance mode, announcements, branding) ──────────────
CREATE TABLE IF NOT EXISTS "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"announcement_enabled" boolean DEFAULT false NOT NULL,
	"announcement_title" text,
	"announcement_text" text,
	"announcement_emoji" text,
	"branding_name" text DEFAULT 'FocusArx' NOT NULL,
	"branding_tagline" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
