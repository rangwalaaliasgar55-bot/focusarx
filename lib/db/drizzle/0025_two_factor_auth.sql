-- TOTP two-factor authentication (§1.2).
--
-- Four columns on users. Secrets are AES-256-GCM ciphertexts produced by
-- lib/secrets.ts (format: v1.<iv>.<tag>.<ciphertext>), never plaintexts:
-- a TOTP secret is a bearer credential, so a database dump alone must not
-- yield working codes.
--
-- The live/pending split makes enrolment two-phase. A secret only moves to
-- the live column after the user has verified a code generated from it, so
-- an abandoned enrolment can never leave the account gated by a factor the
-- user never confirmed.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_secret_enc" text;
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_pending_secret_enc" text;
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_backup_codes_hash" text;

-- An enabled factor without a live secret is unreachable state (sign-in would
-- demand a code no secret can produce). The default-add ordering above sets
-- enabled=false for existing rows; this guard keeps future writers honest.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_two_factor_enabled_needs_secret'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_two_factor_enabled_needs_secret"
      CHECK ("two_factor_enabled" = false OR "two_factor_secret_enc" IS NOT NULL);
  END IF;
END $$;
