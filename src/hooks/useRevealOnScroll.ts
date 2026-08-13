import { useCallback, useRef } from 'react';

/**
 * Attaches a one-shot IntersectionObserver that adds `is-visible` to the
 * element once it scrolls into view (pairs with the `.reveal`/`.reveal-stagger`
 * CSS in index.css). No-ops under prefers-reduced-motion — the CSS already
 * renders those elements fully visible in that case, so the class is harmless.
 *
 * Uses a callback ref rather than useEffect + useRef: the target element is
 * often gated behind a loading/empty state and doesn't exist on first mount,
 * so an effect with an empty dep array would attach to nothing and never
 * re-run once the real element appears. A callback ref fires every time React
 * actually attaches/detaches the DOM node, so it re-attaches correctly.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
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
    observerRef.current = observer;
  }, []);

  return ref;
}
