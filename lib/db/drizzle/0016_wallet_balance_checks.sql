-- Database-level wallet invariants: coins and XP can never be negative.
--
-- Application code is already correct here. Every debit goes through
-- `burnCoins` (lib/coinLedger.ts), which is a compare-and-set —
-- `UPDATE ... WHERE coins >= amount RETURNING coins` — and returns null rather
-- than writing when the balance does not cover the amount. Every credit goes
-- through `mintCoins`. That protects the paths that use those helpers.
--
-- A CHECK constraint protects the paths that do NOT: a raw UPDATE added later,
-- a one-off admin or repair script, a bulk import, or a bug in a helper that
-- has not been written yet. "No known way to go negative" is a property of the
-- code that exists today; "cannot go negative" is a property of the data. This
-- migration buys the second one.
--
-- Repair first, then constrain. A negative balance is by definition corrupt —
-- it can only have arisen from a writer that bypassed the ledger — and
-- flooring it at zero is the only sensible repair, because the alternative is
-- a migration that fails on production and blocks every deploy behind it. The
-- counts are reported by `RAISE NOTICE` so a replay leaves evidence in the log.
--
-- Rollback: lib/db/drizzle/rollback/0016_wallet_balance_checks.down.sql
-- Idempotent: every block guards on pg_constraint, so a re-run is a no-op.

DO $$
DECLARE
  fixed_coins   integer := 0;
  fixed_xp      integer := 0;
  fixed_weekly  integer := 0;
  fixed_level   integer := 0;
  fixed_prestige integer := 0;
BEGIN
  IF to_regclass('public.user_wallets') IS NULL THEN
    RAISE NOTICE 'user_wallets does not exist yet; constraints will come from the base schema';
    RETURN;
  END IF;

  -- Repair, reporting anything found so the cause can be investigated rather
  -- than quietly absorbed.
  UPDATE public.user_wallets SET coins = 0, updated_at = now() WHERE coins < 0;
  GET DIAGNOSTICS fixed_coins = ROW_COUNT;

  UPDATE public.user_wallets SET total_xp = 0, updated_at = now() WHERE total_xp < 0;
  GET DIAGNOSTICS fixed_xp = ROW_COUNT;

  UPDATE public.user_wallets SET weekly_xp = 0, updated_at = now() WHERE weekly_xp < 0;
  GET DIAGNOSTICS fixed_weekly = ROW_COUNT;

  UPDATE public.user_wallets SET level = 1, updated_at = now() WHERE level < 1;
  GET DIAGNOSTICS fixed_level = ROW_COUNT;

  UPDATE public.user_wallets SET prestige = 0, updated_at = now() WHERE prestige < 0;
  GET DIAGNOSTICS fixed_prestige = ROW_COUNT;

  IF fixed_coins + fixed_xp + fixed_weekly + fixed_level + fixed_prestige > 0 THEN
    RAISE WARNING 'repaired wallet rows before adding constraints: coins=%, total_xp=%, weekly_xp=%, level=%, prestige=%',
      fixed_coins, fixed_xp, fixed_weekly, fixed_level, fixed_prestige;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_coins_non_negative') THEN
    ALTER TABLE public.user_wallets ADD CONSTRAINT user_wallets_coins_non_negative CHECK (coins >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_total_xp_non_negative') THEN
    ALTER TABLE public.user_wallets ADD CONSTRAINT user_wallets_total_xp_non_negative CHECK (total_xp >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_weekly_xp_non_negative') THEN
    ALTER TABLE public.user_wallets ADD CONSTRAINT user_wallets_weekly_xp_non_negative CHECK (weekly_xp >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_level_at_least_one') THEN
    ALTER TABLE public.user_wallets ADD CONSTRAINT user_wallets_level_at_least_one CHECK (level >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_wallets'::regclass AND conname = 'user_wallets_prestige_non_negative') THEN
    ALTER TABLE public.user_wallets ADD CONSTRAINT user_wallets_prestige_non_negative CHECK (prestige >= 0);
  END IF;
END $$;
