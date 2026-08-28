# Migration plan: `timestamp` → `timestamptz` (D-1, P1)

## Problem
Every temporal column in the schema is `timestamp` (without time zone). Values
are written from `new Date()` on UTC servers, so correctness currently depends
on every deployment staying UTC. Day-key columns (`text` YYYY-MM-DD) mix UTC
(some streak paths before the fix), server-local, and IST (canonical —
`lib/istDate.ts`). The state introduced in this branch writes IST day keys
everywhere, but the column *types* remain a latent hazard.

## Strategy — additive, zero-downtime (Neon-compatible)
1. **Freeze semantics first (done):** all writers/readers use UTC instants or
   IST day keys via `lib/istDate.ts`. No writer depends on the DB TimeZone GUC.
2. **Convert in place** — Postgres `timestamp` → `timestamptz` is a
   metadata-only change when the stored values are UTC (they are):
   ```sql
   ALTER TABLE users ALTER COLUMN created_at TYPE timestamptz
     USING created_at AT TIME ZONE 'UTC';
   ```
   Generate the full script from `pg_catalog` so no column is missed:
   ```sql
   SELECT format(
     'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L;',
     n.nspname, c.relname, a.attname, a.attname, 'UTC')
   FROM pg_attribute a
   JOIN pg_class c ON c.oid = a.attrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND a.atttypid = 'timestamp'::regtype AND a.attnum > 0 AND NOT a.attisdropped;
   ```
3. **Order:** staging first (restore of prod snapshot), then prod in a
   maintenance window. `ALTER TYPE` takes ACCESS EXCLUSIVE briefly — seconds
   per table; batch 10 tables per transaction.
4. **Schema sync:** apply the same change to `lib/db/src/schema/*.ts`
   (`timestamp(..., { mode: ... })` already yields JS Dates for timestamptz —
   drizzle treats both identically at the type level for reads; no query
   changes required).
5. **Day-key columns stay `text`** (YYYY-MM-DD, IST) — they are calendar keys,
   not instants; converting them would reintroduce the off-by-one class of
   bugs. Enforce the format with CHECK constraints in a follow-up patch
   (`CHECK (date ~ '^\d{4}-\d{2}-\d{2}$')`).

## Verification
- Pre: `SELECT count(*) FROM ... ` row-count snapshots; post: identical.
- App smoke: streak/day-reward flows across the 00:00–05:30 IST boundary.
- Rollback: reverse `USING created_at AT TIME ZONE 'UTC'` (lossless for UTC
  instants — values round-trip exactly).
