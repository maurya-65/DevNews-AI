"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { hostOf, SOURCE_LABEL, type Item } from "@/lib/options";

const ORDER = ["hn", "lobsters", "blog"] as const;

/** Rows enter via CSS, not JS.
 *
 *  Framer's `initial` prop renders opacity 0 into the server HTML, so a reader whose JS
 *  hasn't run sees nothing. CSS keyframes animate without JS and the text is present
 *  either way. Motion drives the things that only exist once JS is running anyway —
 *  hover, tap and the tab underline — where there is nothing to lose.
 */
function Row({ item, index }: { item: Item; index: number }) {
  const reduced = useReducedMotion();

  return (
    <motion.li
      className="group animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards py-7 first:pt-0 last:pb-0"
      style={{
        // Stagger in reading order, capped so a long list doesn't crawl in.
        animationDelay: `${Math.min(index, 8) * 55}ms`,
        animationDuration: "620ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      whileHover={reduced ? undefined : { x: 3 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div className="flex gap-5">
          <span className="mt-1.5 w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/45 transition-colors duration-300 group-hover:text-signal">
            {String(index + 1).padStart(2, "0")}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-pretty text-[21px] font-medium leading-[1.3] tracking-[-0.018em] decoration-foreground/20 underline-offset-[7px] transition-colors group-hover:underline">
              {item.title}
            </h2>

            {item.summary && (
              <p className="mt-2.5 max-w-[60ch] text-pretty text-[15px] leading-[1.75] text-muted-foreground">
                {item.summary}
              </p>
            )}

            <p className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70">
              <span>{SOURCE_LABEL[item.source] ?? item.source}</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="normal-case tracking-normal">{hostOf(item.url)}</span>
              {item.points !== null && (
                <>
                  <span className="text-muted-foreground/30">/</span>
                  <span className="tabular-nums">{item.points}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </a>
    </motion.li>
  );
}

/** Shared by today's digest and the archived ones so they can't drift apart. */
export function DigestList({ items }: { items: Item[] }) {
  const [source, setSource] = React.useState<string>("all");
  const reduced = useReducedMotion();

  // Only offer a filter for sources actually present — an empty tab is worse than no tab.
  const present = ORDER.filter((s) => items.some((i) => i.source === s));
  const shown = source === "all" ? items : items.filter((i) => i.source === source);

  const tabs = [{ id: "all", label: "All", count: items.length }].concat(
    present.map((s) => ({
      id: s as string,
      label: SOURCE_LABEL[s] ?? s,
      count: items.filter((i) => i.source === s).length,
    })),
  );

  return (
    <>
      {present.length > 1 && (
        <div className="mb-9 flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
          {tabs.map((tab) => {
            const active = source === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => setSource(tab.id)}
                aria-pressed={active}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                className={`relative px-3 py-2 text-sm transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative z-10">
                  {tab.label}
                  <span className="ml-1.5 font-mono text-[11px] tabular-nums text-muted-foreground/55">
                    {tab.count}
                  </span>
                </span>
                {active && (
                  <motion.span
                    layoutId="digest-tab"
                    className="absolute inset-x-0 -bottom-px h-px bg-signal"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Keyed on the filter so the CSS entrance replays when the list changes. */}
      <ol key={source} className="divide-y divide-border/50">
        {shown.map((item, i) => (
          <Row key={item.item_id} item={item} index={i} />
        ))}
      </ol>
    </>
  );
}
