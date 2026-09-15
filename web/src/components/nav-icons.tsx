"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";

/** More nav icons in the same idiom as icons.tsx: moving parts, not morphing outlines, and
 *  `rest` / `hover` / `active` variants driven by the parent link. */

const spring: Transition = { type: "spring", stiffness: 420, damping: 26, mass: 0.6 };

const line = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function useT(): Transition {
  return useReducedMotion() ? { duration: 0 } : spring;
}

/** Three stories on one line; the later ones pull toward the first. */
export function ThreadsIcon() {
  const transition = useT();
  const node = (from: number, to: number) => ({
    rest: { cx: from, transition },
    hover: { cx: to, transition },
    active: { cx: from, transition },
  });
  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden className="size-[17px]">
      <line x1="5" y1="12" x2="19" y2="12" {...line} fill="none" opacity="0.45" />
      <circle cx="5" cy="12" r="2.4" fill="currentColor" />
      <motion.circle cy="12" r="2.1" fill="currentColor" variants={node(12, 10)} />
      <motion.circle cy="12" r="1.8" fill="currentColor" variants={node(19, 15.5)} />
    </motion.svg>
  );
}

/** A bookmark that fills in. */
export function SavedIcon() {
  const transition = useT();
  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden className="size-[17px]">
      <motion.path
        d="M7 3.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V4.5a1 1 0 0 1 1-1z"
        {...line}
        fill="currentColor"
        variants={{
          rest: { fillOpacity: 0, y: 0, transition },
          hover: { fillOpacity: 0.2, y: -1, transition },
          active: { fillOpacity: 0.85, y: 0, transition },
        }}
      />
    </motion.svg>
  );
}

/** A lens that leans in. */
export function SearchIcon() {
  const transition = useT();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[17px]"
      variants={{
        rest: { rotate: 0, transition },
        hover: { rotate: -12, transition },
        active: { rotate: 0, transition },
      }}
    >
      <circle cx="10.5" cy="10.5" r="6" {...line} fill="none" />
      <line x1="15" y1="15" x2="20" y2="20" {...line} fill="none" />
    </motion.svg>
  );
}
