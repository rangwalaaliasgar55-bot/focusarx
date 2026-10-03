-- §Design packs — per-user design assignment and the battle log.
--
-- Two tables, and both exist because the same decision had to move out of the
-- client and into a row:
--
-- **`user_appearance` is the assignment record.** The redesign ships several
-- variants of the same surfaces (timer faces, companion art, battle boards,
-- workspace layout). A preference kept only in `localStorage` cannot be pinned
-- by an admin and cannot be reported on, so the choice lives here with two
-- writers made explicit: `source` says who wrote last, and `locked` is the
-- admin's pin — while it is set, a user's own write is refused rather than
-- accepted and then silently overwritten by the next admin sweep. One row per
-- account, created on first write; the absence of a row means "no explicit
-- choice", so no backfill is needed and the table stays proportional to the
-- number of people who actually changed something.
--
-- **`pet_battles` is a log, not an authority.** The fight is simulated on the
-- client (it is animated, pausable and never touches another account), so the
-- row records the displayed result — species, levels, difficulty, the design
-- pack in play — so the console can answer "which battle design is actually
-- used, and is anyone winning". No currency, XP or inventory is derived from
-- this table, which is what makes it safe for the client to report into.
--
-- The CHECK constraints mirror the server catalog
-- (api-server/lib/appearanceCatalog.ts) so a bad id cannot be stored even by a
-- future route that forgets to validate: the failure mode of an unknown design
-- id is a blank stage on someone's screen, which no one reports as a bug.
-- `lib/db/scripts/sync-schema.mjs` keeps these in step with the Drizzle
-- definitions.
--
-- Rollback: lib/db/drizzle/rollback/0027_user_appearance_and_battles.down.sql
-- Idempotent: every statement is guarded, so a re-run is a no-op.

CREATE TABLE IF NOT EXISTS "user_appearance" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "timer_face" text DEFAULT 'classic' NOT NULL,
  "pet_design" text DEFAULT 'classic' NOT NULL,
  "battle_design" text DEFAULT 'duel' NOT NULL,
  "layout" text DEFAULT 'quiet' NOT NULL,
  "locked" boolean DEFAULT false NOT NULL,
  "source" text DEFAULT 'user' NOT NULL,
  "updated_by" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_appearance_timer_face_known" CHECK ("timer_face" IN ('classic', 'neon', 'zen', 'flip', 'segments', 'bars', 'dots', 'rounds', 'aurora', 'orbit', 'hourglass', 'companion', 'garden', 'analog')),
  CONSTRAINT "user_appearance_pet_design_known" CHECK ("pet_design" IN ('classic', 'wild3d', 'sprite')),
  CONSTRAINT "user_appearance_battle_design_known" CHECK ("battle_design" IN ('duel', 'arena', 'retro')),
  CONSTRAINT "user_appearance_layout_known" CHECK ("layout" IN ('quiet', 'studio', 'compact')),
  CONSTRAINT "user_appearance_source_known" CHECK ("source" IN ('user', 'admin', 'default'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_appearance_locked_idx" ON "user_appearance" ("locked");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pet_battles" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pet_slug" text NOT NULL,
  "pet_name" text,
  "pet_level" integer DEFAULT 1 NOT NULL,
  "rival_slug" text NOT NULL,
  "rival_name" text NOT NULL,
  "rival_level" integer DEFAULT 1 NOT NULL,
  "difficulty" text DEFAULT 'normal' NOT NULL,
  "design" text DEFAULT 'duel' NOT NULL,
  "result" text NOT NULL,
  "rounds" integer DEFAULT 0 NOT NULL,
  "damage_dealt" integer DEFAULT 0 NOT NULL,
  "damage_taken" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pet_battles_result_known" CHECK ("result" IN ('win', 'loss', 'flee')),
  CONSTRAINT "pet_battles_design_known" CHECK ("design" IN ('duel', 'arena', 'retro')),
  CONSTRAINT "pet_battles_difficulty_known" CHECK ("difficulty" IN ('easy', 'normal', 'hard')),
  CONSTRAINT "pet_battles_levels_sane" CHECK ("pet_level" >= 1 AND "rival_level" >= 1),
  CONSTRAINT "pet_battles_rounds_non_negative" CHECK ("rounds" >= 0)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pet_battles_user_idx" ON "pet_battles" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pet_battles_design_idx" ON "pet_battles" ("design");
