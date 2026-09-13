"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll } from "motion/react";
import { DevNewsMark } from "./dev-news-mark";
import { IntroHero } from "./intro-hero";
import { DailySeal, HowItWorks, QuietDay, SampleDigest } from "./landing-sections";
import { SmoothAnchor, SmoothScrollProvider } from "./smooth-scroll";

/** The signed-out front page. Drafted in Lovable, ported here: its own nav (the
 *  reader's nav stays out of the way on this route, see shell.tsx), a pinned scroll
 *  story, then sections that each scrub through their own scroll range. */
export function DevNewsLanding() {
  return (
    <SmoothScrollProvider>
      <LandingContent />
    </SmoothScrollProvider>
  );
}

function LandingContent() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  return (
    <div className="devnews min-h-screen bg-background text-foreground">
      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-[70] h-px origin-left bg-signal"
          style={{ scaleX: scrollYProgress }}
        />
      )}

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: reduceMotion ? 0 : 1.2 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12"
        >
          <SmoothAnchor href="#top" className="focus-ring">
            <DevNewsMark />
          </SmoothAnchor>
          <div className="flex items-center gap-5 sm:gap-8">
            <SmoothAnchor
              href="#how-it-works"
              className="focus-ring hidden font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground sm:inline"
            >
              How it works
            </SmoothAnchor>
            <Link
              href="/login"
              className="focus-ring font-mono text-[0.65rem] uppercase tracking-[0.14em] hover:text-signal"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </motion.header>

      <main id="top">
        <IntroHero />
        <HowItWorks />
        <DailySeal />
        <SampleDigest />
        <QuietDay />
        <section className="px-5 py-28 text-center sm:px-8 sm:py-40">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Tomorrow morning
            </p>
            <h2 className="mx-auto mt-7 max-w-4xl font-heading text-5xl font-semibold leading-none sm:text-7xl">
              Read less. Know what mattered.
            </h2>
            <Link
              href="/login"
              className="focus-ring mt-10 inline-flex min-h-12 items-center justify-center bg-foreground px-6 font-mono text-xs font-medium uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-80"
            >
              Get your briefing
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <DevNewsMark />
          <p className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="live-dot size-1.5 rounded-full bg-signal" aria-hidden="true" />
            One call a day · $0 · open source
          </p>
          <a
            href="https://github.com/maurya-65/DevNews-AI"
            target="_blank"
            rel="noreferrer"
            className="focus-ring font-mono text-[0.65rem] uppercase tracking-[0.14em] underline-offset-8 hover:text-signal hover:underline"
          >
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}
