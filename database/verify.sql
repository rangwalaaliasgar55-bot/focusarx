-- FocusArx Schema Verification Script
-- Run after migrations to confirm the expected schema is present.
-- Returns a summary of table counts and any missing tables.

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'users', 'password_reset_tokens', 'refresh_tokens',
    'focus_sessions', 'active_sessions', 'session_ghosts',
    'study_streaks', 'freeze_tokens',
    'tasks', 'goals', 'habits', 'habit_completions',
    'user_wallets', 'user_badges', 'coin_transactions', 'login_rewards',
    'missions', 'user_mission_progress', 'battle_pass_progress',
    'friendships', 'follows', 'buddy_requests',
    'social_posts', 'post_reactions', 'post_comments', 'post_saves',
    'user_emotes',
    'study_groups', 'group_members',
    'study_rooms', 'study_room_members',
    'conversations', 'conversation_participants', 'messages', 'message_reactions',
    'productivity_logs', 'readiness_logs', 'distraction_logs',
    'focus_profiles', 'focus_dna',
    'break_free_streaks', 'break_free_moods', 'break_free_pledges',
    'consequence_contracts',
    'roadmaps', 'user_dreams',
    'notifications', 'push_subscriptions', 'email_logs',
    'focus_cities', 'city_building_definitions',
    'user_pets', 'marketplace_items', 'user_inventory',
    'loot_box_types', 'user_loot_boxes',
    'quest_definitions', 'user_quest_progress',
    'seasonal_events', 'user_seasonal_progress',
    'flashcard_decks', 'flashcards',
    'token_ledger', 'premium_subscriptions', 'premium_plans', 'premium_entitlements',
    'pet_catalog', 'user_pet_inventory',
    'battle_pass_claims', 'feature_flags', 'cosmetic_inventory',
    'token_earning_rules', 'asset_catalog',
    'user_profile_extras', 'wrapped_snapshots', 'app_feedback',
    'site_settings', 'platform_meta',
    'visitors', 'analytics_sessions', 'page_views', 'analytics_events',
    'bot_pending_replies', 'admin_drops', 'admin_drop_claims', 'admin_sql_log',
    'ai_call_log', 'ai_budget_state', 'ai_ideas', 'ai_briefings', 'ai_action_audit',
    'battle_passes', 'battle_pass_rewards', 'user_battle_pass_progress',
    'study_buddies', 'shared_goals', 'leaderboard_snapshots',
    'group_invitations', 'group_audit_logs', 'group_challenges', 'group_challenge_progress',
    'audit_logs', 'posts', 'post_likes', 'quest_progress'
  ];
  missing_count INT := 0;
  existing_count INT := 0;
  t TEXT;
BEGIN
  RAISE NOTICE '=== FocusArx Schema Verification ===';
  RAISE NOTICE 'Expected tables: %', array_length(expected_tables, 1);

  FOREACH t IN ARRAY expected_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      existing_count := existing_count + 1;
    ELSE
      RAISE NOTICE 'MISSING: %', t;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '---';
  RAISE NOTICE 'Found: %', existing_count;
  RAISE NOTICE 'Missing: %', missing_count;

  IF missing_count = 0 THEN
    RAISE NOTICE '✓ All expected tables are present.';
  ELSE
    RAISE NOTICE '✗ % table(s) missing — run pnpm db:push to create them.', missing_count;
  END IF;

  -- Index count
  DECLARE
    idx_count INT;
  BEGIN
    SELECT count(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'public';
    RAISE NOTICE 'Total indexes: %', idx_count;
  END;

  -- Row counts for key tables
  RAISE NOTICE '---';
  RAISE NOTICE 'Row counts (key tables):';
  DECLARE
    cnt INT;
  BEGIN
    EXECUTE 'SELECT count(*) FROM users' INTO cnt;
    RAISE NOTICE '  users: %', cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  users: (error reading)';
  END;
  DECLARE
    cnt INT;
  BEGIN
    EXECUTE 'SELECT count(*) FROM focus_sessions' INTO cnt;
    RAISE NOTICE '  focus_sessions: %', cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  focus_sessions: (error reading)';
  END;
  DECLARE
    cnt INT;
  BEGIN
    EXECUTE 'SELECT count(*) FROM tasks' INTO cnt;
    RAISE NOTICE '  tasks: %', cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  tasks: (error reading)';
  END;
END $$;
