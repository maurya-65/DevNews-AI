"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { cancelFrame, frame, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/** Smooth scrolling for the landing page only — the reader stays on native scroll.
 *
 *  Ported from the Lovable draft, with one change that matters for feel: Lovable ran
 *  Lenis on its own requestAnimationFrame loop, beside Motion's. Two loops means the
 *  scroll position and the scroll-linked transforms can land in different frames, which
 *  reads as a one-frame shimmer on anything pinned. Here Lenis is stepped from Motion's
 *  own frame loop, so scroll and every transform derived from it commit together.
 *
 *  lerp keeps the input's momentum rather than replacing it: a hard trackpad flick
 *  still travels far, a slow drag still creeps. Touch is left native (syncTouch off),
 *  and reduced motion gets no Lenis at all.
 */

type SmoothScrollContextValue = {
  enabled: boolean;
  scrollTo: (target: string | number | HTMLElement) => void;
};

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  enabled: false,
  scrollTo: () => undefined,
});

/** Height of the fixed landing nav, so anchors land below it rather than under it. */
const NAV_OFFSET = -64;

const ease = (value: number) => 1 - Math.pow(1 - value, 4);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  // A ref, not state: nothing renders differently because Lenis exists, and the only
  // reader is scrollTo, which looks at it on click.
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (reduceMotion) return;

    const instance = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      syncTouch: false,
      anchors: false,
      autoRaf: false,
    });

    const step = ({ timestamp }: { timestamp: number }) => instance.raf(timestamp);
    frame.update(step, true);
    lenisRef.current = instance;

    return () => {
      cancelFrame(step);
      instance.destroy();
      lenisRef.current = null;
    };
  }, [reduceMotion]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement) => {
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { duration: 1.15, easing: ease, offset: NAV_OFFSET });
        return;
      }
      const behavior = reduceMotion ? "auto" : "smooth";
      if (typeof target === "number") window.scrollTo({ top: target, behavior });
      else if (typeof target === "string") document.querySelector(target)?.scrollIntoView({ behavior });
      else target.scrollIntoView({ behavior });
    },
    [reduceMotion],
  );

  // useReducedMotion is null until it has read the media query, so "enabled" means
  // Lenis is running: the query has resolved, and it said motion is fine.
  const value = useMemo(() => ({ enabled: reduceMotion === false, scrollTo }), [reduceMotion, scrollTo]);
  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

export function SmoothAnchor({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { scrollTo } = useSmoothScroll();
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        scrollTo(href);
      }}
    >
      {children}
    </a>
  );
}
