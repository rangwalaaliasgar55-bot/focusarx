---
name: Schema recovery (production drift repair)
description: Canonical DB schema file, prod drift root cause, and how to repair
---

## Root cause of prod breakage
Prod DB was stuck at drizzle snapshot 0001 (79 tables); 3 changes never landed:
- `social_posts.moderation_status` / `moderation_reason` (feed 500s)
- `site_settings` table (admin site settings, announcement banner)
- `flashcard_decks` + `flashcards` tables (flashcards 500s)

## Canonical schema file
`focusarx_prod_migration.sql` (root) = generated from a DB converged by
`drizzle-kit push` (82 tables) + content seeds. Fully idempotent:
CREATE IF NOT EXISTS · ADD COLUMN IF NOT EXISTS · guarded ADD CONSTRAINT
(`duplicate_object OR duplicate_table` — the constraint backing index raises
42P07, not 42710, so BOTH must be caught) · ON CONFLICT DO NOTHING seeds.
`focusarx_prod_migration.txt` and `scripts/neon-complete.sql` are byte-synced
copies. `focusarx_neon_audit.sql` = read-only 82-table health check.

## Gotchas
- Seeds must carry explicit ids (app generates PKs in JS; no DB uuid defaults).
- `scripts/prod-schema-snapshot.sql` = the pre-repair Supabase pg_dump. It was
  moved out of artifacts/focusarx/public/ (it was publicly served at /schema.sql).
- Vercel build uses `db run push-force` (non-interactive); dev uses `push`.
- Migrations 0000-0002 now have journal+snapshots (0002_prod_resync consolidates
  the old hand-made 0002-0004 files that `migrate` used to skip silently).
