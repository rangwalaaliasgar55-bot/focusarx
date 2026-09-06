import { pgTable, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

// Extended group metadata (study_groups is the canonical table in focusarx.ts)
export const groupInvitations = pgTable('group_invitations', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeEmail: text('invitee_email'),
  inviteeId: text('invitee_id').references(() => users.id),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('group_invitations_group_idx').on(table.groupId),
}));

export const groupAuditLogs = pgTable('group_audit_logs', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetId: text('target_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('group_audit_logs_group_idx').on(table.groupId),
}));

export const groupChallenges = pgTable('group_challenges', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  targetValue: integer('target_value').notNull().default(1),
  unit: text('unit').notNull().default('sessions'),
  xpReward: integer('xp_reward').notNull().default(500),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('group_challenges_group_idx').on(table.groupId),
}));

export const groupChallengeProgress = pgTable('group_challenge_progress', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  chalUserIdx: index('group_challenge_progress_chal_user_idx').on(table.challengeId, table.userId),
}));
