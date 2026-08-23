ALTER TABLE "marketplace_items"
  ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;

-- Existing high-tier cosmetics become the initial premium catalogue.
UPDATE "marketplace_items"
SET "premium_only" = true
WHERE "id" IN ('frame-diamond', 'avatar-astronaut', 'effect-aurora', 'acc-fire-wings');
