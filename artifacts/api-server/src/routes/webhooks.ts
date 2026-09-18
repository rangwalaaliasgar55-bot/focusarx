/**
 * §1.6 — webhook endpoint management.
 *
 * The user-facing half of `lib/webhooks.ts`. Two rules shape every route here:
 *
 * **The signing secret is shown exactly once.** `POST /webhooks` returns it in
 * the response and never again — `GET` returns only an eight-character hint.
 * The alternative, returning the decrypted secret whenever it is asked for,
 * means a stolen session can be used to *collect the signing keys* of every
 * endpoint the user owns, and the ciphertext at rest buys nothing.
 *
 * **Every write is validated as untrusted input, including the URL.** A webhook
 * URL is a "fetch this for me" primitive, so `validateWebhookUrl` runs on the
 * way in *and* the delivery worker re-checks before each POST: DNS can be
 * repointed at a private address after the fact.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { webhookDeliveriesTable, webhookEndpointsTable } from "@workspace/db/schema";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  decryptSecret,
  encryptSecret,
  generateSecret,
  secretsConfigured,
  secretHint,
} from "../lib/secrets";
import {
  attemptDelivery,
  deliveryStats,
  drainDeliveries,
  MAX_CONSECUTIVE_FAILURES,
  signPayload,
  validateWebhookUrl,
  WEBHOOK_EVENTS,
} from "../lib/webhooks";
import { logger } from "../lib/logger";

export const webhooksRouter = Router();

/** One place that turns "no key configured" into a consistent 503. */
function requireSecrets(res: Response): boolean {
  if (secretsConfigured()) return true;
  res.status(503).json({
    error: "Webhooks are not available on this deployment yet",
    code: "WEBHOOKS_NOT_CONFIGURED",
  });
  return false;
}

const endpointIdSchema = z.string().min(1).max(64);

const createSchema = z.object({
  url: z.string().min(1).max(2048),
  description: z.string().max(120).optional(),
  events: z.array(z.string()).max(WEBHOOK_EVENTS.length).optional(),
});

const updateSchema = z.object({
  url: z.string().min(1).max(2048).optional(),
  description: z.string().max(120).nullable().optional(),
  events: z.array(z.string()).max(WEBHOOK_EVENTS.length).optional(),
  active: z.boolean().optional(),
});

/** Drop names that are not in the catalog. Storing one would be a silent
 * subscription to nothing, which reads as a broken endpoint. */
function normaliseEvents(events: string[] | undefined): string[] {
  if (!events) return [];
  const known = new Set<string>(WEBHOOK_EVENTS);
  return [...new Set(events.filter((e) => known.has(e)))];
}

function shapeEndpoint(row: typeof webhookEndpointsTable.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    events: row.events,
    active: row.active,
    secretHint: row.secretHint,
    failureCount: row.failureCount,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    disabledReason: row.disabledReason,
    createdAt: row.createdAt,
  };
}

/** Load an endpoint, scoped to the caller. Returns null for someone else's. */
async function ownedEndpoint(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.userId, userId)))
    .limit(1);
  return row ?? null;
}

// ─── CATALOG ─────────────────────────────────────────────────────────────────

/** The event names, so a client can render a subscription picker. */
webhooksRouter.get("/webhooks/events", authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ events: WEBHOOK_EVENTS });
});

// ─── LIST ────────────────────────────────────────────────────────────────────

webhooksRouter.get("/webhooks", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const endpoints = await db
      .select()
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.userId, userId))
      .orderBy(desc(webhookEndpointsTable.createdAt));
    const stats = await deliveryStats(userId);
    res.json({
      endpoints: endpoints.map(shapeEndpoint),
      stats,
      available: secretsConfigured(),
      maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
    });
  } catch (err) {
    logger.error({ err }, "webhooks: list failed");
    res.status(500).json({ error: "Could not load webhooks" });
  }
});

// ─── CREATE ──────────────────────────────────────────────────────────────────

