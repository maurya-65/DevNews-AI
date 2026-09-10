"use client";

import { motion, useReducedMotion } from "motion/react";

/** The day's run, drawn as a dial: one tick per candidate, the kept ones long and inked.
 *
 *  This is the one piece of ornament in the app, and it earns its place by being data —
 *  a glance tells you whether today was a generous day or a thin one, and every day's
 *  mark differs because every day's run does. A gradient blob would have filled the same
 *  space and said nothing.
 */
export function DailySeal({
  scored,
  kept,
  className = "",
}: {
  scored: number;
  kept: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const total = Math.max(scored, 1);

  // Ticks run clockwise from twelve o'clock. Kept ones lead, so the inked arc reads as a
  // single wedge rather than being scattered around the dial.
  const ticks = Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const isKept = i < kept;
    const inner = isKept ? 27 : 33;
    const outer = isKept ? 45 : 38;
    return {
      i,
      isKept,
      x1: 50 + Math.cos(rad) * inner,
      y1: 50 + Math.sin(rad) * inner,
      x2: 50 + Math.cos(rad) * outer,
      y2: 50 + Math.sin(rad) * outer,
    };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={`size-[68px] shrink-0 ${className}`}
    >
      <motion.circle
        cx="50"
        cy="50"
        r="21"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-border"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {ticks.map((t) => (
        <motion.line
          key={t.i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeWidth={t.isKept ? 2.4 : 1.4}
          strokeLinecap="round"
          className={t.isKept ? "stroke-signal" : "stroke-border"}
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.45,
            delay: reduced ? 0 : 0.15 + t.i * 0.022,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </svg>
  );
}
