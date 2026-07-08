import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

export interface LootBoxReward {
  type: string;
  value: number | string;
  weight: number;
  category?: string;
  rarity?: string;
}

export const lootBoxTypesTable = pgTable('loot_box_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  rarity: text('rarity').notNull(),
  coinCost: integer('coin_cost').notNull().default(0),
  sessionsRequired: integer('sessions_required').notNull().default(0),
  icon: text('icon').notNull(),
  glowColor: text('glow_color').notNull().default('#7C3AED'),
  possibleRewards: jsonb('possible_rewards').notNull().$type<LootBoxReward[]>(),
});

export type LootBoxType = typeof lootBoxTypesTable.$inferSelect;

export const userLootBoxesTable = pgTable('user_loot_boxes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  boxTypeId: text('box_type_id').notNull().references(() => lootBoxTypesTable.id),
  status: text('status').notNull().default('unopened'),
  rewardType: text('reward_type'),
  rewardValue: jsonb('reward_value'),
  earnedReason: text('earned_reason'),
  openedAt: timestamp('opened_at'),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
}, (t) => [index('user_loot_boxes_user_idx').on(t.userId)]);

export type UserLootBox = typeof userLootBoxesTable.$inferSelect;
