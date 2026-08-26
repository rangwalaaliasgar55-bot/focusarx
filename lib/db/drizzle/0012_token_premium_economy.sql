-- Token-based premium economy: Focus Tokens ledger, plans, entitlements, pet catalog, inventory, battle pass claims, feature flags, cosmetics, quests, earning rules, asset catalog
-- No real-money payments, only in-app tokens

CREATE TABLE IF NOT EXISTS "token_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "transaction_type" text NOT NULL,
  "source" text NOT NULL,
  "related_entity_id" text,
  "idempotency_key" text NOT NULL,
  "balance_after" integer NOT NULL,
  "admin_reason" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "token_ledger_idempotency_unique" UNIQUE("idempotency_key")
);
CREATE INDEX IF NOT EXISTS "token_ledger_user_idx" ON "token_ledger" ("user_id");
CREATE INDEX IF NOT EXISTS "token_ledger_user_created_idx" ON "token_ledger" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "token_ledger_source_idx" ON "token_ledger" ("source");
CREATE INDEX IF NOT EXISTS "token_ledger_type_idx" ON "token_ledger" ("transaction_type");

CREATE TABLE IF NOT EXISTS "premium_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "duration_days" integer NOT NULL,
  "token_cost" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "benefits" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "premium_plans_slug_unique" UNIQUE("slug")
);
CREATE INDEX IF NOT EXISTS "premium_plans_active_idx" ON "premium_plans" ("is_active");

CREATE TABLE IF NOT EXISTS "premium_entitlements" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan_id" text REFERENCES "premium_plans"("id") ON DELETE SET NULL,
  "source" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "starts_at" timestamp DEFAULT now() NOT NULL,
  "ends_at" timestamp NOT NULL,
  "token_cost" integer DEFAULT 0 NOT NULL,
  "idempotency_key" text NOT NULL,
  "granted_by_admin_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "admin_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "premium_entitlements_idempotency_unique" UNIQUE("idempotency_key")
);
CREATE INDEX IF NOT EXISTS "premium_entitlements_user_idx" ON "premium_entitlements" ("user_id");
CREATE INDEX IF NOT EXISTS "premium_entitlements_user_status_idx" ON "premium_entitlements" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "premium_entitlements_ends_idx" ON "premium_entitlements" ("ends_at");

CREATE TABLE IF NOT EXISTS "pet_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "rarity" text DEFAULT 'common' NOT NULL,
  "category" text DEFAULT 'starter' NOT NULL,
  "thumbnail_url" text,
  "model_url" text,
  "fallback_image_url" text,
  "animations" jsonb DEFAULT '{}'::jsonb,
  "unlock_source" text DEFAULT 'starter' NOT NULL,
  "token_cost" integer DEFAULT 0,
  "is_premium" boolean DEFAULT false NOT NULL,
  "is_seasonal" boolean DEFAULT false NOT NULL,
  "seasonal_event_id" text,
  "available_from" timestamp,
  "available_until" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "max_level" integer DEFAULT 20 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pet_catalog_slug_unique" UNIQUE("slug")
);
CREATE INDEX IF NOT EXISTS "pet_catalog_rarity_idx" ON "pet_catalog" ("rarity");
CREATE INDEX IF NOT EXISTS "pet_catalog_category_idx" ON "pet_catalog" ("category");
CREATE INDEX IF NOT EXISTS "pet_catalog_active_idx" ON "pet_catalog" ("is_active");

CREATE TABLE IF NOT EXISTS "user_pet_inventory" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pet_id" text NOT NULL REFERENCES "pet_catalog"("id") ON DELETE CASCADE,
  "level" integer DEFAULT 1 NOT NULL,
  "bond_xp" integer DEFAULT 0 NOT NULL,
  "nickname" text,
  "mood" text DEFAULT 'happy' NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "acquired_from" text DEFAULT 'starter' NOT NULL,
  "accessories" jsonb DEFAULT '[]'::jsonb,
  "color_variant" text DEFAULT 'default',
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_pet_inventory_user_pet_unique" UNIQUE("user_id", "pet_id")
);
CREATE INDEX IF NOT EXISTS "user_pet_inventory_user_idx" ON "user_pet_inventory" ("user_id");
CREATE INDEX IF NOT EXISTS "user_pet_inventory_user_active_idx" ON "user_pet_inventory" ("user_id", "is_active");

