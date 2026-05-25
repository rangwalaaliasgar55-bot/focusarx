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
