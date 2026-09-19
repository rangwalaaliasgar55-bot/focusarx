import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Soft brand spotlight that trails the pointer on the landing page.
 *
 * Ported from the premium redesign proposal (`focusarx-resource`). Two gates
 * keep it from becoming decoration-for-decoration's-sake:
 *  - it mounts only for fine pointers (no glow to chase on touch devices), and
 *  - it respects `prefers-reduced-motion`, matching the app-wide MotionConfig.
 * Both gates are derived state via `useMediaQuery`/`useReducedMotion` — no
 * effect-managed flags. The movement is transform-only and spring-smoothed
 * through motion values, so pointermove never triggers layout.
 */
export function LandingCursorGlow() {
  const reduceMotion = useReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const x = useMotionValue(-800);
  const y = useMotionValue(-800);
  const sx = useSpring(x, { stiffness: 120, damping: 26, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 26, mass: 0.6 });

  const enabled = finePointer && !reduceMotion;

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => {
      x.set(event.clientX - 260);
      y.set(event.clientY - 260);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[calc(var(--z-content)-1)] h-[520px] w-[520px] rounded-full opacity-50 blur-[90px]"
    >
      <div className="h-full w-full rounded-full bg-[radial-gradient(circle,var(--brand-soft),transparent_70%)]" />
    </motion.div>
  );
}
