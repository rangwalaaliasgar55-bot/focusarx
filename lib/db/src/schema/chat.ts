import { pgTable, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

// Phase 4: Real-Time Chat Platform
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  type: text('type').notNull().default('direct'),
  groupId: text('group_id'),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('conversations_group_idx').on(table.groupId),
}));

export const conversationParticipants = pgTable('conversation_participants', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => 'conversations.id' as any, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  convUserIdx: index('conv_participants_conv_user_idx').on(table.conversationId, table.userId),
}));

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => 'conversations.id' as any, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').default('text'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  convIdx: index('messages_conv_idx').on(table.conversationId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
}));

export const messageReads = pgTable('message_reads', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => 'messages.id' as any, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (table) => ({
  messageUserIdx: index('message_reads_message_user_idx').on(table.messageId, table.userId),
}));

// Phase 5: Notification System
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));
