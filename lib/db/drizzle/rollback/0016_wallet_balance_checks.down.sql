-- Rollback for 0016_wallet_balance_checks.sql.
--
-- Drops the five wallet CHECK constraints and nothing else. It deliberately
-- does NOT restore any values the forward migration floored: a negative balance
-- is corrupt data, not state worth returning to, and the repairs were reported
-- via RAISE WARNING when they happened.
--
-- Idempotent: each drop is guarded, so running this on a database where the
-- constraints were never added (or already rolled back) is a no-op.

DO $$
BEGIN
  IF to_regclass('public.user_wallets') IS NULL THEN
    RAISE NOTICE 'user_wallets does not exist; nothing to roll back';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_coins_non_negative') THEN
    ALTER TABLE public.user_wallets DROP CONSTRAINT user_wallets_coins_non_negative;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_total_xp_non_negative') THEN
    ALTER TABLE public.user_wallets DROP CONSTRAINT user_wallets_total_xp_non_negative;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_weekly_xp_non_negative') THEN
    ALTER TABLE public.user_wallets DROP CONSTRAINT user_wallets_weekly_xp_non_negative;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_level_at_least_one') THEN
    ALTER TABLE public.user_wallets DROP CONSTRAINT user_wallets_level_at_least_one;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_prestige_non_negative') THEN
    ALTER TABLE public.user_wallets DROP CONSTRAINT user_wallets_prestige_non_negative;
  END IF;
END $$;
