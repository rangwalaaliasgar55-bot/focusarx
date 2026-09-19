/**
 * §1.6 — the delivery worker.
 *
 * Started once, at import, and `unref`'d so it never holds the process open —
 * the same shape `aiGuardrails` uses for its cleanup timer.
 *
 * Why an interval and not a queue: deliveries live in Postgres and the claim is
 * an atomic `UPDATE ... WHERE status = 'pending'`, so a second instance is
 * already safe and a restart loses nothing. A job queue would be a second piece
 * of infrastructure to run for a feature whose whole workload is "POST a few
 * hundred small JSON bodies per hour", and it would still need the same table
 * for the audit trail the user can see.
 *
 * The tick is 30 seconds. Retry backoff starts at 30 seconds and the schedule
 * after that is measured in minutes and hours, so the tick is not the limiting
 * factor for anything a receiver would notice.
 */

import { drainDeliveries, reclaimStuckDeliveries } from "./webhooks";
import { secretsConfigured } from "./secrets";
import { logger } from "./logger";

export const TICK_MS = 30_000;

let started = false;
let running = false;

/**
 * One pass. Exported for tests and for the manual drain route, which wants the
 * same code path rather than a second one that can drift.
 *
 * `running` is a re-entrancy guard, not a lock. Two overlapping passes cannot
 * double-send (the claim in `drainDeliveries` prevents that), but they can
 * double the connection-pool pressure for no benefit, and a slow receiver is
 * exactly when that happens.
 */
export async function runWebhookTick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await reclaimStuckDeliveries();
    const result = await drainDeliveries();
    if (result.processed > 0) {
      logger.info({ ...result }, "webhooks: drained");
    }
  } catch (err) {
    // Never let a tick rejection escape: an unhandled rejection here takes the
    // process down, and a webhook problem must not be able to do that.
    logger.error({ err }, "webhooks: tick failed");
  } finally {
    running = false;
  }
}

/**
 * Start the worker.
 *
 * Skipped entirely when no encryption key is configured: without it there are
 * no endpoints (creation 503s), so the timer would wake every 30 seconds
 * forever to run a query that cannot return rows.
 */
export function startWebhookWorker(): void {
  if (started) return;
  if (!secretsConfigured()) {
    logger.info("webhooks: worker idle — INTEGRATION_ENCRYPTION_KEY is not set");
    return;
  }
  started = true;
  setInterval(() => void runWebhookTick(), TICK_MS).unref?.();
  logger.info({ tickMs: TICK_MS }, "webhooks: delivery worker started");
}

/** Test hook. Not used in production paths. */
export function resetWebhookWorkerForTests(): void {
  started = false;
  running = false;
}
