-- Down: 0017_account_deletion_grace
-- Drops the grace-period column and its index.
--
-- NOTE: dropping this column does NOT undo a scheduled deletion — it forgets
-- that one was requested. Any account pending purge at the time of rollback
-- silently survives with its data intact, which is the safe direction to fail.

DROP INDEX IF EXISTS "users_deletion_requested_at_idx";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "deletion_requested_at";
