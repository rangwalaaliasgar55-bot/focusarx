-- Rollback of 0028_pet_battle_arena_stage.
--
-- Drops the cup an old battle was fought at. The constraint goes first: dropping
-- a column takes its constraint with it, but leaving it to chance makes the
-- rollback depend on which Postgres version is running it.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_battles_stage_known') THEN
    ALTER TABLE "pet_battles" DROP CONSTRAINT "pet_battles_stage_known";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pet_battles' AND column_name = 'stage'
  ) THEN
    ALTER TABLE "pet_battles" DROP COLUMN "stage";
  END IF;
END $$;
