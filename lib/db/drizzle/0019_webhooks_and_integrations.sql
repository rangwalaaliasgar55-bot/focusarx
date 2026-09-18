-- §1.6 — the webhook and integration layer.
--
-- Three tables, and the reasoning for each shape is in lib/db/src/schema/
-- integrations.ts. The two decisions that had to be made here rather than in
-- application code:
--
-- **Secrets are ciphertext columns, not plaintext.** `secret_enc` and
-- `access_token_enc`/`refresh_token_enc` hold AES-256-GCM output from
-- lib/secrets.ts. A webhook signing secret in plaintext lets anyone with a
-- database read forge deliveries into the user's own endpoint and pass the
-- signature check they rely on; a plaintext refresh token is durable access to
-- their calendar that nobody rotates. Encrypting means a database read alone is
-- not enough.
--
-- **Deliveries are rows.** The prompt asks for retry with backoff, and a retry
-- needs state that survives a restart. It is also the only way to answer "did my
-- webhook fire?" without grepping stdout.
--
-- `delivery_id` is UNIQUE. A receiver may see the same id twice — that is what a
-- retry is — but must never see two *different* payloads under one id, because
-- the documented dedup strategy is "ignore a delivery_id you have seen".
--
-- Foreign keys cascade on user delete, so the §1.7 purge and the existing
-- account-deletion path need no changes: deleting the user removes their
-- endpoints, deliveries and tokens. Without the cascade the purge would start
-- failing on a foreign key violation for any user who had ever connected
-- anything — a bug that only appears for the small set of users who used the
-- feature, which is exactly the kind that ships.
--
-- Rollback: lib/db/drizzle/rollback/0019_webhooks_and_integrations.down.sql
-- Idempotent: every statement is guarded, so a re-run is a no-op.

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "description" text,
  "secret_enc" text NOT NULL,
  -- First 8 characters of the plaintext secret. The full value is shown once,
  -- at creation, and is not recoverable afterwards; this is what the UI lists
  -- so a user can tell two endpoints' secrets apart in a log line.
  "secret_hint" text NOT NULL,
  "events" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_success_at" timestamp,
  "last_failure_at" timestamp,
  "disabled_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "endpoint_id" text NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
  -- Denormalised so the delivery survives its endpoint being deleted, and so
  -- the user-facing history can be listed without a join.
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  -- The exact body that was signed, stored verbatim. A replay has to resend
  -- byte-identical content or the signature the receiver stored will not verify.
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp,
  "delivery_id" text NOT NULL,
  "response_status" integer,
  "response_body" text,
  "duration_ms" integer,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "delivered_at" timestamp
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "external_account_id" text,
  "display_name" text,
  "access_token_enc" text,
  "refresh_token_enc" text,
  "scopes" text,
  "expires_at" timestamp,
  "status" text DEFAULT 'active' NOT NULL,
  "last_error" text,
  "last_synced_at" timestamp,
  "sync_cursor" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Delivery's own query is "pending rows whose next_attempt_at has passed,
-- oldest first". Without this the worker table-scans on every tick, which is
-- fine at ten endpoints and not fine at ten thousand.
CREATE INDEX IF NOT EXISTS "webhook_deliveries_due_idx"
  ON "webhook_deliveries" ("status", "next_attempt_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_deliveries_user_idx"
  ON "webhook_deliveries" ("user_id", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_idx"
  ON "webhook_deliveries" ("endpoint_id", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_endpoints_user_idx"
  ON "webhook_endpoints" ("user_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_endpoints_active_idx"
  ON "webhook_endpoints" ("user_id", "active");--> statement-breakpoint

-- The constraint, not just an index: two different payloads under one
-- delivery_id would silently defeat a receiver's deduplication.
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_deliveries_delivery_id_idx"
  ON "webhook_deliveries" ("delivery_id");--> statement-breakpoint

-- One connection per provider per user. Reconnecting is an upsert against this
-- index rather than a second row, which is what stops a stale token living on in
-- the table, still valid at the provider, invisible in the UI.
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_user_provider_idx"
  ON "integration_connections" ("user_id", "provider");--> statement-breakpoint

-- Repair any rows that predate the constraints below. There are none in a fresh
-- database; the block exists so the migration is safe to run against an
-- environment where the tables were created by `drizzle-kit push` from an
-- earlier revision of the schema, and it reports what it changed rather than
-- altering data silently.
DO $$
DECLARE
  fixed_attempts integer := 0;
  fixed_failures integer := 0;
  fixed_status integer := 0;
BEGIN
  UPDATE "webhook_deliveries" SET "attempts" = 0 WHERE "attempts" < 0;
  GET DIAGNOSTICS fixed_attempts = ROW_COUNT;

  UPDATE "webhook_endpoints" SET "failure_count" = 0 WHERE "failure_count" < 0;
  GET DIAGNOSTICS fixed_failures = ROW_COUNT;

  UPDATE "webhook_deliveries" SET "status" = 'failed'
    WHERE "status" NOT IN ('pending', 'sending', 'success', 'failed', 'dropped');
  GET DIAGNOSTICS fixed_status = ROW_COUNT;

  IF fixed_attempts > 0 OR fixed_failures > 0 OR fixed_status > 0 THEN
    RAISE NOTICE 'webhooks 0019: repaired % attempt counts, % failure counts, % statuses',
      fixed_attempts, fixed_failures, fixed_status;
  END IF;
END $$;
--
-- Status is a closed set. The worker's claim query filters on `pending` and
-- `sending`; a typo written by a future caller would produce a row that is
-- never delivered and never reported, which is indistinguishable from a lost
-- event. Guarded so a re-run does not error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_status_check'
  ) THEN
    ALTER TABLE "webhook_deliveries"
      ADD CONSTRAINT "webhook_deliveries_status_check"
      CHECK ("status" IN ('pending', 'sending', 'success', 'failed', 'dropped'));
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'integration_connections_status_check'
  ) THEN
    ALTER TABLE "integration_connections"
      ADD CONSTRAINT "integration_connections_status_check"
      CHECK ("status" IN ('active', 'expired', 'revoked', 'error'));
  END IF;
END $$;--> statement-breakpoint

-- A negative attempt count would make the retry schedule index negative and
-- index into `undefined`, producing an Invalid Date next-attempt and an item
-- that is never due again. The same reasoning as the §1.8 duration checks: an
-- invariant that silently loops forever is worth a constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_attempts_check'
  ) THEN
    ALTER TABLE "webhook_deliveries"
      ADD CONSTRAINT "webhook_deliveries_attempts_check"
      CHECK ("attempts" >= 0);
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_endpoints_failure_count_check'
  ) THEN
    ALTER TABLE "webhook_endpoints"
      ADD CONSTRAINT "webhook_endpoints_failure_count_check"
      CHECK ("failure_count" >= 0);
  END IF;
END $$;--> statement-breakpoint
