-- Security hardening and performance indexes
-- Adds critical indexes for timer correctness, anti-cheat, and query performance

-- Focus sessions: user + time indexes for history and analytics
CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx
ON focus_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_user_completed_idx
ON focus_sessions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_user_status_idx
ON focus_sessions (user_id, session_status);

-- Active sessions: one active session per user (prevents multiple active sessions)
CREATE UNIQUE INDEX IF NOT EXISTS active_session_per_user_idx
ON active_sessions (user_id);

CREATE INDEX IF NOT EXISTS active_sessions_started_at_idx
ON active_sessions (started_at DESC);

-- Study room members: room + user composite for membership checks
CREATE INDEX IF NOT EXISTS room_members_room_user_idx
ON study_room_members (room_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS study_room_members_room_user_unique
ON study_room_members (room_id, user_id);

-- Audit logs
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);

-- Coin transactions: for economy dashboard and anti-cheat
CREATE INDEX IF NOT EXISTS coin_tx_user_created_idx ON coin_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coin_tx_reason_idx ON coin_transactions (reason);

-- AI budget state: provider + day for budget checks
CREATE UNIQUE INDEX IF NOT EXISTS ai_budget_provider_day_unique ON ai_budget_state (provider, day);

-- AI call logs: user + purpose for per-user daily limits
CREATE INDEX IF NOT EXISTS ai_call_log_user_purpose_idx ON ai_call_log (user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_call_log_provider_day_idx ON ai_call_log (provider, created_at DESC);

-- Password reset tokens: token hash lookup
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx ON password_reset_tokens (expires_at);

-- Productivity logs: user + date for streak and analytics
CREATE INDEX IF NOT EXISTS productivity_logs_user_date_idx ON productivity_logs (user_id, date DESC);

-- Study streaks: already unique on user_id, add last_study_date index
CREATE INDEX IF NOT EXISTS study_streaks_last_date_idx ON study_streaks (last_study_date DESC);

-- User wallets: leaderboard queries
CREATE INDEX IF NOT EXISTS user_wallets_weekly_xp_idx ON user_wallets (weekly_xp DESC);
CREATE INDEX IF NOT EXISTS user_wallets_total_xp_idx ON user_wallets (total_xp DESC);
