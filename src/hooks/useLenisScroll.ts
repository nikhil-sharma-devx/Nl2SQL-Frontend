import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

/**
 * Opts a single long-form page into Lenis smooth-scroll physics (eased
 * inertia instead of the browser's stepped native scroll). Scoped to
 * whichever page calls it via `wrapperRef`/`contentRef` — never applied
 * globally, so dense/virtualized in-app views (tables, chat, schema graph)
 * keep native scroll untouched. No-ops entirely under
 * prefers-reduced-motion, per the design spec's motion rules.
 */
export function useLenisScroll<T extends HTMLElement = HTMLDivElement>() {
  const wrapperRef = useRef<T>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    // Wrapper keeps native overflow-y as a correctness fallback (works even
    // if this effect skips or Lenis fails to init) — Lenis only smooths it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ wrapper, content, smoothWheel: true });
    lenisRef.current = lenis;

    let raf: number;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  /** Smoothly scrolls to a target within the Lenis-managed container, falling
   * back to native `scrollIntoView` when Lenis isn't active (reduced-motion). */
  const scrollTo = (target: string | HTMLElement) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: 0 });
      return;
    }
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return { wrapperRef, contentRef, scrollTo };
}
