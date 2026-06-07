import { pgTable, text, integer, boolean, timestamp, real, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  hashedPassword: text("hashed_password"),
  guestKey: text("guest_key").unique(),
  isGuest: boolean("is_guest").default(false).notNull(),
  role: text("role").default("user").notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingData: jsonb("onboarding_data"),
  bio: text("bio"),
  timezone: text("timezone").default("UTC"),
  productivityScore: real("productivity_score").default(0),
  totalFocusMinutes: integer("total_focus_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const focusSessionsTable = pgTable("focus_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("focus"),
  durationSec: integer("duration_sec").notNull().default(0),
  plannedDurationSec: integer("planned_duration_sec"),
  completedEarly: boolean("completed_early").default(false),
  completionPercentage: real("completion_percentage"),
  sessionStatus: text("session_status").default("completed"),
  completedAt: timestamp("completed_at"),
  focusScore: real("focus_score"),
  focusQuality: text("focus_quality"),
  stabilityRating: text("stability_rating"),
  focusTimeline: text("focus_timeline"),
  sessionInsights: text("session_insights"),
  category: text("category").default("General"),
  productivityScore: real("productivity_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("focus_sessions_user_id_idx").on(t.userId),
  index("focus_sessions_completed_at_idx").on(t.completedAt),
]);

export type FocusSession = typeof focusSessionsTable.$inferSelect;

export const activeSessionsTable = pgTable("active_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("focus"),
  secondsLeft: integer("seconds_left").notNull().default(1500),
  timerStatus: text("timer_status").notNull().default("paused"),
  activeSeconds: integer("active_seconds").notNull().default(0),
  focusScore: real("focus_score"),
  focusQuality: text("focus_quality"),
  focusState: text("focus_state"),
  distractionCount: integer("distraction_count").default(0),
  lastSeenFaceAt: text("last_seen_face_at"),
  focusTimeline: text("focus_timeline").default("[]"),
  monitorEnabled: boolean("monitor_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ActiveSession = typeof activeSessionsTable.$inferSelect;

export const studyStreaksTable = pgTable("study_streaks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastStudyDate: text("last_study_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StudyStreak = typeof studyStreaksTable.$inferSelect;

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  completed: boolean("completed").default(false).notNull(),
  order: integer("order").default(0),
  estimatedMinutes: integer("estimated_minutes"),
  category: text("category").default("General"),
  priority: text("priority").default("medium"),
  tags: jsonb("tags").$type<string[]>().default([]),
  dueDate: text("due_date"),
  recurring: text("recurring"),
  completedAt: timestamp("completed_at"),
  status: text("status").default("active"),
  missedAt: timestamp("missed_at"),
  missCount: integer("miss_count").default(0),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("tasks_user_id_idx").on(t.userId),
]);

export type Task = typeof tasksTable.$inferSelect;

export const goalsTable = pgTable("goals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Goal = typeof goalsTable.$inferSelect;

export const userWalletsTable = pgTable("user_wallets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  coins: integer("coins").notNull().default(0),
  totalXp: integer("total_xp").notNull().default(0),
  weeklyXp: integer("weekly_xp").notNull().default(0),
  weeklyXpResetAt: timestamp("weekly_xp_reset_at").defaultNow(),
  level: integer("level").notNull().default(1),
  prestige: integer("prestige").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserWallet = typeof userWalletsTable.$inferSelect;

export const userBadgesTable = pgTable("user_badges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: text("badge_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export type UserBadge = typeof userBadgesTable.$inferSelect;

// ─── DAILY/WEEKLY MISSIONS ───────────────────────────────────────────────────

export const missionsTable = pgTable("missions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  missionKey: text("mission_key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("daily"),
  category: text("category").notNull().default("focus"),
  xpReward: integer("xp_reward").notNull().default(100),
  coinReward: integer("coin_reward").notNull().default(50),
  targetValue: integer("target_value").notNull().default(1),
  unit: text("unit").notNull().default("sessions"),
  icon: text("icon").notNull().default("🎯"),
  difficulty: text("difficulty").notNull().default("easy"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Mission = typeof missionsTable.$inferSelect;

export const userMissionProgressTable = pgTable("user_mission_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  missionKey: text("mission_key").notNull(),
  periodStart: text("period_start").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  rewardClaimed: boolean("reward_claimed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("mission_progress_user_period_idx").on(t.userId, t.periodStart),
]);

export type UserMissionProgress = typeof userMissionProgressTable.$inferSelect;

// ─── SOCIAL ───────────────────────────────────────────────────────────────────

export const friendshipsTable = pgTable("friendships", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  requesterId: text("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  addresseeId: text("addressee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("friendships_requester_idx").on(t.requesterId),
  index("friendships_addressee_idx").on(t.addresseeId),
]);

export type Friendship = typeof friendshipsTable.$inferSelect;

// ─── PRODUCTIVITY LOGS ────────────────────────────────────────────────────────

export const productivityLogsTable = pgTable("productivity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  focusMinutes: integer("focus_minutes").notNull().default(0),
  sessionsCompleted: integer("sessions_completed").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  avgFocusScore: real("avg_focus_score"),
  productivityScore: real("productivity_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("productivity_logs_user_date_idx").on(t.userId, t.date),
]);

export type ProductivityLog = typeof productivityLogsTable.$inferSelect;

// ─── EXISTING TABLES (unchanged) ─────────────────────────────────────────────

export const readinessLogsTable = pgTable("readiness_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  sleep: integer("sleep").notNull(),
  stress: integer("stress").notNull(),
  energy: integer("energy").notNull(),
  score: integer("score").notNull(),
  sessionLengthRec: integer("session_length_rec").notNull(),
  hrv: integer("hrv"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReadinessLog = typeof readinessLogsTable.$inferSelect;

export const distractionLogsTable = pgTable("distraction_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  reason: text("reason").notNull(),
  worthIt: boolean("worth_it").notNull().default(false),
  hour: integer("hour").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DistractionLog = typeof distractionLogsTable.$inferSelect;

export const focusProfilesTable = pgTable("focus_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ssid: text("ssid"),
  blockedDomains: jsonb("blocked_domains").$type<string[]>().default([]),
  whitelist: jsonb("whitelist").$type<string[]>().default([]),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FocusProfile = typeof focusProfilesTable.$inferSelect;

export const focusDnaTable = pgTable("focus_dna", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  archetype: text("archetype").notNull(),
  description: text("description").notNull(),
  colorPrimary: text("color_primary").notNull(),
  colorSecondary: text("color_secondary").notNull(),
  icon: text("icon").notNull(),
  topFocusHour: integer("top_focus_hour"),
  avgSessionMin: integer("avg_session_min"),
  strongestDay: text("strongest_day"),
  biggestWeakness: text("biggest_weakness"),
  sessionCountAtGeneration: integer("session_count_at_generation").notNull().default(0),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FocusDna = typeof focusDnaTable.$inferSelect;

export const sessionGhostsTable = pgTable("session_ghosts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  taskCategory: text("task_category").notNull().default("General"),
  bestDurationSec: integer("best_duration_sec").notNull().default(0),
  bestUnbrokenSec: integer("best_unbroken_sec").notNull().default(0),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SessionGhost = typeof sessionGhostsTable.$inferSelect;

export const consequenceContractsTable = pgTable("consequence_contracts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  weekStart: text("week_start").notNull(),
  contractType: text("contract_type").notNull(),
  targetMinutes: integer("target_minutes").notNull().default(0),
  charityName: text("charity_name"),
  charityAmount: integer("charity_amount"),
  achieved: boolean("achieved").default(false).notNull(),
  consequenceTriggered: boolean("consequence_triggered").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ConsequenceContract = typeof consequenceContractsTable.$inferSelect;

export const freezeTokensTable = pgTable("freeze_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  tokensAvailable: integer("tokens_available").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FreezeToken = typeof freezeTokensTable.$inferSelect;

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;

export const roadmapsTable = pgTable("roadmaps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Roadmap = typeof roadmapsTable.$inferSelect;

export const breakFreeStreaksTable = pgTable("break_free_streaks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  relapseCount: integer("relapse_count").notNull().default(0),
  lastRelapseDate: text("last_relapse_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BreakFreeStreak = typeof breakFreeStreaksTable.$inferSelect;

export const breakFreeMoodsTable = pgTable("break_free_moods", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mood: integer("mood").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BreakFreeMood = typeof breakFreeMoodsTable.$inferSelect;

export const breakFreePledgesTable = pgTable("break_free_pledges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  message: text("message").notNull(),
  postedAt: timestamp("posted_at").defaultNow().notNull(),
});

export type BreakFreePledge = typeof breakFreePledgesTable.$inferSelect;

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("notifications_user_id_idx").on(t.userId)]);

export type Notification = typeof notificationsTable.$inferSelect;

// ─── LOGIN REWARDS ─────────────────────────────────────────────────────────────

export const loginRewardsTable = pgTable("login_rewards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  lastClaimedDate: text("last_claimed_date"),
  claimStreak: integer("claim_streak").notNull().default(0),
  totalClaimed: integer("total_claimed").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LoginReward = typeof loginRewardsTable.$inferSelect;

// ─── STUDY GROUPS ──────────────────────────────────────────────────────────────

export const studyGroupsTable = pgTable("study_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  groupXp: integer("group_xp").notNull().default(0),
  groupLevel: integer("group_level").notNull().default(1),
  isPublic: boolean("is_public").default(true).notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  maxMembers: integer("max_members").notNull().default(20),
  avatarEmoji: text("avatar_emoji").notNull().default("🎯"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StudyGroup = typeof studyGroupsTable.$inferSelect;

export const groupMembersTable = pgTable("group_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text("group_id").notNull().references(() => studyGroupsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  xpContribution: integer("xp_contribution").notNull().default(0),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [
  index("group_members_group_idx").on(t.groupId),
  index("group_members_user_idx").on(t.userId),
]);

export type GroupMember = typeof groupMembersTable.$inferSelect;

// ─── BATTLE PASS ───────────────────────────────────────────────────────────────

export const battlePassProgressTable = pgTable("battle_pass_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  season: integer("season").notNull().default(1),
  tier: integer("tier").notNull().default(0),
  seasonXp: integer("season_xp").notNull().default(0),
  premiumUnlocked: boolean("premium_unlocked").default(false).notNull(),
  claimedTiers: jsonb("claimed_tiers").$type<number[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BattlePassProgress = typeof battlePassProgressTable.$inferSelect;

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────────

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: jsonb("details"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("audit_logs_user_idx").on(t.userId)]);

export type AuditLog = typeof auditLogsTable.$inferSelect;

// ─── FOLLOWS ───────────────────────────────────────────────────────────────────

export const followsTable = pgTable("follows", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  followerId: text("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("follows_follower_idx").on(t.followerId),
  index("follows_following_idx").on(t.followingId),
]);

export type Follow = typeof followsTable.$inferSelect;
