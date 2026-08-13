import type { Transition, Variants } from 'framer-motion';

/** Spec §9 "standard" timing — the premium, overshoot-free ease used for
 * reveals and panel transitions app-wide. */
export const standardTransition: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1],
};

/** Cross-fade + 8px drift between routes (spec §9) — never a hard cut, never
 * a slide implying spatial navigation the app doesn't have. */
export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: standardTransition },
  exit: { opacity: 0, y: -8, transition: { ...standardTransition, duration: 0.25 } },
};

/** Reduced-motion collapse of the above — opacity-only, ≤150ms (spec §13). */
export const pageTransitionVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Staggered children entrance — cards in a grid, chat messages. Caps at ~6
 * steps per spec §9 (falls back to simultaneous beyond that via the caller
 * choosing a flat delay rather than more staggerChildren). */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: standardTransition },
};

/** Spring feel for hover/press states driven via whileHover/whileTap. */
export const springLift: Transition = { type: 'spring', stiffness: 300, damping: 24 };
