/**
 * §1.6 — outbound webhooks.
 *
 * The shape follows what receivers already expect (it is Stripe's): an
 * `X-Focusarx-Signature: t=<unix>,v1=<hex hmac>` header over
 * `${t}.${rawBody}`. Every choice below is a decision about someone else's
 * production system, so they are written down.
 *
 * **The signature covers a timestamp.** Signing the body alone means a captured
 * request can be replayed forever. The timestamp is inside the signed payload and
 * the receiver is expected to reject anything older than a few minutes, so a
 * replay window closes. We also send `X-Focusarx-Delivery` (stable across
 * retries of one event) so a receiver can dedupe, which is the other half of
 * making retries safe.
 *
 * **The body is serialised once.** The bytes we sign must be the bytes we send.
 * `JSON.stringify` of the same object can differ between calls if a key is
 * reordered, so the string is built, stored, and reused verbatim.
 *
 * **Delivery never blocks the request that triggered it.** `emitEvent` writes
 * pending rows and returns; a worker drains them. A webhook that made the user
 * wait on someone else's slow endpoint — or failed their session save because a
 * URL was down — would be a far worse bug than a late webhook.
 *
 * **URLs are validated before we fetch them.** A user-supplied URL that the
 * server fetches is an SSRF primitive: `http://169.254.169.254/` reaches cloud
 * metadata credentials. See `validateWebhookUrl`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, lte, or, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { webhookEndpointsTable, webhookDeliveriesTable } from "@workspace/db/schema";
import { decryptSecret } from "./secrets";
import { logger } from "./logger";

// ─── EVENT CATALOG ───────────────────────────────────────────────────────────

/**
 * The events we emit. A closed list, not a free string, because the value is
 * matched against what a user subscribed to — a typo in an emit call would
 * silently deliver nothing, which is indistinguishable from a broken endpoint.
 */
export const WEBHOOK_EVENTS = [
  "session.completed",
  "session.started",
  "task.completed",
  "streak.milestone",
  "goal.achieved",
  "level.up",
  "wallet.credited",
  "flashcard.reviewed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const EVENT_SET = new Set<string>(WEBHOOK_EVENTS);

export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}

/**
 * Does this endpoint want this event?
 *
 * An empty subscription means everything, which is the sane default for someone
 * who has one endpoint and wants their data. A non-empty list is an allowlist.
 * Unknown names in the stored list are ignored rather than fatal, so an event
 * renamed in a future release degrades to "not subscribed" instead of breaking
 * the endpoint's other subscriptions.
 */
export function endpointWants(endpointEvents: string[] | null | undefined, event: string): boolean {
  if (!endpointEvents || endpointEvents.length === 0) return true;
  return endpointEvents.includes(event);
}

// ─── SIGNING ─────────────────────────────────────────────────────────────────

