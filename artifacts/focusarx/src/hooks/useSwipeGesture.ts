"use client";

import { useEffect, useRef } from "react";

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
  restraint?: number;
  allowedTime?: number;
}

export function useSwipeGesture(options: SwipeOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeDown,
    onSwipeUp,
    threshold = 80,
    restraint = 100,
    allowedTime = 400,
  } = options;

  const ref = useRef<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const start = touchStart.current;
      const elapsed = Date.now() - start.time;
      if (elapsed > allowedTime) {
        touchStart.current = null;
        return;
      }
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      // Horizontal swipe
      if (Math.abs(dx) >= threshold && Math.abs(dy) <= restraint) {
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      }
      // Vertical swipe
      if (Math.abs(dy) >= threshold && Math.abs(dx) <= restraint) {
        if (dy > 0) onSwipeDown?.();
        else onSwipeUp?.();
      }
      touchStart.current = null;
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeDown, onSwipeUp, threshold, restraint, allowedTime]);

  return ref;
}

export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const ref = useRef<HTMLElement | null>(null);
  const startY = useRef<number>(0);
  const pulling = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      const t = e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      pulling.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy > 80) {
        pulling.current = true;
        // Prevent native pull-to-refresh
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (pulling.current) {
        pulling.current = false;
        try {
          await onRefresh();
        } catch {}
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onRefresh, enabled]);

  return ref;
}
