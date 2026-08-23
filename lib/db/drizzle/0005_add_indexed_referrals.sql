-- Indexed, one-time referral ownership and redemption.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_applied_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code");
CREATE INDEX IF NOT EXISTS "users_referred_by_user_id_idx" ON "users" ("referred_by_user_id");

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_referred_by_user_id_users_id_fk";
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk"
  FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
