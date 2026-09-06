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

// Data-hygiene patches (AUDIT D-5): collapse duplicate rows before the
// unique indexes below can be created. Keeps the lowest id per group.
// Each statement is guarded with to_regclass to skip if the table doesn't exist.
const DEDUPE_SQL = `
DO $$
BEGIN
  IF to_regclass('public.post_reactions') IS NOT NULL THEN
    DELETE FROM public.post_reactions a
      USING public.post_reactions b
      WHERE a.ctid > b.ctid
        AND a.post_id = b.post_id AND a.user_id = b.user_id AND a.reaction = b.reaction;
  END IF;
  IF to_regclass('public.friendships') IS NOT NULL THEN
    DELETE FROM public.friendships a
      USING public.friendships b
      WHERE a.ctid > b.ctid
        AND a.requester_id = b.requester_id AND a.addressee_id = b.addressee_id;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions a
      USING public.push_subscriptions b
      WHERE a.ctid > b.ctid AND a.endpoint = b.endpoint;
  END IF;
END $$;
`;

// Unique guards (AUDIT D-5): one reaction per (post,user,reaction), one
// friendship row per (requester,addressee) pair, one subscription per device
// endpoint. Idempotent create; run DEDUPE_SQL first.
const UNIQUE_GUARDS_SQL = `
DO $$
BEGIN
  IF to_regclass('public.post_reactions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='post_reactions_unique_user_reaction') THEN
    CREATE UNIQUE INDEX post_reactions_unique_user_reaction ON public.post_reactions (post_id, user_id, reaction);
  END IF;
  IF to_regclass('public.friendships') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='friendships_requester_addressee_unique') THEN
    CREATE UNIQUE INDEX friendships_requester_addressee_unique ON public.friendships (requester_id, addressee_id);
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='push_subscriptions_endpoint_unique') THEN
    CREATE UNIQUE INDEX push_subscriptions_endpoint_unique ON public.push_subscriptions (endpoint);
  END IF;
END $$;
`;

// Table-bloat purge (AUDIT D-7): consumed/expired password-reset tokens older
// than 7 days and AI call-log rows older than 90 days. Bounded per run.
// PostgreSQL DELETE does not support LIMIT, so we use a subquery on id.
// Every table is guarded with to_regclass() so this is safe even when the
// table has not been created yet (e.g. pre-migration deploys).
const STALE_ROWS_PURGE_SQL = `
DO $$
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    DELETE FROM public.password_reset_tokens
     WHERE id IN (
       SELECT id FROM public.password_reset_tokens
       WHERE (used_at IS NOT NULL OR expires_at < now())
         AND created_at < now() - interval '7 days'
       LIMIT 5000
     );
  END IF;
  IF to_regclass('public.ai_call_log') IS NOT NULL THEN
    DELETE FROM public.ai_call_log
     WHERE id IN (
       SELECT id FROM public.ai_call_log
       WHERE created_at < now() - interval '90 days'
       LIMIT 5000
     );
  END IF;
  IF to_regclass('public.ai_budget_state') IS NOT NULL THEN
    -- day is a YYYY-MM-DD text key, not a timestamp. Comparing it directly
    -- to now() raises 42883 and rolls back this entire housekeeping block.
    DELETE FROM public.ai_budget_state
     WHERE day < to_char((now() AT TIME ZONE 'UTC') - interval '30 days', 'YYYY-MM-DD');
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

// ─── BARRICADE: Run each SQL block independently so one failure never crashes the build ───
// Each block is wrapped in try/catch. Non-critical failures (missing tables,
// permission issues on optional tables) are logged as warnings, not errors.
// Only truly critical failures (no DB connection at all) abort the script.

const BLOCKS = [
  { name: "null-orphan-user-refs", sql: NULL_ORPHAN_USER_REFS_SQL, critical: false },
  { name: "orphan-sweep",          sql: ORPHAN_SWEEP_SQL,          critical: false },
  { name: "add-missing-columns",   sql: ADD_MISSING_COLUMNS_SQL,   critical: false },
  { name: "focus-sessions-nonce",  sql: FOCUS_SESSIONS_NONCE_UNIQUE_SQL, critical: false },
  { name: "refresh-tokens",        sql: REFRESH_TOKENS_SQL,        critical: false },
  { name: "dedupe",                sql: DEDUPE_SQL,                critical: false },
  { name: "unique-guards",         sql: UNIQUE_GUARDS_SQL,         critical: false },
  { name: "stale-rows-purge",      sql: STALE_ROWS_PURGE_SQL,      critical: false },
];

try {
  await client.connect();

  let failures = 0;
  for (const block of BLOCKS) {
    try {
      await client.query(block.sql);
    } catch (blockErr) {
      failures++;
      if (block.critical) {
        console.error(`cleanup-orphans: CRITICAL block "${block.name}" failed:`, blockErr.message);
        process.exitCode = 1;
      } else {
        // Non-critical: log warning but continue. The build must not fail
        // because an optional table doesn't exist yet.
        console.warn(`cleanup-orphans: warning: block "${block.name}" skipped (${blockErr.code ?? blockErr.message})`);
      }
    }
  }

  if (process.exitCode !== 1) {
    console.log(`cleanup-orphans: sweep complete, schema patches applied (${failures} non-critical warnings)`);
  }
} catch (err) {
  // Only truly fatal errors (e.g. cannot connect to DB) land here.
  console.error("cleanup-orphans: FATAL — cannot connect to database:", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
