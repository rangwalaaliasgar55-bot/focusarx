-- Account deletion becomes reversible for 30 days.
--
-- `DELETE /api/auth/account` used to hard-delete the user row in a single
-- transaction: every session, flashcard, pet, wallet entry and achievement
-- cascaded away instantly and there was no way back. That is the correct
-- *eventual* outcome and the wrong *immediate* one. A mis-click, a bad day, a
-- shared device, or an angry five minutes all produced permanent, unrecoverable
-- data loss with no confirmation step beyond a password.
--
-- This migration adds the one column the grace period needs. Deletion now
-- records the request; a purge job (lib/accountDeletion.ts) hard-deletes rows
-- whose request is older than the window. The user can sign back in during the
-- window and cancel.
--
-- The window itself lives in code, not in the schema, so changing it does not
-- require backfilling every row.
--
-- Rollback: lib/db/drizzle/rollback/0017_account_deletion_grace.down.sql
-- Idempotent: the column is added only if absent, so a re-run is a no-op.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp;

-- The purge job scans for old requests; without this it is a sequential scan of
-- the users table on every run. Partial, because the overwhelming majority of
-- rows are NULL and indexing them buys nothing.
CREATE INDEX IF NOT EXISTS "users_deletion_requested_at_idx"
  ON "users" ("deletion_requested_at")
  WHERE "deletion_requested_at" IS NOT NULL;

COMMENT ON COLUMN "users"."deletion_requested_at" IS
  'When the user requested account deletion. NULL means no pending request. Purged after ACCOUNT_DELETION_GRACE_DAYS.';
