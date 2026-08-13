import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { pageTransitionVariants, pageTransitionVariantsReduced } from './variants';

/**
 * Wraps a route's content in the app's standard cross-fade + drift
 * transition (spec §9), keyed by pathname. Collapses to an opacity-only
 * fade under prefers-reduced-motion (spec §13) — every route gets this for
 * free without each page handling it itself.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  const variants = reduced ? pageTransitionVariantsReduced : pageTransitionVariants;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
