import { pgTable, text, timestamp, boolean, integer, jsonb, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable as users, socialPostsTable } from "./focusarx";

/**
 * Platform-scale tables for V4 workstreams A/B/F/G:
 *  - bot_pending_replies   (A: staggered bot replies to human posts)
 *  - admin_drops / admin_drop_claims (B: scheduled hype events)
 *  - admin_sql_log         (F: immutable SQL console history)
 *  - ai_call_log / ai_budget_state / ai_ideas / ai_briefings (G: Gemini chief-of-staff)
 *
 * Every column is nullable or defaulted so `drizzle-kit push` never needs a
 * data-destroying prompt and existing rows survive.
 */

// ─── A: BOT SOCIAL SIMULATOR ─────────────────────────────────────────────────

/**
 * Staggered bot replies. When a human posts, 0–2 topic-matched replies are
 * queued here with a future `dueAt` (1–8h later). A lazy tick (feed load,
 * leaderboard view, post creation) materialises replies whose due time has
 * passed — no cron, idempotent, restart-safe.
 */
export const botPendingRepliesTable = pgTable("bot_pending_replies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id").notNull().references(() => socialPostsTable.id, { onDelete: "cascade" }),
  botId: text("bot_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: text("parent_id"),
  dueAt: timestamp("due_at").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "sent" | "skipped"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
}, (t) => [
  index("bot_pending_replies_due_idx").on(t.status, t.dueAt),
  index("bot_pending_replies_post_idx").on(t.postId),
]);

export type BotPendingReply = typeof botPendingRepliesTable.$inferSelect;

// ─── B: ADMIN DROPS ──────────────────────────────────────────────────────────

/**
 * Scheduled hype events created from the admin panel (or proposed by Gemini,
 * approved by an admin). `type` is one of:
 *   coin_rain | double_xp | flash_quest | streak_freeze | item_flash_sale | board_shakeup
 */
export const adminDropsTable = pgTable("admin_drops", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  poolTotal: integer("pool_total").notNull().default(0),
  poolClaimed: integer("pool_claimed").notNull().default(0),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdVia: text("created_via").notNull().default("admin"), // "admin" | "gemini"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (t) => [
  index("admin_drops_window_idx").on(t.startsAt, t.endsAt),
  index("admin_drops_active_idx").on(t.isActive),
]);

export type AdminDrop = typeof adminDropsTable.$inferSelect;

/** One claim per (drop, user) — the unique constraint is the double-claim guard. */
export const adminDropClaimsTable = pgTable("admin_drop_claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dropId: text("drop_id").notNull().references(() => adminDropsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
  itemGranted: text("item_granted"),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
}, (t) => [
  unique("admin_drop_claims_drop_user_unique").on(t.dropId, t.userId),
  index("admin_drop_claims_drop_idx").on(t.dropId),
  index("admin_drop_claims_user_idx").on(t.userId),
]);

export type AdminDropClaim = typeof adminDropClaimsTable.$inferSelect;

// ─── F: IMMUTABLE SQL CONSOLE LOG ────────────────────────────────────────────

/**
 * Every statement executed in write mode of the admin SQL console.
 * Insert-only by convention (no UPDATE/DELETE routes ever target this table).
 */
export const adminSqlLogTable = pgTable("admin_sql_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminId: text("admin_id").references(() => users.id, { onDelete: "set null" }),
  sql: text("sql").notNull(),
  kind: text("kind").notNull().default("write"), // "read" | "write"
  rowsAffected: integer("rows_affected").notNull().default(0),
  status: text("status").notNull().default("ok"), // "ok" | "error" | "blocked"
  error: text("error"),
  branchName: text("branch_name"), // Neon restore-point branch, when created
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("admin_sql_log_created_idx").on(t.createdAt)]);

export type AdminSqlLog = typeof adminSqlLogTable.$inferSelect;

// ─── G: GEMINI CHIEF-OF-STAFF ────────────────────────────────────────────────

