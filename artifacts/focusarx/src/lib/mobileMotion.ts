/**
 * Mobile-first motion animations for FocusArx
 * Lightweight, GPU-accelerated animations that work smoothly on mobile
 */

import { motion } from 'framer-motion';
import styled from 'styled-components';

// Page entrance animation
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  },
};

export const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.4,
};

// Card entrance with stagger
export const cardVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  hover: {
    y: -4,
    scale: 1.02,
    transition: {
      duration: 0.2,
    },
  },
  tap: {
    scale: 0.98,
  },
};

// Stagger children animation
export const staggerContainer = {
  initial: {},
  in: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Button press animation
export const buttonVariants = {
  initial: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

// Slide in from right (for mobile menus)
export const slideInRight = {
  initial: {
    x: '100%',
  },
  in: {
    x: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
  out: {
    x: '100%',
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
};

// Fade in animation
export const fadeIn = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  out: {
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

// Scale in animation (for modals)
export const scaleIn = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  in: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300,
    },
  },
  out: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.2,
    },
  },
};

// Pulse animation for notifications
export const pulseVariants = {
  initial: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 2,
    },
  },
};

// Glow animation for active states
export const glowVariants = {
  initial: {
    boxShadow: '0 0 0 rgba(124, 58, 237, 0)',
  },
  active: {
    boxShadow: ['0 0 20px rgba(124, 58, 237, 0.3)', '0 0 40px rgba(124, 58, 237, 0.5)', '0 0 20px rgba(124, 58, 237, 0.3)'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Progress bar animation
export const progressBarVariants = {
  initial: {
    width: 0,
  },
  in: (width: number) => ({
    width: `${width}%`,
    transition: {
      duration: 1,
      ease: 'easeOut',
    },
  }),
};

// Floating animation for decorative elements
export const floatVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Shake animation for errors
export const shakeVariants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
    },
  },
};

// Success checkmark animation
export const checkmarkVariants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  in: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

// Number counter animation
export const counterVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  in: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

// Ripple effect for touch feedback
export const RippleContainer = styled.div`
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }
  
  &:active::after {
    width: 300px;
    height: 300px;
  }
`;

// Skeleton loading animation
export const skeletonVariants = {
  animate: {
    background: [
      'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
      'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 100%)',
      'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// Bounce animation for achievements
export const bounceVariants = {
  initial: {
    scale: 0,
    rotate: -180,
  },
  in: {
    scale: [0, 1.2, 0.9, 1],
    rotate: [−180, 10, −5, 0],
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

// Slide up animation (for bottom sheets)
export const slideUp = {
  initial: {
    y: '100%',
  },
  in: {
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
  out: {
    y: '100%',
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
};

// Rotate animation for loading spinners
export const rotateVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// Morph animation for shape transitions
export const morphVariants = {
  circle: {
    borderRadius: '50%',
    transition: {
      duration: 0.3,
    },
  },
  square: {
    borderRadius: '0%',
    transition: {
      duration: 0.3,
    },
  },
  rounded: {
    borderRadius: '12px',
    transition: {
      duration: 0.3,
    },
  },
};

// Hover lift effect
export const hoverLift = {
  rest: {
    y: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  hover: {
    y: -8,
    boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

// Confetti animation for celebrations
export const confettiVariants = {
  initial: {
    y: -100,
    opacity: 1,
    rotate: 0,
  },
  animate: {
    y: 600,
    opacity: 0,
    rotate: 720,
    transition: {
      duration: 2,
      ease: 'easeIn',
    },
  },
};

// Typing animation for text
export const typingVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const letterVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// Gradient animation
export const gradientVariants = {
  animate: {
    background: [
      'linear-gradient(45deg, #7C3AED, #06D6A0)',
      'linear-gradient(45deg, #06D6A0, #F59E0B)',
      'linear-gradient(45deg, #F59E0B, #7C3AED)',
    ],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// Export motion components with default variants
export const MotionPage = styled(motion.div)`
  will-change: transform, opacity;
`;

export const MotionCard = styled(motion.div)`
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
`;

export const MotionButton = styled(motion.button)`
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
`;
