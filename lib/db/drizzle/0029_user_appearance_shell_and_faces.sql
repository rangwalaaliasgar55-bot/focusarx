-- §Flexible interface — the app frame as an assignable design, and two new faces.
--
-- The user asked for the admin to be able to change *more* than the four things
-- the redesign workstream shipped: "everything ... changing it or layout/face",
-- with "new faces also ... there". Two changes land here.
--
-- 1. `user_appearance.shell` — which frame the whole interface is built in
--    (`sidebar` | `topbar` | `tabs`). This is the entry the uploads hard-code
--    once per ZIP (each of their `App.tsx`/layout files builds a different
--    frame); here it is a per-account value an admin can pin like any other
--    design, so the console can change the *interface*, not just the timer's
--    picture. Default `sidebar` is the frame this app already had, so nothing
--    moves for anyone who never picks — and no backfill is needed, because the
--    column default covers every existing row.
--
-- 2. The timer-face CHECK widens by two: `wave` and `candle`, the faces written
--    for this app in the uploads' own idiom (a tide that sinks, a candle that
--    burns down — their palettes keep returning to water and lantern light).
--    A CHECK narrowed to the fourteen old ids would reject them, and the
--    failure would only show up as a 500 on someone's save.
--
-- Rollback: lib/db/drizzle/rollback/0029_user_appearance_shell_and_faces.down.sql
-- Idempotent: the column is guarded, and each CHECK is dropped and re-added so a
-- re-run converges on the same constraints.

ALTER TABLE "user_appearance" ADD COLUMN IF NOT EXISTS "shell" text NOT NULL DEFAULT 'sidebar';--> statement-breakpoint

DO $$
BEGIN
  -- The face list changed, so the old constraint has to go before the new one
  -- can exist under the same name.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_appearance_timer_face_known') THEN
    ALTER TABLE "user_appearance" DROP CONSTRAINT "user_appearance_timer_face_known";
  END IF;
  ALTER TABLE "user_appearance"
    ADD CONSTRAINT "user_appearance_timer_face_known"
    CHECK ("timer_face" IN ('classic', 'neon', 'zen', 'flip', 'segments', 'bars', 'dots', 'rounds', 'aurora', 'orbit', 'hourglass', 'companion', 'garden', 'analog', 'wave', 'candle', 'seven'));

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_appearance_shell_known') THEN
    ALTER TABLE "user_appearance"
      ADD CONSTRAINT "user_appearance_shell_known"
      CHECK ("shell" IN ('sidebar', 'topbar', 'tabs'));
  END IF;
END $$;