CREATE TABLE IF NOT EXISTS "battle_pass_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "battle_pass_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tier" integer NOT NULL,
  "reward_id" text NOT NULL,
  "is_premium_reward" boolean DEFAULT false NOT NULL,
  "claimed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "battle_pass_claims_unique" UNIQUE("battle_pass_id", "user_id", "tier", "reward_id")
);
CREATE INDEX IF NOT EXISTS "battle_pass_claims_user_idx" ON "battle_pass_claims" ("user_id");
CREATE INDEX IF NOT EXISTS "battle_pass_claims_pass_idx" ON "battle_pass_claims" ("battle_pass_id");

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "description" text,
  "rollout_percentage" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
CREATE INDEX IF NOT EXISTS "feature_flags_enabled_idx" ON "feature_flags" ("enabled");

CREATE TABLE IF NOT EXISTS "cosmetic_inventory" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "cosmetic_id" text NOT NULL,
  "type" text NOT NULL,
  "equipped" boolean DEFAULT false NOT NULL,
  "acquired_from" text DEFAULT 'starter' NOT NULL,
  "acquired_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cosmetic_inventory_user_idx" ON "cosmetic_inventory" ("user_id");
CREATE INDEX IF NOT EXISTS "cosmetic_inventory_user_type_idx" ON "cosmetic_inventory" ("user_id", "type");

CREATE TABLE IF NOT EXISTS "quest_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quest_id" text NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "target" integer NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "claimed" boolean DEFAULT false NOT NULL,
  "period" text NOT NULL,
  "claimed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "quest_progress_unique" UNIQUE("user_id", "quest_id", "period")
);
CREATE INDEX IF NOT EXISTS "quest_progress_user_idx" ON "quest_progress" ("user_id");

CREATE TABLE IF NOT EXISTS "token_earning_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "amount" integer NOT NULL,
  "daily_limit" integer,
  "description" text DEFAULT '' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "token_earning_rules_source_unique" UNIQUE("source")
);
CREATE INDEX IF NOT EXISTS "token_earning_rules_active_idx" ON "token_earning_rules" ("is_active");

CREATE TABLE IF NOT EXISTS "asset_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "type" text NOT NULL,
  "url" text NOT NULL,
  "fallback_url" text,
  "size_bytes" integer,
  "mime_type" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "asset_catalog_key_unique" UNIQUE("key")
);
CREATE INDEX IF NOT EXISTS "asset_catalog_type_idx" ON "asset_catalog" ("type");

-- Seed default premium plans
INSERT INTO "premium_plans" ("id", "name", "slug", "description", "duration_days", "token_cost", "benefits", "is_active", "sort_order")
VALUES
  ('plan_30', '30-Day Premium', 'premium_30', 'Unlock all premium features for 30 days using Focus Tokens', 30, 10000, '["ai_coach","premium_timer_rituals","advanced_analytics","premium_focus_city","premium_profile","premium_convenience","exclusive_pets","premium_battle_pass"]'::jsonb, true, 1),
  ('plan_90', '90-Day Premium', 'premium_90', 'Best value — 90 days of premium, save 17%', 90, 25000, '["ai_coach","premium_timer_rituals","advanced_analytics","premium_focus_city","premium_profile","premium_convenience","exclusive_pets","premium_battle_pass","bonus_cosmetic"]'::jsonb, true, 2),
  ('plan_365', '365-Day Premium', 'premium_365', 'Year of focus mastery — save 33%', 365, 80000, '["ai_coach","premium_timer_rituals","advanced_analytics","premium_focus_city","premium_profile","premium_convenience","exclusive_pets","premium_battle_pass","bonus_cosmetic","founder_badge","early_access"]'::jsonb, true, 3)
ON CONFLICT ("slug") DO NOTHING;

