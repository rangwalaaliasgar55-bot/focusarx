-- ═══════════════════════════════════════════════════════════════════════════
-- FocusArx Premium Tier Migration
-- Run in Neon SQL Editor: https://console.neon.tech → SQL Editor → paste → Run
-- Every statement is idempotent (safe to re-run; skips if already applied).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- TASK 1: Battle Pass premium unlock
-- The column already exists from a prior migration, but verify it's there:
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battle_pass_progress' AND column_name = 'premium_unlocked'
  ) THEN
    ALTER TABLE battle_pass_progress ADD COLUMN premium_unlocked boolean DEFAULT false NOT NULL;
    RAISE NOTICE 'Added premium_unlocked to battle_pass_progress';
  ELSE
    RAISE NOTICE 'premium_unlocked already exists on battle_pass_progress';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- TASK 4: Premium loot box tier — add premium_only column to loot_box_types
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loot_box_types' AND column_name = 'premium_only'
  ) THEN
    ALTER TABLE loot_box_types ADD COLUMN premium_only boolean DEFAULT false NOT NULL;
    RAISE NOTICE 'Added premium_only to loot_box_types';
  ELSE
    RAISE NOTICE 'premium_only already exists on loot_box_types';
  END IF;
END $$;

-- Seed one premium-only loot box (upsert by id so re-runs are safe)
INSERT INTO loot_box_types (id, name, description, rarity, coin_cost, sessions_required, premium_only, icon, glow_color, possible_rewards)
VALUES (
  'lb-pv-1',
  'Premium Vault',
  'Exclusive rewards for Premium members. Higher drop rates for rare and legendary items.',
  'epic',
  800,
  0,
  true,
  '👑',
  '#F59E0B',
  '[{"type":"coins","value":1000,"weight":20},{"type":"xp","value":2500,"weight":20},{"type":"marketplace_item","value":"rare","rarity":"rare","weight":30},{"type":"xp_boost","value":4,"weight":15},{"type":"battle_pass_tiers","value":3,"weight":15}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Mark some existing epic/legendary boxes as premium-only for variety
UPDATE loot_box_types SET premium_only = true WHERE id IN ('lb-e-3', 'lb-l-3', 'lb-m-4');

-- ─────────────────────────────────────────────────────────────────────────
-- TASK 7 (partial): Ensure study_streaks table exists for AI reports
-- (the table already exists in schema.sql, but this is a safety net)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_streaks (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_study_date date,
  streak_start_date date,
  updated_at timestamp NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- Run these after the migration to confirm everything is in place:
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Confirm battle_pass_progress has premium_unlocked column
-- SELECT column_name, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'battle_pass_progress' AND column_name = 'premium_unlocked';

-- 2. Confirm loot_box_types has premium_only column
-- SELECT column_name, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'loot_box_types' AND column_name = 'premium_only';

-- 3. Show premium-only loot boxes
-- SELECT id, name, rarity, premium_only FROM loot_box_types WHERE premium_only = true;

-- 4. Show all users with active premium
-- SELECT u.username, p.expires_at, p.is_active
-- FROM premium_subscriptions p
-- JOIN users u ON u.id = p.user_id
-- WHERE p.is_active = true AND p.expires_at > now();

-- 5. Show battle pass premium unlock status per user
-- SELECT u.username, b.premium_unlocked, b.tier, b.season
-- FROM battle_pass_progress b
-- JOIN users u ON u.id = b.user_id
-- ORDER BY b.tier DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE — All premium tier database changes applied.
-- ═══════════════════════════════════════════════════════════════════════════
