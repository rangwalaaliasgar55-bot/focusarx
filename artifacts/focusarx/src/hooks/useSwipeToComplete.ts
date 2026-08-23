import { useRef } from "react";

/**
 * Swipe-to-complete gesture (audit L4). Attach the returned handlers to a
 * task row: a decisive horizontal swipe (>72px, mostly horizontal) fires
 * onComplete. Vertical scrolling is never hijacked.
 */
export function useSwipeToComplete(onComplete: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    start.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!enabled || !start.current) return;
    const t = e.changedTouches[0];
    if (!t) { start.current = null; return; }
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.6) onComplete();
  };

  return { onTouchStart, onTouchEnd };
}
