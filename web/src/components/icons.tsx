"use client";

import { motion, useReducedMotion, type Transition, type Variants } from "motion/react";

/** Icons that do something when you point at them.
 *
 *  Each one is built from individually animated primitives rather than a single `d`,
 *  because morphing a path between two shapes needs matching node counts and these
 *  shapes genuinely differ. Moving parts instead of interpolating outlines is both more
 *  robust and easier to read at 17px.
 *
 *  Motion propagates variants down from whichever ancestor is hovered, so these expose
 *  `rest` / `hover` / `active` and let `<NavIcon>`'s parent drive the state. Nothing here
 *  sets its own `animate` — that would break the chain.
 */

const spring: Transition = { type: "spring", stiffness: 420, damping: 26, mass: 0.6 };

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function useT(): Transition {
  // Respect the OS setting: same end states, no travel.
  return useReducedMotion() ? { duration: 0 } : spring;
}

/** A sheet of text whose lines reflow. */
export function TodayIcon() {
  const transition = useT();
  const reflow = (from: number, to: number): Variants => ({
    rest: { x2: from, transition },
    hover: { x2: to, transition },
    active: { x2: from, transition },
  });

  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden className="size-[17px]">
      <motion.rect
        x="4" y="3" width="16" height="18" rx="2.5" {...line}
        variants={{
          rest: { scale: 1, transition },
          hover: { scale: 1.06, transition },
          active: { scale: 1, transition },
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <motion.line x1="8" y1="8" y2="8" {...line} variants={reflow(16, 13.5)} />
      <motion.line x1="8" y1="12" y2="12" {...line} variants={reflow(16, 16)} />
      <motion.line x1="8" y1="16" y2="16" {...line} variants={reflow(13, 16)} />
    </motion.svg>
  );
}

/** A box whose lid lifts off. */
export function ArchiveIcon() {
  const transition = useT();
  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden className="size-[17px]">
      <motion.path d="M5 8.5v9.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" {...line} />
      <motion.line x1="10" y1="12.5" x2="14" y2="12.5" {...line} />
      <motion.rect
        x="3" y="4" width="18" height="4.5" rx="1.4" {...line}
        variants={{
          rest: { y: 0, rotate: 0, transition },
          hover: { y: -2.5, rotate: -5, transition },
          active: { y: 0, rotate: 0, transition },
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </motion.svg>
  );
}

/** Three sliders that slide. */
export function PrefsIcon() {
  const transition = useT();
  const knob = (from: number, to: number): Variants => ({
    rest: { cx: from, transition },
    hover: { cx: to, transition },
    active: { cx: from, transition },
  });

  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden className="size-[17px]">
      <line x1="3.5" y1="7" x2="20.5" y2="7" {...line} opacity="0.45" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" {...line} opacity="0.45" />
      <line x1="3.5" y1="17" x2="20.5" y2="17" {...line} opacity="0.45" />
      <motion.circle cy="7" r="2.4" fill="currentColor" variants={knob(9, 15.5)} />
      <motion.circle cy="12" r="2.4" fill="currentColor" variants={knob(15, 8)} />
      <motion.circle cy="17" r="2.4" fill="currentColor" variants={knob(7, 16.5)} />
    </motion.svg>
  );
}

/** Wordmark glyph: four bars that resettle, like a run finishing. */
export function Mark({ className = "size-[18px]" }: { className?: string }) {
  const reduced = useReducedMotion();
  const bar = (rest: number, hover: number, i: number) => ({
    rest: { scaleY: rest },
    hover: {
      scaleY: hover,
      transition: reduced
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 380, damping: 18, delay: i * 0.045 },
    },
  });

  return (
    <motion.svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      {[
        { x: 4, rest: 0.45, hover: 1 },
        { x: 9.5, rest: 1, hover: 0.5 },
        { x: 15, rest: 0.7, hover: 0.95 },
      ].map((b, i) => (
        <motion.rect
          key={b.x}
          x={b.x}
          y="3"
          width="4"
          height="18"
          rx="1.6"
          fill="currentColor"
          variants={bar(b.rest, b.hover, i)}
          style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
        />
      ))}
    </motion.svg>
  );
}
