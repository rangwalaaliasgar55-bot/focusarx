import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimerWorker } from "./timerWorker";

describe("createTimerWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    vi.advanceTimersByTime(300);
    expect(tickFn).toHaveBeenCalled();

    worker.stop();
    const callCount = tickFn.mock.calls.length;
    vi.advanceTimersByTime(300);
    expect(tickFn.mock.calls.length).toBe(callCount);

    worker.destroy();
  });
});
