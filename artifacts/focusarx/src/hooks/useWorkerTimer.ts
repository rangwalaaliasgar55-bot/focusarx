import { useCallback, useEffect, useRef, useState } from 'react';

export interface WorkerTimerState {
  elapsed: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
}

/**
 * useWorkerTimer — Accurate timer using Web Worker that doesn't drift
 * when the browser tab is backgrounded. Falls back to setInterval if
 * Web Workers are not available.
 */
export function useWorkerTimer(durationSeconds: number) {
  const [state, setState] = useState<WorkerTimerState>({
    elapsed: 0,
    remaining: durationSeconds,
    isRunning: false,
    isPaused: false,
  });

  const workerRef = useRef<Worker | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('./timer.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.addEventListener('message', (event) => {
        const { type, elapsed, remaining, isPaused } = event.data;

        switch (type) {
          case 'tick':
            setState({
              elapsed,
              remaining,
              isRunning: true,
              isPaused,
            });
            break;
          case 'complete':
            setState(prev => ({
              ...prev,
              isRunning: false,
              isPaused: false,
              elapsed: durationSeconds,
              remaining: 0,
            }));
            onCompleteRef.current?.();
            break;
          case 'paused':
            setState(prev => ({ ...prev, isPaused: true }));
            break;
          case 'resumed':
            setState(prev => ({ ...prev, isPaused: false }));
            break;
        }
      });

      workerRef.current = worker;

      return () => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      // Web Worker not available — timer will use fallback
      return;
    }
  }, []);

  // Reset when duration changes
  useEffect(() => {
    setState({
      elapsed: 0,
      remaining: durationSeconds,
      isRunning: false,
      isPaused: false,
    });
  }, [durationSeconds]);

  const start = useCallback((seconds?: number) => {
    const dur = seconds ?? durationSeconds;
    setState({
      elapsed: 0,
      remaining: dur,
      isRunning: true,
      isPaused: false,
    });
    workerRef.current?.postMessage({
      type: 'start',
      data: { durationSeconds: dur },
    });
  }, [durationSeconds]);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: 'pause' });
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    workerRef.current?.postMessage({ type: 'resume' });
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'stop' });
    setState({
      elapsed: 0,
      remaining: durationSeconds,
      isRunning: false,
      isPaused: false,
    });
  }, [durationSeconds]);

  const setOnComplete = useCallback((fn: () => void) => {
    onCompleteRef.current = fn;
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    setOnComplete,
  };
}
