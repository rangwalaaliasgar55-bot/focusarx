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
# Local / disposable database: additive sync, then drizzle-kit push for the rest
pnpm db:push

# Shared or production database: additive sync only (what deploys run)
pnpm --filter @workspace/db run sync
pnpm --filter @workspace/db run sync:dry-run   # show the plan first
pnpm --filter @workspace/db run sync:check     # exit 1 unless already in sync
```

`scripts/sync-schema.mjs` compares the live database with
`lib/db/src/schema` and applies only additive, idempotent statements —
`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, guarded `ADD CONSTRAINT`. It never drops,
renames or retypes anything and never prompts, which is what makes it safe to
run unattended against production on every deploy. A `NOT NULL` column
without a default on a populated table is reported as `MANUAL` and left to a
reviewed migration. Running it against an empty database bootstraps the whole
schema; running it twice is a no-op (CI asserts this with `sync:check`).

### 3. Validate Migrations

`drizzle-kit push` synchronizes the TypeScript schema; it **does not replay**
the numbered files in `lib/db/drizzle/`. Validate those separately:

```bash
pnpm --filter @workspace/db run validate-migrations

# Use a newly created, disposable database, never production.
createdb focusarx_migration_test
MIGRATION_DATABASE_URL="postgresql://localhost:5432/focusarx_migration_test" \
  pnpm --filter @workspace/db run test:migrations
```

The replay check refuses a non-empty public schema and applies the journal in
order. It is a test/bootstrap utility, not a production migration-history runner.
CI exercises both recorded migrations and the canonical schema.

`push:vercel` (run by the Vercel production build and mirrored by the
`Production Deploy` workflow) runs `cleanup-orphans.mjs` and then
`sync-schema.mjs` against the production database, and fails the build if
either fails. It skips preview deployments. It is deliberately **not**
`drizzle-kit push`, which needs interactive confirmation for constraint
renames and could drop data; non-additive changes still need a reviewed
migration.

### SQL Bootstrap Snapshot

`database/full_schema.sql` is generated from the same TypeScript schema. It
creates tables before foreign keys and can be reapplied to a compatible schema.
`IF NOT EXISTS` does **not** update columns in an existing, outdated table.

```bash
pnpm --filter @workspace/db run schema:export  # regenerate the snapshot
pnpm --filter @workspace/db run schema:check   # check for drift without a DB
```

Use `sync` (additive), reviewed migrations, or `db:push` (local) for upgrades;
do not assume rerunning the snapshot upgrades an older database.

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
| **Streaks** | `study_streaks`, `streak_history`, `freeze_tokens` | Daily streak tracking, freeze tokens |
| **Tasks & Goals** | `tasks`, `goals`, `habits`, `habit_completions` | Productivity management |
| **Economy** | `user_wallets`, `coin_transactions`, `token_ledger`, `login_rewards` | XP, coins, level progression |
| **Gamification** | `missions`, `user_mission_progress`, `battle_pass_progress`, `user_badges` | Missions, battle pass, achievements |
| **Social** | `social_posts`, `post_reactions`, `post_comments`, `post_saves`, `friendships`, `follows`, `buddy_requests` | Community features |
| **Groups & Rooms** | `study_groups`, `group_members`, `study_rooms`, `study_room_members` | Collaborative study |
| **Messaging** | `conversations`, `conversation_participants`, `messages`, `message_reactions` | Real-time chat |
| **City & Forge** | `focus_cities`, `city_building_definitions`, `user_pets`, `marketplace_items`, `user_inventory` | Gamified world |
| **Loot & Quests** | `loot_box_types`, `user_loot_boxes`, `quest_definitions`, `user_quest_progress` | Rewards |
| **Seasonal** | `seasonal_events`, `user_seasonal_progress` | Time-limited events |
| **Flashcards** | `flashcard_decks`, `flashcards`, `flashcard_reviews` | Study tools with spaced repetition |
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
