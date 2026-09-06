-- FocusArx public schema snapshot, generated from lib/db/src/schema/.
-- Regenerate: pnpm --filter @workspace/db run schema:export
-- Check drift: pnpm --filter @workspace/db run schema:check
-- Creates missing objects without dropping data. IF NOT EXISTS does NOT upgrade
-- columns in existing tables: use reviewed migrations or db:push for upgrades.
-- Tables are created before foreign keys so a fresh database can bootstrap.

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

CREATE TABLE IF NOT EXISTS "city_building_definitions" (
	"id" text PRIMARY KEY NOT NULL,
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
	"tier" text DEFAULT 'hamlet' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "city_building_definitions_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "focus_cities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text DEFAULT 'hamlet' NOT NULL,
	"tier_name" text DEFAULT 'Study Hamlet' NOT NULL,
	"population" integer DEFAULT 5 NOT NULL,
	"total_buildings" integer DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb,
	"buildings" jsonb DEFAULT '{}'::jsonb,
	"atmosphere" text DEFAULT 'day' NOT NULL,
	"selected_skin" text DEFAULT 'classic' NOT NULL,
	"weather" text DEFAULT 'clear' NOT NULL,
	"weather_updated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_cities_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "flashcard_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"next_review_at" timestamp DEFAULT now() NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"fsrs_difficulty" real DEFAULT 0,
	"fsrs_stability" real DEFAULT 0,
	"fsrs_reps" integer DEFAULT 0,
	"fsrs_lapses" integer DEFAULT 0,
	"fsrs_last_review" timestamp,
	"fsrs_due_date" timestamp DEFAULT now(),
	"fsrs_interval" integer DEFAULT 0,
	"fsrs_state" text DEFAULT 'new',
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
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "active_session_per_user_idx" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "app_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"rating" integer NOT NULL,
	"message" text,
	"category" text DEFAULT 'general',
	"session_count" integer DEFAULT 0,
	"user_level" integer DEFAULT 1,
	"device" text,
	"app_version" text DEFAULT '1.0',
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"client_nonce" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_sessions_user_nonce_unique" UNIQUE("user_id","client_nonce")
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

CREATE TABLE IF NOT EXISTS "marketplace_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'avatar' NOT NULL,
	"cost_coins" integer DEFAULT 100 NOT NULL,
	"rarity" text DEFAULT 'common',
	"emoji" text DEFAULT '🎁',
	"data" jsonb,
	"premium_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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

CREATE TABLE IF NOT EXISTS "premium_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"coins_cost" integer DEFAULT 9000,
	"benefits" jsonb DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"granted_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_subscriptions_user_id_unique" UNIQUE("user_id")
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
	"priority_enabled" boolean DEFAULT false NOT NULL,
	"sound" text DEFAULT 'default' NOT NULL,
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

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"replaced_by_token_hash" text,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
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

CREATE TABLE IF NOT EXISTS "streak_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"event" text NOT NULL,
	"from_streak" integer DEFAULT 0 NOT NULL,
	"to_streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

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
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "study_room_members_room_user_unique" UNIQUE("room_id","user_id")
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

CREATE TABLE IF NOT EXISTS "user_dreams" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dream_type" text DEFAULT 'custom' NOT NULL,
	"custom_goal" text,
	"target_date" text,
	"daily_target_minutes" integer DEFAULT 120,
	"total_minutes_logged" integer DEFAULT 0,
	"start_date" text,
	"emoji" text DEFAULT '🎯',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_dreams_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_emotes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"emote_id" text NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_emotes_user_emote_unique" UNIQUE("user_id","emote_id")
);

CREATE TABLE IF NOT EXISTS "user_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL
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

CREATE TABLE IF NOT EXISTS "user_pets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pet_type" text DEFAULT 'owl' NOT NULL,
	"pet_name" text,
	"pet_level" integer DEFAULT 1 NOT NULL,
	"pet_xp" integer DEFAULT 0 NOT NULL,
	"evolution_stage" integer DEFAULT 1 NOT NULL,
	"mood" text DEFAULT 'happy',
	"accessories" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_pets_user_id_unique" UNIQUE("user_id")
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
	"referral_code" text,
	"referred_by_user_id" text,
	"referral_applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_guest_key_unique" UNIQUE("guest_key"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);

