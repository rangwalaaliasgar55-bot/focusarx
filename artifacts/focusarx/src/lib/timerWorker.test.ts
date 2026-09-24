import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimerWorker } from "./timerWorker";

class SilentWorker {
  static instances: SilentWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = false;
  posted: unknown[] = [];
  constructor(_url: string) {
    SilentWorker.instances.push(this);
  }
  postMessage(data: unknown) {
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
}

const ORIGINAL_WORKER = globalThis.Worker;
const ORIGINAL_BLOB = globalThis.Blob;
const ORIGINAL_CREATE = URL.createObjectURL;
const ORIGINAL_REVOKE = URL.revokeObjectURL;

function installFakeWorker() {
  SilentWorker.instances = [];
  // @ts-expect-error — stand-in for the real Worker constructor
  globalThis.Worker = SilentWorker;
  globalThis.Blob = class {
    constructor(_parts: unknown[], _opts?: unknown) {}
  } as unknown as typeof Blob;
  URL.createObjectURL = () => "blob:focusarx-timer";
  URL.revokeObjectURL = vi.fn();
}

function uninstallFakeWorker() {
  globalThis.Worker = ORIGINAL_WORKER;
  globalThis.Blob = ORIGINAL_BLOB;
  URL.createObjectURL = ORIGINAL_CREATE;
  URL.revokeObjectURL = ORIGINAL_REVOKE;
}

describe("createTimerWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    uninstallFakeWorker();
  });

  it("creates a worker controller with start, stop, and destroy methods", () => {
    const worker = createTimerWorker();
    expect(worker).toBeDefined();
    expect(typeof worker.start).toBe("function");
    expect(typeof worker.stop).toBe("function");
    expect(typeof worker.destroy).toBe("function");
    worker.destroy();
  });

  it("triggers ticks on fallback interval when Worker is not available", () => {
    const worker = createTimerWorker();
    const tickFn = vi.fn();

    worker.start(tickFn);
    expect(tickFn).not.toHaveBeenCalled();
    expect(worker.source()).toBe("interval");

    vi.advanceTimersByTime(300);
    expect(tickFn).toHaveBeenCalled();

    worker.stop();
    const callCount = tickFn.mock.calls.length;
    vi.advanceTimersByTime(300);
    expect(tickFn.mock.calls.length).toBe(callCount);

    worker.destroy();
  });

  /**
   * The regression that froze real countdowns: a Worker that constructs but
   * never posts a tick left the controller believing it had a working thread,
   * so the interval was never installed and the clock simply stopped moving.
   */
  it("watches for the first tick and falls back to the interval when it never arrives", () => {
    installFakeWorker();
    const worker = createTimerWorker();
    const tickFn = vi.fn();

    worker.start(tickFn);
    expect(SilentWorker.instances).toHaveLength(1);
    expect(SilentWorker.instances[0].posted).toContain("START");
    expect(worker.source()).toBe("worker");

    // Worker stays silent through the grace window.
    vi.advanceTimersByTime(1600);
    expect(worker.source()).toBe("interval");
    expect(SilentWorker.instances[0].terminated).toBe(true);

    const before = tickFn.mock.calls.length;
    vi.advanceTimersByTime(300);
    expect(tickFn.mock.calls.length).toBeGreaterThan(before);

    worker.destroy();
  });

  it("does not fall back when the worker is alive and ticking", () => {
    installFakeWorker();
    const worker = createTimerWorker();
    const tickFn = vi.fn();

    worker.start(tickFn);
    const instance = SilentWorker.instances[0];
    instance.onmessage?.({ data: { type: "TICK", now: Date.now() } } as MessageEvent);
    expect(tickFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    // Still worker-sourced: the interval must not double-drive the clock.
    expect(worker.source()).toBe("worker");
    expect(tickFn).toHaveBeenCalledTimes(1);

    worker.destroy();
  });

  it("demotes to the interval when the worker raises an error", () => {
    installFakeWorker();
    const worker = createTimerWorker();
    const tickFn = vi.fn();

    worker.start(tickFn);
    SilentWorker.instances[0].onerror?.(new Event("error"));
    expect(worker.source()).toBe("interval");

    vi.advanceTimersByTime(300);
    expect(tickFn).toHaveBeenCalled();

    worker.destroy();
  });

  it("releases the blob URL on destroy, never before the worker has started", () => {
    installFakeWorker();
    const worker = createTimerWorker();
    worker.start(() => {});

    // Revoking here is what broke the worker fetch in some engines.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    worker.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:focusarx-timer");
  });
});
