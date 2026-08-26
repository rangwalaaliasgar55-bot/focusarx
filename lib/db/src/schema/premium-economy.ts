import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./focusarx";

/**
 * Central token economy — Focus Tokens (formerly coins)
 * Ledger is source of truth, balance cached in user_wallets.coins for performance
 */

// Token ledger — immutable, idempotent
export const tokenLedgerTable = pgTable("token_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive = earn, negative = spend
  transactionType: text("transaction_type").notNull(), // earn | spend | refund | admin_grant | adjustment | expiration
  source: text("source").notNull(), // session_complete | daily_quest | weekly_quest | streak | battle_pass | pet_milestone | city_upgrade | admin_grant | seasonal_event | referral | premium_purchase | cosmetic_purchase | etc
  relatedEntityId: text("related_entity_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  balanceAfter: integer("balance_after").notNull(),
  adminReason: text("admin_reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("token_ledger_user_idx").on(t.userId),
  index("token_ledger_user_created_idx").on(t.userId, t.createdAt),
  index("token_ledger_source_idx").on(t.source),
  index("token_ledger_type_idx").on(t.transactionType),
  uniqueIndex("token_ledger_idempotency_unique").on(t.idempotencyKey),
]);

export type TokenLedgerEntry = typeof tokenLedgerTable.$inferSelect;

// Premium plans — configurable by admin, stored in DB
export const premiumPlansTable = pgTable("premium_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  durationDays: integer("duration_days").notNull(),
  tokenCost: integer("token_cost").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  benefits: jsonb("benefits").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("premium_plans_active_idx").on(t.isActive),
]);

export type PremiumPlan = typeof premiumPlansTable.$inferSelect;

// Premium entitlements — history of all premium purchases, auditable
export const premiumEntitlementsTable = pgTable("premium_entitlements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => premiumPlansTable.id, { onDelete: "set null" }),
  source: text("source").notNull(), // token_unlock | admin_grant | seasonal_grant
  status: text("status").notNull().default("active"), // active | expiring_soon | expired | suspended
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at").notNull(),
  tokenCost: integer("token_cost").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  grantedByAdminId: text("granted_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  adminReason: text("admin_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("premium_entitlements_user_idx").on(t.userId),
  index("premium_entitlements_user_status_idx").on(t.userId, t.status),
  index("premium_entitlements_ends_idx").on(t.endsAt),
  uniqueIndex("premium_entitlements_idempotency_unique").on(t.idempotencyKey),
]);

export type PremiumEntitlement = typeof premiumEntitlementsTable.$inferSelect;

// Pet catalog — complete collection system
export const petCatalogTable = pgTable("pet_catalog", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  rarity: text("rarity").notNull().default("common"), // common | rare | epic | legendary | exclusive
  category: text("category").notNull().default("starter"), // starter | achievement | premium | seasonal | event | legendary | admin_drop | exclusive
  thumbnailUrl: text("thumbnail_url"),
  modelUrl: text("model_url"), // GLB/GLTF
  fallbackImageUrl: text("fallback_image_url"),
  animations: jsonb("animations").$type<Record<string, string>>().default({}), // idle, celebration, sleep, focus
  unlockSource: text("unlock_source").notNull().default("starter"),
  tokenCost: integer("token_cost").default(0),
  isPremium: boolean("is_premium").notNull().default(false),
  isSeasonal: boolean("is_seasonal").notNull().default(false),
  seasonalEventId: text("seasonal_event_id"),
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  maxLevel: integer("max_level").notNull().default(20),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("pet_catalog_rarity_idx").on(t.rarity),
  index("pet_catalog_category_idx").on(t.category),
  index("pet_catalog_active_idx").on(t.isActive),
]);

export type PetCatalog = typeof petCatalogTable.$inferSelect;

