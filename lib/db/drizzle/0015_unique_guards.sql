-- Unique guards that exist in the canonical Drizzle schema but were never
-- shipped as a migration (databases managed by `drizzle-kit push` already have
-- them; migrations-only databases did not). Each block dedupes first so the
-- index can always be created, and every statement is idempotent.

-- active_sessions: one row per user (keep the most recently updated).
DO $$
BEGIN
  IF to_regclass('public.active_sessions') IS NOT NULL THEN
    DELETE FROM public.active_sessions a
      USING public.active_sessions b
      WHERE a.user_id = b.user_id
        AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'active_session_per_user_idx')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'active_session_per_user_idx') THEN
      ALTER TABLE public.active_sessions ADD CONSTRAINT active_session_per_user_idx UNIQUE (user_id);
    END IF;
  END IF;
END $$;
--> statement-breakpoint

-- study_room_members: one membership row per (room, user) (keep the newest).
DO $$
BEGIN
  IF to_regclass('public.study_room_members') IS NOT NULL THEN
    DELETE FROM public.study_room_members a
      USING public.study_room_members b
      WHERE a.room_id = b.room_id AND a.user_id = b.user_id
        AND (a.joined_at < b.joined_at OR (a.joined_at = b.joined_at AND a.ctid < b.ctid));
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'study_room_members_room_user_unique')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_room_members_room_user_unique') THEN
      ALTER TABLE public.study_room_members ADD CONSTRAINT study_room_members_room_user_unique UNIQUE (room_id, user_id);
    END IF;
  END IF;
END $$;
--> statement-breakpoint

-- token_ledger / premium_entitlements: migration 0012 named these constraints
-- `*_idempotency_unique`; the schema expects `*_idempotency_key_unique`.
-- Add the canonical name only when neither exists (same column set).
DO $$
BEGIN
  IF to_regclass('public.token_ledger') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('token_ledger_idempotency_key_unique', 'token_ledger_idempotency_unique'))
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'token_ledger_idempotency_key_unique') THEN
    DELETE FROM public.token_ledger a USING public.token_ledger b
      WHERE a.idempotency_key = b.idempotency_key AND a.ctid < b.ctid;
    ALTER TABLE public.token_ledger ADD CONSTRAINT token_ledger_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
  IF to_regclass('public.premium_entitlements') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('premium_entitlements_idempotency_key_unique', 'premium_entitlements_idempotency_unique'))
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'premium_entitlements_idempotency_key_unique') THEN
    DELETE FROM public.premium_entitlements a USING public.premium_entitlements b
      WHERE a.idempotency_key = b.idempotency_key AND a.ctid < b.ctid;
    ALTER TABLE public.premium_entitlements ADD CONSTRAINT premium_entitlements_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;
--> statement-breakpoint

-- Persisted study-room chat (REST-polled; Socket.IO is unavailable on the
-- serverless deployment). Additive only.
CREATE TABLE IF NOT EXISTS "study_room_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text,
	"kind" text DEFAULT 'chat' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_room_messages_room_id_study_rooms_id_fk') THEN
    ALTER TABLE "study_room_messages" ADD CONSTRAINT "study_room_messages_room_id_study_rooms_id_fk"
      FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_room_messages_user_id_users_id_fk') THEN
    ALTER TABLE "study_room_messages" ADD CONSTRAINT "study_room_messages_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_room_messages_room_created_idx" ON "study_room_messages" USING btree ("room_id","created_at");
--> statement-breakpoint
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "topic" text;
--> statement-breakpoint
ALTER TABLE "study_rooms" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp DEFAULT now();
