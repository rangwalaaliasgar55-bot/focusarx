-- ============================================================
-- FOCUSARX — PRODUCTION DB HEALTH CHECK (READ-ONLY)
--
-- Paste into your Supabase / Neon SQL Editor and run.
-- Every block is a pure SELECT — it changes nothing.
--
-- If any check fails, apply the canonical repair script:
--   focusarx_prod_migration.sql  (repo root, fully idempotent)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLE COUNT — expect exactly 82 tables in public
-- ────────────────────────────────────────────────────────────
SELECT count(*) AS table_count, 82 AS expected
FROM information_schema.tables
WHERE table_schema = 'public';

-- ────────────────────────────────────────────────────────────
-- 2. MISSING TABLE CHECK — expect 0 rows returned
-- ────────────────────────────────────────────────────────────
WITH expected(t) AS (VALUES
  ('active_sessions'), ('analytics_events'), ('analytics_sessions'),
  ('app_feedback'), ('audit_logs'), ('battle_passes'),
  ('battle_pass_progress'), ('battle_pass_rewards'), ('break_free_moods'),
  ('break_free_pledges'), ('break_free_streaks'), ('buddy_requests'),
  ('city_building_definitions'), ('coin_transactions'),
  ('consequence_contracts'), ('conversation_participants'),
  ('conversations'), ('distraction_logs'), ('email_logs'),
  ('flashcard_decks'), ('flashcards'), ('focus_cities'), ('focus_dna'),
  ('focus_profiles'), ('focus_sessions'), ('follows'), ('freeze_tokens'),
  ('friendships'), ('goals'), ('group_audit_logs'),
  ('group_challenge_progress'), ('group_challenges'), ('group_invitations'),
  ('group_members'), ('habit_completions'), ('habits'),
  ('leaderboard_snapshots'), ('login_rewards'), ('loot_box_types'),
  ('marketplace_items'), ('message_reactions'), ('messages'), ('missions'),
  ('notifications'), ('page_views'), ('password_reset_tokens'),
  ('post_comments'), ('post_likes'), ('post_reactions'), ('post_saves'),
  ('posts'), ('premium_subscriptions'), ('productivity_logs'),
  ('push_subscriptions'), ('quest_definitions'), ('readiness_logs'),
  ('roadmaps'), ('seasonal_events'), ('session_ghosts'), ('shared_goals'),
  ('site_settings'), ('social_posts'), ('study_buddies'), ('study_groups'),
  ('study_room_members'), ('study_rooms'), ('study_streaks'),
  ('tasks'), ('user_badges'), ('user_battle_pass_progress'),
  ('user_dreams'), ('user_inventory'), ('user_loot_boxes'),
  ('user_mission_progress'), ('user_pets'), ('user_profile_extras'),
  ('user_quest_progress'), ('user_seasonal_progress'), ('user_wallets'),
  ('users'), ('visitors'), ('wrapped_snapshots')
)
SELECT t AS missing_table
FROM expected
WHERE t NOT IN (
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
);

-- ────────────────────────────────────────────────────────────
-- 3. PREVIOUS DRIFT POINTS — verify the columns/tables that were
--    missing in production are present now (expect 1 row each = true)
-- ────────────────────────────────────────────────────────────
SELECT 'social_posts.moderation_status' AS check, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_posts' AND column_name='moderation_status'
) AS ok
UNION ALL
SELECT 'social_posts.moderation_reason', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='social_posts' AND column_name='moderation_reason'
)
UNION ALL
SELECT 'tasks.order', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tasks' AND column_name='order'
)
UNION ALL
SELECT 'site_settings table', EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='site_settings'
)
UNION ALL
SELECT 'flashcard_decks table', EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='flashcard_decks'
)
UNION ALL
SELECT 'flashcards table', EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='flashcards'
);

-- ────────────────────────────────────────────────────────────
-- 4. PHANTOM COLUMN CHECK — these were invented by a stale copy of
--    the schema and must NOT exist (expect 0 rows)
-- ────────────────────────────────────────────────────────────
SELECT table_name, column_name AS unexpected_column
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_pets'
  AND column_name IN ('last_fed_at', 'happiness');

-- ────────────────────────────────────────────────────────────
-- 5. SEED DATA COUNTS — expect: missions 22, quests 7, buildings 12,
--    loot_box_types 45, marketplace_items >= 19, site_settings row 'default'
-- ────────────────────────────────────────────────────────────
SELECT 'missions' AS table_name, count(*) FROM missions
UNION ALL SELECT 'quest_definitions', count(*) FROM quest_definitions
UNION ALL SELECT 'city_building_definitions', count(*) FROM city_building_definitions
UNION ALL SELECT 'loot_box_types', count(*) FROM loot_box_types
UNION ALL SELECT 'marketplace_items', count(*) FROM marketplace_items
UNION ALL SELECT 'site_settings', count(*) FROM site_settings;

-- ────────────────────────────────────────────────────────────
-- 6. FOREIGN KEY INTEGRITY — orphan sweep preview.
--    Expect 0 rows; any row listed would violate its FK once added.
--    (The API server sweeps these automatically at deploy via
--    lib/db/scripts/cleanup-orphans.mjs)
-- ────────────────────────────────────────────────────────────
SELECT 'user_quest_progress orphans' AS issue, count(*)
FROM user_quest_progress up
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = up.user_id)
UNION ALL
SELECT 'group_members orphans (user)', count(*)
FROM group_members gm
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = gm.user_id);

-- ────────────────────────────────────────────────────────────
-- 7. USERS HEALTH SNAPSHOT
-- ────────────────────────────────────────────────────────────
SELECT
  count(*)                                   AS total_users,
  count(*) FILTER (WHERE is_guest = false)   AS real_users,
  count(*) FILTER (WHERE is_guest = true)    AS guest_users,
  count(*) FILTER (WHERE role = 'admin')     AS admins,
  count(*) FILTER (WHERE onboarding_completed) AS onboarded
FROM users;

-- ────────────────────────────────────────────────────────────
-- 8. PREMIUM / EMAIL OPERATIONS SNAPSHOT (safe if tables are empty)
-- ────────────────────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE is_active)                          AS active_subs,
  count(*) FILTER (WHERE NOT is_active)                      AS inactive_subs,
  count(*) FILTER (WHERE expires_at < now())                 AS expired_subs,
  count(*) FILTER (WHERE granted_by_admin)                   AS admin_granted
FROM premium_subscriptions;

SELECT status, count(*) FROM email_logs GROUP BY status;