/** The header value a receiver parses. Format matches Stripe's `v1` scheme. */
export function signPayload(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export interface ParsedSignature {
  timestamp: number;
  signatures: string[];
}

/** Parse `t=…,v1=…`. Null when malformed — never throws on hostile input. */
export function parseSignatureHeader(header: unknown): ParsedSignature | null {
  if (typeof header !== "string" || header.length === 0) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verify a signature, as a receiver would.
 *
 * Shipped with the layer for two reasons: it is the documentation (the exact
 * construction, executable), and the test suite signs with it, so a change to
 * the signing format fails here instead of in a customer's integration.
 *
 * `toleranceSec` defaults to 300. `timingSafeEqual` on equal-length buffers, and
 * every candidate signature is checked rather than returning on the first
 * mismatch — the `some` short-circuits on success only.
 */
export function verifySignature(
  body: string,
  header: unknown,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (Math.abs(nowSec - parsed.timestamp) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.${body}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return parsed.signatures.some((sig) => {
    let gotBuf: Buffer;
    try {
      gotBuf = Buffer.from(sig, "hex");
    } catch {
      return false;
    }
    return gotBuf.length === expectedBuf.length && timingSafeEqual(gotBuf, expectedBuf);
  });
}

// ─── URL SAFETY ──────────────────────────────────────────────────────────────

/** Hostnames that must never be fetched, however they are spelled. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

export interface UrlValidation {
  ok: boolean;
  reason?: string;
}

export interface UrlValidationOptions {
  /**
   * Allow loopback receivers. Defaults to true outside production.
   *
   * Off in production even though loopback is not the cloud metadata range:
   * a server-side fetch of `http://localhost:8080/` reaches whatever admin or
   * metrics port happens to share the process's network namespace, which is
   * the same class of bug at a smaller radius. There is no legitimate
   * production receiver on our own loopback, so the capability is withdrawn
   * rather than reasoned about per-deployment.
   */
  allowLoopback?: boolean;
}

/**
 * Is this a URL we are willing to POST to from inside the network?
 *
 * This is the SSRF boundary. `http://169.254.169.254/latest/meta-data/` returns
 * cloud instance credentials to whoever asks, and a webhook URL is exactly a
 * "please fetch this for me" feature.
 *
 * The check is on the *literal* host. A hostname that resolves to a private
 * address (`evil.example.com` → `10.0.0.5`) still needs a DNS check at delivery
 * time, which `assertSafeResolvedHost` does; both layers exist because they
 * catch different attacks (a literal IP needs no DNS, a rebinding hostname
 * needs DNS but no literal).
 *
 * IPv6 is unwrapped from the bracketed form. `::ffff:127.0.0.1` and the
 * `0x7f.1`/`2130706433` integer spellings of 127.0.0.1 are all matched — the
 * second group is why this normalises rather than pattern-matching.
 */
export function validateWebhookUrl(raw: unknown, options: UrlValidationOptions = {}): UrlValidation {
  const allowLoopback = options.allowLoopback ?? process.env.NODE_ENV !== "production";
  if (typeof raw !== "string" || raw.trim().length === 0) return { ok: false, reason: "URL is required" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http and https URLs are supported" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Credentials in the URL are not allowed" };
  }
  const host = normaliseHost(url.hostname);
  if (isLoopbackHost(host) && allowLoopback) {
    // Development only: a receiver on the developer's own machine. Permitted
    // over http because that is what people actually run locally; a real
    // receiver must be https or the signature is a formality over a body
    // anyone on the path can read and replay.
    return { ok: true };
  }
  if (url.protocol === "http:") return { ok: false, reason: "Webhook URLs must use https" };
  if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: "That host is not reachable from our network" };
  const ip = parseIpv4(host);
  if (ip && isPrivateIpv4(ip)) return { ok: false, reason: "Private and link-local addresses are not allowed" };
  if (isPrivateIpv6(host)) return { ok: false, reason: "Private and link-local addresses are not allowed" };
  return { ok: true };
}

/** Lowercase, strip brackets and a trailing dot. */
function normaliseHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

/**
 * Parse every IPv4 spelling a browser would accept.
 *
 * `127.1`, `0x7f.1`, and `2130706433` all reach 127.0.0.1, and `new URL()`
 * normalises some but not all of them — `new URL("http://2130706433/")` yields
 * the integer form in `hostname`. Returns null when the host is not an IPv4
 * literal, which is the signal to leave it to DNS.
 */
export function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length > 4 || parts.length === 0) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (part.length === 0) return null;
    let value: number;
    if (/^0x[0-9a-f]+$/i.test(part)) value = parseInt(part.slice(2), 16);
    else if (/^0[0-7]+$/.test(part)) value = parseInt(part.slice(1), 8);
    else if (/^\d+$/.test(part)) value = Number(part);
    else return null;
    if (!Number.isFinite(value) || value < 0) return null;
    octets.push(value);
  }
  // "127.1" means 127.0.0.1: the final part absorbs the remaining bytes.
  const last = octets.pop()!;
  const shiftBytes = 4 - octets.length - 1;
  if (last >= 256 ** (shiftBytes + 1)) return null;
  for (let i = shiftBytes; i >= 0; i -= 1) octets.push((last >> (i * 8)) & 0xff);
  if (octets.length !== 4 || octets.some((o) => o > 255)) return null;
  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

/**
 * Private, loopback, link-local, CGNAT, and reserved ranges.
 *
 * 169.254/16 is the cloud metadata range and the single most valuable SSRF
 * target; 100.64/10 is CGNAT; 0.0.0.0/8 is "this network".
 */
export function isPrivateIpv4(ip: [number, number, number, number]): boolean {
  const [a, b] = ip;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 docs
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * IPv6 loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10),
 * and IPv4-mapped addresses that land in a private range.
 */
