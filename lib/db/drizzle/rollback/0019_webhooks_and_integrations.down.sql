-- Rollback for 0019_webhooks_and_integrations.sql.
--
-- Drops the three tables and everything in them. There is no data-preserving
-- rollback for this migration: the secrets are encrypted with a key that lives
-- in the process environment, not in the database, so a dump of these tables
-- taken without the key cannot be restored into a working state anyway. That is
-- the intended property, and it is why this is an explicit drop rather than a
-- rename-and-keep.
--
-- Order matters with foreign keys: deliveries reference endpoints, both
-- reference users. `CASCADE` on each DROP handles the dependency chain, but the
-- explicit ordering keeps the intent readable and makes the script safe to run
-- against a partially-migrated database where only some tables exist.
--
-- Idempotent: `IF EXISTS` throughout.

DROP TABLE IF EXISTS "webhook_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "webhook_endpoints" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "integration_connections" CASCADE;
