-- Rollback of 0025_two_factor_auth: drops the TOTP columns and their guard.
--
-- Dropping the secret columns is deliberately destructive of *credentials
-- only*: accounts keep their passwords and data, and every enrolled user
-- simply signs in with password alone after the rollback. That is the
-- recoverable direction — re-enrolment is a two-minute flow, while a locked
-- account would not be.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_two_factor_enabled_needs_secret";

ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_backup_codes_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_pending_secret_enc";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_secret_enc";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_enabled";
