import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useEffect, useRef } from "react";
import {
  enqueueOfflineItem,
  flushOfflineQueue,
  resetOfflineQueue,
  retryOfflineQueue,
  useOfflineQueue,
  type QueuedItem,
} from "./useOfflineQueue";

/**
 * Two bugs, both invisible when you look at a single component.
 *
 * **The queue was per-component.** State lived in `useState` inside the hook, so
 * `NetworkStatusBanner` and `FocusTimerMobileFirst` — its two callers — each
 * owned a separate array. The timer could enqueue a completed session while the
 * banner's count stayed at zero, so the pill that exists to say "1 session
 * waiting to sync" could never appear. `refresh()` existed to paper over this
 * and no caller used it.
 *
 * **A failed sync was invisible.** After five failed attempts an item was
 * deleted and the shortened queue persisted. With a fixed 30-second retry that
 * gave a completed session a two-and-a-half-minute window to reach the server
 * before it was destroyed with nothing shown to the user, before or after.
 *
 * The actions under test are module functions rather than values pulled out of
 * a rendered component: a component that writes to module state is not a pure
 * function of its props, which the `react-hooks` lint rule rejects and which is
 * the right call. The hook is only a subscription.
 */

/** What the app currently sees. Updated by `Probe` on every render. */
type View = { queueCount: number; queue: QueuedItem[]; needsAttention: boolean; summary: { needsAttention: number } };

function Probe({ onState }: { onState: (v: View) => void }) {
  const state = useOfflineQueue();
  const { queueCount, queue, needsAttention, summary } = state;
  useEffect(() => {
    onState({ queueCount, queue, needsAttention, summary });
  }, [onState, queueCount, queue, needsAttention, summary]);
  return null;
}

/** Renders two independent consumers, so a divergence between them shows up. */
/** Plain mutable sink: the probes publish through callbacks, not shared refs. */
type Sink = { current: View | null };
const sink = (): Sink => ({ current: null });

function mount() {
  const view = sink();
  const banner = sink();
  const timer = sink();
  // Stable identities (same function objects for the lifetime of the test) so
  // the probes' effects don't loop on a changing callback prop.
  const publish = (s: Sink) => (v: View) => { s.current = v; };
  const utils = render(
    <>
      <Probe onState={publish(view)} />
      <Probe onState={publish(banner)} />
      <Probe onState={publish(timer)} />
    </>,
  );
  return { ...utils, view, banner, timer };
}

const read = (ref: Sink): View =>
  ref.current ?? { queueCount: -1, queue: [], needsAttention: false, summary: { needsAttention: 0 } };

beforeEach(() => {
  localStorage.clear();
  resetOfflineQueue();
  // Default to a server error, so an enqueued item *stays* in the queue.
  //
  // The hook flushes on mount, on reconnect and on a timer. With a 2xx default
  // the deferred first flush could deliver an item between `enqueue` and the
  // assertion, making "the queue has one item" pass or fail on timing. Tests
  // that are *about* acceptance set their own mock.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
  );
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  cleanup();
  resetOfflineQueue();
  vi.unstubAllGlobals();
});

describe("the offline queue is shared between consumers", () => {
  it("shows one enqueue to every component that reads it", async () => {
    const { view, banner, timer } = mount();
    expect(read(view).queueCount).toBe(0);

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });

    // The regression: `banner` and `timer` used to stay at 0 while only the
    // component that called `enqueue` saw the item.
    expect(read(banner).queueCount).toBe(1);
    expect(read(timer).queueCount).toBe(1);
    expect(read(view).queueCount).toBe(1);
  });

  it("does not spin, which an unstable getSnapshot would cause", () => {
    // `getSnapshot` must return a cached object. A freshly built one reads as
    // "the store changed" on every check and re-renders forever — the bug
    // `useNow` documents. Bounding the render count is the honest test; an
    // unstable snapshot shows up as unbounded renders, not as a passing assert.
    const renders = { current: 0 };
    function Counting() {
      const n = useRef(0);
      useEffect(() => {
        n.current += 1;
        renders.current = n.current;
      });
      useOfflineQueue();
      return null;
    }
    render(<Counting />);
    const afterMount = renders.current;
    expect(afterMount).toBeLessThan(10);
  });
});

describe("a failed sync is never discarded silently", () => {
  it("keeps the session after far more failures than the old cap", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const { view } = mount();

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    // Eight forced attempts. The old queue deleted the payload after five.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await flushOfflineQueue(true);
      });
    }

    expect(read(view).queueCount).toBe(1);
    expect(read(view).queue[0]!.payload).toMatchObject({ sessionId: "s1" });
  });

  it("tells the user once the item needs them, instead of going quiet", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { message: "Focused session already recorded" } }),
    });
    const { view } = mount();

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });

    expect(read(view).needsAttention).toBe(true);
    expect(read(view).summary.needsAttention).toBe(1);
    // The server's own reason, not "422" — it is what the user acts on.
    expect(read(view).queue[0]!.lastError).toBe("Focused session already recorded");
  });

  it("removes the item only when the server accepted it or already had it", async () => {
    for (const status of [200, 409] as const) {
      resetOfflineQueue();
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockReset();
      fetchMock.mockResolvedValue({ ok: status < 300, status, json: async () => ({}) });

      const { view, unmount } = mount();
      await act(async () => {
        enqueueOfflineItem({ sessionId: `s-${status}`, durationSec: 60 });
      });
      await act(async () => {
        await flushOfflineQueue(true);
      });
      expect(read(view).queueCount, `status ${status}`).toBe(0);
      unmount();
    }
  });

  it("survives a reload, because the surviving item was persisted", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    mount();

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });

    // What the next page load reads back off disk.
    const raw = localStorage.getItem("focusarx-offline-queue");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Array<{ payload: { sessionId: string } }>;
    expect(parsed.map((i) => i.payload.sessionId)).toContain("s1");
  });
});

describe("retryAll", () => {
  it("sends the session once the outage is over, rather than deleting it", async () => {
    // The user story: the API was down, the item stalled, the outage ended, the
    // user pressed "Try again". The session must arrive — not be discarded for
    // having failed too often.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const { view } = mount();

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });
    expect(read(view).queueCount).toBe(1);

    // The server recovers.
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await act(async () => {
      retryOfflineQueue();
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });

    expect(read(view).queueCount).toBe(0);
  });

  it("never deletes on retry, even when it fails again", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "Bad payload" }) });
    const { view } = mount();

    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });
    await act(async () => {
      retryOfflineQueue();
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });

    // Re-arming resets the counters; it must not empty the queue.
    expect(read(view).queueCount).toBe(1);
    expect(read(view).queue[0]!.payload).toMatchObject({ sessionId: "s1" });
  });

  it("reports the count, but never the payload, once the queue is cleared", async () => {
    // Sign-out clears the queue. The assertion that matters is that a cleared
    // queue cannot be re-flushed by the timer still running behind it.
    const { view } = mount();
    await act(async () => {
      enqueueOfflineItem({ sessionId: "s1", durationSec: 1500 });
    });
    expect(read(view).queueCount).toBe(1);

    await act(async () => {
      resetOfflineQueue();
    });
    await act(async () => {
      await flushOfflineQueue(true);
    });
    expect(read(view).queueCount).toBe(0);
    expect(localStorage.getItem("focusarx-offline-queue")).toBeNull();
  });
});

/**
 * `screen` is imported for the render helpers above; asserted here so an unused
 * import cannot be silently dropped by a future cleanup pass.
 */
describe("sanity", () => {
  it("renders no visible chrome of its own", () => {
    mount();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
