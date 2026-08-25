-- FocusArx — complete idempotent schema for the Neon SQL editor
-- Generated: 2026-08-25T12:18:42.748Z
-- Source: live Postgres catalog introspection (node, no psql)
-- Tables: 93 - all CREATEs are IF NOT EXISTS; constraints and indexes
-- are guarded / IF NOT EXISTS. Safe to run repeatedly. No data is modified.
-- FK tables are ordered before their dependents.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public."users" (
    "id" text NOT NULL,
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
    "referral_code" text,
    "referred_by_user_id" text,
    "referral_applied_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_pkey' AND conrelid = format('%I.%I', 'public', 'users')::regclass
  ) THEN
    ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique' AND conrelid = format('%I.%I', 'public', 'users')::regclass
  ) THEN
    ALTER TABLE public."users" ADD CONSTRAINT "users_email_unique" UNIQUE (email);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_guest_key_unique' AND conrelid = format('%I.%I', 'public', 'users')::regclass
  ) THEN
    ALTER TABLE public."users" ADD CONSTRAINT "users_guest_key_unique" UNIQUE (guest_key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_referral_code_unique' AND conrelid = format('%I.%I', 'public', 'users')::regclass
  ) THEN
    ALTER TABLE public."users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE (referral_code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."active_sessions" (
    "id" text NOT NULL,
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
    "started_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'active_sessions_pkey' AND conrelid = format('%I.%I', 'public', 'active_sessions')::regclass
  ) THEN
    ALTER TABLE public."active_sessions" ADD CONSTRAINT "active_sessions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'active_sessions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'active_sessions')::regclass
  ) THEN
    ALTER TABLE public."active_sessions" ADD CONSTRAINT "active_sessions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."admin_drops" (
    "id" text NOT NULL,
    "type" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "payload" jsonb,
    "pool_total" integer DEFAULT 0 NOT NULL,
    "pool_claimed" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp without time zone NOT NULL,
    "ends_at" timestamp without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by_id" text,
    "created_via" text DEFAULT 'admin'::text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "ended_at" timestamp without time zone,
    "cancelled_at" timestamp without time zone
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drops_pkey' AND conrelid = format('%I.%I', 'public', 'admin_drops')::regclass
  ) THEN
    ALTER TABLE public."admin_drops" ADD CONSTRAINT "admin_drops_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drops_created_by_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'admin_drops')::regclass
  ) THEN
    ALTER TABLE public."admin_drops" ADD CONSTRAINT "admin_drops_created_by_id_users_id_fk" FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS admin_drops_active_idx ON public.admin_drops USING btree (is_active);

CREATE INDEX IF NOT EXISTS admin_drops_window_idx ON public.admin_drops USING btree (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public."admin_drop_claims" (
    "id" text NOT NULL,
    "drop_id" text NOT NULL,
    "user_id" text NOT NULL,
    "reward_coins" integer DEFAULT 0 NOT NULL,
    "reward_xp" integer DEFAULT 0 NOT NULL,
    "item_granted" text,
    "claimed_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drop_claims_pkey' AND conrelid = format('%I.%I', 'public', 'admin_drop_claims')::regclass
  ) THEN
    ALTER TABLE public."admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drop_claims_drop_user_unique' AND conrelid = format('%I.%I', 'public', 'admin_drop_claims')::regclass
  ) THEN
    ALTER TABLE public."admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_drop_user_unique" UNIQUE (drop_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drop_claims_drop_id_admin_drops_id_fk' AND conrelid = format('%I.%I', 'public', 'admin_drop_claims')::regclass
  ) THEN
    ALTER TABLE public."admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_drop_id_admin_drops_id_fk" FOREIGN KEY (drop_id) REFERENCES admin_drops(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_drop_claims_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'admin_drop_claims')::regclass
  ) THEN
    ALTER TABLE public."admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS admin_drop_claims_drop_idx ON public.admin_drop_claims USING btree (drop_id);

CREATE INDEX IF NOT EXISTS admin_drop_claims_user_idx ON public.admin_drop_claims USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."admin_sql_log" (
    "id" text NOT NULL,
    "admin_id" text,
    "sql" text NOT NULL,
    "kind" text DEFAULT 'write'::text NOT NULL,
    "rows_affected" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'ok'::text NOT NULL,
    "error" text,
    "branch_name" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_sql_log_pkey' AND conrelid = format('%I.%I', 'public', 'admin_sql_log')::regclass
  ) THEN
    ALTER TABLE public."admin_sql_log" ADD CONSTRAINT "admin_sql_log_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_sql_log_admin_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'admin_sql_log')::regclass
  ) THEN
    ALTER TABLE public."admin_sql_log" ADD CONSTRAINT "admin_sql_log_admin_id_users_id_fk" FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS admin_sql_log_created_idx ON public.admin_sql_log USING btree (created_at);

CREATE TABLE IF NOT EXISTS public."ai_action_audit" (
    "id" text NOT NULL,
    "actor" text NOT NULL,
    "actor_role" text DEFAULT 'system'::text NOT NULL,
    "model" text,
    "action" text NOT NULL,
    "payload" jsonb,
    "approved_by" text,
    "approved_at" timestamp without time zone,
    "outcome" text DEFAULT 'pending'::text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_action_audit_pkey' AND conrelid = format('%I.%I', 'public', 'ai_action_audit')::regclass
  ) THEN
    ALTER TABLE public."ai_action_audit" ADD CONSTRAINT "ai_action_audit_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_action_audit_approved_by_users_id_fk' AND conrelid = format('%I.%I', 'public', 'ai_action_audit')::regclass
  ) THEN
    ALTER TABLE public."ai_action_audit" ADD CONSTRAINT "ai_action_audit_approved_by_users_id_fk" FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_action_audit_action_idx ON public.ai_action_audit USING btree (action);

CREATE INDEX IF NOT EXISTS ai_action_audit_created_idx ON public.ai_action_audit USING btree (created_at);

CREATE TABLE IF NOT EXISTS public."ai_briefings" (
    "id" text NOT NULL,
    "day" text NOT NULL,
    "kind" text DEFAULT 'daily'::text NOT NULL,
    "data" jsonb NOT NULL,
    "summary" text DEFAULT ''::text NOT NULL,
    "emailed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_briefings_pkey' AND conrelid = format('%I.%I', 'public', 'ai_briefings')::regclass
  ) THEN
    ALTER TABLE public."ai_briefings" ADD CONSTRAINT "ai_briefings_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_briefings_day_kind_unique ON public.ai_briefings USING btree (day, kind);

CREATE TABLE IF NOT EXISTS public."ai_budget_state" (
    "id" text NOT NULL,
    "provider" text DEFAULT 'gemini'::text NOT NULL,
    "day" text NOT NULL,
    "calls_used" integer DEFAULT 0 NOT NULL,
    "cap" integer DEFAULT 1500 NOT NULL,
    "cool_until" timestamp without time zone,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_budget_state_pkey' AND conrelid = format('%I.%I', 'public', 'ai_budget_state')::regclass
  ) THEN
    ALTER TABLE public."ai_budget_state" ADD CONSTRAINT "ai_budget_state_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_budget_state_provider_day_unique ON public.ai_budget_state USING btree (provider, day);

CREATE TABLE IF NOT EXISTS public."ai_call_log" (
    "id" text NOT NULL,
    "provider" text NOT NULL,
    "model" text NOT NULL,
    "purpose" text NOT NULL,
    "user_id" text,
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "latency_ms" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'ok'::text NOT NULL,
    "fallback_used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_call_log_pkey' AND conrelid = format('%I.%I', 'public', 'ai_call_log')::regclass
  ) THEN
    ALTER TABLE public."ai_call_log" ADD CONSTRAINT "ai_call_log_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_call_log_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'ai_call_log')::regclass
  ) THEN
    ALTER TABLE public."ai_call_log" ADD CONSTRAINT "ai_call_log_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_call_log_created_idx ON public.ai_call_log USING btree (created_at);

CREATE INDEX IF NOT EXISTS ai_call_log_purpose_idx ON public.ai_call_log USING btree (purpose, created_at);

