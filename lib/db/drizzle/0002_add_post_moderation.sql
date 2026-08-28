-- Add automated content moderation columns to social_posts.
ALTER TABLE IF EXISTS "social_posts" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
ALTER TABLE IF EXISTS "social_posts" ADD COLUMN IF NOT EXISTS "moderation_reason" text;
CREATE INDEX IF NOT EXISTS "social_posts_moderation_idx" ON "social_posts" USING btree ("moderation_status");
