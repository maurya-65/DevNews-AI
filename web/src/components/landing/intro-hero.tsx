"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";
import { SmoothAnchor, useSmoothScroll } from "./smooth-scroll";

/** The pinned opening: forty headlines come in, the story of the cut is scrubbed by
 *  scroll, and what survives becomes the ranked eight. Scrolling back up runs it in
 *  reverse, because every value here is derived from scroll position, not from time.
 *
 *  Nothing in this file sets React state while scrolling. Every moving value is a
 *  MotionValue written straight to transform or opacity, which is what keeps it on
 *  the compositor and off React's render path.
 */

const headlines = [
  ["Postgres 18 async I/O benchmarks", 9.6],
  ["Rust in the Linux kernel: a year in", 9.3],
  ["SQLite on the edge, revisited", 8.9],
  ["The case for boring build systems", 8.7],
  ["Inside V8's new compiler pipeline", 8.4],
  ["Making CRDTs practical at scale", 8.1],
  ["What QUIC changed for databases", 7.8],
  ["Type systems as product design", 7.6],
  ["A tour of Linux io_uring", 4.7],
  ["The cost of a cache miss", 4.3],
  ["WebAssembly beyond the browser", 4.1],
  ["Rethinking API pagination", 3.9],
  ["Notes on distributed tracing", 3.7],
  ["The long road to UTF-8", 3.5],
  ["DNS is still complicated", 3.3],
  ["Debugging memory fragmentation", 3.1],
  ["Lessons from a million deploys", 2.9],
  ["How schedulers actually work", 2.8],
  ["A smaller JavaScript runtime", 2.7],
  ["Parsing at two gigabytes a second", 2.6],
  ["Reliable queues without magic", 2.5],
  ["The architecture of package managers", 2.4],
  ["A visual guide to B-trees", 2.3],
  ["When observability gets noisy", 2.2],
  ["Shipping software to Antarctica", 2.1],
  ["Why clocks drift", 2.0],
  ["A bytecode interpreter in 500 lines", 1.9],
  ["Optimizing cold starts", 1.8],
  ["HTTP caching field notes", 1.7],
  ["Monorepos at medium scale", 1.6],
  ["Reading the Go garbage collector", 1.5],
  ["The hidden life of file descriptors", 1.4],
  ["Lessons in schema evolution", 1.3],
  ["Building a tiny search engine", 1.2],
  ["A practical guide to eBPF", 1.1],
  ["What makes a good CLI", 1.0],
  ["Notes from an incident review", 0.9],
  ["Faster local development", 0.8],
  ["The state of server components", 0.7],
  ["Making sense of vector databases", 0.6],
] as const;

const KEPT = 8;
const kept = headlines.slice(0, KEPT);

/** One spring for everything scroll-derived: enough to absorb wheel steps, not so much
 *  that the story visibly trails the scrollbar. */
const follow = { stiffness: 120, damping: 30, mass: 0.4 };