CREATE INDEX IF NOT EXISTS ai_call_log_user_purpose_idx ON public.ai_call_log USING btree (user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS public."ai_ideas" (
    "id" text NOT NULL,
    "title" text NOT NULL,
    "body" text NOT NULL,
    "category" text DEFAULT 'growth'::text NOT NULL,
    "effort" text DEFAULT 'medium'::text NOT NULL,
    "impact" text DEFAULT 'medium'::text NOT NULL,
    "source" text DEFAULT 'gemini'::text NOT NULL,
    "status" text DEFAULT 'backlog'::text NOT NULL,
    "promoted_to_task" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_ideas_pkey' AND conrelid = format('%I.%I', 'public', 'ai_ideas')::regclass
  ) THEN
    ALTER TABLE public."ai_ideas" ADD CONSTRAINT "ai_ideas_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_ideas_status_idx ON public.ai_ideas USING btree (status, created_at);

CREATE TABLE IF NOT EXISTS public."analytics_events" (
    "id" text NOT NULL,
    "event_id" text NOT NULL,
    "visitor_id" text NOT NULL,
    "session_id" text,
    "event_type" text NOT NULL,
    "event_data" jsonb,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analytics_events_pkey' AND conrelid = format('%I.%I', 'public', 'analytics_events')::regclass
  ) THEN
    ALTER TABLE public."analytics_events" ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events USING btree (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_event_id_idx ON public.analytics_events USING btree (event_id);

CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx ON public.analytics_events USING btree (visitor_id);

CREATE TABLE IF NOT EXISTS public."analytics_sessions" (
    "id" text NOT NULL,
    "visitor_id" text NOT NULL,
    "session_start" timestamp without time zone DEFAULT now() NOT NULL,
    "session_end" timestamp without time zone,
    "duration_sec" integer DEFAULT 0 NOT NULL,
    "page_views" integer DEFAULT 0 NOT NULL,
    "focus_sessions_started" integer DEFAULT 0 NOT NULL,
    "tasks_created" integer DEFAULT 0 NOT NULL,
    "roadmaps_generated" integer DEFAULT 0 NOT NULL,
    "ai_features_used" integer DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analytics_sessions_pkey' AND conrelid = format('%I.%I', 'public', 'analytics_sessions')::regclass
  ) THEN
    ALTER TABLE public."analytics_sessions" ADD CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS analytics_sessions_last_activity_idx ON public.analytics_sessions USING btree (last_activity_at);

CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_id_idx ON public.analytics_sessions USING btree (visitor_id);

CREATE TABLE IF NOT EXISTS public."app_feedback" (
    "id" text NOT NULL,
    "user_id" text,
    "rating" integer NOT NULL,
    "message" text,
    "category" text DEFAULT 'general'::text,
    "session_count" integer DEFAULT 0,
    "user_level" integer DEFAULT 1,
    "device" text,
    "app_version" text DEFAULT '1.0'::text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_feedback_pkey' AND conrelid = format('%I.%I', 'public', 'app_feedback')::regclass
  ) THEN
    ALTER TABLE public."app_feedback" ADD CONSTRAINT "app_feedback_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_feedback_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'app_feedback')::regclass
  ) THEN
    ALTER TABLE public."app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON public.app_feedback USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."audit_logs" (
    "id" text NOT NULL,
    "user_id" text,
    "action" text NOT NULL,
    "details" jsonb,
    "ip" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_logs_pkey' AND conrelid = format('%I.%I', 'public', 'audit_logs')::regclass
  ) THEN
    ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_logs_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'audit_logs')::regclass
  ) THEN
    ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."battle_pass_progress" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "season" integer DEFAULT 1 NOT NULL,
    "tier" integer DEFAULT 0 NOT NULL,
    "season_xp" integer DEFAULT 0 NOT NULL,
    "premium_unlocked" boolean DEFAULT false NOT NULL,
    "claimed_tiers" jsonb DEFAULT '[]'::jsonb,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_pass_progress_pkey' AND conrelid = format('%I.%I', 'public', 'battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_pass_progress_user_id_unique' AND conrelid = format('%I.%I', 'public', 'battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_pass_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."battle_passes" (
    "id" text NOT NULL,
    "season" text NOT NULL,
    "title" text NOT NULL,
    "start_date" timestamp without time zone NOT NULL,
    "end_date" timestamp without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_passes_pkey' AND conrelid = format('%I.%I', 'public', 'battle_passes')::regclass
  ) THEN
    ALTER TABLE public."battle_passes" ADD CONSTRAINT "battle_passes_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_passes_season_unique' AND conrelid = format('%I.%I', 'public', 'battle_passes')::regclass
  ) THEN
    ALTER TABLE public."battle_passes" ADD CONSTRAINT "battle_passes_season_unique" UNIQUE (season);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."battle_pass_rewards" (
    "id" text NOT NULL,
    "battle_pass_id" text NOT NULL,
    "tier" integer NOT NULL,
    "type" text NOT NULL,
    "value" jsonb,
    "required_xp" integer NOT NULL,
    "is_premium" boolean DEFAULT false NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_pass_rewards_pkey' AND conrelid = format('%I.%I', 'public', 'battle_pass_rewards')::regclass
  ) THEN
    ALTER TABLE public."battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'battle_pass_rewards_battle_pass_id_battle_passes_id_fk' AND conrelid = format('%I.%I', 'public', 'battle_pass_rewards')::regclass
  ) THEN
    ALTER TABLE public."battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_battle_pass_id_battle_passes_id_fk" FOREIGN KEY (battle_pass_id) REFERENCES battle_passes(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."study_groups" (
    "id" text NOT NULL,
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
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_groups_pkey' AND conrelid = format('%I.%I', 'public', 'study_groups')::regclass
  ) THEN
    ALTER TABLE public."study_groups" ADD CONSTRAINT "study_groups_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_groups_invite_code_unique' AND conrelid = format('%I.%I', 'public', 'study_groups')::regclass
  ) THEN
    ALTER TABLE public."study_groups" ADD CONSTRAINT "study_groups_invite_code_unique" UNIQUE (invite_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_groups_owner_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_groups')::regclass
  ) THEN
    ALTER TABLE public."study_groups" ADD CONSTRAINT "study_groups_owner_id_users_id_fk" FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."social_posts" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "content" text NOT NULL,
    "type" text DEFAULT 'general'::text NOT NULL,
    "image_urls" jsonb DEFAULT '[]'::jsonb,
    "metadata" jsonb,
    "group_id" text,
    "is_public" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "moderation_status" text DEFAULT 'approved'::text NOT NULL,
    "moderation_reason" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_posts_pkey' AND conrelid = format('%I.%I', 'public', 'social_posts')::regclass
  ) THEN
    ALTER TABLE public."social_posts" ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_posts_group_id_study_groups_id_fk' AND conrelid = format('%I.%I', 'public', 'social_posts')::regclass
  ) THEN
    ALTER TABLE public."social_posts" ADD CONSTRAINT "social_posts_group_id_study_groups_id_fk" FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_posts_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'social_posts')::regclass
  ) THEN
    ALTER TABLE public."social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_posts_created_at_idx ON public.social_posts USING btree (created_at);

CREATE INDEX IF NOT EXISTS social_posts_moderation_idx ON public.social_posts USING btree (moderation_status);

CREATE INDEX IF NOT EXISTS social_posts_user_idx ON public.social_posts USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."bot_pending_replies" (
    "id" text NOT NULL,
    "post_id" text NOT NULL,
    "bot_id" text NOT NULL,
    "content" text NOT NULL,
    "parent_id" text,
    "due_at" timestamp without time zone NOT NULL,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "sent_at" timestamp without time zone
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bot_pending_replies_pkey' AND conrelid = format('%I.%I', 'public', 'bot_pending_replies')::regclass
  ) THEN
    ALTER TABLE public."bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bot_pending_replies_bot_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'bot_pending_replies')::regclass
  ) THEN
    ALTER TABLE public."bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_bot_id_users_id_fk" FOREIGN KEY (bot_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bot_pending_replies_post_id_social_posts_id_fk' AND conrelid = format('%I.%I', 'public', 'bot_pending_replies')::regclass
  ) THEN
    ALTER TABLE public."bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_post_id_social_posts_id_fk" FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bot_pending_replies_due_idx ON public.bot_pending_replies USING btree (status, due_at);

CREATE INDEX IF NOT EXISTS bot_pending_replies_post_idx ON public.bot_pending_replies USING btree (post_id);

