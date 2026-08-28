-- Cleanup orphaned user_quest_progress records where the referenced user does not exist
-- Run this migration before the next drizzle-kit push
-- Idempotent: skips if either table does not exist.

DO $$
BEGIN
  IF to_regclass('public.user_quest_progress') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    DELETE FROM public.user_quest_progress up
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = up.user_id
    );
  END IF;
END $$;