webhooksRouter.post("/webhooks", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid webhook" });

    const check = validateWebhookUrl(parsed.data.url);
    if (!check.ok) return res.status(400).json({ error: check.reason, code: "INVALID_WEBHOOK_URL" });

    const userId = req.userId;
    // A cap per user. Without one, a script can create endpoints until the
    // delivery worker is doing nothing but failing to reach them.
    const existing = await db
      .select({ id: webhookEndpointsTable.id })
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.userId, userId));
    if (existing.length >= 10) {
      return res.status(409).json({ error: "You can have at most 10 webhook endpoints", code: "TOO_MANY_ENDPOINTS" });
    }

    const secret = generateSecret();
    const [row] = await db
      .insert(webhookEndpointsTable)
      .values({
        userId,
        url: parsed.data.url.trim(),
        description: parsed.data.description ?? null,
        secretEnc: encryptSecret(secret),
        secretHint: secretHint(secret),
        events: normaliseEvents(parsed.data.events),
      })
      .returning();

    // The only time the plaintext is ever returned. `secretHint` is what every
    // later read shows.
    res.status(201).json({ endpoint: shapeEndpoint(row!), secret });
  } catch (err) {
    logger.error({ err }, "webhooks: create failed");
    res.status(500).json({ error: "Could not create the webhook" });
  }
});

// ─── UPDATE ──────────────────────────────────────────────────────────────────

webhooksRouter.patch("/webhooks/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid update" });

    const existing = await ownedEndpoint(req.userId, id.data);
    if (!existing) return res.status(404).json({ error: "Webhook not found" });

    if (parsed.data.url !== undefined) {
      const check = validateWebhookUrl(parsed.data.url);
      if (!check.ok) return res.status(400).json({ error: check.reason, code: "INVALID_WEBHOOK_URL" });
    }

    const [row] = await db
      .update(webhookEndpointsTable)
      .set({
        ...(parsed.data.url !== undefined ? { url: parsed.data.url.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.events !== undefined ? { events: normaliseEvents(parsed.data.events) } : {}),
        // Re-enabling clears the reason and the failure run, so a fixed receiver
        // starts from a clean slate rather than one failure from disabled again.
        ...(parsed.data.active !== undefined
          ? { active: parsed.data.active, ...(parsed.data.active ? { failureCount: 0, disabledReason: null } : {}) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpointsTable.id, id.data))
      .returning();

    res.json({ endpoint: shapeEndpoint(row!) });
  } catch (err) {
    logger.error({ err }, "webhooks: update failed");
    res.status(500).json({ error: "Could not update the webhook" });
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

webhooksRouter.delete("/webhooks/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const deleted = await db
      .delete(webhookEndpointsTable)
      .where(and(eq(webhookEndpointsTable.id, id.data), eq(webhookEndpointsTable.userId, req.userId)))
      .returning({ id: webhookEndpointsTable.id });
    if (deleted.length === 0) return res.status(404).json({ error: "Webhook not found" });
    // Deliveries cascade with the endpoint. Reporting the count makes that
    // visible rather than leaving "where did my history go" as a question.
    res.json({ deleted: true, id: deleted[0]!.id });
  } catch (err) {
    logger.error({ err }, "webhooks: delete failed");
    res.status(500).json({ error: "Could not delete the webhook" });
  }
});

// ─── ROTATE SECRET ───────────────────────────────────────────────────────────

webhooksRouter.post("/webhooks/:id/rotate", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const existing = await ownedEndpoint(req.userId, id.data);
    if (!existing) return res.status(404).json({ error: "Webhook not found" });

    const secret = generateSecret();
    await db
      .update(webhookEndpointsTable)
      .set({ secretEnc: encryptSecret(secret), secretHint: secretHint(secret), updatedAt: new Date() })
      .where(eq(webhookEndpointsTable.id, id.data));
    // Rotating invalidates the old secret immediately — that is what the user
    // pressed the button for. Deliveries still pending will now fail signature
    // checks at the receiver, which is stated in the UI copy rather than hidden.
    res.json({ secret });
  } catch (err) {
    logger.error({ err }, "webhooks: rotate failed");
    res.status(500).json({ error: "Could not rotate the secret" });
  }
});

