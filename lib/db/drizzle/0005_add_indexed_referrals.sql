-- Indexed, one-time referral ownership and redemption.
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" text;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "referral_applied_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code");
CREATE INDEX IF NOT EXISTS "users_referred_by_user_id_idx" ON "users" ("referred_by_user_id");

DO $$ BEGIN
  ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_referred_by_user_id_users_id_fk";
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referred_by_user_id_users_id_fk') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk"
      FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
