/**
 * The offline queue's rules, with no React and no storage.
 *
 * Split out because the previous queue was a hook that mixed three things —
 * persistence, retry policy and React state — and the retry policy had a bug
 * that cost the user real data. Keeping the policy here means it can be tested
 * directly, at every boundary, without a DOM or a fake timer.
 *
 * ## The bug this exists to prevent
 *
 * The old queue dropped a payload after five failed attempts:
 *
 *     if (item.attempts >= MAX_ATTEMPTS) {
 *       // Drop after max attempts but keep for debugging? For now drop
 *       continue;
 *     }
 *
 * and then persisted the shortened queue. Combined with a fixed 30-second
 * retry, that meant **two and a half minutes** of the API returning 5xx, or of
 * a payload the server would never accept, was enough to delete a completed
 * focus session permanently — with no error shown and nothing left to recover.
 * `navigator.onLine` guards the truly-offline case, so the window was not
 * "you were offline too long"; it was "the server had a bad two minutes".
 *
 * The rule now is absolute: **the queue never discards a payload by itself.**
 * Items leave only on an accepted response (or its 409 duplicate), or because
 * the user explicitly dismissed them. Everything else stays, backed off, and is
 * surfaced.
 */

export interface QueuedItem {
  id: string;
  idempotencyKey: string;
  payload: unknown;
  createdAt: number;
  /** Counts transient failures only. */
  attempts: number;
  lastAttemptAt: number | null;
  /**
   * Set when the server rejected the payload in a way retrying cannot fix —
   * a 400, a 422, a 403. The item is kept so nothing is lost, but automatic
   * retries stop, because repeating a request that is definitionally invalid
   * forever is just noise on the user's connection.
   */
  rejected: boolean;
  /** Human-readable reason from the last attempt, shown in the UI. */
  lastError?: string;
}

/**
 * How many *automatic* retries before an item waits for a manual "Sync now".
 *
 * Reached this does not remove anything — it stops the timer from silently
 * re-attempting a request that has already failed eight times, and leaves the
 * item visible until the user acts on it.
 */
export const MAX_AUTO_ATTEMPTS = 8;

/** First backoff step. Five seconds, so a momentary blip recovers quickly. */
export const BASE_BACKOFF_MS = 5_000;

/** Ceiling. Thirty minutes: long enough to stop hammering, short enough that a
 *  session started offline on a train is synced by the time the user looks. */
export const MAX_BACKOFF_MS = 30 * 60_000;

/** A queue this long is not a network problem, it is a broken account. */
export const MAX_QUEUE_ITEMS = 200;

export type AttemptOutcome = "accepted" | "duplicate" | "transient" | "rejected";

/**
 * What an HTTP status means for retry policy.
 *
 * The distinction that matters is *will retrying ever work*. Treating every
 * non-2xx as transient is what produced the silent deletion: a 400 that can
 * never succeed burned the same five attempts as a 500 that could, and then
 * both were discarded.
 *
 *  - 2xx                 → accepted, remove
 *  - 409                 → the idempotency key was already recorded; the
 *                          session is saved. Remove. (This is the one failure
 *                          that is genuinely a success.)
 *  - 408, 425, 429, 5xx  → transient. The server is busy, restarting, or the
 *                          request never landed. Keep and back off.
 *  - 401, 403            → rejected. A token problem will not fix itself by
 *                          retrying, and the auth layer handles refresh.
 *  - 400, 404, 410, 422  → rejected. The payload is not acceptable and will not
 *                          become acceptable.
 *  - anything else 4xx   → rejected, because unknown 4xx is far more likely to
 *                          be a permanent refusal than a transient one.
 */
export function classifyStatus(status: number): AttemptOutcome {
  if (status >= 200 && status < 300) return "accepted";
  if (status === 409) return "duplicate";
  if (status >= 500) return "transient";
  if (status === 408 || status === 425 || status === 429) return "transient";
  return "rejected";
}