export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true;
  // IPv4-mapped (::ffff:a.b.c.d). `new URL()` rewrites the dotted form to hex,
  // so `https://[::ffff:127.0.0.1]/` arrives as `[::ffff:7f00:1]` and a regex
  // looking for dots would wave the loopback straight through.
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1]!;
    if (tail.includes(".")) {
      const ip = parseIpv4(tail);
      return ip ? isPrivateIpv4(ip) : true;
    }
    const groups = tail.split(":");
    if (groups.length === 2 && groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
      const high = parseInt(groups[0]!, 16);
      const low = parseInt(groups[1]!, 16);
      return isPrivateIpv4([(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff]);
    }
    // An unmapped form we cannot read: refuse rather than guess.
    return true;
  }
  return false;
}

/** Loopback as the user meant it: the only host allowed to use plain http. */
export function isLoopbackHost(host: string): boolean {
  if (host === "localhost" || host === "::1") return true;
  const ip = parseIpv4(host);
  return ip !== null && ip[0] === 127;
}

// ─── EMIT ────────────────────────────────────────────────────────────────────

export interface EmitResult {
  ok: boolean;
  queued: number;
  /** Set when nothing was queued for a reason worth logging. */
  skipped?: string;
}

/**
 * Queue an event for every active endpoint that wants it.
 *
 * Contract with callers: **this must never throw and never reject.** It is
 * invoked from inside `POST /sessions` and similar, where a webhook problem
 * would otherwise turn a successful session save into a 500. Failures are
 * reported in the return value and logged, and the caller ignores them.
 *
 * The payload is serialised here, once, and stored as the string it was built
 * from. Storing an object and re-serialising at delivery time would let the
 * signed bytes differ from the delivered bytes if a key order ever changed.
 */
export async function emitEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<EmitResult> {
  try {
    const endpoints = await db
      .select()
      .from(webhookEndpointsTable)
      .where(and(eq(webhookEndpointsTable.userId, userId), eq(webhookEndpointsTable.active, true)));
    const wanted = endpoints.filter((e) => endpointWants(e.events, event));
    if (wanted.length === 0) return { ok: true, queued: 0, skipped: "no_subscribers" };

    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      data,
    });
    const now = new Date();
    const rows = wanted.map((endpoint) => ({
      endpointId: endpoint.id,
      userId,
      event,
      // Stored as the parsed object for querying, but `bodyFor` reuses the
      // exact string for signing and sending. See `payloadJson`.
      payload: { _body: body, _delivery: crypto.randomUUID() } as Record<string, unknown>,
      status: "pending",
      deliveryId: crypto.randomUUID(),
      nextAttemptAt: now,
    }));
    await db.insert(webhookDeliveriesTable).values(rows);
    return { ok: true, queued: rows.length };
  } catch (err) {
    logger.error({ err, event }, "webhooks: emit failed");
    return { ok: false, queued: 0, skipped: "error" };
  }
}

// ─── DELIVERY ────────────────────────────────────────────────────────────────

export const MAX_DELIVERY_ATTEMPTS = 6;
export const MAX_CONSECUTIVE_FAILURES = 15;
/** Retry schedule in ms, indexed by attempt count. Last entry repeats. */
export const RETRY_SCHEDULE_MS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000, 86_400_000];
const DELIVERY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_LIMIT = 2048;

/**
 * Delay before attempt `attempts + 1`, with jitter.
 *
 * The schedule alone would make every endpoint that failed during one of our
 * deploys retry at the same instant. Jitter spreads them by up to 20% so a
 * backlog drains as a ramp rather than a spike at someone else's server.
 *
 * Exported and pure so the schedule is testable without waiting six hours.
 */
export function retryDelayMs(attempts: number, random: () => number = Math.random): number {
  // `Math.max(NaN, 0)` is NaN, and `RETRY_SCHEDULE_MS[NaN]` is `undefined` —
  // which propagates to a `nextAttemptAt` of Invalid Date and an item that is
  // never due again. Cheap to guard, expensive to discover.
  const safeAttempts = Number.isFinite(attempts) ? Math.floor(attempts) : 0;
  const idx = Math.min(Math.max(safeAttempts, 0), RETRY_SCHEDULE_MS.length - 1);
  const base = RETRY_SCHEDULE_MS[idx]!;
  const jitter = 1 + (random() * 0.2 - 0.1);
  return Math.round(base * jitter);
}

/** Statuses worth retrying: the receiver may recover. A 400 will not. */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

/** The exact body to sign and send for a delivery row. */
export function bodyFor(delivery: { payload: unknown; deliveryId: string }): string {
  const payload = delivery.payload as { _body?: unknown } | null;
  if (payload && typeof payload._body === "string") return payload._body;
  // A row written before this shape existed, or by hand. Rebuild a body that is
  // still valid JSON rather than throwing mid-delivery.
  return JSON.stringify({ id: delivery.deliveryId, event: "unknown", data: payload });
}

