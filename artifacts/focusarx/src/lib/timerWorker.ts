/**
 * Background Precision Timer Worker (Web Worker with Blob fallback).
 *
 * Browsers aggressively throttle setInterval() down to 1 tick/min in
 * inactive or background tabs. A Web Worker runs on an isolated thread,
 * ensuring unthrottled ticks and exact countdown precision.
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

export interface TimerWorkerController {
  start: (onTick: () => void) => void;
  stop: () => void;
  destroy: () => void;
}

export function createTimerWorker(): TimerWorkerController {
  let worker: Worker | null = null;
  let fallbackId: number | null = null;
  let tickCallback: (() => void) | null = null;

  try {
    if (typeof window !== "undefined" && typeof Worker !== "undefined" && typeof Blob !== "undefined") {
      const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);

      worker.onmessage = (event) => {
        if (event.data?.type === "TICK" && tickCallback) {
          tickCallback();
        }
      };
    }
  } catch {
    worker = null;
  }

  return {
    start(onTick: () => void) {
      tickCallback = onTick;
      if (worker) {
        worker.postMessage("START");
      } else if (typeof window !== "undefined") {
        if (fallbackId) clearInterval(fallbackId);
        fallbackId = window.setInterval(onTick, 150);
      }
    },
    stop() {
      if (worker) {
        worker.postMessage("STOP");
      }
      if (fallbackId) {
        clearInterval(fallbackId);
        fallbackId = null;
      }
      tickCallback = null;
    },
    destroy() {
      this.stop();
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },
  };
}
