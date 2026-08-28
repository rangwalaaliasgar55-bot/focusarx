ALTER TABLE IF EXISTS "marketplace_items"
  ADD COLUMN IF NOT EXISTS "premium_only" boolean DEFAULT false NOT NULL;

-- Existing high-tier cosmetics become the initial premium catalogue.
-- Skips if table missing or rows already updated.
DO $$ BEGIN
  IF to_regclass('public.marketplace_items') IS NOT NULL THEN
    UPDATE "marketplace_items"
    SET "premium_only" = true
    WHERE "id" IN ('frame-diamond', 'avatar-astronaut', 'effect-aurora', 'acc-fire-wings')
      AND "premium_only" = false;
  END IF;
END $$;