/** One row per AI call (Gemini/Groq). Feeds the budget meter + cost reports. */
export const aiCallLogTable = pgTable("ai_call_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull(), // "gemini" | "groq"
  model: text("model").notNull(),
  purpose: text("purpose").notNull(), // "arx_reply" | "briefing" | "seo" | "console" | "ideas" | ...
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // for per-user caps (Arx 30/day)
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: text("status").notNull().default("ok"), // "ok" | "error" | "rate_limited" | "fallback"
  fallbackUsed: boolean("fallback_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("ai_call_log_created_idx").on(t.createdAt),
  index("ai_call_log_purpose_idx").on(t.purpose, t.createdAt),
  index("ai_call_log_user_purpose_idx").on(t.userId, t.purpose, t.createdAt),
]);

export type AiCallLog = typeof aiCallLogTable.$inferSelect;

/**
 * Per-provider daily counters, persisted so serverless instances share the
 * budget. `day` is the IST date key (YYYY-MM-DD).
 */
export const aiBudgetStateTable = pgTable("ai_budget_state", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull().default("gemini"),
  day: text("day").notNull(),
  callsUsed: integer("calls_used").notNull().default(0),
  cap: integer("cap").notNull().default(1500),
  coolUntil: timestamp("cool_until"), // set after 429s (exponential backoff)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("ai_budget_state_provider_day_unique").on(t.provider, t.day)]);

export type AiBudgetState = typeof aiBudgetStateTable.$inferSelect;

/** Gemini's running, prioritised idea backlog. */
export const aiIdeasTable = pgTable("ai_ideas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("growth"), // "growth" | "seo" | "feature" | "event"
  effort: text("effort").notNull().default("medium"), // "small" | "medium" | "large"
  impact: text("impact").notNull().default("medium"), // "low" | "medium" | "high"
  source: text("source").notNull().default("gemini"), // "gemini" | "admin"
  status: text("status").notNull().default("backlog"), // "backlog" | "approved" | "done" | "rejected"
  promotedToTask: text("promoted_to_task"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("ai_ideas_status_idx").on(t.status, t.createdAt),
]);

export type AiIdea = typeof aiIdeasTable.$inferSelect;

/** Daily operations briefings (IST mornings) + ad-hoc analyses. */
export const aiBriefingsTable = pgTable("ai_briefings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  day: text("day").notNull(),
  kind: text("kind").notNull().default("daily"), // "daily" | "seo" | "cost"
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  summary: text("summary").notNull().default(""),
  emailed: boolean("emailed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("ai_briefings_day_kind_unique").on(t.day, t.kind),
]);

export type AiBriefing = typeof aiBriefingsTable.$inferSelect;

/**
 * Tiny key-value store for lazy-tick coordination (no cron on serverless).
 * e.g. `bot_tick_day` → "2026-08-24" so exactly one instance runs the daily
 * bot tick per day even across cold starts.
 */
export const platformMetaTable = pgTable("platform_meta", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformMeta = typeof platformMetaTable.$inferSelect;

/**
 * Immutable audit log for AI-initiated + admin-power actions
 * (rule #9: every AI action is logged with actor/model/payload/timestamp;
 * powerful actions are logged again on approval).
 */
export const aiActionAuditTable = pgTable("ai_action_audit", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actor: text("actor").notNull(), // user id, "gemini", or "system"
  actorRole: text("actor_role").notNull().default("system"), // "admin" | "system" | "gemini"
  model: text("model"),
  action: text("action").notNull(), // "post_publish" | "drop_create" | "wallet_edit" | ...
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  outcome: text("outcome").notNull().default("pending"), // "pending" | "approved" | "rejected" | "executed" | "failed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("ai_action_audit_created_idx").on(t.createdAt),
  index("ai_action_audit_action_idx").on(t.action),
]);

export type AiActionAudit = typeof aiActionAuditTable.$inferSelect;