CREATE TABLE IF NOT EXISTS "wrapped_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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

CREATE TABLE IF NOT EXISTS "loot_box_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rarity" text NOT NULL,
	"coin_cost" integer DEFAULT 0 NOT NULL,
	"sessions_required" integer DEFAULT 0 NOT NULL,
	"premium_only" boolean DEFAULT false NOT NULL,
	"icon" text NOT NULL,
	"glow_color" text DEFAULT '#7C3AED' NOT NULL,
	"possible_rewards" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_loot_boxes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"box_type_id" text NOT NULL,
	"status" text DEFAULT 'unopened' NOT NULL,
	"reward_type" text,
	"reward_value" jsonb,
	"earned_reason" text,
	"opened_at" timestamp,
	"earned_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quest_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"target" integer NOT NULL,
	"metric" text NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"coin_reward" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rotation_weight" integer DEFAULT 10 NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_quest_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"period" text NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_quest_progress_unique" UNIQUE("user_id","quest_id","period")
);

CREATE TABLE IF NOT EXISTS "seasonal_events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"banner_color" text DEFAULT '#7C3AED' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"xp_multiplier" real DEFAULT 1 NOT NULL,
	"coin_multiplier" real DEFAULT 1 NOT NULL,
	"special_missions" jsonb DEFAULT '[]'::jsonb,
	"exclusive_rewards" jsonb DEFAULT '[]'::jsonb,
	"premium_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasonal_events_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "user_seasonal_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"completed_missions" jsonb DEFAULT '[]'::jsonb,
	"rewards_claimed" jsonb DEFAULT '[]'::jsonb,
	"rank" integer,
	CONSTRAINT "user_seasonal_progress_unique" UNIQUE("user_id","event_id")
);

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
	"hero_title" text,
	"hero_subtitle" text,
	"hero_cta_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_drop_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"drop_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"reward_xp" integer DEFAULT 0 NOT NULL,
	"item_granted" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_drop_claims_drop_user_unique" UNIQUE("drop_id","user_id")
);

CREATE TABLE IF NOT EXISTS "admin_drops" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"payload" jsonb,
	"pool_total" integer DEFAULT 0 NOT NULL,
	"pool_claimed" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_via" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"cancelled_at" timestamp
);

CREATE TABLE IF NOT EXISTS "admin_sql_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text,
	"sql" text NOT NULL,
	"kind" text DEFAULT 'write' NOT NULL,
	"rows_affected" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"branch_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_action_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"actor_role" text DEFAULT 'system' NOT NULL,
	"model" text,
	"action" text NOT NULL,
	"payload" jsonb,
	"approved_by" text,
	"approved_at" timestamp,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_briefings" (
	"id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"kind" text DEFAULT 'daily' NOT NULL,
	"data" jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"emailed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_budget_state" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"day" text NOT NULL,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"cap" integer DEFAULT 1500 NOT NULL,
	"cool_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_call_log" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"user_id" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text DEFAULT 'growth' NOT NULL,
	"effort" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"source" text DEFAULT 'gemini' NOT NULL,
	"status" text DEFAULT 'backlog' NOT NULL,
	"promoted_to_task" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bot_pending_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"bot_id" text NOT NULL,
	"content" text NOT NULL,
	"parent_id" text,
	"due_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);

CREATE TABLE IF NOT EXISTS "platform_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "asset_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"fallback_url" text,
	"size_bytes" integer,
	"mime_type" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_catalog_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "battle_pass_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"battle_pass_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tier" integer NOT NULL,
	"reward_id" text NOT NULL,
	"is_premium_reward" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cosmetic_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cosmetic_id" text NOT NULL,
	"type" text NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"acquired_from" text DEFAULT 'starter' NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"rollout_percentage" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "pet_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"category" text DEFAULT 'starter' NOT NULL,
	"thumbnail_url" text,
	"model_url" text,
	"fallback_image_url" text,
	"animations" jsonb DEFAULT '{}'::jsonb,
	"unlock_source" text DEFAULT 'starter' NOT NULL,
	"token_cost" integer DEFAULT 0,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_seasonal" boolean DEFAULT false NOT NULL,
	"seasonal_event_id" text,
	"available_from" timestamp,
	"available_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"max_level" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pet_catalog_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "premium_entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"token_cost" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"granted_by_admin_id" text,
	"admin_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_entitlements_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "premium_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_days" integer NOT NULL,
	"token_cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_plans_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "quest_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"period" text NOT NULL,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "token_earning_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"daily_limit" integer,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_earning_rules_source_unique" UNIQUE("source")
);

