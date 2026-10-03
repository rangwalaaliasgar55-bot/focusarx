-- Rollback of 0029_user_appearance_shell_and_faces.
--
-- Drops the assignable app frame and narrows the face list back to the fourteen
-- ids 0028 shipped. The narrow list is restored before the column goes, because
-- a row holding `wave`/`candle` cannot satisfy the old CHECK and the constraint
-- would refuse to be added — the rollback would fail on exactly the data it is
-- meant to clean up.
--
-- Anything pinned to a `wave`/`candle`/`seven` face is moved to `classic` first: the id
-- is about to stop being legal, and a fallback to the default is what
-- `coerceAppearance` would do on the client anyway.

UPDATE "user_appearance" SET "timer_face" = 'classic' WHERE "timer_face" IN ('wave', 'candle', 'seven');--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_appearance_timer_face_known') THEN
    ALTER TABLE "user_appearance" DROP CONSTRAINT "user_appearance_timer_face_known";
  END IF;
  ALTER TABLE "user_appearance"
    ADD CONSTRAINT "user_appearance_timer_face_known"
    CHECK ("timer_face" IN ('classic', 'neon', 'zen', 'flip', 'segments', 'bars', 'dots', 'rounds', 'aurora', 'orbit', 'hourglass', 'companion', 'garden', 'analog'));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_appearance_shell_known') THEN
    ALTER TABLE "user_appearance" DROP CONSTRAINT "user_appearance_shell_known";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_appearance' AND column_name = 'shell'
  ) THEN
    ALTER TABLE "user_appearance" DROP COLUMN "shell";
  END IF;
END $$;
