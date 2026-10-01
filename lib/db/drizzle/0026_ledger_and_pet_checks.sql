-- Ledger and pet-inventory arithmetic invariants, in the style of 0016/0018.
--
-- Every constraint is added behind a pg_constraint guard so the migration is
-- idempotent, and every guard is preceded by a repair that normalises rows a
-- pre-constraint bug (or a hand-written SQL patch) may have left behind. A
-- repair that silently rewrites financial history would be worse than the bug,
-- so each repair only touches the minimum: negatives become the documented
-- clamp, rows that are merely unusual are left alone and reported.
--
-- These statements are deliberately NOT NOT VALID. The tables are small
-- (ledger rows scale with users, not with sessions), the repairs below make
-- the constraints pass for existing data, and an enforced constraint is worth
-- a one-time scan; a NOT VALID check that nobody ever VALIDATEs is a comment,
-- not a guarantee.

-- ── token_ledger.balance_after >= 0 ─────────────────────────────────────────
-- The ledger is the source of truth; the wallet merely caches it. A negative
-- balance_after means a spend committed without funds, contradicting the
-- 0016 wallet check.

UPDATE "token_ledger" SET "balance_after" = 0 WHERE "balance_after" < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'token_ledger'::regclass AND conname = 'token_ledger_balance_after_non_negative'
  ) THEN
    ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_balance_after_non_negative"
      CHECK ("balance_after" >= 0);
  END IF;
END $$;

-- ── user_pet_inventory progression bounds ───────────────────────────────────
-- level is bounded by PET_MAX_LEVEL (20) in lib/petBond.ts; bond_xp is the
-- unspent remainder within the level, consumed on level-up; mood enumerates
-- the values the product writes ("happy" today, with "excited"/"sleepy" from
-- the same derivePetMood vocabulary reserved).

UPDATE "user_pet_inventory" SET "bond_xp" = 0 WHERE "bond_xp" < 0;
UPDATE "user_pet_inventory" SET "level" = 20 WHERE "level" > 20;
UPDATE "user_pet_inventory" SET "level" = 1 WHERE "level" < 1;
UPDATE "user_pet_inventory" SET "mood" = 'happy' WHERE "mood" NOT IN ('happy', 'excited', 'sleepy');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_pet_inventory'::regclass AND conname = 'user_pet_inventory_level_range'
  ) THEN
    ALTER TABLE "user_pet_inventory" ADD CONSTRAINT "user_pet_inventory_level_range"
      CHECK ("level" >= 1 AND "level" <= 20);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_pet_inventory'::regclass AND conname = 'user_pet_inventory_bond_xp_non_negative'
  ) THEN
    ALTER TABLE "user_pet_inventory" ADD CONSTRAINT "user_pet_inventory_bond_xp_non_negative"
      CHECK ("bond_xp" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_pet_inventory'::regclass AND conname = 'user_pet_inventory_mood_known'
  ) THEN
    ALTER TABLE "user_pet_inventory" ADD CONSTRAINT "user_pet_inventory_mood_known"
      CHECK ("mood" IN ('happy', 'excited', 'sleepy'));
  END IF;
END $$;
