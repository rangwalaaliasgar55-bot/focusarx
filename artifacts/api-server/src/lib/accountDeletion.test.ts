import { describe, it, expect } from "vitest";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  daysUntilPurge,
  describeDeletion,
  isPurgeDue,
  purgeDateFor,
} from "./accountDeletion";

/**
 * The grace period is the only thing standing between a mis-click and
 * irreversible data loss, and it is pure date arithmetic — which is exactly the
 * kind of code that is easy to get subtly wrong and never notice, because wrong
 * answers here look like plausible numbers.
 *
 * These tests use explicit `now` values rather than the clock, so they assert
 * the rule rather than the current time. (An earlier test in this codebase was
 * written with `expect(delta).toBe(3)` and could never fail; the equivalent
 * trap here is comparing two calls to `new Date()`.)
 */

const DAY = 24 * 60 * 60 * 1000;
const requested = new Date("2026-01-01T12:00:00.000Z");

describe("deletion grace period", () => {
  it("is thirty days", () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });

  it("purges exactly thirty days after the request, not before", () => {
    expect(purgeDateFor(requested).toISOString()).toBe("2026-01-31T12:00:00.000Z");

    const oneMsBefore = new Date(purgeDateFor(requested).getTime() - 1);
    expect(isPurgeDue(requested, oneMsBefore)).toBe(false);

    const exactly = purgeDateFor(requested);
    expect(isPurgeDue(requested, exactly)).toBe(true);
  });

  it("counts down from thirty and never goes negative", () => {
    expect(daysUntilPurge(requested, requested)).toBe(30);
    expect(daysUntilPurge(requested, new Date(requested.getTime() + 29 * DAY))).toBe(1);
    // A day late, a year late — the number is 0, never -1 or -335.
    expect(daysUntilPurge(requested, new Date(requested.getTime() + 31 * DAY))).toBe(0);
    expect(daysUntilPurge(requested, new Date(requested.getTime() + 365 * DAY))).toBe(0);
  });

  it("rounds part-days up, so the UI never shows '0 days left' while cancelling still works", () => {
    // 29 days and 1 second elapsed: 23h59m59s remain. Floor would say 0.
    const almost = new Date(requested.getTime() + 29 * DAY + 1000);
    expect(daysUntilPurge(requested, almost)).toBe(1);
    expect(isPurgeDue(requested, almost)).toBe(false);
  });

  it("never offers a cancel the purge is about to take away", () => {
    // The bug this prevents: `cancellable: daysRemaining > 0` disagrees with
    // `isPurgeDue` in the gap between the deadline passing and the job running,
    // so the UI shows an enabled Cancel button for an account the next cron
    // destroys regardless.
    for (const elapsedDays of [0, 1, 15, 29, 29.999, 30, 31, 400]) {
      const now = new Date(requested.getTime() + elapsedDays * DAY);
      const state = describeDeletion(requested, now);
      expect(state.cancellable, `at +${elapsedDays}d`).toBe(!isPurgeDue(requested, now));
      if (!state.cancellable) expect(state.daysRemaining).toBe(0);
    }
  });

  it("describes a pending request in the shape the settings UI renders", () => {
    const state = describeDeletion(requested, new Date(requested.getTime() + 10 * DAY));
    expect(state).toEqual({
      requestedAt: "2026-01-01T12:00:00.000Z",
      scheduledFor: "2026-01-31T12:00:00.000Z",
      daysRemaining: 20,
      cancellable: true,
    });
  });

  it("handles a leap-day window without drifting an hour", () => {
    // 2028 is a leap year: Feb 1 + 30 days crosses Feb 29.
    const feb = new Date("2028-02-01T09:30:00.000Z");
    expect(purgeDateFor(feb).toISOString()).toBe("2028-03-02T09:30:00.000Z");
    expect(daysUntilPurge(feb, feb)).toBe(30);
  });
});
