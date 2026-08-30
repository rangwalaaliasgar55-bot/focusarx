# FocusArx Database

## Overview

FocusArx uses **PostgreSQL** (primary target: Neon serverless) with **Drizzle ORM** as the query builder and migration tool. The schema is defined in TypeScript under `lib/db/src/schema/` and split across 14 module files by domain.

## Environment Variables

| Variable | Scope | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | SERVER_ONLY | REQUIRED | PostgreSQL connection string with SSL |
| `UPSTASH_REDIS_REST_URL` | SERVER_ONLY | OPTIONAL | Distributed cache for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | SERVER_ONLY | OPTIONAL | Upstash Redis auth token |

## Setup

### 1. Provision PostgreSQL

```bash
# Option A: Neon (recommended for serverless)
# Create a project at https://neon.tech and copy the connection string.

# Option B: Local development
createdb focusarx_dev
export DATABASE_URL="postgresql://localhost:5432/focusarx_dev"
```

### 2. Push Schema

```bash
# Push Drizzle schema to the database (development)
pnpm db:push

# Or push directly via the script
pnpm --filter @workspace/db run push
```

### 3. Run Migrations

Drizzle migrations are in `lib/db/drizzle/`. They are applied sequentially by `drizzle-kit push`.

```bash
# For Neon serverless (Vercel deployment)
pnpm --filter @workspace/db run push:vercel

# For local
pnpm --filter @workspace/db run push
```

### 4. Seed (optional)

```bash
pnpm --filter @workspace/db run seed
```

### 5. Verify

```bash
psql "$DATABASE_URL" -f database/verify.sql
```

## Schema Architecture

### Table Categories

| Category | Tables | Description |
|---|---|---|
| **Core Users & Auth** | `users`, `password_reset_tokens`, `refresh_tokens` | Authentication, registration, sessions |
| **Focus Sessions** | `focus_sessions`, `active_sessions`, `session_ghosts` | Timer state, completed sessions, ghost data |
| **Streaks** | `study_streaks`, `freeze_tokens` | Daily streak tracking, freeze tokens |
| **Tasks & Goals** | `tasks`, `goals`, `habits`, `habit_completions` | Productivity management |
| **Economy** | `user_wallets`, `coin_transactions`, `token_ledger`, `login_rewards` | XP, coins, level progression |
| **Gamification** | `missions`, `user_mission_progress`, `battle_pass_progress`, `user_badges` | Missions, battle pass, achievements |
| **Social** | `social_posts`, `post_reactions`, `post_comments`, `post_saves`, `friendships`, `follows`, `buddy_requests` | Community features |
| **Groups & Rooms** | `study_groups`, `group_members`, `study_rooms`, `study_room_members` | Collaborative study |
| **Messaging** | `conversations`, `conversation_participants`, `messages`, `message_reactions` | Real-time chat |
| **City & Forge** | `focus_cities`, `city_building_definitions`, `user_pets`, `marketplace_items`, `user_inventory` | Gamified world |
| **Loot & Quests** | `loot_box_types`, `user_loot_boxes`, `quest_definitions`, `user_quest_progress` | Rewards |
| **Seasonal** | `seasonal_events`, `user_seasonal_progress` | Time-limited events |
| **Flashcards** | `flashcard_decks`, `flashcards` | Study tools with spaced repetition |
| **Premium** | `premium_subscriptions`, `premium_plans`, `premium_entitlements`, `pet_catalog`, `user_pet_inventory`, `battle_pass_claims`, `feature_flags`, `cosmetic_inventory` | Premium economy |
| **Profile** | `user_profile_extras`, `wrapped_snapshots`, `app_feedback` | User data |
| **Analytics** | `visitors`, `analytics_sessions`, `page_views`, `analytics_events` | Web analytics |
| **Platform** | `platform_meta`, `site_settings`, `audit_logs` | System config |
| **AI** | `ai_call_log`, `ai_budget_state`, `ai_ideas`, `ai_briefings`, `ai_action_audit` | AI integration tracking |
| **Admin** | `admin_drops`, `admin_drop_claims`, `admin_sql_log`, `bot_pending_replies` | Admin operations |

### Key Design Decisions

- **All tables use TEXT UUIDs** as primary keys (crypto.randomUUID())
- **Foreign keys with CASCADE** for user-owned data
- **No DROP statements** in the idempotent schema — safe to re-run
- **Server-authoritative values**: XP, coins, streaks, and productivity scores are computed server-side
- **Nonce-based idempotency** on focus sessions prevents double-counting
- **Token ledger** is insert-only for economic auditability

## Backup & Rollback

### Backup
```bash
# Neon: automatic point-in-time recovery
# Manual: pg_dump
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Rollback
```bash
# Restore from dump
psql "$DATABASE_URL" < backup_20260830.sql

# Neon: use the dashboard to restore to a point in time
```

## Migration Guidelines

1. **Never use destructive migrations** on production data
2. **Add columns with defaults** — never add NOT NULL columns without a default
3. **Test migrations on a Neon branch** before applying to main
4. **Run `verify.sql`** after migrations to confirm schema integrity
5. **Use the Admin SQL Console** (write mode) for emergency data fixes — all statements are logged to `admin_sql_log`
