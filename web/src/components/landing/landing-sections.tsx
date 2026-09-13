"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/** Everything below the hero. Each section owns its own scroll range, so its sequence
 *  is local: entering it plays forward, leaving back up the page plays it in reverse. */

const steps = [
  ["01", "Fetch", "Hacker News, Lobsters and a dozen engineering blogs. Duplicates collapse on canonical URL."],
  ["02", "Judge", "Every candidate is scored against your preferences: novelty, consequence, depth. Rejects included."],
  ["03", "Cut", "Ranking happens in code, not in the prompt. A thin day ships a short digest instead of padding."],
] as const;

const digestItems = [
  ["01", "Postgres 18 makes async I/O measurable", "Hacker News", "9.6", "A meaningful storage-engine shift with clear, reproducible benchmarks."],
  ["02", "Rust in the Linux kernel: a year in", "Lobsters", "9.3", "First-hand evidence from one of software’s highest-stakes migrations."],
  ["03", "The case for boring build systems", "Increment", "8.7", "A durable engineering argument with consequences beyond one toolchain."],
] as const;

/** Phones and touch screens keep native scrolling and get a plain vertical digest —
 *  a pinned horizontal track fights a thumb instead of following it. */
const TOUCH_QUERY = "(max-width: 767px), (pointer: coarse)";