CREATE TABLE IF NOT EXISTS public."break_free_moods" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "mood" integer NOT NULL,
    "date" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_moods_pkey' AND conrelid = format('%I.%I', 'public', 'break_free_moods')::regclass
  ) THEN
    ALTER TABLE public."break_free_moods" ADD CONSTRAINT "break_free_moods_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_moods_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'break_free_moods')::regclass
  ) THEN
    ALTER TABLE public."break_free_moods" ADD CONSTRAINT "break_free_moods_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."break_free_pledges" (
    "id" text NOT NULL,
    "message" text NOT NULL,
    "posted_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_pledges_pkey' AND conrelid = format('%I.%I', 'public', 'break_free_pledges')::regclass
  ) THEN
    ALTER TABLE public."break_free_pledges" ADD CONSTRAINT "break_free_pledges_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."break_free_streaks" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "start_date" text NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "relapse_count" integer DEFAULT 0 NOT NULL,
    "last_relapse_date" text,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_streaks_pkey' AND conrelid = format('%I.%I', 'public', 'break_free_streaks')::regclass
  ) THEN
    ALTER TABLE public."break_free_streaks" ADD CONSTRAINT "break_free_streaks_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_streaks_user_id_unique' AND conrelid = format('%I.%I', 'public', 'break_free_streaks')::regclass
  ) THEN
    ALTER TABLE public."break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'break_free_streaks_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'break_free_streaks')::regclass
  ) THEN
    ALTER TABLE public."break_free_streaks" ADD CONSTRAINT "break_free_streaks_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."buddy_requests" (
    "id" text NOT NULL,
    "sender_id" text NOT NULL,
    "receiver_id" text NOT NULL,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "message" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddy_requests_pkey' AND conrelid = format('%I.%I', 'public', 'buddy_requests')::regclass
  ) THEN
    ALTER TABLE public."buddy_requests" ADD CONSTRAINT "buddy_requests_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddy_requests_receiver_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'buddy_requests')::regclass
  ) THEN
    ALTER TABLE public."buddy_requests" ADD CONSTRAINT "buddy_requests_receiver_id_users_id_fk" FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddy_requests_sender_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'buddy_requests')::regclass
  ) THEN
    ALTER TABLE public."buddy_requests" ADD CONSTRAINT "buddy_requests_sender_id_users_id_fk" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS buddy_requests_receiver_idx ON public.buddy_requests USING btree (receiver_id);

CREATE TABLE IF NOT EXISTS public."city_building_definitions" (
    "id" text NOT NULL,
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
    "sort_order" integer DEFAULT 0 NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'city_building_definitions_pkey' AND conrelid = format('%I.%I', 'public', 'city_building_definitions')::regclass
  ) THEN
    ALTER TABLE public."city_building_definitions" ADD CONSTRAINT "city_building_definitions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'city_building_definitions_slug_unique' AND conrelid = format('%I.%I', 'public', 'city_building_definitions')::regclass
  ) THEN
    ALTER TABLE public."city_building_definitions" ADD CONSTRAINT "city_building_definitions_slug_unique" UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS city_building_slug_idx ON public.city_building_definitions USING btree (slug);

CREATE TABLE IF NOT EXISTS public."coin_transactions" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "amount" integer NOT NULL,
    "reason" text NOT NULL,
    "description" text NOT NULL,
    "balance_after" integer DEFAULT 0 NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coin_transactions_pkey' AND conrelid = format('%I.%I', 'public', 'coin_transactions')::regclass
  ) THEN
    ALTER TABLE public."coin_transactions" ADD CONSTRAINT "coin_transactions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coin_transactions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'coin_transactions')::regclass
  ) THEN
    ALTER TABLE public."coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON public.coin_transactions USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."consequence_contracts" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "week_start" text NOT NULL,
    "contract_type" text NOT NULL,
    "target_minutes" integer DEFAULT 0 NOT NULL,
    "charity_name" text,
    "charity_amount" integer,
    "achieved" boolean DEFAULT false NOT NULL,
    "consequence_triggered" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consequence_contracts_pkey' AND conrelid = format('%I.%I', 'public', 'consequence_contracts')::regclass
  ) THEN
    ALTER TABLE public."consequence_contracts" ADD CONSTRAINT "consequence_contracts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consequence_contracts_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'consequence_contracts')::regclass
  ) THEN
    ALTER TABLE public."consequence_contracts" ADD CONSTRAINT "consequence_contracts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."conversation_participants" (
    "id" text NOT NULL,
    "conversation_id" text NOT NULL,
    "user_id" text NOT NULL,
    "last_read_at" timestamp without time zone,
    "is_admin" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_participants_pkey' AND conrelid = format('%I.%I', 'public', 'conversation_participants')::regclass
  ) THEN
    ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_participants_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'conversation_participants')::regclass
  ) THEN
    ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conv_participants_conv_user_idx ON public.conversation_participants USING btree (conversation_id, user_id);

CREATE TABLE IF NOT EXISTS public."conversations" (
    "id" text NOT NULL,
    "type" text DEFAULT 'direct'::text NOT NULL,
    "name" text,
    "group_id" text,
    "last_message_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_pkey' AND conrelid = format('%I.%I', 'public', 'conversations')::regclass
  ) THEN
    ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_group_idx ON public.conversations USING btree (group_id);

CREATE TABLE IF NOT EXISTS public."distraction_logs" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "session_id" text,
    "reason" text NOT NULL,
    "worth_it" boolean DEFAULT false NOT NULL,
    "hour" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distraction_logs_pkey' AND conrelid = format('%I.%I', 'public', 'distraction_logs')::regclass
  ) THEN
    ALTER TABLE public."distraction_logs" ADD CONSTRAINT "distraction_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distraction_logs_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'distraction_logs')::regclass
  ) THEN
    ALTER TABLE public."distraction_logs" ADD CONSTRAINT "distraction_logs_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."email_logs" (
    "id" text NOT NULL,
    "recipient_id" text,
    "recipient_email" text NOT NULL,
    "template" text NOT NULL,
    "subject" text NOT NULL,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "provider_id" text,
    "sent_at" timestamp without time zone,
    "opened_at" timestamp without time zone,
    "clicked_at" timestamp without time zone,
    "bounced" boolean DEFAULT false,
    "error" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_logs_pkey' AND conrelid = format('%I.%I', 'public', 'email_logs')::regclass
  ) THEN
    ALTER TABLE public."email_logs" ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_logs_recipient_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'email_logs')::regclass
  ) THEN
    ALTER TABLE public."email_logs" ADD CONSTRAINT "email_logs_recipient_id_users_id_fk" FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs USING btree (created_at);

CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON public.email_logs USING btree (recipient_id);

CREATE TABLE IF NOT EXISTS public."flashcard_decks" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "category" text DEFAULT 'General'::text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcard_decks_pkey' AND conrelid = format('%I.%I', 'public', 'flashcard_decks')::regclass
  ) THEN
    ALTER TABLE public."flashcard_decks" ADD CONSTRAINT "flashcard_decks_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcard_decks_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'flashcard_decks')::regclass
  ) THEN
    ALTER TABLE public."flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx ON public.flashcard_decks USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."flashcards" (
    "id" text NOT NULL,
    "deck_id" text NOT NULL,
    "front" text NOT NULL,
    "back" text NOT NULL,
    "box" integer DEFAULT 1 NOT NULL,
    "next_review_at" timestamp without time zone DEFAULT now() NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "incorrect_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcards_pkey' AND conrelid = format('%I.%I', 'public', 'flashcards')::regclass
  ) THEN
    ALTER TABLE public."flashcards" ADD CONSTRAINT "flashcards_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcards_deck_id_flashcard_decks_id_fk' AND conrelid = format('%I.%I', 'public', 'flashcards')::regclass
  ) THEN
    ALTER TABLE public."flashcards" ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk" FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS flashcards_deck_idx ON public.flashcards USING btree (deck_id);

