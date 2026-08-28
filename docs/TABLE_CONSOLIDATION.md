# Legacy Table Consolidation Plan

Status: **plan only** — the codebase is already migrated off every table listed below; what remains is a
live-DB migration (drop/archive) plus one code repoint discovered during verification. Execution requires a
database connection and is therefore left to the maintainer. Cross-reference: AUDIT.md finding **D-4**.

Verification method used (this session): grepped every `insert(` / `update(` / `delete(` / `select().from(`
call in `artifacts/api-server/src` against every exported drizzle table in `lib/db/src/schema/*`.

## 1. Inventory

| Legacy table (SQL name) | Drizzle export | Readers | Writers | Replaced by | Verdict |
|---|---|---|---|---|---|
| `posts` | `legacyPosts` (schema/social.ts) | **0** | **0** | `social_posts` (`socialPostsTable`) + `post_comments` / `post_reactions` / `post_saves` | **Orphan — safe to archive & drop** |
| `post_likes` | `postLikes` (schema/social.ts) | **0** | **0** | `post_reactions` (`postReactionsTable`) | **Orphan — safe to archive & drop** |
| `user_battle_pass_progress` | `userBattlePassProgress` (schema/gamification.ts) | **0** (Phase 0 repointed the last three reads) | **0** | `battle_pass_progress` (`battlePassProgressTable`, written by premium/retention/sessions) | **Orphan — safe to archive & drop (Phase 0 code fix shipped)** |
| `study_buddies` | `studyBuddies` (schema/gamification.ts) | 0 | 0 | friendships / buddy_requests / study_groups | **Orphan — safe to archive & drop** |
| `shared_goals` | `sharedGoals` (schema/gamification.ts) | 0 | 0 | `goals` + group challenges | **Orphan — safe to archive & drop** |
| `leaderboard_snapshots` | `leaderboardSnapshots` (schema/gamification.ts) | 0 | 0 | computed on the fly from `focus_sessions` | **Orphan — safe to archive & drop** |

Not orphans (verified live): `coin_transactions` vs `token_ledger` are two *different* economies (soft coins
vs premium tokens) — both have writers; `user_pets` (3 writers) and `user_pet_inventory` (1 writer) are both
live. D-4's coins/pets duplication concern is resolved as "intentional, distinct tables".

## 2. Phase 0 — code fix (IMPLEMENTED — see commit "battle-pass: repair tier claims")

During verification the gate turned out worse than "dead": `routes/battlePassEnhanced.ts` (the router behind
the client's `/battle-pass` page) read season XP from the never-written `user_battle_pass_progress`, so every
user's progress rendered as 0 and `POST /battle-pass/claim` always failed with "Tier not yet unlocked". The
page was non-functional for everyone. Fixed this session:

- `src/lib/battlePassTiers.ts` — pure tier math (`requiredXpForTier`, `eligibleTiersForXp`,
  `currentTierForXp`) with unit tests (`battlePassTiers.test.ts`), replacing three divergent inline
  computations (the `/claim` gate, `/claim-all`'s hardcoded `tier * 500`, and `/current`'s filter count).
- All three routes now read **live** season XP from `battle_pass_progress.season_xp` (the column session
  completion credits). The last reader of `user_battle_pass_progress` is gone — the table is now a pure
  orphan.
- `/current` mapped a nonexistent `r.xpRequired` field (real column: `required_xp`) — corrected.
- Semantic note: `battle_pass_progress.season_xp` resets on the ISO-week boundary (canonical battle pass in
  `lib/battlePass.ts`), while the enhanced routes treat seasons as calendar months. XP therefore accrues
  weekly; claimed tiers persist in `battle_pass_claims` and survive the reset. Unifying the two season
  cadences is a product decision, deliberately not made here.

## 3. Phase 1 — live-DB migration (maintainer, with a production connection)

Order matters: archive → deploy code → drop → clean schema. All SQL below assumes PostgreSQL ≥ 13.

**Step 1 — archive (do not skip; tables are unrecoverable after Step 4):**

```bash
pg_dump "$DATABASE_URL" --table=posts --table=post_likes --table=user_battle_pass_progress \
  --table=study_buddies --table=shared_goals --table=leaderboard_snapshots \
  --data-only --column-inserts > legacy_tables_archive_$(date +%F).sql
# verify the archive is non-empty and spot-check one INSERT per table
grep -c "^INSERT INTO" legacy_tables_archive_*.sql
```

Store the archive with backups (e.g. object storage), not in Git.

**Step 2 — pre-flight counts (record for post-drop verification):**

```sql
SELECT 'posts' t, count(*) FROM posts
UNION ALL SELECT 'post_likes', count(*) FROM post_likes
UNION ALL SELECT 'user_battle_pass_progress', count(*) FROM user_battle_pass_progress
UNION ALL SELECT 'study_buddies', count(*) FROM study_buddies
UNION ALL SELECT 'shared_goals', count(*) FROM shared_goals
UNION ALL SELECT 'leaderboard_snapshots', count(*) FROM leaderboard_snapshots;
```

If `user_battle_pass_progress` has rows, diff them against `battle_pass_progress` for the same users before
deciding whether legacy tiers need a one-time backfill into `battle_pass_progress` (write the backfill as an
explicit `INSERT … ON CONFLICT DO NOTHING` script, run it staging-first).

**Step 3 — deploy the Phase-0 code fix and the schema cleanup (Step 5) together**, *before* dropping.
The app never reads `posts`/`post_likes`/`study_buddies`/`shared_goals`/`leaderboard_snapshots`, so dropping
them is not strictly blocked by the deploy, but sequencing deploy-then-drop keeps any single deploy
reversible.

**Step 4 — drop (one transaction, lock_timeout so a long report query can't block the migration):**

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS post_likes;              -- child first if any FK ever existed
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS user_battle_pass_progress;
DROP TABLE IF EXISTS study_buddies;
DROP TABLE IF EXISTS shared_goals;
DROP TABLE IF EXISTS leaderboard_snapshots;
COMMIT;
```

Post-verify: the Step-2 query now fails with `relation does not exist` for all six names, and app error rate
is unchanged (Sentry/logs).

**Step 5 — remove the drizzle exports** (`legacyPosts`, `postLikes` from `lib/db/src/schema/social.ts`;
`userBattlePassProgress`, `studyBuddies`, `sharedGoals`, `leaderboardSnapshots` from
`lib/db/src/schema/gamification.ts`), run `pnpm run typecheck:libs` then `pnpm run typecheck`, and delete
`social.ts` entirely if it becomes empty. Do this *after* the DROP so a stray deployment of old code can't
crash against missing tables it still imports.

**Rollback:** `psql "$DATABASE_URL" < legacy_tables_archive_*.sql` recreates the tables from inserts
(constraints are simple PK/uniques — safe). Schema-export removal reverts via Git.

## 4. Follow-through checklist

- [x] Phase 0: battlePassEnhanced reads repointed to `battle_pass_progress` (+ `battlePassTiers.test.ts`; the route-level claim regression needs a live DB)
- [ ] Step 1: archive dumped and stored off-repo
- [ ] Step 2: row counts recorded
- [ ] Step 3: code + schema-export deploy live
- [ ] Step 4: six tables dropped in one tx
- [ ] Step 5: drizzle exports removed, typecheck green
- [ ] AUDIT.md D-4 closed with a link to this document
