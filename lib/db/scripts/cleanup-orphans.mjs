// Deletes orphaned rows that block `drizzle-kit push` from applying schema
// changes (e.g. adding ON DELETE CASCADE to user_quest_progress.user_id).
// Idempotent and safe: only rows that already violate an existing foreign
// key are removed — unreachable garbage data, nothing else.
//
// Instead of targeting a single table, this sweeps EVERY single-column
// foreign key in the public schema, so the next orphaned table cannot
// fail the push either. Verified against PostgreSQL 18.
//
// Mirrors the connection-URL preference of drizzle.config.ts.
import pg from "pg";

const { Client } = pg;

const connectionUrl = process.env.VERCEL
  ? (process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL)
  : (process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING);

if (!connectionUrl) {
  console.error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set",
  );
  process.exit(1);
}

const ORPHAN_SWEEP_SQL = `
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
      RAISE NOTICE 'cleanup-orphans: deleted % orphaned row(s) from %.% (constraint %)',
        deleted_count, fk.child_schema, fk.child_table, fk.constraint_name;
    END IF;
  END LOOP;
END $$;
`;

// Null out dangling optional user refs BEFORE adding/validating FKs.
// email_logs.recipient_id is the one that failed Neon (23503).
const NULL_ORPHAN_USER_REFS_SQL = `
DO $$
BEGIN
  IF to_regclass('public.email_logs') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.email_logs e
    SET recipient_id = NULL
    WHERE e.recipient_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = e.recipient_id);
  END IF;
  IF to_regclass('public.visitors') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.visitors v
    SET user_id = NULL
    WHERE v.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v.user_id);
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.audit_logs a
    SET user_id = NULL
    WHERE a.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.user_id);
  END IF;
  IF to_regclass('public.app_feedback') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.app_feedback a
    SET user_id = NULL
    WHERE a.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.user_id);
  END IF;
END $$;
`;

const client = new Client({ connectionString: connectionUrl });

client.on("notice", (msg) => console.log(msg.message));

// drizzle-kit push prompts (and then aborts in CI) when adding a UNIQUE
// constraint to a populated table. Pre-apply it here after a safe dedupe so
// push sees the constraint already present. Multiple NULL client_nonce values
// are allowed by PostgreSQL UNIQUE and are left untouched.
const FOCUS_SESSIONS_NONCE_UNIQUE_SQL = `
DO $$
DECLARE
  deleted_count bigint;
BEGIN
  IF to_regclass('public.focus_sessions') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS client_nonce text;

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
    RAISE NOTICE 'cleanup-orphans: deleted % duplicate focus_sessions (user_id, client_nonce)',
      deleted_count;
  END IF;

  -- Drop the partial unique index from 0007 if it exists under the same name
  -- so we can add the table constraint drizzle-kit expects.
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_user_nonce_unique'
  ) THEN
    ALTER TABLE public.focus_sessions
      ADD CONSTRAINT focus_sessions_user_nonce_unique UNIQUE (user_id, client_nonce);
    RAISE NOTICE 'cleanup-orphans: added focus_sessions_user_nonce_unique';
  END IF;
END $$;
`;

// Refresh-token store (auth rotation + reuse detection). Idempotent create so
// production gets the table on the next deploy without an interactive push;
// constraint names match what drizzle-kit expects to avoid push prompts.
const REFRESH_TOKENS_SQL = `
DO $$
BEGIN
  IF to_regclass('public.refresh_tokens') IS NULL THEN
    CREATE TABLE public.refresh_tokens (
      id text CONSTRAINT refresh_tokens_id_primary PRIMARY KEY,
      user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      family_id text NOT NULL,
      expires_at timestamp NOT NULL,
      revoked_at timestamp,
      replaced_by_token_hash text,
      user_agent text,
      ip text,
      created_at timestamp DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX refresh_tokens_token_hash_unique ON public.refresh_tokens (token_hash);
    CREATE INDEX refresh_tokens_user_idx ON public.refresh_tokens (user_id);
    CREATE INDEX refresh_tokens_family_idx ON public.refresh_tokens (family_id);
    RAISE NOTICE 'cleanup-orphans: created refresh_tokens';
  END IF;
END $$;
`;

const ADD_MISSING_COLUMNS_SQL = `
DO $$
BEGIN
  IF to_regclass('public.social_posts') IS NOT NULL THEN
    ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'approved' NOT NULL;
    ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS moderation_reason text;
  END IF;
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_user_id text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_applied_at timestamp;
  END IF;
  IF to_regclass('public.marketplace_items') IS NOT NULL THEN
    ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS premium_only boolean DEFAULT false NOT NULL;
  END IF;
  IF to_regclass('public.active_sessions') IS NOT NULL THEN
    ALTER TABLE public.active_sessions ADD COLUMN IF NOT EXISTS started_at timestamp DEFAULT now() NOT NULL;
  END IF;
  IF to_regclass('public.focus_cities') IS NOT NULL THEN
    ALTER TABLE public.focus_cities ADD COLUMN IF NOT EXISTS selected_skin text DEFAULT 'classic' NOT NULL;
  END IF;
  IF to_regclass('public.seasonal_events') IS NOT NULL THEN
    ALTER TABLE public.seasonal_events ADD COLUMN IF NOT EXISTS premium_only boolean DEFAULT false NOT NULL;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS priority_enabled boolean DEFAULT false NOT NULL;
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS sound text DEFAULT 'default' NOT NULL;
  END IF;
END $$;
`;

try {
  await client.connect();
  await client.query(NULL_ORPHAN_USER_REFS_SQL);
  await client.query(ORPHAN_SWEEP_SQL);
  await client.query(ADD_MISSING_COLUMNS_SQL);
  await client.query(FOCUS_SESSIONS_NONCE_UNIQUE_SQL);
  await client.query(REFRESH_TOKENS_SQL);
  console.log("cleanup-orphans: sweep complete, schema patches applied");
} catch (err) {
  console.error("cleanup-orphans: failed to clean orphaned rows:", err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
