-- Rollback of 0026_ledger_and_pet_checks: removes the arithmetic guards.
--
-- Historical data made compliant by the 0026 repairs stays as it was
-- repaired — the clamped values are kept (a rollback does not un-fix rows),
-- only the enforcement disappears.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public"."token_ledger"'::regclass AND conname = 'token_ledger_balance_after_non_negative'
  ) THEN
    ALTER TABLE "token_ledger" DROP CONSTRAINT "token_ledger_balance_after_non_negative";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public"."user_pet_inventory"'::regclass AND conname = 'user_pet_inventory_level_range'
  ) THEN
    ALTER TABLE "user_pet_inventory" DROP CONSTRAINT "user_pet_inventory_level_range";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public"."user_pet_inventory"'::regclass AND conname = 'user_pet_inventory_bond_xp_non_negative'
  ) THEN
    ALTER TABLE "user_pet_inventory" DROP CONSTRAINT "user_pet_inventory_bond_xp_non_negative";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public"."user_pet_inventory"'::regclass AND conname = 'user_pet_inventory_mood_known'
  ) THEN
    ALTER TABLE "user_pet_inventory" DROP CONSTRAINT "user_pet_inventory_mood_known";
  END IF;
END $$;
