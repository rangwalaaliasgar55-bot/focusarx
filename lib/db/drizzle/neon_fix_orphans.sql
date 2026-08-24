-- Paste this EXACTLY. Do not let the editor turn names into links.
-- Safe to re-run.

UPDATE "email_logs" AS e
SET "recipient_id" = NULL
WHERE e."recipient_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = e."recipient_id");

UPDATE "visitors" AS v
SET "user_id" = NULL
WHERE v."user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = v."user_id");

UPDATE "audit_logs" AS a
SET "user_id" = NULL
WHERE a."user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = a."user_id");

UPDATE "app_feedback" AS f
SET "user_id" = NULL
WHERE f."user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = f."user_id");
