import { pgTable, text, integer, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

export const questDefinitionsTable = pgTable('quest_definitions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  difficulty: text('difficulty').notNull().default('easy'),
  target: integer('target').notNull(),
  metric: text('metric').notNull(),
  xpReward: integer('xp_reward').notNull().default(0),
  coinReward: integer('coin_reward').notNull().default(0),
  icon: text('icon').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  rotationWeight: integer('rotation_weight').notNull().default(10),
});

export type QuestDefinition = typeof questDefinitionsTable.$inferSelect;

export const userQuestProgressTable = pgTable('user_quest_progress', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questId: text('quest_id').notNull().references(() => questDefinitionsTable.id),
  period: text('period').notNull(),
  current: integer('current').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  claimedAt: timestamp('claimed_at'),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => [
  index('user_quest_progress_user_idx').on(t.userId),
  unique('user_quest_progress_unique').on(t.userId, t.questId, t.period),
]);

export type UserQuestProgress = typeof userQuestProgressTable.$inferSelect;
