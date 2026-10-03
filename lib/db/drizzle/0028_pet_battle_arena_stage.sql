-- §Arena ladder — the cup a battle was fought at.
--
-- The uploads' arena is a ladder of six named cups, each unlocked by clearing
-- the one before it (`ARENA` in their `lib/pets.ts`; ported to
-- `artifacts/focusarx/src/lib/arenaLadder.ts`). This app records every fight in
-- `pet_battles`, and without this column the log could say *that* a battle
-- happened but not *which cup* it was — which is precisely the question an admin
-- asks of the ladder ("is anyone past cup 2?").
--
-- Nullable on purpose: a pick-up fight against a chosen rival is not a cup, and
-- every row written before this migration is one of those. The CHECK mirrors
-- `MAX_ARENA_CUP` in the client ladder and the sanitiser in
-- `api-server/lib/appearanceCatalog.ts`; a stage outside 1–6 would render as a
-- cup label nobody can look up.
--
-- Rollback: lib/db/drizzle/rollback/0028_pet_battle_arena_stage.down.sql
-- Idempotent: the column and the constraint are each guarded, so a re-run is a
-- no-op.

ALTER TABLE "pet_battles" ADD COLUMN IF NOT EXISTS "stage" integer;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pet_battles_stage_known'
  ) THEN
    ALTER TABLE "pet_battles"
      ADD CONSTRAINT "pet_battles_stage_known"
      CHECK ("stage" IS NULL OR ("stage" >= 1 AND "stage" <= 6));
  END IF;
END $$;
