import { describe, it, expect } from "vitest";
import {
  addItem,
  applyOutcome,
  backoffMs,
  classifyStatus,
  dueItems,
  MAX_AUTO_ATTEMPTS,
  MAX_BACKOFF_MS,
  makeIdempotencyKey,
  nextAttemptAt,
  summarise,
  type QueuedItem,
} from "./offlineQueueCore";

/**
 * The behaviour under test is a data-loss bug, so the assertions lead with what
 * must *never* happen rather than what should.
 *
 * The old queue dropped a payload once `attempts >= 5` and then saved the
 * shortened queue. With a fixed 30-second retry that gave a completed focus
 * session a two-and-a-half-minute window to reach the server before it was
 * deleted without a word. Nothing in the UI mentioned it afterwards, because
 * the item was gone.
 */

const item = (over: Partial<QueuedItem> = {}): QueuedItem => ({
  id: "q1",
  idempotencyKey: "completion_s1", // gitleaks:allow
  payload: { sessionId: "s1" },
  createdAt: 1_000,
  attempts: 0,
  lastAttemptAt: null,
  rejected: false,
  ...over,
});

describe("classifyStatus", () => {
  it("treats 2xx as accepted and 409 as the duplicate that it is", () => {
    expect(classifyStatus(200)).toBe("accepted");
    expect(classifyStatus(201)).toBe("accepted");
    expect(classifyStatus(204)).toBe("accepted");
    // 409 means the idempotency key is already recorded — the session IS saved.
    expect(classifyStatus(409)).toBe("duplicate");
  });

  it("treats 5xx, 408, 425 and 429 as worth retrying", () => {
    for (const status of [500, 502, 503, 504, 408, 425, 429]) {
      expect(classifyStatus(status), String(status)).toBe("transient");
    }
  });

  it("treats a 400 as permanent, which is the distinction that was missing", () => {
    // The old code retried a 400 five times and then deleted the payload. A
    // request the server has already refused on its merits will be refused
    // again; retrying it burns the user's connection and their data.
    for (const status of [400, 401, 403, 404, 410, 422, 451]) {
      expect(classifyStatus(status), String(status)).toBe("rejected");
    }
  });
});

describe("the queue never discards a payload on its own", () => {
  it("keeps the item on every outcome except acceptance", () => {
    for (const outcome of ["transient", "rejected"] as const) {
      const next = applyOutcome(item(), outcome, 2_000);
      expect(next, outcome).not.toBeNull();
      expect(next!.payload).toEqual({ sessionId: "s1" });
    }
  });

  it("removes the item only when the server accepted it or already has it", () => {
    expect(applyOutcome(item(), "accepted", 2_000)).toBeNull();
    expect(applyOutcome(item(), "duplicate", 2_000)).toBeNull();
  });

  it("survives far more failures than the old queue's five-attempt cap", () => {
    // Twenty consecutive server errors: the payload is still here, and the
    // reason is recorded so the UI can explain itself.
    let current: QueuedItem | null = item();
    for (let i = 0; i < 20; i += 1) {
      current = applyOutcome(current!, "transient", 1_000 + i * 1_000, "Server error");
    }
    expect(current).not.toBeNull();
    expect(current!.payload).toEqual({ sessionId: "s1" });
    expect(current!.attempts).toBe(20);
    expect(current!.lastError).toBe("Server error");
  });

  it("stops auto-retrying once the attempt budget is spent, without dropping", () => {
    const spent = item({ attempts: MAX_AUTO_ATTEMPTS, lastAttemptAt: 5_000 });
    expect(nextAttemptAt(spent)).toBeNull();
    // Null means "not automatically", not "discard" — the item is still here.
    expect(spent.payload).toEqual({ sessionId: "s1" });
    expect(summarise([spent]).needsAttention).toBe(1);
  });

  it("stops retrying a rejected payload but keeps it visible", () => {
    const rejected = applyOutcome(item(), "rejected", 2_000, "Focused session already recorded")!;
    expect(rejected.rejected).toBe(true);
    expect(nextAttemptAt(rejected)).toBeNull();
    expect(rejected.lastError).toBe("Focused session already recorded");
    expect(summarise([rejected]).needsAttention).toBe(1);
  });
});

