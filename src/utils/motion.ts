import { useReducedMotion } from 'motion/react';

export const MOTION_TOKENS = {
  instant: 0.01,
  fast: 0.14,
  normal: 0.2,
} as const;

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const CARD_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 26,
  mass: 0.9,
};

export const useMotionPreference = () => {
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);

  return {
    reduced,
    durations: {
      instant: MOTION_TOKENS.instant,
      fast: reduced ? MOTION_TOKENS.instant : MOTION_TOKENS.fast,
      normal: reduced ? MOTION_TOKENS.instant : MOTION_TOKENS.normal,
    },
  };
};

export const getSharedTransition = (
  reduced: boolean,
  duration: keyof typeof MOTION_TOKENS = 'fast',
) => ({
  duration: reduced ? MOTION_TOKENS.instant : MOTION_TOKENS[duration],
  ease: MOTION_EASE,
});
