-- =============================================================================
-- FocusARX — paste ALL of this into Neon SQL Editor and Run.
-- Fully idempotent: every step skips if it is already applied.
-- Safe to run many times.
-- =============================================================================

-- 1) Column (skip if already there)
ALTER TABLE IF EXISTS public.focus_sessions
  ADD COLUMN IF NOT EXISTS client_nonce text;

-- 2) Delete orphaned child rows (FK parent missing). No-op if none.
DO $$
DECLARE
  fk record;
  deleted_count bigint;
BEGIN
  FOR fk IN
    SELECT
      cns.nspname  AS child_schema,
      cls.relname  AS child_table,
      att.attname  AS child_column,
      pns.nspname  AS parent_schema,
      pcls.relname AS parent_table,
      patt.attname AS parent_column,
      con.conname  AS constraint_name
    FROM pg_constraint con
    JOIN pg_class     cls  ON cls.oid  = con.conrelid
    JOIN pg_namespace cns  ON cns.oid  = cls.relnamespace
    JOIN pg_class     pcls ON pcls.oid = con.confrelid
    JOIN pg_namespace pns  ON pns.oid  = pcls.relnamespace
    JOIN pg_attribute att  ON att.attrelid  = con.conrelid
                           AND att.attnum   = con.conkey[1]
    JOIN pg_attribute patt ON patt.attrelid = con.confrelid
                           AND patt.attnum  = con.confkey[1]
    WHERE con.contype = 'f'
      AND cns.nspname = 'public'
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I t
       WHERE t.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM %I.%I p WHERE p.%I = t.%I)',
      fk.child_schema, fk.child_table, fk.child_column,
      fk.parent_schema, fk.parent_table, fk.parent_column, fk.child_column
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE NOTICE 'deleted % orphaned row(s) from %.% (%)',
        deleted_count, fk.child_schema, fk.child_table, fk.constraint_name;
    END IF;
  END LOOP;
  RAISE NOTICE 'orphan sweep finished (nothing left, or already clean)';
END $$;

-- 3) Dedupe + unique constraint on focus_sessions (user_id, client_nonce)
--    Skips table/column missing, skips if no dupes, skips if constraint exists.
--    NULL client_nonce rows are never deleted (Postgres UNIQUE allows many NULLs).
DO $$
DECLARE
  deleted_count bigint;
BEGIN
  IF to_regclass('public.focus_sessions') IS NULL THEN
    RAISE NOTICE 'skip: table focus_sessions does not exist';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'focus_sessions'
      AND column_name = 'client_nonce'
  ) THEN
    RAISE NOTICE 'skip: column client_nonce does not exist';
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

  -- Old migration 0007 may have a UNIQUE INDEX with this name (not a constraint).
  -- Drop only the index if the table constraint is not there yet.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'focus_sessions_user_nonce_unique'
      AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_user_nonce_unique'
  ) THEN
    DROP INDEX public.focus_sessions_user_nonce_unique;
    RAISE NOTICE 'dropped leftover index focus_sessions_user_nonce_unique';
  ELSE
    RAISE NOTICE 'skip: no leftover index to drop';
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
