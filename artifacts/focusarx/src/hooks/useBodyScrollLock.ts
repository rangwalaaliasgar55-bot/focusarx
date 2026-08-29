import { useEffect } from "react";

/**
 * Module-level lock state.
 *
 * It has to live outside React: two overlays can be open at once (a sheet with
 * a confirm dialog on top), and if each instance locked and restored
 * independently, closing the inner one would unlock the page while the outer
 * one was still visible. A shared counter also survives StrictMode's
 * mount/unmount/remount in development, which would otherwise unlock early.
 */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";
let savedTouchAction = "";

/**
 * Prevent the page behind an overlay from scrolling.
 *
 * Why this is not just `overflow: hidden`:
 *  - removing the scrollbar changes the viewport width, so the whole page
 *    shifts sideways for the duration of the overlay; we add matching padding
 *    to absorb it
 *  - iOS Safari ignores `overflow: hidden` on <body> for touch scrolling, so we
 *    also need `touch-action: none`
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    if (lockCount === 0) {
      const { body } = document;
      const { documentElement } = document;

      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      savedTouchAction = body.style.touchAction;

      // Width the scrollbar was occupying, if any.
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      if (scrollbarWidth > 0) {
        const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + scrollbarWidth}px`;
      }
    }

    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
        document.body.style.touchAction = savedTouchAction;
      }
    };
  }, [active]);
}
