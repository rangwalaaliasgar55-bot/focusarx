/**
 * FocusArx — Apple-style scroll motion primitives
 * ────────────────────────────────────────────────
 * A small, reusable layer over framer-motion for the marketing surfaces:
 *
 *  <Reveal>        — fade + rise as the element enters the viewport (once).
 *  <RevealStagger> — container that staggers its <RevealItem> children.
 *  <RevealItem>    — child of RevealStagger.
 *  <ScrollScale>   — scroll-SCRUBBED product reveal: scales from ~0.94 → 1
 *                    with a slight X-rotation flattening out, like Apple's
 *                    device shots. Driven by scroll position, not time.
 *  <HeroScrub>     — the inverse: hero content softly recedes (opacity/scale/
 *                    translate) as you scroll past it.
 *  <Parallax>      — slow decorative drift for background glows.
 *
 * Every primitive collapses to a static element when the user prefers
 * reduced motion. All transforms are GPU-composited (opacity/transform only)
 * so nothing here can cause layout shift — reveals start at full layout size.
 */
import { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/* Apple-ish easing: fast start, long soft landing. */
export const EASE_APPLE = [0.16, 1, 0.3, 1] as const;

const VIEWPORT = { once: true, margin: "-80px 0px" } as const;

/* ── Reveal ─────────────────────────────────────────────────────────── */

interface RevealProps extends Omit<React.ComponentProps<typeof motion.div>, "children"> {
  children?: React.ReactNode;
  /** Extra delay in seconds (use sparingly — stagger containers are better). */
  delay?: number;
  /** Initial rise distance in px. Default 24. */
  distance?: number;
  as?: "div" | "section" | "article" | "header" | "li" | "span";
}

export function Reveal({ delay = 0, distance = 24, as = "div", children, ...rest }: RevealProps) {
  const reduced = useReducedMotion();
  const Tag = (motion as any)[as] as typeof motion.div;
  if (reduced) {
    const { style, className } = rest as any;
    const Plain = as;
    return <Plain style={style} className={className}>{children}</Plain>;
  }
  return (
    <Tag
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, delay, ease: EASE_APPLE }}
      style={{ willChange: "transform, opacity", ...(rest as { style?: React.CSSProperties }).style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── Staggered reveal ───────────────────────────────────────────────── */

const STAGGER_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_APPLE } },
};

type StaggerProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode;
};

export function RevealStagger({ children, ...rest }: StaggerProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    const { style, className } = rest as any;
    return <div style={style} className={className}>{children}</div>;
  }
  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" whileInView="show" viewport={VIEWPORT} {...rest}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, ...rest }: StaggerProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    const { style, className } = rest as any;
    return <div style={style} className={className}>{children}</div>;
  }
  return (
    <motion.div variants={STAGGER_ITEM} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── ScrollScale — Apple product-shot reveal, scrubbed by scroll ────── */

export function ScrollScale({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Progress 0 → 1 while the element travels from below the fold to center.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 95%", "start 35%"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.55 });
  const scale = useTransform(smooth, [0, 1], [0.94, 1]);
  const rotateX = useTransform(smooth, [0, 1], [7, 0]);
  const opacity = useTransform(smooth, [0, 0.55], [0.45, 1]);
  const y = useTransform(smooth, [0, 1], [36, 0]);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className} style={{ perspective: "1400px" }}>
      <motion.div style={{ scale, rotateX, opacity, y, transformOrigin: "center 20%", willChange: "transform, opacity" }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ── HeroScrub — hero recedes softly as you scroll away ─────────────── */

export function HeroScrub({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.35]);
  const scale = useTransform(scrollYProgress, [0, 0.8], [1, 0.965]);
  const y = useTransform(scrollYProgress, [0, 0.8], [0, 44]);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ opacity, scale, y, willChange: "transform, opacity" }}>{children}</motion.div>
    </div>
  );
}

/* ── Parallax — slow drift for decorative layers ────────────────────── */

export function Parallax({
  children,
  className,
  amount = 80,
}: {
  children: React.ReactNode;
  className?: string;
  /** Total drift in px across the element's scroll journey. */
  amount?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount * 0.5, -amount * 0.5]);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y, willChange: "transform" }}>{children}</motion.div>
    </div>
  );
}
