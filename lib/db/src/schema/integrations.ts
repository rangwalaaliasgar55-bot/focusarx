import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable as users } from "./focusarx";

/**
 * §1.6 — webhook and integration layer.
 *
 * Three tables, three jobs:
 *
 *   webhook_endpoints     — where a user's events go, and the secret we sign with
 *   webhook_deliveries    — one row per attempt, so a delivery is auditable and
 *                           retryable rather than fire-and-forget
 *   integration_connections — third-party OAuth grants (Calendar, Slack, …)
 *
 * Two deliberate choices worth stating, because they are the ones that are
 * expensive to change later:
 *
 * **Secrets are stored encrypted, never in plaintext.** `secret_enc` holds an
 * AES-256-GCM ciphertext (see `lib/secrets.ts`). A webhook secret in plaintext
 * is a signing key that anyone with a database read — a backup, a replica, a
 * support query — can use to forge deliveries into a user's own endpoint, which
 * defeats the entire point of signing them.
 *
 * **Deliveries are rows, not log lines.** The prompt asks for retry with
 * backoff; a retry needs state that survives a restart, and an operator asked
 * "did my webhook fire?" needs an answer that is not a grep through stdout.
 */

export const webhookEndpointsTable = pgTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Human label, so a user with several endpoints can tell them apart. */
    description: text("description"),
    /**
     * Base64 AES-256-GCM ciphertext of the signing secret. The plaintext is
     * shown exactly once, at creation, and is not recoverable afterwards.
     */
    secretEnc: text("secret_enc").notNull(),
    /** First 8 chars of the plaintext, so a user can match a secret to a log line. */
    secretHint: text("secret_hint").notNull(),
    /** Event names this endpoint subscribes to. Empty array means "all". */
    events: jsonb("events").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    /**
     * Consecutive failures. The endpoint is disabled once this crosses
     * `MAX_CONSECUTIVE_FAILURES` — continuing to POST to a URL that has failed
     * a hundred times is how an integration layer gets a reputation for abuse.
     * Reset to 0 by any success, and by an explicit test delivery.
     */
    failureCount: integer("failure_count").notNull().default(0),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    /** Set when auto-disabled, cleared when the user re-enables. */
    disabledReason: text("disabled_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("webhook_endpoints_user_idx").on(t.userId),
    // Delivery looks up "every active endpoint subscribed to this event" for a
    // single user; both columns are in that filter.
    index("webhook_endpoints_active_idx").on(t.userId, t.active),
  ],
);

export const webhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpointsTable.id, { onDelete: "cascade" }),
    /** Denormalised so a delivery survives its endpoint being deleted and a
     * delivery can be listed without a join. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    /** The exact body that was signed. Stored verbatim: a redelivery has to
     * resend byte-identical content or the signature the receiver stored will
     * not verify. */
    payload: jsonb("payload").notNull(),
    /**
     * pending  — awaiting its first or next attempt
     * success  — 2xx received (or, for redelivery, a manual resolution)
     * failed   — retries exhausted; terminal, and visible to the user
     * dropped  — the endpoint was deleted or disabled while this was pending
     */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    /** Scheduler cursor. Null on terminal rows. */
    nextAttemptAt: timestamp("next_attempt_at"),
    /** The idempotency key we send, so a receiver can dedupe our retries. */
    deliveryId: text("delivery_id").notNull(),
    responseStatus: integer("response_status"),
    /** First 2KB of the response body — enough to debug, not enough to bloat. */
    responseBody: text("response_body"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at"),
  },
  (t) => [
    // The retry worker's query: due rows, oldest first.
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
    // The user-facing history list.
    index("webhook_deliveries_user_idx").on(t.userId, t.createdAt),
    index("webhook_deliveries_endpoint_idx").on(t.endpointId, t.createdAt),
    // A receiver may see the same `delivery_id` more than once (that is what a
    // retry is); it must never see two *different* payloads under one id.
    uniqueIndex("webhook_deliveries_delivery_id_idx").on(t.deliveryId),
  ],
);

/**
 * A third-party OAuth grant. Provider-agnostic on purpose: adding Slack should
 * be a registry entry plus an env var, not a new table.
 *
 * Tokens are AES-256-GCM encrypted. A refresh token in plaintext is a durable
 * key to a user's calendar or workspace, and unlike a password it is never
 * rotated by the user.
 */
export const integrationConnectionsTable = pgTable(
  "integration_connections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "google_calendar" | "slack" | "discord" | … — a key in the provider registry. */
    provider: text("provider").notNull(),
    /** The account on the far side, for display ("aliasgar@…"). */
    externalAccountId: text("external_account_id"),
    displayName: text("display_name"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    /** Space-separated, as granted. Surfaced so a user can see what they gave away. */
    scopes: text("scopes"),
    expiresAt: timestamp("expires_at"),
    /** active | expired | revoked | error */
    status: text("status").notNull().default("active"),
    /** Last error from a sync or refresh, so a broken connection explains itself. */
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at"),
    /** Provider-specific cursor (sync token, history id, last message ts). */
    syncCursor: text("sync_cursor"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // One connection per provider per user: reconnecting replaces the grant
    // rather than silently accumulating a second, stale token.
    uniqueIndex("integration_connections_user_provider_idx").on(t.userId, t.provider),
  ],
);

export type WebhookEndpoint = typeof webhookEndpointsTable.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
export type IntegrationConnection = typeof integrationConnectionsTable.$inferSelect;
