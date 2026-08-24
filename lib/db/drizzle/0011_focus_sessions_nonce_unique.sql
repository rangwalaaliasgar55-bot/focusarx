-- Idempotent Neon / Postgres patch.
-- Safe to re-run: already-applied steps are skipped.
-- 1) Add client_nonce if missing
-- 2) Drop extra rows that share (user_id, client_nonce) — keep newest
-- 3) Ensure UNIQUE constraint focus_sessions_user_nonce_unique exists
-- NULL client_nonce values are allowed and are never deleted.

-- 1. Column
ALTER TABLE IF EXISTS public.focus_sessions
  ADD COLUMN IF NOT EXISTS client_nonce text;

-- 2 + 3. Dedupe + constraint
DO $$
DECLARE
  deleted_count bigint;
BEGIN
  IF to_regclass('public.focus_sessions') IS NULL THEN
    RAISE NOTICE 'skip: focus_sessions does not exist';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'focus_sessions'
      AND column_name = 'client_nonce'
  ) THEN
    RAISE NOTICE 'skip: client_nonce column missing';
    RETURN;
  END IF;

  DELETE FROM public.focus_sessions
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id, client_nonce
        ORDER BY created_at DESC NULLS LAST, id DESC
      ) AS rn
      FROM public.focus_sessions
      WHERE client_nonce IS NOT NULL
    ) ranked
    WHERE rn > 1
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    RAISE NOTICE 'deleted % duplicate focus_sessions (user_id, client_nonce)', deleted_count;
  ELSE
    RAISE NOTICE 'skip: no duplicate (user_id, client_nonce) rows';
  END IF;

  -- If 0007 left a partial UNIQUE INDEX with this name (not a table constraint),
  -- drop the index so the constraint drizzle-kit expects can be added.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'focus_sessions_user_nonce_unique'
      AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_user_nonce_unique'
  ) THEN
    DROP INDEX public.focus_sessions_user_nonce_unique;
    RAISE NOTICE 'dropped leftover index focus_sessions_user_nonce_unique';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_user_nonce_unique'
  ) THEN
    RAISE NOTICE 'skip: constraint focus_sessions_user_nonce_unique already exists';
  ELSE
    ALTER TABLE public.focus_sessions
      ADD CONSTRAINT focus_sessions_user_nonce_unique UNIQUE (user_id, client_nonce);
    RAISE NOTICE 'added constraint focus_sessions_user_nonce_unique';
  END IF;
END $$;
