-- Versioned web-native city simulation state. Kept separate from legacy
-- building placement so existing cities migrate without losing progress.
ALTER TABLE IF EXISTS "focus_cities"
  ADD COLUMN IF NOT EXISTS "simulation" jsonb DEFAULT '{}'::jsonb;