CREATE TABLE IF NOT EXISTS public."focus_cities" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "tier" text DEFAULT 'hamlet'::text NOT NULL,
    "tier_name" text DEFAULT 'Study Hamlet'::text NOT NULL,
    "population" integer DEFAULT 5 NOT NULL,
    "total_buildings" integer DEFAULT 0 NOT NULL,
    "total_sessions" integer DEFAULT 0 NOT NULL,
    "unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb,
    "buildings" jsonb DEFAULT '{}'::jsonb,
    "atmosphere" text DEFAULT 'day'::text NOT NULL,
    "selected_skin" text DEFAULT 'classic'::text NOT NULL,
    "weather" text DEFAULT 'clear'::text NOT NULL,
    "weather_updated_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_cities_pkey' AND conrelid = format('%I.%I', 'public', 'focus_cities')::regclass
  ) THEN
    ALTER TABLE public."focus_cities" ADD CONSTRAINT "focus_cities_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_cities_user_id_unique' AND conrelid = format('%I.%I', 'public', 'focus_cities')::regclass
  ) THEN
    ALTER TABLE public."focus_cities" ADD CONSTRAINT "focus_cities_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_cities_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'focus_cities')::regclass
  ) THEN
    ALTER TABLE public."focus_cities" ADD CONSTRAINT "focus_cities_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS focus_cities_user_idx ON public.focus_cities USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."focus_dna" (
    "id" text NOT NULL,
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
    "generated_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_dna_pkey' AND conrelid = format('%I.%I', 'public', 'focus_dna')::regclass
  ) THEN
    ALTER TABLE public."focus_dna" ADD CONSTRAINT "focus_dna_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_dna_user_id_unique' AND conrelid = format('%I.%I', 'public', 'focus_dna')::regclass
  ) THEN
    ALTER TABLE public."focus_dna" ADD CONSTRAINT "focus_dna_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_dna_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'focus_dna')::regclass
  ) THEN
    ALTER TABLE public."focus_dna" ADD CONSTRAINT "focus_dna_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."focus_profiles" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "ssid" text,
    "blocked_domains" jsonb DEFAULT '[]'::jsonb,
    "whitelist" jsonb DEFAULT '[]'::jsonb,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_profiles_pkey' AND conrelid = format('%I.%I', 'public', 'focus_profiles')::regclass
  ) THEN
    ALTER TABLE public."focus_profiles" ADD CONSTRAINT "focus_profiles_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_profiles_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'focus_profiles')::regclass
  ) THEN
    ALTER TABLE public."focus_profiles" ADD CONSTRAINT "focus_profiles_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."focus_sessions" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "mode" text DEFAULT 'focus'::text NOT NULL,
    "duration_sec" integer DEFAULT 0 NOT NULL,
    "planned_duration_sec" integer,
    "completed_early" boolean DEFAULT false,
    "completion_percentage" real,
    "session_status" text DEFAULT 'completed'::text,
    "completed_at" timestamp without time zone,
    "focus_score" real,
    "focus_quality" text,
    "stability_rating" text,
    "focus_timeline" text,
    "session_insights" text,
    "category" text DEFAULT 'General'::text,
    "productivity_score" real,
    "client_nonce" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_sessions_pkey' AND conrelid = format('%I.%I', 'public', 'focus_sessions')::regclass
  ) THEN
    ALTER TABLE public."focus_sessions" ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_sessions_user_nonce_unique' AND conrelid = format('%I.%I', 'public', 'focus_sessions')::regclass
  ) THEN
    ALTER TABLE public."focus_sessions" ADD CONSTRAINT "focus_sessions_user_nonce_unique" UNIQUE (user_id, client_nonce);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'focus_sessions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'focus_sessions')::regclass
  ) THEN
    ALTER TABLE public."focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS focus_sessions_completed_at_idx ON public.focus_sessions USING btree (completed_at);

CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON public.focus_sessions USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."follows" (
    "id" text NOT NULL,
    "follower_id" text NOT NULL,
    "following_id" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'follows_pkey' AND conrelid = format('%I.%I', 'public', 'follows')::regclass
  ) THEN
    ALTER TABLE public."follows" ADD CONSTRAINT "follows_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'follows_follower_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'follows')::regclass
  ) THEN
    ALTER TABLE public."follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'follows_following_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'follows')::regclass
  ) THEN
    ALTER TABLE public."follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows USING btree (follower_id);

CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows USING btree (following_id);

CREATE TABLE IF NOT EXISTS public."freeze_tokens" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "tokens_available" integer DEFAULT 0 NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'freeze_tokens_pkey' AND conrelid = format('%I.%I', 'public', 'freeze_tokens')::regclass
  ) THEN
    ALTER TABLE public."freeze_tokens" ADD CONSTRAINT "freeze_tokens_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'freeze_tokens_user_id_unique' AND conrelid = format('%I.%I', 'public', 'freeze_tokens')::regclass
  ) THEN
    ALTER TABLE public."freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'freeze_tokens_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'freeze_tokens')::regclass
  ) THEN
    ALTER TABLE public."freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."friendships" (
    "id" text NOT NULL,
    "requester_id" text NOT NULL,
    "addressee_id" text NOT NULL,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friendships_pkey' AND conrelid = format('%I.%I', 'public', 'friendships')::regclass
  ) THEN
    ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friendships_addressee_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'friendships')::regclass
  ) THEN
    ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friendships_requester_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'friendships')::regclass
  ) THEN
    ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships USING btree (addressee_id);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships USING btree (requester_id);

CREATE TABLE IF NOT EXISTS public."goals" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goals_pkey' AND conrelid = format('%I.%I', 'public', 'goals')::regclass
  ) THEN
    ALTER TABLE public."goals" ADD CONSTRAINT "goals_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goals_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'goals')::regclass
  ) THEN
    ALTER TABLE public."goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."group_audit_logs" (
    "id" text NOT NULL,
    "group_id" text NOT NULL,
    "actor_id" text NOT NULL,
    "action" text NOT NULL,
    "target_id" text,
    "details" jsonb,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_audit_logs_pkey' AND conrelid = format('%I.%I', 'public', 'group_audit_logs')::regclass
  ) THEN
    ALTER TABLE public."group_audit_logs" ADD CONSTRAINT "group_audit_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_audit_logs_actor_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_audit_logs')::regclass
  ) THEN
    ALTER TABLE public."group_audit_logs" ADD CONSTRAINT "group_audit_logs_actor_id_users_id_fk" FOREIGN KEY (actor_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_audit_logs_group_idx ON public.group_audit_logs USING btree (group_id);

CREATE TABLE IF NOT EXISTS public."group_challenge_progress" (
    "id" text NOT NULL,
    "challenge_id" text NOT NULL,
    "user_id" text NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp without time zone,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_challenge_progress_pkey' AND conrelid = format('%I.%I', 'public', 'group_challenge_progress')::regclass
  ) THEN
    ALTER TABLE public."group_challenge_progress" ADD CONSTRAINT "group_challenge_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_challenge_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_challenge_progress')::regclass
  ) THEN
    ALTER TABLE public."group_challenge_progress" ADD CONSTRAINT "group_challenge_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_challenge_progress_chal_user_idx ON public.group_challenge_progress USING btree (challenge_id, user_id);

CREATE TABLE IF NOT EXISTS public."group_challenges" (
    "id" text NOT NULL,
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
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_challenges_pkey' AND conrelid = format('%I.%I', 'public', 'group_challenges')::regclass
  ) THEN
    ALTER TABLE public."group_challenges" ADD CONSTRAINT "group_challenges_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_challenges_creator_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_challenges')::regclass
  ) THEN
    ALTER TABLE public."group_challenges" ADD CONSTRAINT "group_challenges_creator_id_users_id_fk" FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_challenges_group_idx ON public.group_challenges USING btree (group_id);

CREATE TABLE IF NOT EXISTS public."group_invitations" (
    "id" text NOT NULL,
    "group_id" text NOT NULL,
    "inviter_id" text NOT NULL,
    "invitee_email" text,
    "invitee_id" text,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "expires_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_invitations_pkey' AND conrelid = format('%I.%I', 'public', 'group_invitations')::regclass
  ) THEN
    ALTER TABLE public."group_invitations" ADD CONSTRAINT "group_invitations_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_invitations_invitee_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_invitations')::regclass
  ) THEN
    ALTER TABLE public."group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_users_id_fk" FOREIGN KEY (invitee_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_invitations_inviter_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_invitations')::regclass
  ) THEN
    ALTER TABLE public."group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_users_id_fk" FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_invitations_group_idx ON public.group_invitations USING btree (group_id);