// ─── DELIVERY HISTORY ────────────────────────────────────────────────────────

webhooksRouter.get("/webhooks/deliveries", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const endpointId = typeof req.query.endpointId === "string" ? req.query.endpointId : null;

    const conditions = [eq(webhookDeliveriesTable.userId, userId)];
    if (status && ["pending", "sending", "success", "failed", "dropped"].includes(status)) {
      conditions.push(eq(webhookDeliveriesTable.status, status));
    }
    if (endpointId) {
      // Scoped through `ownedEndpoint` so a foreign id returns nothing rather
      // than leaking that the id exists.
      const owned = await ownedEndpoint(userId, endpointId);
      if (!owned) return res.json({ deliveries: [] });
      conditions.push(eq(webhookDeliveriesTable.endpointId, endpointId));
    }

    const rows = await db
      .select({
        id: webhookDeliveriesTable.id,
        endpointId: webhookDeliveriesTable.endpointId,
        event: webhookDeliveriesTable.event,
        status: webhookDeliveriesTable.status,
        attempts: webhookDeliveriesTable.attempts,
        nextAttemptAt: webhookDeliveriesTable.nextAttemptAt,
        responseStatus: webhookDeliveriesTable.responseStatus,
        responseBody: webhookDeliveriesTable.responseBody,
        durationMs: webhookDeliveriesTable.durationMs,
        error: webhookDeliveriesTable.error,
        createdAt: webhookDeliveriesTable.createdAt,
        deliveredAt: webhookDeliveriesTable.deliveredAt,
        url: webhookEndpointsTable.url,
      })
      .from(webhookDeliveriesTable)
      .innerJoin(webhookEndpointsTable, eq(webhookEndpointsTable.id, webhookDeliveriesTable.endpointId))
      .where(and(...conditions))
      .orderBy(desc(webhookDeliveriesTable.createdAt))
      .limit(limit);

    res.json({ deliveries: rows });
  } catch (err) {
    logger.error({ err }, "webhooks: deliveries failed");
    res.status(500).json({ error: "Could not load deliveries" });
  }
});

// ─── SEND A TEST ─────────────────────────────────────────────────────────────

/**
 * Deliver a synthetic event, synchronously.
 *
 * The one route that waits on the network, because the whole point is to tell
 * the user whether their endpoint works *now* — a queued test that reports
 * "queued" answers nothing. A success here also clears the failure run, so
 * fixing a receiver and pressing the button is enough to re-enable a
 * disabled endpoint.
 */
webhooksRouter.post("/webhooks/:id/test", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const endpoint = await ownedEndpoint(req.userId, id.data);
    if (!endpoint) return res.status(404).json({ error: "Webhook not found" });

    // Re-validated at send time: the URL was checked when it was saved, but DNS
    // can be repointed at a private address afterwards, and this is the request
    // that would reach it.
    const check = validateWebhookUrl(endpoint.url);
    if (!check.ok) {
      return res.status(400).json({ error: check.reason ?? "That URL cannot be reached", code: "UNSAFE_WEBHOOK_URL" });
    }

    const secret = decryptSecret(endpoint.secretEnc);
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event: "webhook.test",
      createdAt: new Date().toISOString(),
      data: { message: "This is a test delivery from Focusarx.", endpointId: endpoint.id },
    });
    const outcome = await attemptDelivery(endpoint.url, secret, body, "webhook.test", crypto.randomUUID());

    if (outcome.ok) {
      await db
        .update(webhookEndpointsTable)
        .set({ failureCount: 0, lastSuccessAt: new Date(), disabledReason: null, updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, endpoint.id));
    } else {
      await db
        .update(webhookEndpointsTable)
        .set({ failureCount: endpoint.failureCount + 1, lastFailureAt: new Date(), updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, endpoint.id));
    }

    res.json({
      ok: outcome.ok,
      status: outcome.status ?? null,
      durationMs: outcome.durationMs,
      error: outcome.error ?? null,
      // Shown so the user can watch the header arrive in their own logs, which
      // is the only way to confirm the signature format matches.
      signatureHeaderFormat: "X-Focusarx-Signature: t=<unix>,v1=<hex hmac-sha256 over `${t}.${body}`>",
    });
  } catch (err) {
    logger.error({ err }, "webhooks: test failed");
    res.status(500).json({ error: "Could not send the test delivery" });
  }
});

