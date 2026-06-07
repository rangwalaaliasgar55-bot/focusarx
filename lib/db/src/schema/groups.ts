import { pgTable, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './focusarx';

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // e.g. 'study', 'productivity', 'fitness', 'general'
  isPublic: boolean('is_public').default(true).notNull(),
  isInviteOnly: boolean('is_invite_only').default(false).notNull(),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  rules: jsonb('rules').$type<string[]>().default([]),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('groups_owner_idx').on(table.ownerId),
  categoryIdx: index('groups_category_idx').on(table.category),
}));

export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'owner', 'admin', 'moderator', 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  groupUserIdx: index('group_members_group_user_idx').on(table.groupId, table.userId),
}));

export const groupRoles = pgTable('group_roles', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // owner, admin, moderator, member
  assignedBy: text('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => ({
  groupUserIdx: index('group_roles_group_user_idx').on(table.groupId, table.userId),
}));

export const groupInvitations = pgTable('group_invitations', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeEmail: text('invitee_email'),
  inviteeId: text('invitee_id').references(() => users.id),
  status: text('status').notNull().default('pending'), // pending, accepted, declined, expired
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('group_invitations_group_idx').on(table.groupId),
}));

export const joinRequests = pgTable('join_requests', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  groupUserIdx: index('join_requests_group_user_idx').on(table.groupId, table.userId),
}));

export const roleHistory = pgTable('role_history', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  previousRole: text('previous_role'),
  newRole: text('new_role').notNull(),
  changedBy: text('changed_by').notNull().references(() => users.id),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('role_history_group_idx').on(table.groupId),
}));

export const groupAuditLogs = pgTable('group_audit_logs', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(), // e.g. 'member_added', 'role_changed', 'announcement_created'
  targetId: text('target_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('group_audit_logs_group_idx').on(table.groupId),
}));