CREATE TABLE IF NOT EXISTS public."group_members" (
    "id" text NOT NULL,
    "group_id" text NOT NULL,
    "user_id" text NOT NULL,
    "role" text DEFAULT 'member'::text NOT NULL,
    "xp_contribution" integer DEFAULT 0 NOT NULL,
    "joined_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_members_pkey' AND conrelid = format('%I.%I', 'public', 'group_members')::regclass
  ) THEN
    ALTER TABLE public."group_members" ADD CONSTRAINT "group_members_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_members_group_id_study_groups_id_fk' AND conrelid = format('%I.%I', 'public', 'group_members')::regclass
  ) THEN
    ALTER TABLE public."group_members" ADD CONSTRAINT "group_members_group_id_study_groups_id_fk" FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_members_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'group_members')::regclass
  ) THEN
    ALTER TABLE public."group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS group_members_group_idx ON public.group_members USING btree (group_id);

CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."habits" (
    "id" text NOT NULL,
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
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'habits_pkey' AND conrelid = format('%I.%I', 'public', 'habits')::regclass
  ) THEN
    ALTER TABLE public."habits" ADD CONSTRAINT "habits_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'habits_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'habits')::regclass
  ) THEN
    ALTER TABLE public."habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS habits_user_idx ON public.habits USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."habit_completions" (
    "id" text NOT NULL,
    "habit_id" text NOT NULL,
    "user_id" text NOT NULL,
    "date" text NOT NULL,
    "note" text,
    "completed_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'habit_completions_pkey' AND conrelid = format('%I.%I', 'public', 'habit_completions')::regclass
  ) THEN
    ALTER TABLE public."habit_completions" ADD CONSTRAINT "habit_completions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'habit_completions_habit_id_habits_id_fk' AND conrelid = format('%I.%I', 'public', 'habit_completions')::regclass
  ) THEN
    ALTER TABLE public."habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'habit_completions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'habit_completions')::regclass
  ) THEN
    ALTER TABLE public."habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS habit_completions_habit_idx ON public.habit_completions USING btree (habit_id);

CREATE INDEX IF NOT EXISTS habit_completions_user_date_idx ON public.habit_completions USING btree (user_id, date);

CREATE TABLE IF NOT EXISTS public."leaderboard_snapshots" (
    "id" text NOT NULL,
    "period" text NOT NULL,
    "category" text NOT NULL,
    "scope" text DEFAULT 'global'::text,
    "group_id" text,
    "data" jsonb NOT NULL,
    "generated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leaderboard_snapshots_pkey' AND conrelid = format('%I.%I', 'public', 'leaderboard_snapshots')::regclass
  ) THEN
    ALTER TABLE public."leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leaderboard_snapshots_period_category_idx ON public.leaderboard_snapshots USING btree (period, category);

CREATE TABLE IF NOT EXISTS public."login_rewards" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "last_claimed_date" text,
    "claim_streak" integer DEFAULT 0 NOT NULL,
    "total_claimed" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'login_rewards_pkey' AND conrelid = format('%I.%I', 'public', 'login_rewards')::regclass
  ) THEN
    ALTER TABLE public."login_rewards" ADD CONSTRAINT "login_rewards_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'login_rewards_user_id_unique' AND conrelid = format('%I.%I', 'public', 'login_rewards')::regclass
  ) THEN
    ALTER TABLE public."login_rewards" ADD CONSTRAINT "login_rewards_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'login_rewards_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'login_rewards')::regclass
  ) THEN
    ALTER TABLE public."login_rewards" ADD CONSTRAINT "login_rewards_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."loot_box_types" (
    "id" text NOT NULL,
    "name" text NOT NULL,
    "description" text NOT NULL,
    "rarity" text NOT NULL,
    "coin_cost" integer DEFAULT 0 NOT NULL,
    "sessions_required" integer DEFAULT 0 NOT NULL,
    "premium_only" boolean DEFAULT false NOT NULL,
    "icon" text NOT NULL,
    "glow_color" text DEFAULT '#7C3AED'::text NOT NULL,
    "possible_rewards" jsonb NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loot_box_types_pkey' AND conrelid = format('%I.%I', 'public', 'loot_box_types')::regclass
  ) THEN
    ALTER TABLE public."loot_box_types" ADD CONSTRAINT "loot_box_types_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."marketplace_items" (
    "id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "type" text DEFAULT 'avatar'::text NOT NULL,
    "cost_coins" integer DEFAULT 100 NOT NULL,
    "rarity" text DEFAULT 'common'::text,
    "emoji" text DEFAULT '🎁'::text,
    "data" jsonb,
    "premium_only" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_items_pkey' AND conrelid = format('%I.%I', 'public', 'marketplace_items')::regclass
  ) THEN
    ALTER TABLE public."marketplace_items" ADD CONSTRAINT "marketplace_items_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."message_reactions" (
    "id" text NOT NULL,
    "message_id" text NOT NULL,
    "user_id" text NOT NULL,
    "emoji" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_reactions_pkey' AND conrelid = format('%I.%I', 'public', 'message_reactions')::regclass
  ) THEN
    ALTER TABLE public."message_reactions" ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_reactions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'message_reactions')::regclass
  ) THEN
    ALTER TABLE public."message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_reactions_msg_idx ON public.message_reactions USING btree (message_id);

CREATE INDEX IF NOT EXISTS message_reactions_msg_user_idx ON public.message_reactions USING btree (message_id, user_id);

CREATE TABLE IF NOT EXISTS public."messages" (
    "id" text NOT NULL,
    "conversation_id" text NOT NULL,
    "sender_id" text NOT NULL,
    "content" text NOT NULL,
    "type" text DEFAULT 'text'::text,
    "reply_to_id" text,
    "is_edited" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_pkey' AND conrelid = format('%I.%I', 'public', 'messages')::regclass
  ) THEN
    ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_sender_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'messages')::regclass
  ) THEN
    ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages USING btree (conversation_id);

CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages USING btree (created_at);

CREATE TABLE IF NOT EXISTS public."missions" (
    "id" text NOT NULL,
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
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'missions_pkey' AND conrelid = format('%I.%I', 'public', 'missions')::regclass
  ) THEN
    ALTER TABLE public."missions" ADD CONSTRAINT "missions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'missions_mission_key_unique' AND conrelid = format('%I.%I', 'public', 'missions')::regclass
  ) THEN
    ALTER TABLE public."missions" ADD CONSTRAINT "missions_mission_key_unique" UNIQUE (mission_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."notifications" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "title" text NOT NULL,
    "message" text NOT NULL,
    "data" jsonb,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_pkey' AND conrelid = format('%I.%I', 'public', 'notifications')::regclass
  ) THEN
    ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'notifications')::regclass
  ) THEN
    ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."page_views" (
    "id" text NOT NULL,
    "visitor_id" text NOT NULL,
    "session_id" text NOT NULL,
    "page" text NOT NULL,
    "viewed_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'page_views_pkey' AND conrelid = format('%I.%I', 'public', 'page_views')::regclass
  ) THEN
    ALTER TABLE public."page_views" ADD CONSTRAINT "page_views_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS page_views_session_id_idx ON public.page_views USING btree (session_id);

CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON public.page_views USING btree (viewed_at);

CREATE INDEX IF NOT EXISTS page_views_visitor_id_idx ON public.page_views USING btree (visitor_id);

CREATE TABLE IF NOT EXISTS public."password_reset_tokens" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp without time zone NOT NULL,
    "used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_pkey' AND conrelid = format('%I.%I', 'public', 'password_reset_tokens')::regclass
  ) THEN
    ALTER TABLE public."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_token_unique' AND conrelid = format('%I.%I', 'public', 'password_reset_tokens')::regclass
  ) THEN
    ALTER TABLE public."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_unique" UNIQUE (token);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'password_reset_tokens')::regclass
  ) THEN
    ALTER TABLE public."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."platform_meta" (
    "key" text NOT NULL,
    "value" jsonb,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_meta_pkey' AND conrelid = format('%I.%I', 'public', 'platform_meta')::regclass
  ) THEN
    ALTER TABLE public."platform_meta" ADD CONSTRAINT "platform_meta_pkey" PRIMARY KEY (key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."post_comments" (
    "id" text NOT NULL,
    "post_id" text NOT NULL,
    "user_id" text NOT NULL,
    "parent_id" text,
    "content" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_comments_pkey' AND conrelid = format('%I.%I', 'public', 'post_comments')::regclass
  ) THEN
    ALTER TABLE public."post_comments" ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_comments_post_id_social_posts_id_fk' AND conrelid = format('%I.%I', 'public', 'post_comments')::regclass
  ) THEN
    ALTER TABLE public."post_comments" ADD CONSTRAINT "post_comments_post_id_social_posts_id_fk" FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_comments_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'post_comments')::regclass
  ) THEN
    ALTER TABLE public."post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments USING btree (post_id);

