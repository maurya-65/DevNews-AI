"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { hostOf, SOURCE_LABEL, type Item } from "@/lib/supabase";

const ORDER = ["hn", "lobsters", "blog"] as const;

/** Rows enter via CSS, not JS.
 *
 *  Framer's `initial` prop renders opacity 0 into the server HTML, so a reader whose JS
 *  hasn't run sees nothing. CSS keyframes animate without JS and the text is present
 *  either way. Motion is kept for the tab underline, where the effect genuinely needs
 *  measurement and there is nothing to read if JS is off anyway.
 */
function Row({ item, index }: { item: Item; index: number }) {
  return (
    <li
      className="group animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-backwards"
      // Stagger in reading order. Capped so a long list doesn't crawl in.
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div className="flex items-baseline gap-4">
          <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="text-balance text-lg font-medium leading-snug tracking-[-0.01em] decoration-foreground/25 underline-offset-[6px] transition-colors group-hover:underline">
            {item.title}
          </h2>
        </div>

        <div className="mt-2 pl-10">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>{SOURCE_LABEL[item.source] ?? item.source}</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="normal-case tracking-normal">{hostOf(item.url)}</span>
            {item.points !== null && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="tabular-nums">{item.points} pts</span>
              </>
            )}
          </p>

          {item.summary && (
            <p className="mt-3 max-w-[62ch] text-pretty text-[15px] leading-[1.7] text-foreground/75">
              {item.summary}
            </p>
          )}
        </div>
      </a>
    </li>
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
        <div className="mb-10 flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
          {tabs.map((tab) => {
            const active = source === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSource(tab.id)}
                aria-pressed={active}
                className={`relative px-3 py-2 text-sm transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative z-10">
                  {tab.label}
                  <span className="ml-1.5 font-mono text-[11px] tabular-nums text-muted-foreground/60">
                    {tab.count}
                  </span>
                </span>
                {active && (
                  <motion.span
                    layoutId="digest-tab"
                    className="absolute inset-x-0 -bottom-px h-px bg-foreground"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Keyed on the filter so the CSS entrance replays when the list changes. */}
      <ol key={source} className="space-y-10">
        {shown.map((item, i) => (
          <Row key={item.id} item={item} index={i} />
        ))}
      </ol>
    </>
  );
}
