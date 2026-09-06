import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the screen awake while focusing, reacquiring after a hidden tab resumes. */
export function useWakeLock(active: boolean) {
  const supported = typeof navigator !== "undefined" && typeof navigator.wakeLock?.request === "function";
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const request = useCallback((): Promise<void> => {
    if (!supported || !enabledRef.current || document.visibilityState !== "visible") return Promise.resolve();
    if (wakeLockRef.current || pendingRef.current !== null) return Promise.resolve();

    const generation = ++generationRef.current;
    pendingRef.current = generation;
    // Publish state in the browser API's completion callbacks, never during
    // effect setup. The first promise also catches synchronous API failures.
    return Promise.resolve().then(() => navigator.wakeLock.request("screen")).then(async (sentinel) => {
      // A request cannot be aborted. Release a late result instead of leaking
      // a screen lock after unmount, a stopped timer, or a newer request.
      if (!enabledRef.current || generation !== generationRef.current || document.visibilityState !== "visible") {
        await sentinel.release();
        return;
      }
      wakeLockRef.current = sentinel;
      setIsLocked(true);
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current !== sentinel) return;
        // A released sentinel must not block reacquisition on visibilitychange.
        wakeLockRef.current = null;
        if (mountedRef.current) setIsLocked(false);
      }, { once: true });
    }).catch(() => {
      // Unsupported, denied, or backgrounded: focusing must still work.
    }).finally(() => {
      if (pendingRef.current === generation) pendingRef.current = null;
    });
  }, [supported]);

  const release = useCallback((): Promise<void> => {
    generationRef.current++;
    pendingRef.current = null;
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!sentinel) return Promise.resolve();
    return Promise.resolve().then(() => sentinel.release()).catch(() => {
      // Releasing an already-released lock is harmless.
    }).then(() => {
      if (mountedRef.current && !wakeLockRef.current) setIsLocked(false);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    enabledRef.current = active;
    if (active) void request();
    else void release();
    return () => {
      enabledRef.current = false;
      void release();
    };
  }, [active, request, release]);

  useEffect(() => {
    if (!active || !supported) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [active, supported, request]);

  return { supported, isLocked: active && isLocked, request, release };
}
