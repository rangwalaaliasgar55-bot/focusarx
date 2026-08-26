"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep screen awake during focus mode using Wake Lock API.
 * Gracefully degrades on unsupported browsers (iOS Safari, etc).
 * Re-acquires on visibilitychange.
 */
export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [supported, setSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  const request = useCallback(async () => {
    if (!supported) return;
    try {
      // @ts-ignore - Wake Lock API types not in lib.dom yet in some TS versions
      const sentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setIsLocked(true);
      sentinel.addEventListener("release", () => {
        setIsLocked(false);
      });
    } catch {
      // Permission denied or not allowed - silent fail
      setIsLocked(false);
    }
  }, [supported]);

  const release = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {}
    wakeLockRef.current = null;
    setIsLocked(false);
  }, []);

  useEffect(() => {
    if (active) {
      void request();
    } else {
      void release();
    }
    return () => {
      void release();
    };
  }, [active, request, release]);

  // Re-acquire when tab becomes visible again (browser auto-releases on hide)
  useEffect(() => {
    if (!active || !supported) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [active, supported, request]);

  return { supported, isLocked, request, release };
}
