import { pgTable, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

// Legacy posts table (kept for backward compat; canonical is social_posts in focusarx.ts)
export const legacyPosts = pgTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').notNull().default('general'),
  imageUrls: jsonb('image_urls').$type<string[]>().default([]),
  achievementData: jsonb('achievement_data'),
  studyLogData: jsonb('study_log_data'),
  isPublic: boolean('is_public').default(true).notNull(),
  groupId: text('group_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  legacyPostUserIdx: index('posts_user_idx').on(table.userId),
  legacyPostCreatedAtIdx: index('posts_created_at_idx').on(table.createdAt),
}));

export const postLikes = pgTable('post_likes', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  postLikesIdx: index('post_likes_post_user_idx').on(table.postId, table.userId),
}));