/**
 * Exponential backoff with full jitter.
 *
 * Capped at MAX_BACKOFF_MS, and never negative or NaN for any input — a
 * `Math.pow` overflow on a corrupted `attempts` value would otherwise produce
 * `Infinity` and the item would never be considered due again.
 *
 * The jitter is deliberate and load-bearing: without it, every client that went
 * offline during the same outage retries at the same instant, and the API gets
 * a synchronised thundering herd exactly when it is least able to cope.
 */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const safeAttempts = Number.isFinite(attempts) ? Math.max(0, Math.trunc(attempts)) : 0;
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(safeAttempts, 20));
  if (!Number.isFinite(ceiling) || ceiling <= 0) return MAX_BACKOFF_MS;
  // Full jitter: anywhere in [0, ceiling]. Keeps the first retry fast on average
  // while still spreading the herd.
  return Math.floor(random() * ceiling);
}

/** When this item may next be attempted, or null if it never should be again. */
export function nextAttemptAt(item: QueuedItem): number | null {
  if (item.rejected) return null;
  if (item.attempts >= MAX_AUTO_ATTEMPTS) return null;
  if (item.lastAttemptAt === null) return item.createdAt;
  // `attempts - 1` so the first retry after one failure uses the base delay
  // rather than double it.
  return item.lastAttemptAt + backoffMs(Math.max(0, item.attempts - 1));
}

/**
 * The items a run should attempt now, in arrival order.
 *
 * Oldest first, because the queue is a record of things the user did and losing
 * the session they finished two hours ago while flushing the one from a minute
 * ago would be the wrong priority if the run is interrupted.
 */
export function dueItems(items: QueuedItem[], now: number): QueuedItem[] {
  return items.filter((item) => {
    const due = nextAttemptAt(item);
    return due !== null && due <= now;
  });
}

/**
 * Apply the result of one attempt.
 *
 * Returns the item's new state, or null when it should leave the queue. There
 * is no branch that returns null for anything other than an accepted or
 * duplicate response — that is the safety property, and it is enforced here
 * rather than trusted to each caller.
 */
export function applyOutcome(
  item: QueuedItem,
  outcome: AttemptOutcome,
  now: number,
  error?: string,
): QueuedItem | null {
  if (outcome === "accepted" || outcome === "duplicate") return null;
  return {
    ...item,
    attempts: item.attempts + 1,
    lastAttemptAt: now,
    rejected: outcome === "rejected",
    lastError: error,
  };
}

export interface QueueSummary {
  /** Items that will be retried automatically. */
  pending: number;
  /** Items that need the user to do something — they will not retry. */
  needsAttention: number;
  total: number;
  /** True when there is nothing left that can sync itself. */
  hasStalled: boolean;
}

export function summarise(items: QueuedItem[]): QueueSummary {
  const needsAttention = items.filter(
    (i) => i.rejected || i.attempts >= MAX_AUTO_ATTEMPTS,
  ).length;
  return {
    pending: items.length - needsAttention,
    needsAttention,
    total: items.length,
    hasStalled: items.length > 0 && needsAttention === items.length,
  };
}

/** Stable identity for a payload, so a re-enqueue cannot duplicate a session. */
export function makeIdempotencyKey(payload: unknown, fallbackSeed: number): string {
  const record = payload as { sessionId?: unknown; idempotencyKey?: unknown } | null;
  if (typeof record?.idempotencyKey === "string" && record.idempotencyKey.length > 0) {
    return record.idempotencyKey;
  }
  if (typeof record?.sessionId === "string" && record.sessionId.length > 0) {
    return `completion_${record.sessionId}`;
  }
  return `completion_${fallbackSeed}`;
}

/**
 * Enqueue, without ever losing an existing item.
 *
 * Refuses rather than truncates when full: the old implementation had no bound
 * at all, and a bound that silently drops the oldest item would be the same
 * data-loss bug in a new place. Returning false lets the caller tell the user.
 */
export function addItem(
  items: QueuedItem[],
  item: QueuedItem,
): { items: QueuedItem[]; added: boolean } {
  if (items.length >= MAX_QUEUE_ITEMS) return { items, added: false };
  // A key already present means this exact session is queued or already sent.
  if (items.some((i) => i.idempotencyKey === item.idempotencyKey)) return { items, added: false };
  return { items: [...items, item], added: true };
}