CREATE TABLE IF NOT EXISTS "token_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"source" text NOT NULL,
	"related_entity_id" text,
	"idempotency_key" text NOT NULL,
	"balance_after" integer NOT NULL,
	"admin_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "user_pet_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"bond_xp" integer DEFAULT 0 NOT NULL,
	"nickname" text,
	"mood" text DEFAULT 'happy' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"acquired_from" text DEFAULT 'starter' NOT NULL,
	"accessories" jsonb DEFAULT '[]'::jsonb,
	"color_variant" text DEFAULT 'default',
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."visitors"'::regclass AND conname = 'visitors_user_id_users_id_fk') THEN
    ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."conversation_participants"'::regclass AND conname = 'conversation_participants_user_id_users_id_fk') THEN
    ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."message_reactions"'::regclass AND conname = 'message_reactions_user_id_users_id_fk') THEN
    ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."messages"'::regclass AND conname = 'messages_sender_id_users_id_fk') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."focus_cities"'::regclass AND conname = 'focus_cities_user_id_users_id_fk') THEN
    ALTER TABLE "focus_cities" ADD CONSTRAINT "focus_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."flashcard_decks"'::regclass AND conname = 'flashcard_decks_user_id_users_id_fk') THEN
    ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."flashcard_reviews"'::regclass AND conname = 'flashcard_reviews_card_id_flashcards_id_fk') THEN
    ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_card_id_flashcards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."flashcard_reviews"'::regclass AND conname = 'flashcard_reviews_user_id_users_id_fk') THEN
    ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."flashcards"'::regclass AND conname = 'flashcards_deck_id_flashcard_decks_id_fk') THEN
    ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."flashcard_decks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."active_sessions"'::regclass AND conname = 'active_sessions_user_id_users_id_fk') THEN
    ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."app_feedback"'::regclass AND conname = 'app_feedback_user_id_users_id_fk') THEN
    ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."audit_logs"'::regclass AND conname = 'audit_logs_user_id_users_id_fk') THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."battle_pass_progress"'::regclass AND conname = 'battle_pass_progress_user_id_users_id_fk') THEN
    ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."break_free_moods"'::regclass AND conname = 'break_free_moods_user_id_users_id_fk') THEN
    ALTER TABLE "break_free_moods" ADD CONSTRAINT "break_free_moods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."break_free_streaks"'::regclass AND conname = 'break_free_streaks_user_id_users_id_fk') THEN
    ALTER TABLE "break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."buddy_requests"'::regclass AND conname = 'buddy_requests_sender_id_users_id_fk') THEN
    ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."buddy_requests"'::regclass AND conname = 'buddy_requests_receiver_id_users_id_fk') THEN
    ALTER TABLE "buddy_requests" ADD CONSTRAINT "buddy_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."coin_transactions"'::regclass AND conname = 'coin_transactions_user_id_users_id_fk') THEN
    ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."consequence_contracts"'::regclass AND conname = 'consequence_contracts_user_id_users_id_fk') THEN
    ALTER TABLE "consequence_contracts" ADD CONSTRAINT "consequence_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."distraction_logs"'::regclass AND conname = 'distraction_logs_user_id_users_id_fk') THEN
    ALTER TABLE "distraction_logs" ADD CONSTRAINT "distraction_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."email_logs"'::regclass AND conname = 'email_logs_recipient_id_users_id_fk') THEN
    ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."focus_dna"'::regclass AND conname = 'focus_dna_user_id_users_id_fk') THEN
    ALTER TABLE "focus_dna" ADD CONSTRAINT "focus_dna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."focus_profiles"'::regclass AND conname = 'focus_profiles_user_id_users_id_fk') THEN
    ALTER TABLE "focus_profiles" ADD CONSTRAINT "focus_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."focus_sessions"'::regclass AND conname = 'focus_sessions_user_id_users_id_fk') THEN
    ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."follows"'::regclass AND conname = 'follows_follower_id_users_id_fk') THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."follows"'::regclass AND conname = 'follows_following_id_users_id_fk') THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."freeze_tokens"'::regclass AND conname = 'freeze_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."friendships"'::regclass AND conname = 'friendships_requester_id_users_id_fk') THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."friendships"'::regclass AND conname = 'friendships_addressee_id_users_id_fk') THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."goals"'::regclass AND conname = 'goals_user_id_users_id_fk') THEN
    ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_members"'::regclass AND conname = 'group_members_group_id_study_groups_id_fk') THEN
    ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_members"'::regclass AND conname = 'group_members_user_id_users_id_fk') THEN
    ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."habit_completions"'::regclass AND conname = 'habit_completions_habit_id_habits_id_fk') THEN
    ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."habit_completions"'::regclass AND conname = 'habit_completions_user_id_users_id_fk') THEN
    ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."habits"'::regclass AND conname = 'habits_user_id_users_id_fk') THEN
    ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."login_rewards"'::regclass AND conname = 'login_rewards_user_id_users_id_fk') THEN
    ALTER TABLE "login_rewards" ADD CONSTRAINT "login_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."notifications"'::regclass AND conname = 'notifications_user_id_users_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."password_reset_tokens"'::regclass AND conname = 'password_reset_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_comments"'::regclass AND conname = 'post_comments_post_id_social_posts_id_fk') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_comments"'::regclass AND conname = 'post_comments_user_id_users_id_fk') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_reactions"'::regclass AND conname = 'post_reactions_post_id_social_posts_id_fk') THEN
    ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_reactions"'::regclass AND conname = 'post_reactions_user_id_users_id_fk') THEN
    ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_saves"'::regclass AND conname = 'post_saves_post_id_social_posts_id_fk') THEN
    ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_saves"'::regclass AND conname = 'post_saves_user_id_users_id_fk') THEN
    ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."premium_subscriptions"'::regclass AND conname = 'premium_subscriptions_user_id_users_id_fk') THEN
    ALTER TABLE "premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."productivity_logs"'::regclass AND conname = 'productivity_logs_user_id_users_id_fk') THEN
    ALTER TABLE "productivity_logs" ADD CONSTRAINT "productivity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."push_subscriptions"'::regclass AND conname = 'push_subscriptions_user_id_users_id_fk') THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."readiness_logs"'::regclass AND conname = 'readiness_logs_user_id_users_id_fk') THEN
    ALTER TABLE "readiness_logs" ADD CONSTRAINT "readiness_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."refresh_tokens"'::regclass AND conname = 'refresh_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."roadmaps"'::regclass AND conname = 'roadmaps_user_id_users_id_fk') THEN
    ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."session_ghosts"'::regclass AND conname = 'session_ghosts_user_id_users_id_fk') THEN
    ALTER TABLE "session_ghosts" ADD CONSTRAINT "session_ghosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."social_posts"'::regclass AND conname = 'social_posts_user_id_users_id_fk') THEN
    ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."social_posts"'::regclass AND conname = 'social_posts_group_id_study_groups_id_fk') THEN
    ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."streak_history"'::regclass AND conname = 'streak_history_user_id_users_id_fk') THEN
    ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_groups"'::regclass AND conname = 'study_groups_owner_id_users_id_fk') THEN
    ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_room_members"'::regclass AND conname = 'study_room_members_room_id_study_rooms_id_fk') THEN
    ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_room_id_study_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_room_members"'::regclass AND conname = 'study_room_members_user_id_users_id_fk') THEN
    ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_rooms"'::regclass AND conname = 'study_rooms_group_id_study_groups_id_fk') THEN
    ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_group_id_study_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_rooms"'::regclass AND conname = 'study_rooms_host_id_users_id_fk') THEN
    ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_streaks"'::regclass AND conname = 'study_streaks_user_id_users_id_fk') THEN
    ALTER TABLE "study_streaks" ADD CONSTRAINT "study_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."tasks"'::regclass AND conname = 'tasks_user_id_users_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_badges"'::regclass AND conname = 'user_badges_user_id_users_id_fk') THEN
    ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_dreams"'::regclass AND conname = 'user_dreams_user_id_users_id_fk') THEN
    ALTER TABLE "user_dreams" ADD CONSTRAINT "user_dreams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_emotes"'::regclass AND conname = 'user_emotes_user_id_users_id_fk') THEN
    ALTER TABLE "user_emotes" ADD CONSTRAINT "user_emotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_inventory"'::regclass AND conname = 'user_inventory_user_id_users_id_fk') THEN
    ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_inventory"'::regclass AND conname = 'user_inventory_item_id_marketplace_items_id_fk') THEN
    ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_marketplace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_mission_progress"'::regclass AND conname = 'user_mission_progress_user_id_users_id_fk') THEN
    ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_pets"'::regclass AND conname = 'user_pets_user_id_users_id_fk') THEN
    ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_profile_extras"'::regclass AND conname = 'user_profile_extras_user_id_users_id_fk') THEN
    ALTER TABLE "user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_wallets"'::regclass AND conname = 'user_wallets_user_id_users_id_fk') THEN
    ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."wrapped_snapshots"'::regclass AND conname = 'wrapped_snapshots_user_id_users_id_fk') THEN
    ALTER TABLE "wrapped_snapshots" ADD CONSTRAINT "wrapped_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."battle_pass_rewards"'::regclass AND conname = 'battle_pass_rewards_battle_pass_id_battle_passes_id_fk') THEN
    ALTER TABLE "battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."shared_goals"'::regclass AND conname = 'shared_goals_creator_id_users_id_fk') THEN
    ALTER TABLE "shared_goals" ADD CONSTRAINT "shared_goals_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_buddies"'::regclass AND conname = 'study_buddies_user_id_users_id_fk') THEN
    ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."study_buddies"'::regclass AND conname = 'study_buddies_buddy_id_users_id_fk') THEN
    ALTER TABLE "study_buddies" ADD CONSTRAINT "study_buddies_buddy_id_users_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_battle_pass_progress"'::regclass AND conname = 'user_battle_pass_progress_user_id_users_id_fk') THEN
    ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_battle_pass_progress"'::regclass AND conname = 'user_battle_pass_progress_battle_pass_id_battle_passes_id_fk') THEN
    ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_audit_logs"'::regclass AND conname = 'group_audit_logs_actor_id_users_id_fk') THEN
    ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_challenge_progress"'::regclass AND conname = 'group_challenge_progress_user_id_users_id_fk') THEN
    ALTER TABLE "group_challenge_progress" ADD CONSTRAINT "group_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_challenges"'::regclass AND conname = 'group_challenges_creator_id_users_id_fk') THEN
    ALTER TABLE "group_challenges" ADD CONSTRAINT "group_challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_invitations"'::regclass AND conname = 'group_invitations_inviter_id_users_id_fk') THEN
    ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."group_invitations"'::regclass AND conname = 'group_invitations_invitee_id_users_id_fk') THEN
    ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."posts"'::regclass AND conname = 'posts_user_id_users_id_fk') THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."post_likes"'::regclass AND conname = 'post_likes_user_id_users_id_fk') THEN
    ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_loot_boxes"'::regclass AND conname = 'user_loot_boxes_user_id_users_id_fk') THEN
    ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_loot_boxes"'::regclass AND conname = 'user_loot_boxes_box_type_id_loot_box_types_id_fk') THEN
    ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_box_type_id_loot_box_types_id_fk" FOREIGN KEY ("box_type_id") REFERENCES "public"."loot_box_types"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_quest_progress"'::regclass AND conname = 'user_quest_progress_user_id_users_id_fk') THEN
    ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_quest_progress"'::regclass AND conname = 'user_quest_progress_quest_id_quest_definitions_id_fk') THEN
    ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_quest_definitions_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quest_definitions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_seasonal_progress"'::regclass AND conname = 'user_seasonal_progress_user_id_users_id_fk') THEN
    ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_seasonal_progress"'::regclass AND conname = 'user_seasonal_progress_event_id_seasonal_events_id_fk') THEN
    ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_event_id_seasonal_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."seasonal_events"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."admin_drop_claims"'::regclass AND conname = 'admin_drop_claims_drop_id_admin_drops_id_fk') THEN
    ALTER TABLE "admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_drop_id_admin_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."admin_drops"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."admin_drop_claims"'::regclass AND conname = 'admin_drop_claims_user_id_users_id_fk') THEN
    ALTER TABLE "admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."admin_drops"'::regclass AND conname = 'admin_drops_created_by_id_users_id_fk') THEN
    ALTER TABLE "admin_drops" ADD CONSTRAINT "admin_drops_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."admin_sql_log"'::regclass AND conname = 'admin_sql_log_admin_id_users_id_fk') THEN
    ALTER TABLE "admin_sql_log" ADD CONSTRAINT "admin_sql_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."ai_action_audit"'::regclass AND conname = 'ai_action_audit_approved_by_users_id_fk') THEN
    ALTER TABLE "ai_action_audit" ADD CONSTRAINT "ai_action_audit_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."ai_call_log"'::regclass AND conname = 'ai_call_log_user_id_users_id_fk') THEN
    ALTER TABLE "ai_call_log" ADD CONSTRAINT "ai_call_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."bot_pending_replies"'::regclass AND conname = 'bot_pending_replies_post_id_social_posts_id_fk') THEN
    ALTER TABLE "bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."bot_pending_replies"'::regclass AND conname = 'bot_pending_replies_bot_id_users_id_fk') THEN
    ALTER TABLE "bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_bot_id_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."battle_pass_claims"'::regclass AND conname = 'battle_pass_claims_user_id_users_id_fk') THEN
    ALTER TABLE "battle_pass_claims" ADD CONSTRAINT "battle_pass_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."cosmetic_inventory"'::regclass AND conname = 'cosmetic_inventory_user_id_users_id_fk') THEN
    ALTER TABLE "cosmetic_inventory" ADD CONSTRAINT "cosmetic_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."premium_entitlements"'::regclass AND conname = 'premium_entitlements_user_id_users_id_fk') THEN
    ALTER TABLE "premium_entitlements" ADD CONSTRAINT "premium_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."premium_entitlements"'::regclass AND conname = 'premium_entitlements_plan_id_premium_plans_id_fk') THEN
    ALTER TABLE "premium_entitlements" ADD CONSTRAINT "premium_entitlements_plan_id_premium_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."premium_plans"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."premium_entitlements"'::regclass AND conname = 'premium_entitlements_granted_by_admin_id_users_id_fk') THEN
    ALTER TABLE "premium_entitlements" ADD CONSTRAINT "premium_entitlements_granted_by_admin_id_users_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."quest_progress"'::regclass AND conname = 'quest_progress_user_id_users_id_fk') THEN
    ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."token_ledger"'::regclass AND conname = 'token_ledger_user_id_users_id_fk') THEN
    ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_pet_inventory"'::regclass AND conname = 'user_pet_inventory_user_id_users_id_fk') THEN
    ALTER TABLE "user_pet_inventory" ADD CONSTRAINT "user_pet_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."user_pet_inventory"'::regclass AND conname = 'user_pet_inventory_pet_id_pet_catalog_id_fk') THEN
    ALTER TABLE "user_pet_inventory" ADD CONSTRAINT "user_pet_inventory_pet_id_pet_catalog_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pet_catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_event_id_idx" ON "analytics_events" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_visitor_id_idx" ON "analytics_events" USING btree ("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_id_idx" ON "analytics_sessions" USING btree ("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_last_activity_idx" ON "analytics_sessions" USING btree ("last_activity_at");