// ─── REDELIVER ───────────────────────────────────────────────────────────────

webhooksRouter.post("/webhooks/deliveries/:id/replay", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db
      .select()
      .from(webhookDeliveriesTable)
      .where(and(eq(webhookDeliveriesTable.id, id.data), eq(webhookDeliveriesTable.userId, req.userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Delivery not found" });

    const [endpoint] = await db
      .select()
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.id, row.endpointId))
      .limit(1);
    if (!endpoint) return res.status(409).json({ error: "That endpoint no longer exists", code: "ENDPOINT_GONE" });
    if (!endpoint.active) {
      return res.status(409).json({ error: "Re-enable the endpoint before replaying", code: "ENDPOINT_DISABLED" });
    }

    // A *new* row, not a reset of the old one. The original result is history
    // the user may be relying on, and a new `deliveryId` means a receiver that
    // deduped the first attempt does not discard the replay.
    const [created] = await db
      .insert(webhookDeliveriesTable)
      .values({
        endpointId: endpoint.id,
        userId: req.userId,
        event: row.event,
        payload: row.payload,
        status: "pending",
        deliveryId: crypto.randomUUID(),
        nextAttemptAt: new Date(),
      })
      .returning({ id: webhookDeliveriesTable.id, deliveryId: webhookDeliveriesTable.deliveryId });

    // Deliver now rather than waiting for the worker's tick, so the UI can show
    // the result without a poll.
    const outcome = await drainDeliveries(1);
    res.status(202).json({ queued: true, id: created!.id, deliveryId: created!.deliveryId, drain: outcome });
  } catch (err) {
    logger.error({ err }, "webhooks: replay failed");
    res.status(500).json({ error: "Could not replay the delivery" });
  }
});

// ─── DRAIN (operational) ─────────────────────────────────────────────────────

/**
 * Force a drain.
 *
 * Exposed because delivery is normally driven by an interval worker, and an
 * operator watching a backlog wants to know whether draining it is the fix
 * before waiting for the tick. Restricted to the caller's own rows by the
 * worker's query, and rate-limited by the global limiter like every other route.
 */
webhooksRouter.post("/webhooks/drain", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const owned = await db
      .select({ id: webhookEndpointsTable.id })
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.userId, req.userId));
    if (owned.length === 0) return res.json({ processed: 0, succeeded: 0, failed: 0, retrying: 0 });
    // The global worker drains everyone; it is idempotent and safe to trigger,
    // and a per-user drain would need the same claim logic a second time.
    const result = await drainDeliveries(20);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "webhooks: drain failed");
    res.status(500).json({ error: "Could not drain deliveries" });
  }
});

/** Sign a body with an endpoint's secret, so the user can verify their own
 * implementation against ours. Confirmatory only — the secret is not revealed. */
webhooksRouter.post("/webhooks/:id/sign", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireSecrets(res)) return;
  try {
    const id = endpointIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "Invalid id" });
    const endpoint = await ownedEndpoint(req.userId, id.data);
    if (!endpoint) return res.status(404).json({ error: "Webhook not found" });
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    if (body.length > 4096) return res.status(400).json({ error: "Body too large" });
    const secret = decryptSecret(endpoint.secretEnc);
    res.json({ header: signPayload(secret, Math.floor(Date.now() / 1000), body) });
  } catch (err) {
    logger.error({ err }, "webhooks: sign failed");
    res.status(500).json({ error: "Could not sign the body" });
  }
});