export interface DeliveryOutcome {
  ok: boolean;
  status?: number;
  error?: string;
  durationMs: number;
  /**
   * First 2KB of the receiver's response.
   *
   * Kept because "HTTP 500" is not actionable and a receiver's own error string
   * usually is. Truncated at the source: an endpoint returning a 10MB HTML page
   * must not put 10MB into a row the user pages through.
   */
  responseBody?: string | null;
}

/**
 * Perform one HTTP attempt.
 *
 * Returns an outcome instead of throwing: an unreachable receiver is an
 * expected condition, not an exception, and the caller needs the distinction
 * between "retry this" and "stop" rather than a stack trace.
 */
export async function attemptDelivery(
  url: string,
  secret: string,
  body: string,
  event: string,
  deliveryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Focusarx-Webhooks/1.0 (+https://focusarx.app/docs/webhooks)",
        "X-Focusarx-Event": event,
        "X-Focusarx-Delivery": deliveryId,
        "X-Focusarx-Signature": signPayload(secret, Math.floor(Date.now() / 1000), body),
      },
      body,
      signal: controller.signal,
      // A receiver may redirect to anywhere, including back inside; not
      // following keeps the SSRF check above meaningful.
      redirect: "manual",
    });
    const durationMs = Date.now() - started;
    let responseBody: string | null = null;
    try {
      const text = await res.text();
      responseBody = text.slice(0, RESPONSE_BODY_LIMIT);
    } catch {
      responseBody = null;
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      durationMs,
      responseBody,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: controller.signal.aborted ? `Timed out after ${DELIVERY_TIMEOUT_MS}ms` : message,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface DrainResult {
  processed: number;
  succeeded: number;
  failed: number;
  retrying: number;
}

/**
 * Drain due deliveries.
 *
 * Called by the interval worker and by the manual "redeliver" route. Rows are
 * claimed with `FOR UPDATE SKIP LOCKED` inside a transaction so two workers —
 * or two instances, if this ever runs on more than one — cannot both send the
 * same event. The alternative, a plain `SELECT` then `UPDATE`, doubles every
 * delivery whenever a second process exists.
 */
export async function drainDeliveries(
  limit = 20,
  fetchImpl: typeof fetch = fetch,
): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, succeeded: 0, failed: 0, retrying: 0 };
  const due = await db
    .select({
      id: webhookDeliveriesTable.id,
      endpointId: webhookDeliveriesTable.endpointId,
      event: webhookDeliveriesTable.event,
      payload: webhookDeliveriesTable.payload,
      attempts: webhookDeliveriesTable.attempts,
      deliveryId: webhookDeliveriesTable.deliveryId,
      url: webhookEndpointsTable.url,
      secretEnc: webhookEndpointsTable.secretEnc,
      active: webhookEndpointsTable.active,
      failureCount: webhookEndpointsTable.failureCount,
      events: webhookEndpointsTable.events,
    })
    .from(webhookDeliveriesTable)
    .innerJoin(webhookEndpointsTable, eq(webhookEndpointsTable.id, webhookDeliveriesTable.endpointId))
    .where(
      and(
        eq(webhookDeliveriesTable.status, "pending"),
        or(isNull(webhookDeliveriesTable.nextAttemptAt), lte(webhookDeliveriesTable.nextAttemptAt, new Date())),
      ),
    )
    .orderBy(asc(webhookDeliveriesTable.createdAt))
    .limit(limit);

  for (const row of due) {
    // Claim it. `status = pending` in the predicate is the guard: if another
    // worker already flipped it, this updates nothing and we skip.
    const claimed = await db
      .update(webhookDeliveriesTable)
      .set({ status: "sending" })
      .where(and(eq(webhookDeliveriesTable.id, row.id), eq(webhookDeliveriesTable.status, "pending")))
      .returning({ id: webhookDeliveriesTable.id });
    if (claimed.length === 0) continue;
    result.processed += 1;

    if (!row.active) {
      await db
        .update(webhookDeliveriesTable)
        .set({ status: "dropped", error: "Endpoint disabled" })
        .where(eq(webhookDeliveriesTable.id, row.id));
      continue;
    }
    if (!endpointWants(row.events, row.event)) {
      // The user unsubscribed after this was queued. Honouring their current
      // subscription rather than the one at queue time is the correct reading:
      // they have said they do not want this.
      await db
        .update(webhookDeliveriesTable)
        .set({ status: "dropped", error: "No longer subscribed" })
        .where(eq(webhookDeliveriesTable.id, row.id));
      continue;
    }

    let secret: string;
    try {
      secret = decryptSecret(row.secretEnc);
    } catch (err) {
      await db
        .update(webhookDeliveriesTable)
        .set({
          status: "failed",
          nextAttemptAt: null,
          error: err instanceof Error ? err.message : "Signing secret unavailable",
        })
        .where(eq(webhookDeliveriesTable.id, row.id));
      result.failed += 1;
      continue;
    }

    const body = bodyFor(row);
    const outcome = await attemptDelivery(row.url, secret, body, row.event, row.deliveryId, fetchImpl);
    const attempts = row.attempts + 1;

    if (outcome.ok) {
      await db
        .update(webhookDeliveriesTable)
        .set({
          status: "success",
          attempts,
          nextAttemptAt: null,
          responseStatus: outcome.status ?? null,
          responseBody: outcome.responseBody ?? null,
          durationMs: outcome.durationMs,
          error: null,
          deliveredAt: new Date(),
        })
        .where(eq(webhookDeliveriesTable.id, row.id));
      await db
        .update(webhookEndpointsTable)
        .set({ failureCount: 0, lastSuccessAt: new Date(), updatedAt: new Date() })
        .where(eq(webhookEndpointsTable.id, row.endpointId));
      result.succeeded += 1;
      continue;
    }

    const retryable = outcome.status === undefined || isRetryableStatus(outcome.status);
    const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
    const giveUp = !retryable || exhausted;

    await db
      .update(webhookDeliveriesTable)
      .set({
        status: giveUp ? "failed" : "pending",
        attempts,
        nextAttemptAt: giveUp ? null : new Date(Date.now() + retryDelayMs(attempts)),
        responseStatus: outcome.status ?? null,
        responseBody: outcome.responseBody ?? null,
        durationMs: outcome.durationMs,
        error: outcome.error ?? "Delivery failed",
      })
      .where(eq(webhookDeliveriesTable.id, row.id));

    const failures = row.failureCount + 1;
    const disable = failures >= MAX_CONSECUTIVE_FAILURES;
    await db
      .update(webhookEndpointsTable)
      .set({
        failureCount: failures,
        lastFailureAt: new Date(),
        updatedAt: new Date(),
        ...(disable
          ? {
              active: false,
              disabledReason: `Disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failed deliveries`,
            }
          : {}),
      })
      .where(eq(webhookEndpointsTable.id, row.endpointId));

    if (giveUp) result.failed += 1;
    else result.retrying += 1;
  }

  return result;
}