// User pet inventory — multiple pets per user
export const userPetInventoryTable = pgTable("user_pet_inventory", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  petId: text("pet_id").notNull().references(() => petCatalogTable.id, { onDelete: "cascade" }),
  level: integer("level").notNull().default(1),
  bondXp: integer("bond_xp").notNull().default(0),
  nickname: text("nickname"),
  mood: text("mood").notNull().default("happy"),
  isActive: boolean("is_active").notNull().default(false),
  acquiredFrom: text("acquired_from").notNull().default("starter"),
  accessories: jsonb("accessories").$type<string[]>().default([]),
  colorVariant: text("color_variant").default("default"),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("user_pet_inventory_user_idx").on(t.userId),
  index("user_pet_inventory_user_active_idx").on(t.userId, t.isActive),
  uniqueIndex("user_pet_inventory_user_pet_unique").on(t.userId, t.petId),
]);

export type UserPetInventory = typeof userPetInventoryTable.$inferSelect;

// Battle pass claims — idempotent per tier
export const battlePassClaimsTable = pgTable("battle_pass_claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  battlePassId: text("battle_pass_id").notNull(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull(),
  rewardId: text("reward_id").notNull(),
  isPremiumReward: boolean("is_premium_reward").notNull().default(false),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
}, (t) => [
  index("battle_pass_claims_user_idx").on(t.userId),
  index("battle_pass_claims_pass_idx").on(t.battlePassId),
  uniqueIndex("battle_pass_claims_unique").on(t.battlePassId, t.userId, t.tier, t.rewardId),
]);

export type BattlePassClaim = typeof battlePassClaimsTable.$inferSelect;

// Feature flags
export const featureFlagsTable = pgTable("feature_flags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  description: text("description"),
  rolloutPercentage: integer("rollout_percentage").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("feature_flags_enabled_idx").on(t.enabled),
]);

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;

// Cosmetic inventory
export const cosmeticInventoryTable = pgTable("cosmetic_inventory", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cosmeticId: text("cosmetic_id").notNull(),
  type: text("type").notNull(), // avatar_frame | nameplate | background | badge | aura | emote | theme | sound
  equipped: boolean("equipped").notNull().default(false),
  acquiredFrom: text("acquired_from").notNull().default("starter"),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
}, (t) => [
  index("cosmetic_inventory_user_idx").on(t.userId),
  index("cosmetic_inventory_user_type_idx").on(t.userId, t.type),
]);

export type CosmeticInventory = typeof cosmeticInventoryTable.$inferSelect;

// Quest definitions — extended
export const questProgressTable = pgTable("quest_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  progress: integer("progress").notNull().default(0),
  target: integer("target").notNull(),
  completed: boolean("completed").notNull().default(false),
  claimed: boolean("claimed").notNull().default(false),
  period: text("period").notNull(), // daily_2024-01-01 | weekly_2024-W01
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("quest_progress_user_idx").on(t.userId),
  uniqueIndex("quest_progress_unique").on(t.userId, t.questId, t.period),
]);

export type QuestProgress = typeof questProgressTable.$inferSelect;

// Token earning rules — admin configurable
export const tokenEarningRulesTable = pgTable("token_earning_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull().unique(),
  amount: integer("amount").notNull(),
  dailyLimit: integer("daily_limit"),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("token_earning_rules_active_idx").on(t.isActive),
]);

export type TokenEarningRule = typeof tokenEarningRulesTable.$inferSelect;

// Asset catalog for 3D models, thumbnails, etc
export const assetCatalogTable = pgTable("asset_catalog", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  type: text("type").notNull(), // pet_model | pet_thumbnail | city_building | theme | sound | emote | avatar_frame
  url: text("url").notNull(),
  fallbackUrl: text("fallback_url"),
  sizeBytes: integer("size_bytes"),
  mimeType: text("mime_type"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("asset_catalog_type_idx").on(t.type),
]);

export type AssetCatalog = typeof assetCatalogTable.$inferSelect;
