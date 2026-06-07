import { pgTable, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './focusarx';

// Phase 2: Social Creator Platform + Phase 3: Follow System
export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').notNull().default('general'), // general, achievement, study_log, journal
  imageUrls: jsonb('image_urls').$type<string[]>().default([]),
  achievementData: jsonb('achievement_data'),
  studyLogData: jsonb('study_log_data'),
  isPublic: boolean('is_public').default(true).notNull(),
  groupId: text('group_id').references(() => 'groups.id' as any), // string ref to avoid circular import
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('posts_user_idx').on(table.userId),
  createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
}));

export const postLikes = pgTable('post_likes', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => 'posts.id' as any, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  postUserIdx: index('post_likes_post_user_idx').on(table.postId, table.userId),
}));

export const postComments = pgTable('post_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => 'posts.id' as any, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentCommentId: text('parent_comment_id').references(() => 'post_comments.id' as any),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  postIdx: index('post_comments_post_idx').on(table.postId),
}));

export const postSaves = pgTable('post_saves', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => 'posts.id' as any, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  postUserIdx: index('post_saves_post_user_idx').on(table.postId, table.userId),
}));

export const follows = pgTable('follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: text('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  followerIdx: index('follows_follower_idx').on(table.followerId),
  followingIdx: index('follows_following_idx').on(table.followingId),
  uniqueFollow: index('follows_unique_idx').on(table.followerId, table.followingId),
}));

export const userFollowers = pgTable('user_followers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('user_followers_user_idx').on(table.userId),
}));