CREATE TABLE IF NOT EXISTS public."post_likes" (
    "id" text NOT NULL,
    "post_id" text NOT NULL,
    "user_id" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_likes_pkey' AND conrelid = format('%I.%I', 'public', 'post_likes')::regclass
  ) THEN
    ALTER TABLE public."post_likes" ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_likes_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'post_likes')::regclass
  ) THEN
    ALTER TABLE public."post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_likes_post_user_idx ON public.post_likes USING btree (post_id, user_id);

CREATE TABLE IF NOT EXISTS public."post_reactions" (
    "id" text NOT NULL,
    "post_id" text NOT NULL,
    "user_id" text NOT NULL,
    "reaction" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_reactions_pkey' AND conrelid = format('%I.%I', 'public', 'post_reactions')::regclass
  ) THEN
    ALTER TABLE public."post_reactions" ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_reactions_post_id_social_posts_id_fk' AND conrelid = format('%I.%I', 'public', 'post_reactions')::regclass
  ) THEN
    ALTER TABLE public."post_reactions" ADD CONSTRAINT "post_reactions_post_id_social_posts_id_fk" FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_reactions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'post_reactions')::regclass
  ) THEN
    ALTER TABLE public."post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_reactions_post_idx ON public.post_reactions USING btree (post_id);

CREATE TABLE IF NOT EXISTS public."post_saves" (
    "id" text NOT NULL,
    "post_id" text NOT NULL,
    "user_id" text NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_saves_pkey' AND conrelid = format('%I.%I', 'public', 'post_saves')::regclass
  ) THEN
    ALTER TABLE public."post_saves" ADD CONSTRAINT "post_saves_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_saves_post_id_social_posts_id_fk' AND conrelid = format('%I.%I', 'public', 'post_saves')::regclass
  ) THEN
    ALTER TABLE public."post_saves" ADD CONSTRAINT "post_saves_post_id_social_posts_id_fk" FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_saves_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'post_saves')::regclass
  ) THEN
    ALTER TABLE public."post_saves" ADD CONSTRAINT "post_saves_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_saves_post_user_idx ON public.post_saves USING btree (post_id, user_id);

CREATE TABLE IF NOT EXISTS public."posts" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "content" text NOT NULL,
    "type" text DEFAULT 'general'::text NOT NULL,
    "image_urls" jsonb DEFAULT '[]'::jsonb,
    "achievement_data" jsonb,
    "study_log_data" jsonb,
    "is_public" boolean DEFAULT true NOT NULL,
    "group_id" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_pkey' AND conrelid = format('%I.%I', 'public', 'posts')::regclass
  ) THEN
    ALTER TABLE public."posts" ADD CONSTRAINT "posts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'posts')::regclass
  ) THEN
    ALTER TABLE public."posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts USING btree (created_at);

CREATE INDEX IF NOT EXISTS posts_user_idx ON public.posts USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."premium_subscriptions" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "activated_at" timestamp without time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp without time zone,
    "coins_cost" integer DEFAULT 9000,
    "benefits" jsonb DEFAULT '["exclusive_pets", "premium_loot_boxes", "premium_themes", "xp_multiplier", "coin_multiplier", "premium_analytics", "profile_badge", "premium_battle_pass"]'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "granted_by_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'premium_subscriptions_pkey' AND conrelid = format('%I.%I', 'public', 'premium_subscriptions')::regclass
  ) THEN
    ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'premium_subscriptions_user_id_unique' AND conrelid = format('%I.%I', 'public', 'premium_subscriptions')::regclass
  ) THEN
    ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'premium_subscriptions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'premium_subscriptions')::regclass
  ) THEN
    ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS premium_subscriptions_user_idx ON public.premium_subscriptions USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."productivity_logs" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "date" text NOT NULL,
    "focus_minutes" integer DEFAULT 0 NOT NULL,
    "sessions_completed" integer DEFAULT 0 NOT NULL,
    "tasks_completed" integer DEFAULT 0 NOT NULL,
    "avg_focus_score" real,
    "productivity_score" real,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productivity_logs_pkey' AND conrelid = format('%I.%I', 'public', 'productivity_logs')::regclass
  ) THEN
    ALTER TABLE public."productivity_logs" ADD CONSTRAINT "productivity_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productivity_logs_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'productivity_logs')::regclass
  ) THEN
    ALTER TABLE public."productivity_logs" ADD CONSTRAINT "productivity_logs_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS productivity_logs_user_date_idx ON public.productivity_logs USING btree (user_id, date);

CREATE TABLE IF NOT EXISTS public."push_subscriptions" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "endpoint" text NOT NULL,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "priority_enabled" boolean DEFAULT false NOT NULL,
    "sound" text DEFAULT 'default'::text NOT NULL,
    "expires_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_pkey' AND conrelid = format('%I.%I', 'public', 'push_subscriptions')::regclass
  ) THEN
    ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'push_subscriptions')::regclass
  ) THEN
    ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS push_sub_user_idx ON public.push_subscriptions USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."quest_definitions" (
    "id" text NOT NULL,
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quest_definitions_pkey' AND conrelid = format('%I.%I', 'public', 'quest_definitions')::regclass
  ) THEN
    ALTER TABLE public."quest_definitions" ADD CONSTRAINT "quest_definitions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."readiness_logs" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "date" text NOT NULL,
    "sleep" integer NOT NULL,
    "stress" integer NOT NULL,
    "energy" integer NOT NULL,
    "score" integer NOT NULL,
    "session_length_rec" integer NOT NULL,
    "hrv" integer,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'readiness_logs_pkey' AND conrelid = format('%I.%I', 'public', 'readiness_logs')::regclass
  ) THEN
    ALTER TABLE public."readiness_logs" ADD CONSTRAINT "readiness_logs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'readiness_logs_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'readiness_logs')::regclass
  ) THEN
    ALTER TABLE public."readiness_logs" ADD CONSTRAINT "readiness_logs_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."roadmaps" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "subject" text NOT NULL,
    "data" jsonb NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmaps_pkey' AND conrelid = format('%I.%I', 'public', 'roadmaps')::regclass
  ) THEN
    ALTER TABLE public."roadmaps" ADD CONSTRAINT "roadmaps_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmaps_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'roadmaps')::regclass
  ) THEN
    ALTER TABLE public."roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."seasonal_events" (
    "id" text NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "description" text NOT NULL,
    "theme" text NOT NULL,
    "banner_color" text DEFAULT '#7C3AED'::text NOT NULL,
    "start_date" timestamp without time zone NOT NULL,
    "end_date" timestamp without time zone NOT NULL,
    "xp_multiplier" real DEFAULT 1 NOT NULL,
    "coin_multiplier" real DEFAULT 1 NOT NULL,
    "special_missions" jsonb DEFAULT '[]'::jsonb,
    "exclusive_rewards" jsonb DEFAULT '[]'::jsonb,
    "premium_only" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seasonal_events_pkey' AND conrelid = format('%I.%I', 'public', 'seasonal_events')::regclass
  ) THEN
    ALTER TABLE public."seasonal_events" ADD CONSTRAINT "seasonal_events_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seasonal_events_slug_unique' AND conrelid = format('%I.%I', 'public', 'seasonal_events')::regclass
  ) THEN
    ALTER TABLE public."seasonal_events" ADD CONSTRAINT "seasonal_events_slug_unique" UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS seasonal_events_slug_idx ON public.seasonal_events USING btree (slug);