CREATE INDEX IF NOT EXISTS "page_views_visitor_id_idx" ON "page_views" USING btree ("visitor_id");
CREATE INDEX IF NOT EXISTS "page_views_session_id_idx" ON "page_views" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views" USING btree ("viewed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_visitor_id_idx" ON "visitors" USING btree ("visitor_id");
CREATE INDEX IF NOT EXISTS "visitors_last_seen_idx" ON "visitors" USING btree ("last_seen");
CREATE INDEX IF NOT EXISTS "visitors_user_id_idx" ON "visitors" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "conv_participants_conv_user_idx" ON "conversation_participants" USING btree ("conversation_id","user_id");
CREATE INDEX IF NOT EXISTS "conversations_group_idx" ON "conversations" USING btree ("group_id");
CREATE INDEX IF NOT EXISTS "message_reactions_msg_user_idx" ON "message_reactions" USING btree ("message_id","user_id");
CREATE INDEX IF NOT EXISTS "message_reactions_msg_idx" ON "message_reactions" USING btree ("message_id");
CREATE INDEX IF NOT EXISTS "messages_conv_idx" ON "messages" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "city_building_slug_idx" ON "city_building_definitions" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "focus_cities_user_idx" ON "focus_cities" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "flashcard_decks_user_idx" ON "flashcard_decks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "flashcard_reviews_card_idx" ON "flashcard_reviews" USING btree ("card_id");
CREATE INDEX IF NOT EXISTS "flashcard_reviews_user_date_idx" ON "flashcard_reviews" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "flashcards_deck_idx" ON "flashcards" USING btree ("deck_id");
CREATE INDEX IF NOT EXISTS "flashcards_fsrs_due_idx" ON "flashcards" USING btree ("next_review_at");
CREATE INDEX IF NOT EXISTS "active_sessions_started_at_idx" ON "active_sessions" USING btree ("started_at");
CREATE INDEX IF NOT EXISTS "app_feedback_user_idx" ON "app_feedback" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "buddy_requests_receiver_idx" ON "buddy_requests" USING btree ("receiver_id");
CREATE INDEX IF NOT EXISTS "coin_tx_user_idx" ON "coin_transactions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "email_logs_recipient_idx" ON "email_logs" USING btree ("recipient_id");
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_id_idx" ON "focus_sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "focus_sessions_completed_at_idx" ON "focus_sessions" USING btree ("completed_at");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_started_idx" ON "focus_sessions" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_completed_idx" ON "focus_sessions" USING btree ("user_id","completed_at");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_status_idx" ON "focus_sessions" USING btree ("user_id","session_status");
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
CREATE INDEX IF NOT EXISTS "premium_subscriptions_user_idx" ON "premium_subscriptions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "productivity_logs_user_date_idx" ON "productivity_logs" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "push_sub_user_idx" ON "push_subscriptions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");
CREATE INDEX IF NOT EXISTS "social_posts_user_idx" ON "social_posts" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "social_posts_created_at_idx" ON "social_posts" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "social_posts_moderation_idx" ON "social_posts" USING btree ("moderation_status");
CREATE INDEX IF NOT EXISTS "streak_history_user_idx" ON "streak_history" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "streak_history_user_date_idx" ON "streak_history" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "study_room_members_room_idx" ON "study_room_members" USING btree ("room_id");
CREATE INDEX IF NOT EXISTS "room_members_room_user_idx" ON "study_room_members" USING btree ("room_id","user_id");
CREATE INDEX IF NOT EXISTS "study_rooms_host_idx" ON "study_rooms" USING btree ("host_id");
CREATE INDEX IF NOT EXISTS "study_rooms_status_idx" ON "study_rooms" USING btree ("status");
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_emotes_user_idx" ON "user_emotes" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_inventory_user_idx" ON "user_inventory" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_inventory_user_item_unique" ON "user_inventory" USING btree ("user_id","item_id");
CREATE INDEX IF NOT EXISTS "mission_progress_user_period_idx" ON "user_mission_progress" USING btree ("user_id","period_start");
CREATE INDEX IF NOT EXISTS "user_wallets_weekly_xp_idx" ON "user_wallets" USING btree ("weekly_xp");
CREATE INDEX IF NOT EXISTS "user_wallets_total_xp_idx" ON "user_wallets" USING btree ("total_xp");
CREATE INDEX IF NOT EXISTS "wrapped_user_period_idx" ON "wrapped_snapshots" USING btree ("user_id","period");
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
CREATE INDEX IF NOT EXISTS "user_loot_boxes_user_idx" ON "user_loot_boxes" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_quest_progress_user_idx" ON "user_quest_progress" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "seasonal_events_slug_idx" ON "seasonal_events" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "user_seasonal_progress_user_idx" ON "user_seasonal_progress" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "admin_drop_claims_drop_idx" ON "admin_drop_claims" USING btree ("drop_id");
CREATE INDEX IF NOT EXISTS "admin_drop_claims_user_idx" ON "admin_drop_claims" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "admin_drops_window_idx" ON "admin_drops" USING btree ("starts_at","ends_at");
CREATE INDEX IF NOT EXISTS "admin_drops_active_idx" ON "admin_drops" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "admin_sql_log_created_idx" ON "admin_sql_log" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "ai_action_audit_created_idx" ON "ai_action_audit" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "ai_action_audit_action_idx" ON "ai_action_audit" USING btree ("action");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_briefings_day_kind_unique" ON "ai_briefings" USING btree ("day","kind");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_budget_state_provider_day_unique" ON "ai_budget_state" USING btree ("provider","day");
CREATE INDEX IF NOT EXISTS "ai_call_log_created_idx" ON "ai_call_log" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "ai_call_log_purpose_idx" ON "ai_call_log" USING btree ("purpose","created_at");
CREATE INDEX IF NOT EXISTS "ai_call_log_user_purpose_idx" ON "ai_call_log" USING btree ("user_id","purpose","created_at");
CREATE INDEX IF NOT EXISTS "ai_ideas_status_idx" ON "ai_ideas" USING btree ("status","created_at");
CREATE INDEX IF NOT EXISTS "bot_pending_replies_due_idx" ON "bot_pending_replies" USING btree ("status","due_at");
CREATE INDEX IF NOT EXISTS "bot_pending_replies_post_idx" ON "bot_pending_replies" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "asset_catalog_type_idx" ON "asset_catalog" USING btree ("type");
CREATE INDEX IF NOT EXISTS "battle_pass_claims_user_idx" ON "battle_pass_claims" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "battle_pass_claims_pass_idx" ON "battle_pass_claims" USING btree ("battle_pass_id");
CREATE UNIQUE INDEX IF NOT EXISTS "battle_pass_claims_unique" ON "battle_pass_claims" USING btree ("battle_pass_id","user_id","tier","reward_id");
CREATE INDEX IF NOT EXISTS "cosmetic_inventory_user_idx" ON "cosmetic_inventory" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "cosmetic_inventory_user_type_idx" ON "cosmetic_inventory" USING btree ("user_id","type");
CREATE INDEX IF NOT EXISTS "feature_flags_enabled_idx" ON "feature_flags" USING btree ("enabled");
CREATE INDEX IF NOT EXISTS "pet_catalog_rarity_idx" ON "pet_catalog" USING btree ("rarity");
CREATE INDEX IF NOT EXISTS "pet_catalog_category_idx" ON "pet_catalog" USING btree ("category");
CREATE INDEX IF NOT EXISTS "pet_catalog_active_idx" ON "pet_catalog" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "premium_entitlements_user_idx" ON "premium_entitlements" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "premium_entitlements_user_status_idx" ON "premium_entitlements" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "premium_entitlements_ends_idx" ON "premium_entitlements" USING btree ("ends_at");
CREATE UNIQUE INDEX IF NOT EXISTS "premium_entitlements_idempotency_unique" ON "premium_entitlements" USING btree ("idempotency_key");
CREATE INDEX IF NOT EXISTS "premium_plans_active_idx" ON "premium_plans" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "quest_progress_user_idx" ON "quest_progress" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quest_progress_unique" ON "quest_progress" USING btree ("user_id","quest_id","period");
CREATE INDEX IF NOT EXISTS "token_earning_rules_active_idx" ON "token_earning_rules" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "token_ledger_user_idx" ON "token_ledger" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "token_ledger_user_created_idx" ON "token_ledger" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "token_ledger_source_idx" ON "token_ledger" USING btree ("source");
CREATE INDEX IF NOT EXISTS "token_ledger_type_idx" ON "token_ledger" USING btree ("transaction_type");
CREATE UNIQUE INDEX IF NOT EXISTS "token_ledger_idempotency_unique" ON "token_ledger" USING btree ("idempotency_key");
CREATE INDEX IF NOT EXISTS "user_pet_inventory_user_idx" ON "user_pet_inventory" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_pet_inventory_user_active_idx" ON "user_pet_inventory" USING btree ("user_id","is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "user_pet_inventory_user_pet_unique" ON "user_pet_inventory" USING btree ("user_id","pet_id");
