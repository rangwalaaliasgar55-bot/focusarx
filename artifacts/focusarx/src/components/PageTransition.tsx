import { motion, useReducedMotion } from "framer-motion";
import { PAGE, SLIDE_UP, FADE_IN, rm } from "@/lib/animations";

/**
 * PageTransition — wraps page content with the shared PAGE variant.
 * Automatically respects prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={rm(PAGE, reduced)}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

export function SlideUpTransition({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={rm(SLIDE_UP, reduced)}
      initial="initial"
      animate="animate"
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={rm(FADE_IN, reduced)}
      initial="initial"
      animate="animate"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