function subscribeTouch(onChange: () => void) {
  const media = window.matchMedia(TOUCH_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useTouchLayout() {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

function ParallaxHeading({
  children,
  className,
  progress,
}: {
  children: ReactNode;
  className: string;
  progress: MotionValue<number>;
}) {
  const reduceMotion = useReducedMotion();
  const y = useTransform(progress, [0, 1], [reduceMotion ? 0 : 20, reduceMotion ? 0 : -20]);
  return (
    <motion.h2 className={`${className} will-change-transform`} style={{ y }}>
      {children}
    </motion.h2>
  );
}

function Step({
  number,
  title,
  copy,
  index,
  progress,
}: {
  number: string;
  title: string;
  copy: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const centers = [0.2, 0.5, 0.8];
  const center = centers[index] ?? 0.5;
  const opacity = useTransform(progress, [center - 0.18, center, center + 0.18], [0.35, 1, 0.35]);
  const y = useTransform(progress, [center - 0.18, center, center + 0.18], [12, 0, -12]);
  return (
    <motion.article style={{ opacity, y }} className="will-change-transform">
      <span className="font-mono text-[0.65rem] text-muted-foreground">{number}</span>
      <h3 className="mt-8 font-heading text-4xl font-semibold">{title}</h3>
      <p className="mt-5 max-w-sm leading-relaxed text-muted-foreground">{copy}</p>
    </motion.article>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <section ref={ref} id="how-it-works" className="scroll-section border-b border-border md:h-[220vh]">
      <div className="section-sticky px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-14 h-px bg-border">
            <motion.div
              className="h-full origin-left bg-signal"
              style={{ scaleX: reduceMotion ? 1 : scrollYProgress }}
            />
          </div>
          <p className="mb-14 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            How it works
          </p>
          <div className="grid gap-14 md:grid-cols-3 md:gap-8">
            {steps.map(([number, title, copy], index) => (
              <Step key={number} number={number} title={title} copy={copy} index={index} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SealTick({
  index,
  kept,
  progress,
  reduced,
}: {
  index: number;
  kept: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const start = index / 48;
  const isKept = index < kept;
  const opacity = useTransform(progress, [start, Math.min(start + 0.12, 1)], [0.08, isKept ? 1 : 0.42]);
  const pathLength = useTransform(progress, [start, Math.min(start + 0.12, 1)], [0, 1]);
  return (
    <motion.line
      x1="160"
      y1={isKept ? 24 : 30}
      x2="160"
      y2={isKept ? 52 : 45}
      transform={`rotate(${index * 9} 160 160)`}
      className={isKept ? "stroke-signal" : "stroke-muted-foreground"}
      strokeWidth={isKept ? 3 : 1}
      style={{
        opacity: reduced ? (isKept ? 1 : 0.42) : opacity,
        pathLength: reduced ? 1 : pathLength,
      }}
    />
  );
}

export function DailySeal() {
  const ref = useRef<HTMLElement>(null);
  const [kept, setKept] = useState(8);
  const reduceMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-4, 4]);
  return (
    <section ref={ref} className="border-b border-border px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
      <div className="mx-auto grid max-w-5xl items-center gap-16 md:grid-cols-2">
        <motion.div className="mx-auto aspect-square w-full max-w-sm will-change-transform" style={{ rotate }}>
          <svg viewBox="0 0 320 320" role="img" aria-label={`Daily seal with ${kept} kept items`} className="size-full">
            <circle cx="160" cy="160" r="104" fill="none" stroke="currentColor" strokeOpacity="0.1" />
            {Array.from({ length: 40 }).map((_, index) => (
              <SealTick key={index} index={index} kept={kept} progress={scrollYProgress} reduced={reduceMotion} />
            ))}
            <text x="160" y="151" textAnchor="middle" className="fill-foreground font-heading text-[54px] font-semibold">
              {kept}
            </text>
            <text
              x="160"
              y="181"
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]"
            >
              kept today
            </text>
          </svg>
        </motion.div>
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">The daily seal</p>
          <ParallaxHeading
            progress={scrollYProgress}
            className="mt-6 font-heading text-4xl font-semibold leading-tight sm:text-5xl"
          >
            Every day leaves a different mark.
          </ParallaxHeading>
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
            Every day’s mark is different, because every day’s run is.
          </p>
          <label
            htmlFor="kept-range"
            className="mt-12 flex items-center justify-between font-mono text-xs uppercase tracking-[0.14em]"
          >
            <span>Kept</span>
            <span className="text-signal">{kept} / 12</span>
          </label>
          <input
            id="kept-range"
            type="range"
            min="0"
            max="12"
            value={kept}
            onChange={(event) => setKept(Number(event.target.value))}
            className="seal-range mt-4 w-full"
          />
        </div>
      </div>
    </section>
  );
}

function DigestCard({
  item,
  index,
  progress,
  staticLayout,
}: {
  item: (typeof digestItems)[number];
  index: number;
  progress: MotionValue<number>;
  staticLayout: boolean;
}) {
  const centers = [0.15, 0.5, 0.85];
  const center = centers[index] ?? 0.5;
  const y = useTransform(progress, [center - 0.14, center, center + 0.14], staticLayout ? [0, 0, 0] : [14, -10, 14]);
  const [rank, headline, source, score, reason] = item;
  return (
    <motion.article
      className="digest-card w-full shrink-0 border-y border-border py-8 will-change-transform md:w-[56vw] md:max-w-[760px]"
      style={{ y }}
    >
      <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 sm:grid-cols-[4rem_1fr_10rem_3rem] sm:gap-5">
        <span className="font-mono text-xs text-signal">{rank}</span>
        <h3 className="font-heading text-2xl font-semibold leading-snug sm:text-4xl">{headline}</h3>
        <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground sm:block">
          {source}
        </span>
        <span className="text-right font-mono text-xs">{score}</span>
      </div>
      <p className="mt-6 grid grid-cols-[2.5rem_1fr] gap-3 font-mono text-[0.65rem] leading-relaxed text-muted-foreground sm:grid-cols-[4rem_1fr] sm:gap-5">
        <span />
        <span>{reason}</span>
      </p>
    </motion.article>
  );
}

export function SampleDigest() {
  const ref = useRef<HTMLElement>(null);
  const touch = useTouchLayout();
  const reduceMotion = Boolean(useReducedMotion());
  const staticLayout = touch || reduceMotion;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], staticLayout ? ["0%", "0%"] : ["0%", "-53%"]);
  return (
    <section ref={ref} className="digest-track border-b border-border md:h-[260vh]">
      <div className="digest-sticky overflow-hidden px-5 py-24 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Sample digest · 07:00
          </p>
          <ParallaxHeading progress={scrollYProgress} className="mt-6 font-heading text-5xl font-semibold sm:text-6xl">
            Today’s cut.
          </ParallaxHeading>
          <motion.div className="digest-row mt-14 flex gap-8 will-change-transform md:w-max" style={{ x }}>
            {digestItems.map((item, index) => (
              <DigestCard
                key={item[0]}
                item={item}
                index={index}
                progress={scrollYProgress}
                staticLayout={staticLayout}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const quietWords = "Some days, nothing clears the bar. You get an empty page, not filler.".split(" ");

function QuietWord({
  word,
  index,
  progress,
  reduced,
}: {
  word: string;
  index: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const start = index / (quietWords.length + 3);
  const opacity = useTransform(progress, [start, Math.min(1, start + 0.17)], [0.15, 1]);
  return (
    <motion.span style={{ opacity: reduced ? 1 : opacity }}>
      {word}{" "}
    </motion.span>
  );
}

export function QuietDay() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 45%"] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [20, -20]);
  return (
    <section ref={ref} className="border-b border-border px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Quiet day · 0 kept</p>
        <motion.h2
          className="mt-7 font-heading text-5xl font-semibold leading-[1.02] will-change-transform sm:text-7xl lg:text-8xl"
          style={{ y }}
        >
          {quietWords.map((word, index) => (
            <QuietWord
              key={`${word}-${index}`}
              word={word}
              index={index}
              progress={scrollYProgress}
              reduced={reduceMotion}
            />
          ))}
        </motion.h2>
      </div>
    </section>
  );
}
