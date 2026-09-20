-- Atomic idempotency ledger for confirmed voice-created tasks and goals.
CREATE TABLE IF NOT EXISTS "voice_capture_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "transcript" text NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_capture_batches_user_key_uidx"
  ON "voice_capture_batches" ("user_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "voice_capture_batches_user_created_idx"
  ON "voice_capture_batches" ("user_id", "created_at");
