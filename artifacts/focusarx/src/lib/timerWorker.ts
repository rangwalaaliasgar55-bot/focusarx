/**
 * Background precision timer worker (Web Worker with a guarded fallback).
 *
 * Browsers throttle `setInterval` to roughly one tick per minute in a
 * background tab. A Web Worker runs on its own thread and is throttled far
 * less aggressively, so it is the primary tick source for the countdown.
 *
 * The worker is a *preference*, never a dependency. The previous version had
 * three ways to freeze the clock and no way back from any of them:
 *
 *   1. `URL.revokeObjectURL(workerUrl)` was called immediately after
 *      `new Worker(workerUrl)`. Some engines finish fetching the script
 *      asynchronously, so the fetch could 404 against a URL that no longer
 *      exists — the Worker never boots and never posts a tick.
 *   2. In-app browsers (the Instagram funnel lands in one) and pages under a
 *      strict `worker-src` policy often refuse `blob:` workers. Where the
 *      refusal is asynchronous there is no exception to catch, so the fallback
 *      interval was never installed.
 *   3. Nothing watched for the first tick. A worker that died after
 *      construction left `worker !== null`, which meant the `else` branch that
 *      installs the interval was never taken — a frozen countdown with a
 *      "running" status chip on top of it.
 *
 * All three are fixed here: the object URL lives until `destroy()`, the first
 * tick is watched for, and a worker that errors or stays silent past
 * `STARTUP_GRACE_MS` is torn down and replaced by the interval.
 */

const WORKER_SCRIPT = `
let timerId = null;
self.onmessage = function(e) {
  if (e.data === 'START') {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function() {
      self.postMessage({ type: 'TICK', now: Date.now() });
    }, 150);
  } else if (e.data === 'STOP') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};
`;

/** ~1.5 ticks at the worker's 150 ms cadence, plus room for a cold start. */
export const STARTUP_GRACE_MS = 1500;
const FALLBACK_INTERVAL_MS = 150;

export type TimerTickSource = "idle" | "worker" | "interval";

export interface TimerWorkerController {
  start: (onTick: () => void) => void;
  stop: () => void;
  destroy: () => void;
  /**
   * Where ticks are coming from right now. `"interval"` means the worker was
   * unavailable (or died) and the main-thread interval is carrying the clock —
   * callers that want to warn about background throttling can read this.
   */
  source: () => TimerTickSource;
}

function supportsWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

export function createTimerWorker(): TimerWorkerController {
  let worker: Worker | null = null;
  let workerUrl: string | null = null;
  let fallbackId: number | null = null;
  let startupId: number | null = null;
  let tickCallback: (() => void) | null = null;
  let source: TimerTickSource = "idle";

  function clearTimers() {
    if (fallbackId !== null) {
      window.clearInterval(fallbackId);
      fallbackId = null;
    }
    if (startupId !== null) {
      window.clearTimeout(startupId);
      startupId = null;
    }
  }

  function teardownWorker() {
    if (worker) {
      try {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      } catch {
        /* already gone */
      }
      worker = null;
    }
  }

  /** Main-thread ticks. Used when there is no worker, and when one dies. */
  function useInterval() {
    clearTimers();
    teardownWorker();
    if (!tickCallback || typeof window === "undefined") return;
    source = "interval";
    fallbackId = window.setInterval(() => tickCallback?.(), FALLBACK_INTERVAL_MS);
  }

  function createWorker(): Worker | null {
    if (!supportsWorker()) return null;
    try {
      const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
      // Deliberately NOT revoked here: a blob URL revoked before the worker
      // script has finished loading is a documented way to get a Worker that
      // constructs successfully and then never runs. It is released in
      // `destroy()` instead.
      const url = URL.createObjectURL(blob);
      const instance = new Worker(url);
      workerUrl = url;
      instance.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string } | null;
        if (data?.type !== "TICK") return;
        if (startupId !== null) {
          // First tick arrived — the worker is genuinely alive.
          window.clearTimeout(startupId);
          startupId = null;
        }
        tickCallback?.();
      };
      instance.onerror = () => {
        // Script failed to load, or threw on the worker thread.
        if (source === "worker") useInterval();
        else teardownWorker();
      };
      return instance;
    } catch {
      return null;
    }
  }

  return {
    start(onTick: () => void) {
      tickCallback = onTick;
      clearTimers();
      teardownWorker();
      worker = createWorker();

      if (!worker) {
        useInterval();
        return;
      }

      source = "worker";
      try {
        worker.postMessage("START");
      } catch {
        useInterval();
        return;
      }

      // Watchdog: if the first tick never lands (blocked blob worker, revoked
      // URL in an old engine, a worker that quietly failed to boot), demote to
      // the interval rather than leaving a frozen clock on screen.
      startupId = window.setTimeout(() => {
        startupId = null;
        if (source === "worker" && tickCallback) useInterval();
      }, STARTUP_GRACE_MS);
    },

    stop() {
      clearTimers();
      tickCallback = null;
      source = "idle";
      if (worker) {
        try {
          worker.postMessage("STOP");
        } catch {
          /* ignore — destroy() will terminate it */
        }
      }
    },

    destroy() {
      this.stop();
      teardownWorker();
      if (workerUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        try {
          URL.revokeObjectURL(workerUrl);
        } catch {
          /* ignore */
        }
      }
      workerUrl = null;
    },

    source() {
      return source;
    },
  };
}
