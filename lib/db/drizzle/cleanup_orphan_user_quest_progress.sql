-- Cleanup orphaned user_quest_progress records where the referenced user does not exist
-- Run this migration before the next drizzle-kit push

DELETE FROM public.user_quest_progress up
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = up.user_id
);
