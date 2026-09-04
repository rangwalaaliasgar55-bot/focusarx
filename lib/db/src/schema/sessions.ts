// ─── SESSION SECURITY ───────────────────────────────────────────────────────────
//
// Tables for session inventory, rotated refresh tokens, and password-reset-driven
// access-token revocation. Backend-only change — no frontend or env changes.
//
// Design notes:
//  - Refresh tokens are single-use and rotated on every use. A reuse attempt flags
//    the session as revoked (detector pattern).
//  - Access tokens (JWT) live for a short, configurable window; refresh tokens are
//    the long-lived credential. Password resets revoke every active access token for
//    the user by bumping their revocable-snapshot token version.
//  - Admins cannot be forced out of an auth-server session by a password reset, so
//    admin sessions hold a separate `role` snapshot that is not revoked by user
//    password resets. Non-admin sessions are invalidated on password reset.

import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Snapshot of the role at session creation. Stored because password resets
    // should not invalidate admin sessions, and because JWT verification needs a
    // stable role claim that matches what was granted when the token was issued.
    role: text("role").notNull().default("user"),
    refreshToken: text("refresh_token").notNull().unique(),
    // Rotating version of the user's access-token material. Incremented on
    // password reset; access tokens created before the bump are rejected.
    tokenVersion: integer("token_version").notNull().default(1),
    // Rotation last-seen timestamp. Updated every time the refresh token is used.
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    // When the refresh token expires. Default 30 days; rotated tokens get a fresh
    // window each time they are used.
    expiresAt: timestamp("expires_at").notNull(),
    // Active flag — set false on explicit logout, session revocation, or reuse
    // detection. Rows are retained for auditing until cleanup.
    revoked: boolean("revoked").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_refresh_idx").on(t.refreshToken),
  ],
);

export type Session = typeof sessionsTable.$inferSelect;
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  lastSeenAt: true,
  createdAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;

export const passwordResetTokenRevocationsTable = pgTable(
  "password_reset_token_revocations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    passwordResetTokenId: text("password_reset_token_id")
      .notNull()
      .references(() => passwordResetTokensTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenVersionBumpedTo: integer("token_version_bumped_to").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("pr_revocations_reset_token_idx").on(t.passwordResetTokenId),
    index("pr_revocations_user_idx").on(t.userId),
  ],
);

export type PasswordResetTokenRevocation =
  typeof passwordResetTokenRevocationsTable.$inferSelect;
export const insertPasswordResetTokenRevocationSchema =
  createInsertSchema(passwordResetTokenRevocationsTable).omit({
    id: true,
    createdAt: true,
  });
export type InsertPasswordResetTokenRevocation = z.infer<
  typeof insertPasswordResetTokenRevocationSchema
>;
