import { pgTable, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';
import { groups } from './groups';

// Phase 6: Battle Pass Rebuild
export const battlePasses = pgTable('battle_passes', {
  id: text('id').primaryKey(),
  season: text('season').notNull().unique(),
  title: text('title').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const battlePassRewards = pgTable('battle_pass_rewards', {
  id: text('id').primaryKey(),
  battlePassId: text('battle_pass_id').notNull().references(() => battlePasses.id, { onDelete: 'cascade' }),
  tier: integer('tier').notNull(),
  type: text('type').notNull(),
  value: jsonb('value'),
  requiredXp: integer('required_xp').notNull(),
  isPremium: boolean('is_premium').default(false).notNull(),
});

export const userBattlePassProgress = pgTable('user_battle_pass_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  battlePassId: text('battle_pass_id').notNull().references(() => battlePasses.id, { onDelete: 'cascade' }),
  currentXp: integer('current_xp').default(0).notNull(),
  currentTier: integer('current_tier').default(0).notNull(),
  claimedRewards: jsonb('claimed_rewards').$type<number[]>().default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userPassIdx: index('user_battle_pass_user_pass_idx').on(table.userId, table.battlePassId),
}));

// Phase 8: Accountability System
export const studyBuddies = pgTable('study_buddies', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  buddyId: text('buddy_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userBuddyIdx: index('study_buddies_user_buddy_idx').on(table.userId, table.buddyId),
}));

export const sharedGoals = pgTable('shared_goals', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => groups.id),
  creatorId: text('creator_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  targetValue: integer('target_value').notNull(),
  currentValue: integer('current_value').default(0).notNull(),
  deadline: timestamp('deadline'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('shared_goals_group_idx').on(table.groupId),
}));

// Phase 9: Leaderboards
export const leaderboardSnapshots = pgTable('leaderboard_snapshots', {
  id: text('id').primaryKey(),
  period: text('period').notNull(),
  category: text('category').notNull(),
  scope: text('scope').default('global'),
  groupId: text('group_id').references(() => groups.id),
  data: jsonb('data').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
}, (table) => ({
  periodCategoryIdx: index('leaderboard_snapshots_period_category_idx').on(table.period, table.category),
}));