CREATE TABLE IF NOT EXISTS public."session_ghosts" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "task_category" text DEFAULT 'General'::text NOT NULL,
    "best_duration_sec" integer DEFAULT 0 NOT NULL,
    "best_unbroken_sec" integer DEFAULT 0 NOT NULL,
    "session_id" text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_ghosts_pkey' AND conrelid = format('%I.%I', 'public', 'session_ghosts')::regclass
  ) THEN
    ALTER TABLE public."session_ghosts" ADD CONSTRAINT "session_ghosts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_ghosts_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'session_ghosts')::regclass
  ) THEN
    ALTER TABLE public."session_ghosts" ADD CONSTRAINT "session_ghosts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."shared_goals" (
    "id" text NOT NULL,
    "group_id" text,
    "creator_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "target_value" integer NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "deadline" timestamp without time zone,
    "status" text DEFAULT 'active'::text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_goals_pkey' AND conrelid = format('%I.%I', 'public', 'shared_goals')::regclass
  ) THEN
    ALTER TABLE public."shared_goals" ADD CONSTRAINT "shared_goals_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_goals_creator_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'shared_goals')::regclass
  ) THEN
    ALTER TABLE public."shared_goals" ADD CONSTRAINT "shared_goals_creator_id_users_id_fk" FOREIGN KEY (creator_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS shared_goals_group_idx ON public.shared_goals USING btree (group_id);

CREATE TABLE IF NOT EXISTS public."site_settings" (
    "id" text NOT NULL,
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
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_pkey' AND conrelid = format('%I.%I', 'public', 'site_settings')::regclass
  ) THEN
    ALTER TABLE public."site_settings" ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."study_buddies" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "buddy_id" text NOT NULL,
    "status" text DEFAULT 'active'::text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_buddies_pkey' AND conrelid = format('%I.%I', 'public', 'study_buddies')::regclass
  ) THEN
    ALTER TABLE public."study_buddies" ADD CONSTRAINT "study_buddies_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_buddies_buddy_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_buddies')::regclass
  ) THEN
    ALTER TABLE public."study_buddies" ADD CONSTRAINT "study_buddies_buddy_id_users_id_fk" FOREIGN KEY (buddy_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_buddies_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_buddies')::regclass
  ) THEN
    ALTER TABLE public."study_buddies" ADD CONSTRAINT "study_buddies_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS study_buddies_user_buddy_idx ON public.study_buddies USING btree (user_id, buddy_id);

CREATE TABLE IF NOT EXISTS public."study_rooms" (
    "id" text NOT NULL,
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
    "scheduled_for" timestamp without time zone,
    "ended_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_rooms_pkey' AND conrelid = format('%I.%I', 'public', 'study_rooms')::regclass
  ) THEN
    ALTER TABLE public."study_rooms" ADD CONSTRAINT "study_rooms_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_rooms_group_id_study_groups_id_fk' AND conrelid = format('%I.%I', 'public', 'study_rooms')::regclass
  ) THEN
    ALTER TABLE public."study_rooms" ADD CONSTRAINT "study_rooms_group_id_study_groups_id_fk" FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_rooms_host_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_rooms')::regclass
  ) THEN
    ALTER TABLE public."study_rooms" ADD CONSTRAINT "study_rooms_host_id_users_id_fk" FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS study_rooms_host_idx ON public.study_rooms USING btree (host_id);

CREATE INDEX IF NOT EXISTS study_rooms_status_idx ON public.study_rooms USING btree (status);

CREATE TABLE IF NOT EXISTS public."study_room_members" (
    "id" text NOT NULL,
    "room_id" text NOT NULL,
    "user_id" text NOT NULL,
    "joined_at" timestamp without time zone DEFAULT now() NOT NULL,
    "left_at" timestamp without time zone,
    "focus_minutes" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'active'::text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_room_members_pkey' AND conrelid = format('%I.%I', 'public', 'study_room_members')::regclass
  ) THEN
    ALTER TABLE public."study_room_members" ADD CONSTRAINT "study_room_members_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_room_members_room_id_study_rooms_id_fk' AND conrelid = format('%I.%I', 'public', 'study_room_members')::regclass
  ) THEN
    ALTER TABLE public."study_room_members" ADD CONSTRAINT "study_room_members_room_id_study_rooms_id_fk" FOREIGN KEY (room_id) REFERENCES study_rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_room_members_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_room_members')::regclass
  ) THEN
    ALTER TABLE public."study_room_members" ADD CONSTRAINT "study_room_members_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS study_room_members_room_idx ON public.study_room_members USING btree (room_id);

CREATE TABLE IF NOT EXISTS public."study_streaks" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "last_study_date" text,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_streaks_pkey' AND conrelid = format('%I.%I', 'public', 'study_streaks')::regclass
  ) THEN
    ALTER TABLE public."study_streaks" ADD CONSTRAINT "study_streaks_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_streaks_user_id_unique' AND conrelid = format('%I.%I', 'public', 'study_streaks')::regclass
  ) THEN
    ALTER TABLE public."study_streaks" ADD CONSTRAINT "study_streaks_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_streaks_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'study_streaks')::regclass
  ) THEN
    ALTER TABLE public."study_streaks" ADD CONSTRAINT "study_streaks_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."tasks" (
    "id" text NOT NULL,
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
    "completed_at" timestamp without time zone,
    "status" text DEFAULT 'active'::text,
    "missed_at" timestamp without time zone,
    "miss_count" integer DEFAULT 0,
    "archived_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_pkey' AND conrelid = format('%I.%I', 'public', 'tasks')::regclass
  ) THEN
    ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'tasks')::regclass
  ) THEN
    ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."user_badges" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "badge_id" text NOT NULL,
    "unlocked_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_badges_pkey' AND conrelid = format('%I.%I', 'public', 'user_badges')::regclass
  ) THEN
    ALTER TABLE public."user_badges" ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_badges_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_badges')::regclass
  ) THEN
    ALTER TABLE public."user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."user_battle_pass_progress" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "battle_pass_id" text NOT NULL,
    "current_xp" integer DEFAULT 0 NOT NULL,
    "current_tier" integer DEFAULT 0 NOT NULL,
    "claimed_rewards" jsonb DEFAULT '[]'::jsonb,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_battle_pass_progress_pkey' AND conrelid = format('%I.%I', 'public', 'user_battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_battle_pass_progress_battle_pass_id_battle_passes_id_fk' AND conrelid = format('%I.%I', 'public', 'user_battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_battle_pass_id_battle_passes_id_fk" FOREIGN KEY (battle_pass_id) REFERENCES battle_passes(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_battle_pass_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_battle_pass_progress')::regclass
  ) THEN
    ALTER TABLE public."user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_battle_pass_user_pass_idx ON public.user_battle_pass_progress USING btree (user_id, battle_pass_id);

CREATE TABLE IF NOT EXISTS public."user_dreams" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "dream_type" text DEFAULT 'custom'::text NOT NULL,
    "custom_goal" text,
    "target_date" text,
    "daily_target_minutes" integer DEFAULT 120,
    "total_minutes_logged" integer DEFAULT 0,
    "start_date" text,
    "emoji" text DEFAULT '🎯'::text,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_dreams_pkey' AND conrelid = format('%I.%I', 'public', 'user_dreams')::regclass
  ) THEN
    ALTER TABLE public."user_dreams" ADD CONSTRAINT "user_dreams_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_dreams_user_id_unique' AND conrelid = format('%I.%I', 'public', 'user_dreams')::regclass
  ) THEN
    ALTER TABLE public."user_dreams" ADD CONSTRAINT "user_dreams_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_dreams_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_dreams')::regclass
  ) THEN
    ALTER TABLE public."user_dreams" ADD CONSTRAINT "user_dreams_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."user_emotes" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "emote_id" text NOT NULL,
    "equipped" boolean DEFAULT false NOT NULL,
    "unlocked_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_emotes_pkey' AND conrelid = format('%I.%I', 'public', 'user_emotes')::regclass
  ) THEN
    ALTER TABLE public."user_emotes" ADD CONSTRAINT "user_emotes_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_emotes_user_emote_unique' AND conrelid = format('%I.%I', 'public', 'user_emotes')::regclass
  ) THEN
    ALTER TABLE public."user_emotes" ADD CONSTRAINT "user_emotes_user_emote_unique" UNIQUE (user_id, emote_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_emotes_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_emotes')::regclass
  ) THEN
    ALTER TABLE public."user_emotes" ADD CONSTRAINT "user_emotes_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_emotes_user_idx ON public.user_emotes USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."user_inventory" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "item_id" text NOT NULL,
    "acquired_at" timestamp without time zone DEFAULT now() NOT NULL,
    "equipped" boolean DEFAULT false NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_inventory_pkey' AND conrelid = format('%I.%I', 'public', 'user_inventory')::regclass
  ) THEN
    ALTER TABLE public."user_inventory" ADD CONSTRAINT "user_inventory_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_inventory_item_id_marketplace_items_id_fk' AND conrelid = format('%I.%I', 'public', 'user_inventory')::regclass
  ) THEN
    ALTER TABLE public."user_inventory" ADD CONSTRAINT "user_inventory_item_id_marketplace_items_id_fk" FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_inventory_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_inventory')::regclass
  ) THEN
    ALTER TABLE public."user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON public.user_inventory USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_inventory_user_item_unique ON public.user_inventory USING btree (user_id, item_id);

