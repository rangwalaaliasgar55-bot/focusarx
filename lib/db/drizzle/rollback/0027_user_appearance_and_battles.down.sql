-- Rollback of 0027_user_appearance_and_battles.
--
-- Both tables are new in 0027 and nothing else references them, so the rollback
-- is a drop. It is destructive by nature — dropping `user_appearance` discards
-- per-account design assignments, and dropping `pet_battles` discards the
-- battle log — which is why the file exists separately and says so: apply this
-- only when the feature is being removed, not to "unstick" a bad row.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pet_battles') THEN
    DROP TABLE "pet_battles";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_appearance') THEN
    DROP TABLE "user_appearance";
  END IF;
END $$;
