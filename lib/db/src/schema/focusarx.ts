import { pgTable, text, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  hashedPassword: text("hashed_password"),
  guestKey: text("guest_key").unique(),
  isGuest: boolean("is_guest").default(false).notNull(),
  role: text("role").default("user").notNull(), // "user" | "admin"
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingData: jsonb("onboarding_data"),
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
  completedAt: timestamp("completed_at"),
  focusScore: real("focus_score"),
  focusQuality: text("focus_quality"),
  stabilityRating: text("stability_rating"),
  focusTimeline: text("focus_timeline"),
  sessionInsights: text("session_insights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
