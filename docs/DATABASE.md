# FocusArx Database Documentation

## Technology Stack

- **Database**: PostgreSQL 15+ (Neon serverless recommended)
- **ORM**: Drizzle ORM 0.45+
- **Migrations**: Drizzle Kit (`drizzle-kit push`)
- **Connection**: SSL-required connection string via `DATABASE_URL`

## Schema Documentation

See `database/full_schema.sql` for the complete, idempotent schema.
See `database/README.md` for setup instructions.
See `database/verify.sql` for schema verification.

## Table Summary

The database contains **95+ tables** organized into these domains:

### Core (12 tables)
`users`, `password_reset_tokens`, `refresh_tokens`, `focus_sessions`, `active_sessions`, `study_streaks`, `tasks`, `goals`, `habits`, `habit_completions`, `user_wallets`, `user_badges`

### Gamification (15 tables)
`missions`, `user_mission_progress`, `battle_pass_progress`, `login_rewards`, `coin_transactions`, `quest_definitions`, `user_quest_progress`, `loot_box_types`, `user_loot_boxes`, `seasonal_events`, `user_seasonal_progress`, `freeze_tokens`, `consequence_contracts`, `leaderboard_snapshots`

### Social (18 tables)
`friendships`, `follows`, `buddy_requests`, `social_posts`, `post_reactions`, `post_comments`, `post_saves`, `user_emotes`, `posts` (legacy), `post_likes`, `study_groups`, `group_members`, `study_rooms`, `study_room_members`, `conversations`, `conversation_participants`, `messages`, `message_reactions`

### Premium Economy (10 tables)
`token_ledger`, `premium_subscriptions`, `premium_plans`, `premium_entitlements`, `pet_catalog`, `user_pet_inventory`, `battle_pass_claims`, `feature_flags`, `cosmetic_inventory`, `token_earning_rules`

### City & World (5 tables)
`focus_cities`, `city_building_definitions`, `user_pets`, `marketplace_items`, `user_inventory`

### Platform (12 tables)
`site_settings`, `platform_meta`, `audit_logs`, `admin_drops`, `admin_drop_claims`, `admin_sql_log`, `bot_pending_replies`, `ai_call_log`, `ai_budget_state`, `ai_ideas`, `ai_briefings`, `ai_action_audit`

### Analytics (4 tables)
`visitors`, `analytics_sessions`, `page_views`, `analytics_events`

### Misc (19+ tables)
`productivity_logs`, `readiness_logs`, `distraction_logs`, `focus_profiles`, `focus_dna`, `break_free_streaks`, `break_free_moods`, `break_free_pledges`, `roadmaps`, `user_dreams`, `notifications`, `push_subscriptions`, `email_logs`, `flashcard_decks`, `flashcards`, `user_profile_extras`, `wrapped_snapshots`, `app_feedback`, `session_ghosts`, `study_buddies`, `shared_goals`, and more.

## Data Integrity Rules

1. **All user data queries** filter by `userId` server-side — no IDOR possible
2. **XP/coins/streaks** are computed and validated server-side
3. **Focus sessions** use client nonce for idempotency
4. **Token ledger** is insert-only for economic auditability
5. **Admin SQL log** is insert-only — all write operations are recorded
6. **Cascade deletes** on all user-owned data when a user is deleted
