-- Security hardening and performance indexes
-- Adds critical indexes for timer correctness, anti-cheat, and query performance
-- Fully idempotent: every statement uses IF NOT EXISTS and skips if already present.

-- Focus sessions: user + time indexes for history and analytics
CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx
ON focus_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_user_completed_idx
ON focus_sessions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_user_status_idx
ON focus_sessions (user_id, session_status);

-- Active sessions: one active session per user (prevents multiple active sessions)
-- Wrapped in DO block because the unique constraint may already exist as a
-- table-level constraint from the Drizzle schema, which makes CREATE UNIQUE
-- INDEX fail with "relation already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='active_session_per_user_idx'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'active_session_per_user_idx'
  ) THEN
    CREATE UNIQUE INDEX active_session_per_user_idx ON active_sessions (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS active_sessions_started_at_idx
ON active_sessions (started_at DESC);

-- Study room members: room + user composite for membership checks
CREATE INDEX IF NOT EXISTS room_members_room_user_idx
ON study_room_members (room_id, user_id);

-- Skip if unique constraint already exists as table-level constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='study_room_members_room_user_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_room_members_room_user_unique'
  ) THEN
    CREATE UNIQUE INDEX study_room_members_room_user_unique
    ON study_room_members (room_id, user_id);
  END IF;
END $$;

-- Audit logs (skip if tables don't exist)
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id);
    CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
  END IF;

  IF to_regclass('public.coin_transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS coin_tx_user_created_idx ON coin_transactions (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS coin_tx_reason_idx ON coin_transactions (reason);
  END IF;

  IF to_regclass('public.ai_budget_state') IS NOT NULL THEN
    -- Skip if unique constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ai_budget_provider_day_unique'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_budget_state_provider_day_unique'
    ) THEN
      CREATE UNIQUE INDEX ai_budget_provider_day_unique ON ai_budget_state (provider, day);
    END IF;
  END IF;

  IF to_regclass('public.ai_call_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS ai_call_log_user_purpose_idx ON ai_call_log (user_id, purpose, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_call_log_provider_day_idx ON ai_call_log (provider, created_at DESC);
  END IF;

  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
    CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx ON password_reset_tokens (expires_at);
  END IF;

  IF to_regclass('public.productivity_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS productivity_logs_user_date_idx ON productivity_logs (user_id, date DESC);
  END IF;

  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS study_streaks_last_date_idx ON study_streaks (last_study_date DESC);
  END IF;

  IF to_regclass('public.user_wallets') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS user_wallets_weekly_xp_idx ON user_wallets (weekly_xp DESC);
    CREATE INDEX IF NOT EXISTS user_wallets_total_xp_idx ON user_wallets (total_xp DESC);
  END IF;
END $$;
