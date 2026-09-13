"use client";

import { motion, type Transition } from "motion/react";

const spring: Transition = { type: "spring", stiffness: 320, damping: 24 };

/** The landing page's wordmark: three bars of different heights beside the name. */
export function DevNewsMark({ animated = false }: { animated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="DevNews">
      <span className="flex h-7 items-end gap-1" aria-hidden="true">
        {[13, 22, 17].map((height, index) => (
          <motion.span
            key={height}
            className="w-1.5 rounded-full bg-foreground"
            style={{ height }}
            initial={animated ? { scaleY: 0, opacity: 0 } : false}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ ...spring, delay: animated ? index * 0.09 : 0 }}
          />
        ))}
      </span>
      <span className="font-heading text-[1.4rem] font-bold leading-none">DevNews</span>
    </span>
  );
}