-- Seed earning rules
INSERT INTO "token_earning_rules" ("id", "source", "amount", "daily_limit", "description", "is_active")
VALUES
  ('rule_session', 'session_complete', 50, 500, 'Focus session 25m+ (max 10/day)', true),
  ('rule_daily_quest', 'daily_quest', 30, 150, 'Daily quest', true),
  ('rule_weekly_quest', 'weekly_quest', 100, NULL, 'Weekly quest', true),
  ('rule_streak', 'streak', 20, 20, 'Streak maintenance', true),
  ('rule_battle_pass', 'battle_pass', 50, NULL, 'Battle pass tier', true),
  ('rule_pet', 'pet_milestone', 40, NULL, 'Pet milestone', true),
  ('rule_city', 'city_upgrade', 60, NULL, 'City upgrade', true),
  ('rule_seasonal', 'seasonal_event', 80, NULL, 'Seasonal event', true),
  ('rule_referral', 'referral', 200, NULL, 'Referral', true),
  ('rule_daily_reward', 'daily_reward', 25, 25, 'Daily reward', true),
  ('rule_achievement', 'achievement', 50, NULL, 'Achievement unlock', true)
ON CONFLICT ("source") DO NOTHING;

-- Seed feature flags
INSERT INTO "feature_flags" ("id", "key", "enabled", "description", "rollout_percentage")
VALUES
  ('flag_timer_rituals', 'premium_timer_rituals', true, 'Premium timer rituals: 10-180m, sequences, fullscreen, sound mixing, intentions', 100),
  ('flag_analytics', 'premium_analytics', true, 'Advanced analytics: best hours/days, export, 180-day view', 100),
  ('flag_city', 'premium_city_modes', true, 'Premium Focus City modes: night/sunset/weather/seasonal', 100),
  ('flag_pets_3d', 'pets_3d', true, '3D pets with GLB/GLTF, quality settings, fallback', 100),
  ('flag_battle_pass', 'battle_pass', true, 'Battle pass with free+premium tracks', 100),
  ('flag_profile', 'profile_customization', true, 'Profile frames, nameplates, backgrounds, badges, aura, emotes', 100)
ON CONFLICT ("key") DO NOTHING;

-- Seed pet catalog starter
INSERT INTO "pet_catalog" ("id", "slug", "name", "description", "rarity", "category", "token_cost", "is_premium", "is_active", "sort_order", "max_level", "unlock_source")
VALUES
  ('pet_owl', 'owl', 'Sage Owl', 'Wise and calm. Perfect for deep study.', 'common', 'starter', 0, false, true, 0, 20, 'starter'),
  ('pet_fox', 'fox', 'Focus Fox', 'Sharp and cunning. Thrives on consistency.', 'common', 'starter', 0, false, true, 1, 20, 'starter'),
  ('pet_robot', 'robot', 'Study Bot', 'Logical and precise. Optimizes sessions.', 'common', 'starter', 0, false, true, 2, 20, 'starter'),
  ('pet_cat', 'cat', 'Neko Scholar', 'Curious and playful. Keeps you motivated.', 'common', 'free', 0, false, true, 3, 20, 'achievement'),
  ('pet_dragon', 'dragon', 'Study Dragon', 'Fierce and powerful. Grows with ambition.', 'epic', 'premium', 2500, true, true, 10, 20, 'premium'),
  ('pet_phoenix', 'phoenix', 'Rising Phoenix', 'Reborn every session. Symbolizes growth.', 'legendary', 'premium', 5000, true, true, 11, 20, 'premium'),
  ('pet_turtle', 'turtle', 'Zen Turtle', 'Slow and steady wins the race.', 'rare', 'achievement', 0, false, true, 4, 20, 'achievement'),
  ('pet_panda', 'panda', 'Chill Panda', 'Relaxed focus companion.', 'rare', 'seasonal', 1000, false, true, 5, 20, 'seasonal'),
  ('pet_unicorn', 'unicorn', 'Mystic Unicorn', 'Magical productivity booster.', 'legendary', 'event', 8000, true, true, 20, 20, 'event'),
  ('pet_axolotl', 'axolotl', 'Axolotl Scholar', 'Rare and adorable deep work buddy.', 'epic', 'exclusive', 6000, true, true, 15, 20, 'exclusive'),
  ('pet_capybara', 'capybara', 'Capybara Chill', 'The most chill study companion.', 'rare', 'free', 1500, false, true, 6, 20, 'free'),
  ('pet_otter', 'otter', 'Focus Otter', 'Playful and productive.', 'common', 'free', 800, false, true, 7, 20, 'free')
ON CONFLICT ("slug") DO NOTHING;
