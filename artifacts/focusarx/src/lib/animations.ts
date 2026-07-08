import { type Variants } from 'framer-motion';

export const PAGE: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

export const CARD: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export const STAGGER: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
};

export const SLIDE_UP: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const POP: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 22 } },
};

export const SHAKE: Variants = {
  animate: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.5 } },
};

export const FLOAT = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const GLOW_PULSE = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(124,58,237,0)',
      '0 0 20px rgba(124,58,237,0.6)',
      '0 0 0px rgba(124,58,237,0)',
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};

export const FADE_IN: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
};

export const SCALE_IN: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};
