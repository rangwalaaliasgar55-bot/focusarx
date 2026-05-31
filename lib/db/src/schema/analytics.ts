import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./focusarx";

/** Anonymous site visitors — separate from auth users table. */
export const visitorsTable = pgTable(
  "visitors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    firstSeen: timestamp("first_seen").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    visitCount: integer("visit_count").notNull().default(0),
    deviceType: text("device_type"),
    browser: text("browser"),
    os: text("os"),
    country: text("country"),
    city: text("city"),
    isBot: boolean("is_bot").notNull().default(false),
  },
  (t) => [
    uniqueIndex("visitors_visitor_id_idx").on(t.visitorId),
    index("visitors_last_seen_idx").on(t.lastSeen),
    index("visitors_user_id_idx").on(t.userId),
  ],
);

export type Visitor = typeof visitorsTable.$inferSelect;

/** Web analytics sessions (not Pomodoro focus sessions). */
export const analyticsSessionsTable = pgTable(
  "analytics_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    visitorId: text("visitor_id").notNull(),
    sessionStart: timestamp("session_start").defaultNow().notNull(),
    sessionEnd: timestamp("session_end"),
    durationSec: integer("duration_sec").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    focusSessionsStarted: integer("focus_sessions_started").notNull().default(0),
    tasksCreated: integer("tasks_created").notNull().default(0),
    roadmapsGenerated: integer("roadmaps_generated").notNull().default(0),
    aiFeaturesUsed: integer("ai_features_used").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  },
  (t) => [
    index("analytics_sessions_visitor_id_idx").on(t.visitorId),
    index("analytics_sessions_last_activity_idx").on(t.lastActivityAt),
  ],
);

export type AnalyticsSession = typeof analyticsSessionsTable.$inferSelect;

export const pageViewsTable = pgTable(
  "page_views",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id").notNull(),
    page: text("page").notNull(),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  },
  (t) => [
    index("page_views_visitor_id_idx").on(t.visitorId),
    index("page_views_session_id_idx").on(t.sessionId),
    index("page_views_viewed_at_idx").on(t.viewedAt),
  ],
);

export type PageView = typeof pageViewsTable.$inferSelect;

export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id"),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("analytics_events_event_id_idx").on(t.eventId),
    index("analytics_events_created_at_idx").on(t.createdAt),
    index("analytics_events_visitor_id_idx").on(t.visitorId),
  ],
);

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
