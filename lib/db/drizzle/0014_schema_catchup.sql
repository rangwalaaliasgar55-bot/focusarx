-- Additive schema catch-up for tables/columns already used by the application.
-- Derived from the canonical Drizzle schema, compared with migrations 0000-0013.
-- Does not drop tables, rewrite existing columns, or delete application data.
-- IF NOT EXISTS also supports databases previously managed with drizzle-kit push.

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

CREATE TABLE IF NOT EXISTS "streak_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"event" text NOT NULL,
	"from_streak" integer DEFAULT 0 NOT NULL,
	"to_streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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

ALTER TABLE "loot_box_types" ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'refresh_tokens'::regclass AND conname = 'refresh_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'streak_history'::regclass AND conname = 'streak_history_user_id_users_id_fk') THEN
    ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'admin_drop_claims'::regclass AND conname = 'admin_drop_claims_drop_id_admin_drops_id_fk') THEN
    ALTER TABLE "admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_drop_id_admin_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."admin_drops"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'admin_drop_claims'::regclass AND conname = 'admin_drop_claims_user_id_users_id_fk') THEN
    ALTER TABLE "admin_drop_claims" ADD CONSTRAINT "admin_drop_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'admin_drops'::regclass AND conname = 'admin_drops_created_by_id_users_id_fk') THEN
    ALTER TABLE "admin_drops" ADD CONSTRAINT "admin_drops_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'admin_sql_log'::regclass AND conname = 'admin_sql_log_admin_id_users_id_fk') THEN
    ALTER TABLE "admin_sql_log" ADD CONSTRAINT "admin_sql_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'ai_action_audit'::regclass AND conname = 'ai_action_audit_approved_by_users_id_fk') THEN
    ALTER TABLE "ai_action_audit" ADD CONSTRAINT "ai_action_audit_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'ai_call_log'::regclass AND conname = 'ai_call_log_user_id_users_id_fk') THEN
    ALTER TABLE "ai_call_log" ADD CONSTRAINT "ai_call_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'bot_pending_replies'::regclass AND conname = 'bot_pending_replies_post_id_social_posts_id_fk') THEN
    ALTER TABLE "bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'bot_pending_replies'::regclass AND conname = 'bot_pending_replies_bot_id_users_id_fk') THEN
    ALTER TABLE "bot_pending_replies" ADD CONSTRAINT "bot_pending_replies_bot_id_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "message_reactions_msg_idx" ON "message_reactions" USING btree ("message_id");

CREATE INDEX IF NOT EXISTS "active_sessions_started_at_idx" ON "active_sessions" USING btree ("started_at");

CREATE INDEX IF NOT EXISTS "focus_sessions_user_started_idx" ON "focus_sessions" USING btree ("user_id","created_at");

CREATE INDEX IF NOT EXISTS "focus_sessions_user_completed_idx" ON "focus_sessions" USING btree ("user_id","completed_at");

CREATE INDEX IF NOT EXISTS "focus_sessions_user_status_idx" ON "focus_sessions" USING btree ("user_id","session_status");

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");

CREATE INDEX IF NOT EXISTS "streak_history_user_idx" ON "streak_history" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "streak_history_user_date_idx" ON "streak_history" USING btree ("user_id","date");

CREATE INDEX IF NOT EXISTS "room_members_room_user_idx" ON "study_room_members" USING btree ("room_id","user_id");

CREATE INDEX IF NOT EXISTS "user_wallets_weekly_xp_idx" ON "user_wallets" USING btree ("weekly_xp");

CREATE INDEX IF NOT EXISTS "user_wallets_total_xp_idx" ON "user_wallets" USING btree ("total_xp");

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