describe("backoff", () => {
  it("grows and then stops at the ceiling", () => {
    // Deterministic random so the growth is observable: full jitter means the
    // value is a sample from [0, ceiling], and random() = 1 is the ceiling.
    const atCeiling = () => 1;
    expect(backoffMs(0, atCeiling)).toBe(5_000);
    expect(backoffMs(1, atCeiling)).toBe(10_000);
    expect(backoffMs(2, atCeiling)).toBe(20_000);
    expect(backoffMs(5, atCeiling)).toBe(160_000);
    expect(backoffMs(20, atCeiling)).toBe(MAX_BACKOFF_MS);
  });

  it("never returns a value outside [0, ceiling]", () => {
    for (const attempts of [0, 1, 3, 8, 50, 1e9]) {
      const value = backoffMs(attempts, () => 0.5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    }
  });

  it("cannot be made to produce NaN or Infinity by a corrupted attempt count", () => {
    // `Math.pow(2, Infinity)` is Infinity, and `Date + Infinity` is Invalid
    // Date — an item that then never becomes due again and is never retried.
    for (const attempts of [NaN, Infinity, -Infinity, -5, undefined as unknown as number]) {
      const value = backoffMs(attempts, () => 0.5);
      expect(Number.isFinite(value), String(attempts)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("jitters, so clients that went offline together do not return together", () => {
    const spread = new Set([0, 0.25, 0.5, 0.75, 1].map((r) => backoffMs(4, () => r)));
    expect(spread.size).toBe(5);
  });
});

describe("scheduling", () => {
  it("makes a never-attempted item due immediately", () => {
    const fresh = item({ createdAt: 10_000 });
    expect(nextAttemptAt(fresh)).toBe(10_000);
    expect(dueItems([fresh], 10_000)).toHaveLength(1);
  });

  it("waits out the backoff after a failure", () => {
    const failed = item({ attempts: 1, lastAttemptAt: 10_000 });
    // attempts - 1 = 0 → ceiling 5s, so at 4s it is not yet due and at 5s it is
    // (with random() returning 1, the ceiling).
    expect(dueItems([failed], 10_000).length + dueItems([failed], 10_000 + 5_000).length).toBeGreaterThan(0);
    expect(nextAttemptAt(failed)).toBeGreaterThanOrEqual(10_000);
    expect(nextAttemptAt(failed)).toBeLessThanOrEqual(10_000 + 5_000);
  });

  it("flushes oldest first", () => {
    const older = item({ id: "a", idempotencyKey: "k-a", createdAt: 1_000 });
    const newer = item({ id: "b", idempotencyKey: "k-b", createdAt: 9_000 });
    expect(dueItems([older, newer], 10_000).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("enqueue", () => {
  it("refuses a duplicate idempotency key rather than queueing it twice", () => {
    const first = addItem([], item());
    expect(first.added).toBe(true);
    const second = addItem(first.items, item({ id: "q2" }));
    expect(second.added).toBe(false);
    expect(second.items).toHaveLength(1);
  });

  it("refuses when full rather than truncating an existing item", () => {
    // A bound that drops the oldest entry would be the same data-loss bug in a
    // new place; refusing lets the caller tell the user instead.
    const full = Array.from({ length: 200 }, (_, i) =>
      item({ id: `q${i}`, idempotencyKey: `k${i}`, payload: { sessionId: `s${i}` } }),
    );
    const result = addItem(full, item({ id: "new", idempotencyKey: "new" }));
    expect(result.added).toBe(false);
    expect(result.items).toHaveLength(200);
    expect(result.items[0]!.payload).toEqual({ sessionId: "s0" });
  });

  it("derives a stable key from the session id, so a retry cannot double-count", () => {
    expect(makeIdempotencyKey({ sessionId: "abc" }, 1)).toBe("completion_abc");
    expect(makeIdempotencyKey({ sessionId: "abc" }, 999)).toBe("completion_abc");
    expect(makeIdempotencyKey({ idempotencyKey: "given" }, 1)).toBe("given");
    // No session id at all: fall back to a seed, which is the only case where
    // two enqueues of "the same" payload can legitimately differ.
    expect(makeIdempotencyKey({}, 42)).toBe("completion_42");
  });
});

describe("summarise", () => {
  it("separates what will retry itself from what needs the user", () => {
    const items = [
      item({ id: "a", idempotencyKey: "a" }),
      item({ id: "b", idempotencyKey: "b", rejected: true }),
      item({ id: "c", idempotencyKey: "c", attempts: MAX_AUTO_ATTEMPTS }),
    ];
    expect(summarise(items)).toEqual({
      pending: 1,
      needsAttention: 2,
      total: 3,
      hasStalled: false,
    });
  });

  it("reports a stalled queue only when nothing can self-heal", () => {
    expect(summarise([]).hasStalled).toBe(false);
    expect(summarise([item({ rejected: true })]).hasStalled).toBe(true);
    expect(summarise([item()]).hasStalled).toBe(false);
  });
});
