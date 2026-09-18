import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isStreakMilestone } from "./sessions";

/**
 * Webhook emission is fire-and-forget, so nothing about it fails loudly. These
 * checks are about *where* it is wired in, which is the part that decays: an
 * event added to the wrong branch fires on every keystroke, and one added after
 * an early return never fires at all.
 */

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("streak milestones", () => {
  it("emits on the numbers a person actually mentions", () => {
    for (const day of [3, 7, 14, 21, 30, 50, 100, 180, 365]) {
      expect(isStreakMilestone(day), String(day)).toBe(true);
    }
  });

  it("stays quiet on an ordinary day", () => {
    // Every day would be noise: the receiver already gets a
    // `session.completed` per session, so a per-day event adds nothing.
    for (const day of [1, 2, 4, 5, 6, 8, 29, 31, 99, 101, 364]) {
      expect(isStreakMilestone(day), String(day)).toBe(false);
    }
  });

  it("keeps going past a year, without going per-day", () => {
    expect(isStreakMilestone(500)).toBe(true);
    expect(isStreakMilestone(1000)).toBe(true);
    expect(isStreakMilestone(501)).toBe(false);
  });

  it("rejects a value that is not a positive integer streak", () => {
    // The column is an integer, but a corrupt or absent row yields 0, and a
    // milestone event for "0 days" is worse than none.
    for (const value of [0, -1, NaN, Infinity, 1.5]) {
      expect(isStreakMilestone(value), String(value)).toBe(false);
    }
  });
});

describe("where the events are wired", () => {
  it("emits session.completed only on the non-replayed success path", () => {
    // The replay branch returns earlier with `idempotentReplay: true`. Emitting
    // above it would re-fire the event for every retry of the same session,
    // which the offline queue deliberately does.
    const text = read("routes/sessions.ts");
    const emit = text.indexOf('emitEvent(req.userId, "session.completed"');
    const replayReturn = text.indexOf("idempotentReplay: true");
    expect(emit).toBeGreaterThan(-1);
    expect(replayReturn).toBeGreaterThan(-1);
    expect(emit).toBeGreaterThan(replayReturn);
  });

  it("does not await the emit on the request path", () => {
    // A slow receiver must not delay the response the user is waiting on, and
    // the emit must not be able to turn a saved session into a 500.
    const text = read("routes/sessions.ts");
    const line = text.split("\n").find((l) => l.includes('emitEvent(req.userId, "session.completed"'))!;
    expect(line.trim().startsWith("void emitEvent(")).toBe(true);
    // `await emitEvent(` anywhere in a route is the shape being guarded against.
    expect(text).not.toMatch(/await emitEvent\(/);
    expect(read("routes/tasks.ts")).not.toMatch(/await emitEvent\(/);
  });

  it("emits task.completed on the transition, not on every update", () => {
    // PATCHing an already-completed task — a title edit — must not re-fire it,
    // or a receiver sees a duplicate completion each keystroke.
    const text = read("routes/tasks.ts");
    const emit = text.indexOf('emitEvent(req.userId, "task.completed"');
    expect(emit).toBeGreaterThan(-1);
    // It must sit inside the `if (wasCompleting)` block.
    const guard = text.lastIndexOf("if (wasCompleting)", emit);
    expect(guard).toBeGreaterThan(-1);
    const between = text.slice(guard, emit);
    // No closing brace of that block between the guard and the emit.
    expect(between).not.toContain("\n    }");
  });

  it("covers every event in the catalog with a real emitter", () => {
    // A catalog entry with no emitter is a subscription the user can select and
    // will never receive anything for — indistinguishable from a broken
    // endpoint. This is the check that catches adding a name to the list.
    // Sliced to the array itself. An unscoped scan of the file also matches
    // `"localhost.localdomain"` in the blocked-host set, which is how the first
    // version of this test reported a hostname as an unemitted webhook event.
    const catalog = read("lib/webhooks.ts");
    const arrayStart = catalog.indexOf("export const WEBHOOK_EVENTS = [");
    const arrayEnd = catalog.indexOf("] as const;", arrayStart);
    expect(arrayStart).toBeGreaterThan(-1);
    expect(arrayEnd).toBeGreaterThan(arrayStart);
    const declared = [...catalog.slice(arrayStart, arrayEnd).matchAll(/"([a-z]+\.[a-z]+)"/g)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThanOrEqual(4);

    const emitters = ["routes/sessions.ts", "routes/tasks.ts"]
      .map(read)
      .join("\n");
    const emitted = new Set([...emitters.matchAll(/emitEvent\([^,]+,\s*"([a-z]+\.[a-z]+)"/g)].map((m) => m[1]!));

    const unemitted = declared.filter((event) => !emitted.has(event));
    // `wallet.credited`, `level.up`, `goal.achieved` and `flashcard.reviewed`
    // are declared for the endpoints to subscribe to and are emitted by their
    // own subsystems in later slices. Listing them here is deliberate; what
    // this test forbids is a name added to the catalog and nowhere else, so the
    // allowlist is explicit and has to be edited to grow.
    const KNOWN_UNWIRED = ["wallet.credited", "level.up", "goal.achieved", "flashcard.reviewed", "session.started"];
    expect(unemitted.filter((e) => !KNOWN_UNWIRED.includes(e)), "Events with no emitter").toEqual([]);
    // And the wired ones are genuinely wired.
    expect(emitted.has("session.completed")).toBe(true);
    expect(emitted.has("task.completed")).toBe(true);
    expect(emitted.has("streak.milestone")).toBe(true);
  });
});
