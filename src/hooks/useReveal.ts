'use client';

import { useEffect, useRef, useState } from 'react';

/** Scroll-triggered reveal (Uber careers–style fade + rise). Respects reduced motion. */
export function useReveal(options?: {
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const once = options?.once ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const t = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { rootMargin: options?.rootMargin ?? '0px 0px -8% 0px', threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, options?.rootMargin]);

  return { ref, visible, className: visible ? 'ig-reveal is-visible' : 'ig-reveal' };
}