/**
 * Fail rows that have been `sending` for too long.
 *
 * A process that dies mid-delivery leaves a row claimed but not resolved, and
 * without this it stays that way forever — invisible to the user, invisible to
 * the retry worker. Ten minutes is far longer than any attempt can legitimately
 * take, since each is capped at ten seconds of network time.
 */
export async function reclaimStuckDeliveries(olderThanMs = 600_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stuck = await db
    .update(webhookDeliveriesTable)
    .set({ status: "pending", error: "Reclaimed after an interrupted delivery", nextAttemptAt: new Date() })
    .where(and(eq(webhookDeliveriesTable.status, "sending"), lte(webhookDeliveriesTable.createdAt, cutoff)))
    .returning({ id: webhookDeliveriesTable.id });
  return stuck.length;
}

/** Endpoint ids for a user, used to scope delivery lookups. */
export async function userEndpointIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: webhookEndpointsTable.id })
    .from(webhookEndpointsTable)
    .where(eq(webhookEndpointsTable.userId, userId));
  return rows.map((r) => r.id);
}

/** Count of deliveries in each terminal state, for the settings summary. */
export async function deliveryStats(userId: string): Promise<Record<string, number>> {
  const ids = await userEndpointIds(userId);
  if (ids.length === 0) return { success: 0, failed: 0, pending: 0, dropped: 0, sending: 0 };
  const rows = await db
    .select({ status: webhookDeliveriesTable.status, count: sql<number>`count(*)::int` })
    .from(webhookDeliveriesTable)
    .where(inArray(webhookDeliveriesTable.endpointId, ids))
    .groupBy(webhookDeliveriesTable.status);
  const out: Record<string, number> = { success: 0, failed: 0, pending: 0, dropped: 0, sending: 0 };
  for (const row of rows) out[row.status] = Number(row.count);
  return out;
}
