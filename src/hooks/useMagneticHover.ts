import { useEffect, useRef } from 'react';

const MAX_OFFSET = 6;
const RADIUS = 90;

/**
 * Subtle cursor-tracking transform for primary CTAs — the button drifts
 * toward the cursor within `RADIUS`px, capped at `MAX_OFFSET`px, and springs
 * back on mouseleave. Disabled on touch devices and under reduced-motion.
 */
export function useMagneticHover<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS) return;
      const pull = (1 - dist / RADIUS) * MAX_OFFSET;
      const angle = Math.atan2(dy, dx);
      el.style.transform = `translate(${Math.cos(angle) * pull}px, ${Math.sin(angle) * pull}px)`;
    };

    const onLeave = () => {
      el.style.transform = '';
    };

    el.style.transition = 'transform 0.2s ease-out';
    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return ref;
}
