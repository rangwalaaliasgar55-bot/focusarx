/**
 * Account deletion with a grace period.
 *
 * Deletion used to be a single transaction that removed the user row, and with
 * it every session, card, pet, coin and achievement they had ever earned. It
 * was irreversible and instant, confirmed by nothing more than a password.
 *
 * That is the right *eventual* outcome and the wrong *immediate* one. The
 * decision to leave a product is often made in a bad five minutes, and the cost
 * of being wrong is unbounded: there is no support ticket that can restore a
 * cascaded foreign key.
 *
 * So the request is recorded and honoured later. The window is defined here,
 * once, in days — not written into each row at request time — because the only
 * thing that changes about it is the number, and a number that lives in one
 * place can be revised without a backfill.
 */

import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, emailLogsTable } from "@workspace/db/schema";
import { logger } from "./logger";

/**
 * How long a deletion request stays cancellable.
 *
 * Thirty days is the convention shared by GitHub, Google and most consumer
 * products, and it is also the period the GDPR's right-to-erasure guidance
 * treats as reasonable for a "recovery window" as opposed to indefinite
 * retention. The value is deliberately not configurable per environment: a
 * staging deploy with a one-day window would be the first place a real deletion
 * mistake happens.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** When a request made at `requestedAt` becomes eligible for hard deletion. */
export function purgeDateFor(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * MS_PER_DAY);
}

/** Whole days remaining, floored at 0 — never negative, never fractional. */
export function daysUntilPurge(requestedAt: Date, now: Date = new Date()): number {
  const remaining = purgeDateFor(requestedAt).getTime() - now.getTime();
  return remaining <= 0 ? 0 : Math.ceil(remaining / MS_PER_DAY);
}

export function isPurgeDue(requestedAt: Date, now: Date = new Date()): boolean {
  return purgeDateFor(requestedAt).getTime() <= now.getTime();
}

export interface DeletionState {
  requestedAt: string;
  scheduledFor: string;
  daysRemaining: number;
  /** False once the window has lapsed — the purge just has not run yet. */
  cancellable: boolean;
}

/**
 * The public shape of a pending deletion, for the API and the settings UI.
 *
 * `cancellable` is computed from the same `isPurgeDue` the purge job uses
 * rather than from `daysRemaining > 0`, so the UI cannot offer a Cancel button
 * for a request the next job run is about to destroy.
 */
export function describeDeletion(requestedAt: Date, now: Date = new Date()): DeletionState {
  const due = isPurgeDue(requestedAt, now);
  return {
    requestedAt: requestedAt.toISOString(),
    scheduledFor: purgeDateFor(requestedAt).toISOString(),
    daysRemaining: daysUntilPurge(requestedAt, now),
    cancellable: !due,
  };
}

export interface PurgeResult {
  purged: number;
  scanned: number;
  cutoff: string;
}

/**
 * Hard-delete every account whose grace period has lapsed.
 *
 * PII is scrubbed before the cascade, exactly as the immediate-delete path used
 * to do: `email_logs.recipient_id` is `ON DELETE SET NULL`, so the email address
 * survives in the log unless it is overwritten while the link still exists.
 *
 * Safe to run repeatedly and concurrently. Two workers racing on the same row
 * both issue the same `DELETE`, one affects a row and the other affects none;
 * neither can resurrect or double-delete. That matters because the intended
 * deployment is a cron that may overlap with itself on a slow run, and there is
 * no lock to leak if the process dies mid-purge.
 */
export async function purgeExpiredDeletions(now: Date = new Date()): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * MS_PER_DAY);

  const due = await db
    .select({ id: usersTable.id, isGuest: usersTable.isGuest })
    .from(usersTable)
    .where(and(isNotNull(usersTable.deletionRequestedAt), lt(usersTable.deletionRequestedAt, cutoff)));

  if (due.length === 0) {
    return { purged: 0, scanned: 0, cutoff: cutoff.toISOString() };
  }

  let purged = 0;
  for (const user of due) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(emailLogsTable)
          .set({ recipientEmail: "[deleted]" })
          .where(eq(emailLogsTable.recipientId, user.id));
        await tx.delete(usersTable).where(eq(usersTable.id, user.id));
      });
      purged += 1;
    } catch (err) {
      // One bad row must not strand the rest of the batch. Report it and keep
      // going; the next run will retry this account.
      logger.error({ err, userId: user.id }, "purge of a single account failed");
    }
  }

  logger.info({ purged, scanned: due.length, cutoff: cutoff.toISOString() }, "purged deleted accounts");
  return { purged, scanned: due.length, cutoff: cutoff.toISOString() };
}

/**
 * How many accounts are inside the window, and how many are overdue.
 *
 * Split out so an operator can tell "the cron is not running" (overdue > 0)
 * from "nobody is deleting their account" (both zero) without reading logs.
 */
export async function deletionBacklog(now: Date = new Date()): Promise<{ pending: number; overdue: number }> {
  const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * MS_PER_DAY);
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${usersTable.deletionRequestedAt} >= ${cutoff})`,
      overdue: sql<number>`count(*) filter (where ${usersTable.deletionRequestedAt} < ${cutoff})`,
    })
    .from(usersTable)
    .where(isNotNull(usersTable.deletionRequestedAt));
  return { pending: Number(row?.pending ?? 0), overdue: Number(row?.overdue ?? 0) };
}
