-- ============================================================
-- FOCUSARX — NEON DB FULL HEALTH CHECK & RECOVERY SQL
-- Run this in your Neon SQL Editor to verify every table.
-- ============================================================

-- 1. LIST ALL TABLES (should show 78 tables)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================
-- 2. VERIFY THE 3 PREVIOUSLY-REPORTED MISSING OBJECTS
-- ============================================================

-- 2a. Check email_logs table exists and has correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'email_logs'
ORDER BY ordinal_position;

-- 2b. Check premium_subscriptions table exists and has correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'premium_subscriptions'
ORDER BY ordinal_position;

-- 2c. Check conversation_participants.is_admin column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- ============================================================
-- 3. FULL TABLE ROW COUNTS (all 78 tables)
-- ============================================================
SELECT
  t.table_name,
  (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name) AS approx_row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
ORDER BY t.table_name;

-- ============================================================
-- 4. MISSING TABLE SAFETY NET — CREATE IF NOT EXISTS
-- Run these only if the SELECT above shows any missing tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON email_logs(recipient_id);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON email_logs(created_at);

CREATE TABLE IF NOT EXISTS premium_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,
  coins_cost INTEGER DEFAULT 9000,
  benefits JSONB DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS premium_subscriptions_user_idx ON premium_subscriptions(user_id);

-- Add is_admin column to conversation_participants if missing
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS coin_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON coin_transactions(user_id);

-- ============================================================
-- 5. INDEX HEALTH CHECK — verify critical indexes exist
-- ============================================================
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'email_logs', 'premium_subscriptions', 'coin_transactions',
    'conversation_participants', 'focus_sessions', 'notifications',
    'tasks', 'user_wallets', 'habits', 'habit_completions'
  )
ORDER BY tablename, indexname;

-- ============================================================
-- 6. FOREIGN KEY HEALTH CHECK
-- ============================================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================
-- 7. USERS TABLE HEALTH
-- ============================================================
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE is_guest = false) AS real_users,
  COUNT(*) FILTER (WHERE is_guest = true) AS guest_users,
  COUNT(*) FILTER (WHERE role = 'admin') AS admins,
  COUNT(*) FILTER (WHERE onboarding_completed = true) AS onboarded
FROM users;

-- ============================================================
-- 8. PREMIUM SUBSCRIPTIONS STATUS
-- ============================================================
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_active = true) AS active,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired,
  COUNT(*) FILTER (WHERE granted_by_admin = true) AS admin_granted
FROM premium_subscriptions;

-- ============================================================
-- 9. EMAIL LOGS STATUS
-- ============================================================
SELECT
  status,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE bounced = true) AS bounced
FROM email_logs
GROUP BY status;

-- ============================================================
-- 10. RECENT ERRORS — last 20 failed email sends
-- ============================================================
SELECT
  id, recipient_email, template, status, error, created_at
FROM email_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