export function IntroHero() {
  const trackRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollTo } = useSmoothScroll();
  const { scrollY, scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, follow);

  // The one velocity effect: the chip grid leans a little into a fast scroll and
  // settles when it stops. Clamped, so a violent flick cannot throw it across the page.
  const velocity = useVelocity(scrollY);
  const velocityDrift = useSpring(
    useTransform(velocity, [-2200, 0, 2200], [-22, 0, 22], { clamp: true }),
    follow,
  );

  // Three beats that hand off instead of stacking: the forty, then the eight, then the
  // line. On a laptop-height screen the headline block is taller than the space under
  // the ranked list (measured: a 302px overlap at 1440x675), so the eight recede before
  // the headline arrives. The draft let both sit at full opacity on top of each other.
  const gridOpacity = useTransform(smoothProgress, [0, 0.5, 0.64], [1, 1, 0]);
  const gridY = useTransform(smoothProgress, [0, 0.64], [0, -36]);
  const rankOpacity = useTransform(smoothProgress, [0.5, 0.64, 0.74, 0.82], [0, 1, 1, 0]);
  const rankY = useTransform(smoothProgress, [0.5, 0.66, 0.74, 0.82], [40, 0, 0, -48]);
  const counterOpacity = useTransform(smoothProgress, [0.74, 0.8], [1, 0]);
  const copyOpacity = useTransform(smoothProgress, [0.8, 0.88], [0, 1]);
  // Both lines land by 0.94, so the end of the pin is a settled hold rather than a
  // reveal still in flight as the section lets go. Their masks carry 0.22em of bottom
  // padding (cancelled by a matching negative margin) so descenders and the signal
  // underline are not clipped; lines start at 130% to stay hidden in the taller mask.
  const lineOneY = useTransform(smoothProgress, [0.8, 0.9], ["130%", "0%"]);
  const lineTwoY = useTransform(smoothProgress, [0.84, 0.94], ["130%", "0%"]);
  const readCount = useTransform(smoothProgress, [0, 0.38], [0, headlines.length], { clamp: true });
  const keptCount = useTransform(smoothProgress, [0.4, 0.62], [headlines.length, KEPT], { clamp: true });
  const readLabel = useTransform(readCount, (value) => Math.round(value));
  const keptLabel = useTransform(keptCount, (value) => Math.round(value));

  return (
    <section ref={trackRef} className="hero-track relative h-auto border-b border-border md:h-[250vh]">
      <div className="hero-sticky relative flex min-h-screen flex-col overflow-hidden px-5 pb-12 pt-24 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => scrollTo(trackRef.current ?? 0)}
          className="focus-ring absolute right-5 top-24 z-20 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground sm:right-8"
        >
          Replay
        </button>

        <div className="mx-auto flex w-full max-w-[1400px] flex-1 items-center justify-center">
          <div aria-hidden="true" className="absolute inset-x-5 top-[18%] mx-auto max-w-6xl sm:inset-x-8">
            <motion.div
              className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border will-change-transform sm:grid-cols-4 lg:grid-cols-8"
              style={{ opacity: reduceMotion ? 0 : gridOpacity, y: gridY, x: velocityDrift }}
            >
              {headlines.map(([title, score], index) => (
                <HeroChip key={title} title={title} score={score} index={index} progress={smoothProgress} />
              ))}
            </motion.div>
            {!reduceMotion && (
              <motion.p
                className="mt-4 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground"
                style={{ opacity: counterOpacity }}
              >
                <motion.span className="tabular-nums">{readLabel}</motion.span> read ·{" "}
                <motion.span className="tabular-nums">{keptLabel}</motion.span> kept
              </motion.p>
            )}
          </div>

          {/* Reduced motion has no scroll sequence to hand off with, so the list would sit
              under the headline for good. It stays out; the sample digest below shows the
              same kept items. */}
          <motion.ol
            aria-label="Eight headlines kept today"
            className="absolute inset-x-5 top-[18%] mx-auto max-w-3xl divide-y divide-border border-y border-border will-change-transform sm:inset-x-8"
            style={{ opacity: reduceMotion ? 0 : rankOpacity, y: reduceMotion ? 0 : rankY }}
          >
            {kept.map(([title, score], index) => (
              <li
                key={title}
                className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-2.5 font-mono text-[0.66rem] sm:text-xs"
              >
                <span className="text-signal">{String(index + 1).padStart(2, "0")}</span>
                <span>{title}</span>
                <span className="text-muted-foreground">{score.toFixed(1)}</span>
              </li>
            ))}
          </motion.ol>

          <motion.div
            className="relative z-10 mx-auto mt-auto max-w-5xl bg-background/90 pb-4 text-center sm:bg-transparent"
            style={{ opacity: reduceMotion ? 1 : copyOpacity }}
          >
            <p className="mb-5 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Your morning, edited
            </p>
            <h1 className="font-heading text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[6.5rem]">
              <span className="-mb-[0.22em] block overflow-hidden pb-[0.22em]">
                <motion.span className="block will-change-transform" style={{ y: reduceMotion ? 0 : lineOneY }}>
                  The news isn’t scarce.
                </motion.span>
              </span>
              <span className="-mb-[0.22em] block overflow-hidden pb-[0.22em]">
                <motion.span
                  className="accent-underline block will-change-transform"
                  style={{ y: reduceMotion ? 0 : lineTwoY }}
                >
                  Judgement is.
                </motion.span>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A daily CS briefing that reads everything and keeps only what earns your attention.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-5 sm:flex-row">
              <Link
                href="/login"
                className="focus-ring inline-flex min-h-12 items-center justify-center bg-foreground px-6 font-mono text-xs font-medium uppercase tracking-[0.12em] text-background hover:opacity-80"
              >
                Get your briefing
              </Link>
              <SmoothAnchor
                href="#how-it-works"
                className="focus-ring font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground underline-offset-8 hover:text-foreground hover:underline"
              >
                How it works
              </SmoothAnchor>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroChip({
  title,
  score,
  index,
  progress,
}: {
  title: string;
  score: number;
  index: number;
  progress: MotionValue<number>;
}) {
  const rejected = index >= KEPT;
  const y = useTransform(
    progress,
    rejected ? [0.28, 0.68] : [0, 0.65],
    rejected ? [0, 120 + (index % 5) * 16] : [12 - (index % 3) * 8, -18 + (index % 4) * 7],
  );
  const opacity = useTransform(progress, rejected ? [0.35, 0.68] : [0, 0.7], rejected ? [1, 0] : [1, 0.72]);
  // scaleX rather than Lovable's clip-path: the line draws identically, but a transform
  // stays on the compositor where clip-path would repaint thirty-two chips every frame.
  const strike = useTransform(progress, [0.3, 0.52], [0, 1]);

  return (
    <motion.div
      className="headline-chip relative min-h-16 overflow-hidden bg-background p-2.5 font-mono text-[0.58rem] leading-relaxed will-change-transform sm:min-h-20"
      style={{ y, opacity }}
    >
      <span className={rejected ? "text-muted-foreground" : "text-foreground"}>{title}</span>
      {rejected && (
        <motion.span
          aria-hidden="true"
          className="absolute left-2 right-2 top-1/2 h-px origin-left bg-muted-foreground"
          style={{ scaleX: strike }}
        />
      )}
      <span className="mt-2 block text-right text-muted-foreground">{score.toFixed(1)}</span>
    </motion.div>
  );
}