CREATE TABLE IF NOT EXISTS public."user_loot_boxes" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "box_type_id" text NOT NULL,
    "status" text DEFAULT 'unopened'::text NOT NULL,
    "reward_type" text,
    "reward_value" jsonb,
    "earned_reason" text,
    "opened_at" timestamp without time zone,
    "earned_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_loot_boxes_pkey' AND conrelid = format('%I.%I', 'public', 'user_loot_boxes')::regclass
  ) THEN
    ALTER TABLE public."user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_loot_boxes_box_type_id_loot_box_types_id_fk' AND conrelid = format('%I.%I', 'public', 'user_loot_boxes')::regclass
  ) THEN
    ALTER TABLE public."user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_box_type_id_loot_box_types_id_fk" FOREIGN KEY (box_type_id) REFERENCES loot_box_types(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_loot_boxes_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_loot_boxes')::regclass
  ) THEN
    ALTER TABLE public."user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_loot_boxes_user_idx ON public.user_loot_boxes USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."user_mission_progress" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "mission_key" text NOT NULL,
    "period_start" text NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp without time zone,
    "reward_claimed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_mission_progress_pkey' AND conrelid = format('%I.%I', 'public', 'user_mission_progress')::regclass
  ) THEN
    ALTER TABLE public."user_mission_progress" ADD CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_mission_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_mission_progress')::regclass
  ) THEN
    ALTER TABLE public."user_mission_progress" ADD CONSTRAINT "user_mission_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS mission_progress_user_period_idx ON public.user_mission_progress USING btree (user_id, period_start);

CREATE TABLE IF NOT EXISTS public."user_pets" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "pet_type" text DEFAULT 'owl'::text NOT NULL,
    "pet_name" text,
    "pet_level" integer DEFAULT 1 NOT NULL,
    "pet_xp" integer DEFAULT 0 NOT NULL,
    "evolution_stage" integer DEFAULT 1 NOT NULL,
    "mood" text DEFAULT 'happy'::text,
    "accessories" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_pets_pkey' AND conrelid = format('%I.%I', 'public', 'user_pets')::regclass
  ) THEN
    ALTER TABLE public."user_pets" ADD CONSTRAINT "user_pets_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_pets_user_id_unique' AND conrelid = format('%I.%I', 'public', 'user_pets')::regclass
  ) THEN
    ALTER TABLE public."user_pets" ADD CONSTRAINT "user_pets_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_pets_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_pets')::regclass
  ) THEN
    ALTER TABLE public."user_pets" ADD CONSTRAINT "user_pets_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."user_profile_extras" (
    "id" text NOT NULL,
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
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profile_extras_pkey' AND conrelid = format('%I.%I', 'public', 'user_profile_extras')::regclass
  ) THEN
    ALTER TABLE public."user_profile_extras" ADD CONSTRAINT "user_profile_extras_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profile_extras_user_id_unique' AND conrelid = format('%I.%I', 'public', 'user_profile_extras')::regclass
  ) THEN
    ALTER TABLE public."user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profile_extras_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_profile_extras')::regclass
  ) THEN
    ALTER TABLE public."user_profile_extras" ADD CONSTRAINT "user_profile_extras_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."user_quest_progress" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "quest_id" text NOT NULL,
    "period" text NOT NULL,
    "current" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "claimed_at" timestamp without time zone,
    "assigned_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_quest_progress_pkey' AND conrelid = format('%I.%I', 'public', 'user_quest_progress')::regclass
  ) THEN
    ALTER TABLE public."user_quest_progress" ADD CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_quest_progress_unique' AND conrelid = format('%I.%I', 'public', 'user_quest_progress')::regclass
  ) THEN
    ALTER TABLE public."user_quest_progress" ADD CONSTRAINT "user_quest_progress_unique" UNIQUE (user_id, quest_id, period);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_quest_progress_quest_id_quest_definitions_id_fk' AND conrelid = format('%I.%I', 'public', 'user_quest_progress')::regclass
  ) THEN
    ALTER TABLE public."user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_quest_definitions_id_fk" FOREIGN KEY (quest_id) REFERENCES quest_definitions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_quest_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_quest_progress')::regclass
  ) THEN
    ALTER TABLE public."user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_quest_progress_user_idx ON public.user_quest_progress USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."user_seasonal_progress" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "event_id" text NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "completed_missions" jsonb DEFAULT '[]'::jsonb,
    "rewards_claimed" jsonb DEFAULT '[]'::jsonb,
    "rank" integer
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_seasonal_progress_pkey' AND conrelid = format('%I.%I', 'public', 'user_seasonal_progress')::regclass
  ) THEN
    ALTER TABLE public."user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_seasonal_progress_unique' AND conrelid = format('%I.%I', 'public', 'user_seasonal_progress')::regclass
  ) THEN
    ALTER TABLE public."user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_unique" UNIQUE (user_id, event_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_seasonal_progress_event_id_seasonal_events_id_fk' AND conrelid = format('%I.%I', 'public', 'user_seasonal_progress')::regclass
  ) THEN
    ALTER TABLE public."user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_event_id_seasonal_events_id_fk" FOREIGN KEY (event_id) REFERENCES seasonal_events(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_seasonal_progress_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_seasonal_progress')::regclass
  ) THEN
    ALTER TABLE public."user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_seasonal_progress_user_idx ON public.user_seasonal_progress USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."user_wallets" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "coins" integer DEFAULT 0 NOT NULL,
    "total_xp" integer DEFAULT 0 NOT NULL,
    "weekly_xp" integer DEFAULT 0 NOT NULL,
    "weekly_xp_reset_at" timestamp without time zone DEFAULT now(),
    "level" integer DEFAULT 1 NOT NULL,
    "prestige" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_wallets_pkey' AND conrelid = format('%I.%I', 'public', 'user_wallets')::regclass
  ) THEN
    ALTER TABLE public."user_wallets" ADD CONSTRAINT "user_wallets_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_wallets_user_id_unique' AND conrelid = format('%I.%I', 'public', 'user_wallets')::regclass
  ) THEN
    ALTER TABLE public."user_wallets" ADD CONSTRAINT "user_wallets_user_id_unique" UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_wallets_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'user_wallets')::regclass
  ) THEN
    ALTER TABLE public."user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_wallets_total_xp_idx ON public.user_wallets USING btree (total_xp);

CREATE INDEX IF NOT EXISTS user_wallets_weekly_xp_idx ON public.user_wallets USING btree (weekly_xp);

CREATE TABLE IF NOT EXISTS public."visitors" (
    "id" text NOT NULL,
    "visitor_id" text NOT NULL,
    "user_id" text,
    "first_seen" timestamp without time zone DEFAULT now() NOT NULL,
    "last_seen" timestamp without time zone DEFAULT now() NOT NULL,
    "visit_count" integer DEFAULT 0 NOT NULL,
    "device_type" text,
    "browser" text,
    "os" text,
    "country" text,
    "city" text,
    "is_bot" boolean DEFAULT false NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visitors_pkey' AND conrelid = format('%I.%I', 'public', 'visitors')::regclass
  ) THEN
    ALTER TABLE public."visitors" ADD CONSTRAINT "visitors_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visitors_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'visitors')::regclass
  ) THEN
    ALTER TABLE public."visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON public.visitors USING btree (last_seen);

CREATE INDEX IF NOT EXISTS visitors_user_id_idx ON public.visitors USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS visitors_visitor_id_idx ON public.visitors USING btree (visitor_id);

CREATE TABLE IF NOT EXISTS public."wrapped_snapshots" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "period" text NOT NULL,
    "period_type" text DEFAULT 'monthly'::text NOT NULL,
    "data" jsonb NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wrapped_snapshots_pkey' AND conrelid = format('%I.%I', 'public', 'wrapped_snapshots')::regclass
  ) THEN
    ALTER TABLE public."wrapped_snapshots" ADD CONSTRAINT "wrapped_snapshots_pkey" PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wrapped_snapshots_user_id_users_id_fk' AND conrelid = format('%I.%I', 'public', 'wrapped_snapshots')::regclass
  ) THEN
    ALTER TABLE public."wrapped_snapshots" ADD CONSTRAINT "wrapped_snapshots_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wrapped_user_period_idx ON public.wrapped_snapshots USING btree (user_id, period);

-- Verification: expect 93 tables
SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
