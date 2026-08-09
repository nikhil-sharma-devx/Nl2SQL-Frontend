import { useEffect, useRef } from 'react';

/**
 * Attaches a one-shot IntersectionObserver that adds `is-visible` to the
 * element once it scrolls into view (pairs with the `.reveal`/`.reveal-stagger`
 * CSS in index.css). No-ops under prefers-reduced-motion — the CSS already
 * renders those elements fully visible in that case, so the class is harmless.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
