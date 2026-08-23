import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, unique } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

export const seasonalEventsTable = pgTable('seasonal_events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  theme: text('theme').notNull(),
  bannerColor: text('banner_color').notNull().default('#7C3AED'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  xpMultiplier: real('xp_multiplier').notNull().default(1.0),
  coinMultiplier: real('coin_multiplier').notNull().default(1.0),
  specialMissions: jsonb('special_missions').default([]),
  exclusiveRewards: jsonb('exclusive_rewards').default([]),
  premiumOnly: boolean('premium_only').notNull().default(false),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('seasonal_events_slug_idx').on(t.slug)]);

export type SeasonalEvent = typeof seasonalEventsTable.$inferSelect;

export const userSeasonalProgressTable = pgTable('user_seasonal_progress', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => seasonalEventsTable.id),
  points: integer('points').notNull().default(0),
  completedMissions: jsonb('completed_missions').$type<string[]>().default([]),
  rewardsClaimed: jsonb('rewards_claimed').$type<string[]>().default([]),
  rank: integer('rank'),
}, (t) => [
  index('user_seasonal_progress_user_idx').on(t.userId),
  unique('user_seasonal_progress_unique').on(t.userId, t.eventId),
]);

export type UserSeasonalProgress = typeof userSeasonalProgressTable.$inferSelect;
