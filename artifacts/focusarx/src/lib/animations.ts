/**
 * FocusArx — Shared Motion System
 *
 * Single source-of-truth for all Framer Motion variants.
 */

import { type Variants, type Transition } from 'framer-motion';

/* ─── Shared easing curves ─────────────────────────────────────────────── */
const SPRING_SMOOTH: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 };
const SPRING_SNAPPY: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };
const SPRING_BOUNCY: Transition = { type: 'spring', stiffness: 480, damping: 22, mass: 0.5 };
const EASE_OUT:  Transition = { duration: 0.28, ease: [0.16, 1, 0.3, 1] };
const EASE_FAST: Transition = { duration: 0.16, ease: [0.16, 1, 0.3, 1] };

/* ─── Blur variants ────────────────────────────────────────────────────── */
export const BLUR_IN: Variants = {
  initial: { opacity: 0, filter: 'blur(10px)', scale: 0.95 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1, transition: { ...SPRING_SMOOTH, duration: 0.6 } },
  exit:    { opacity: 0, filter: 'blur(10px)', scale: 0.95, transition: EASE_FAST },
};

/* ─── Page transitions ─────────────────────────────────────────────────── */
export const PAGE: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { ...SPRING_SMOOTH, delay: 0.02 } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const PAGE_FADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' } },
};

/* ─── Card / panel entrances ───────────────────────────────────────────── */
export const CARD: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, y: 8,  scale: 0.97, transition: EASE_FAST },
};

export const CARD_RISE: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.96, filter: 'blur(3px)' },
  animate: { opacity: 1, y: 0,  scale: 1,    filter: 'blur(0px)', transition: SPRING_SMOOTH },
};

/* ─── Stagger containers ───────────────────────────────────────────────── */
export const STAGGER: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.065 } },
};

export const STAGGER_FAST: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04 } },
};

export const STAGGER_SLOW: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.10, delayChildren: 0.1 } },
};

/** Use as a child inside a STAGGER container */
export const STAGGER_CHILD: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0,  transition: SPRING_SMOOTH },
  exit:    { opacity: 0, y: 6,  transition: EASE_FAST },
};

export const STAGGER_CHILD_FADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};

/* ─── Slide variants ───────────────────────────────────────────────────── */
export const SLIDE_UP: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, y: -12, transition: EASE_FAST },
};

export const SLIDE_DOWN: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, y: -10, transition: EASE_FAST },
};

export const SLIDE_LEFT: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, x: 16, transition: EASE_FAST },
};

export const SLIDE_RIGHT: Variants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, x: -16, transition: EASE_FAST },
};

/* ─── Pop / scale variants ─────────────────────────────────────────────── */
export const POP: Variants = {
  initial: { scale: 0,    opacity: 0 },
  animate: { scale: 1,    opacity: 1, transition: SPRING_BOUNCY },
  exit:    { scale: 0.85, opacity: 0, transition: EASE_FAST },
};

export const SCALE_IN: Variants = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1, transition: SPRING_SNAPPY },
  exit:    { opacity: 0, scale: 0.92, transition: EASE_FAST },
};

export const ZOOM_IN: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1,    transition: { ...SPRING_SMOOTH, duration: 0.3 } },
  exit:    { opacity: 0, scale: 0.96, transition: EASE_FAST },
};

/* ─── Fade only ────────────────────────────────────────────────────────── */
export const FADE_IN: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
};

export const FADE_UP: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { ...EASE_OUT, duration: 0.32 } },
  exit:    { opacity: 0, y: 4, transition: { duration: 0.14 } },
};

/* ─── Special states ───────────────────────────────────────────────────── */
export const SHAKE: Variants = {
  animate: { x: [0, -7, 7, -5, 5, -2, 2, 0], transition: { duration: 0.45 } },
};

export const FLOAT = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const GLOW_PULSE = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(124,58,237,0)',
      '0 0 24px rgba(124,58,237,0.55)',
      '0 0 0px rgba(124,58,237,0)',
    ],
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
  },
};

/* ─── Hover / press spring helpers ────────────────────────────────────── */
/** Standard hover: lift + subtle shadow */
export const hoverLift = {
  y: -2,
  boxShadow: '0 8px 24px rgba(124,58,237,0.18)',
  transition: SPRING_SNAPPY,
};

/** Button press: scale down */
export const tapPress = {
  scale: 0.96,
  transition: { duration: 0.1 },
};

/** Card hover: lift with violet shadow */
export const cardHover = {
  y: -3,
  boxShadow: '0 12px 32px rgba(124,58,237,0.22), 0 0 0 1px rgba(124,58,237,0.16)',
  transition: SPRING_SMOOTH,
};

/* ─── Modal overlay ────────────────────────────────────────────────────── */
export const OVERLAY: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.20, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const MODAL: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 16 },
  animate: { opacity: 1, scale: 1,    y: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: EASE_FAST },
};

/* ─── Notification / toast ─────────────────────────────────────────────── */
export const TOAST: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.95 },
  animate: { opacity: 1, y: 0,  scale: 1, transition: SPRING_SNAPPY },
  exit:    { opacity: 0, y: 8,  scale: 0.96, transition: EASE_FAST },
};

/* ─── List item transitions ────────────────────────────────────────────── */
export const LIST_ITEM: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: SPRING_SMOOTH },
  exit:    { opacity: 0, x: 8, transition: EASE_FAST },
};

/* ─── Number counter animation ─────────────────────────────────────────── */
export const COUNT_UP = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: SPRING_SNAPPY },
};

/* ─── Drawer / sheet ───────────────────────────────────────────────────── */
export const DRAWER_BOTTOM: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: SPRING_SMOOTH },
  exit:    { y: '100%', transition: { ...EASE_OUT, duration: 0.22 } },
};

export const DRAWER_LEFT: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: SPRING_SMOOTH },
  exit:    { x: '-100%', transition: { ...EASE_OUT, duration: 0.22 } },
};

/* ─── Reduced-motion helpers ───────────────────────────────────────────── */
/**
 * Call this to collapse a variant to a simple opacity fade when
 * \`useReducedMotion()\` returns true.
 *
 * Usage:
 *   const prefersReduced = useReducedMotion();
 *   <motion.div variants={rm(CARD, prefersReduced)} />
 */
export function rm(variant: Variants, reduced: boolean | null): Variants {
  if (!reduced) return variant;
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.15 } },
    exit:    { opacity: 0, transition: { duration: 0.10 } },
  };
}
