ALTER TABLE "active_sessions"
  ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;
