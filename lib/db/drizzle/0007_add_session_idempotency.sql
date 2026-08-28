ALTER TABLE IF EXISTS "focus_sessions" ADD COLUMN IF NOT EXISTS "client_nonce" text;
CREATE UNIQUE INDEX IF NOT EXISTS "focus_sessions_user_nonce_unique"
  ON "focus_sessions" ("user_id", "client_nonce")
  WHERE "client_nonce" IS NOT NULL;
