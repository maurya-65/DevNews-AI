"use client";

import * as React from "react";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AVOID_OPTIONS, LEVEL_OPTIONS, TOPIC_OPTIONS, type Profile } from "@/lib/options";
import { saveSettings, type SaveResult } from "./actions";

/** Preferences is the product, not a settings page — it is the only place a person tells
 *  the model what they care about. So it reads top to bottom as one page: nesting it in a
 *  second row of tabs under the Profile nav would hide two thirds of it behind a click.
 */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        <p className="max-w-[62ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/** A selectable card. Inverts to solid on selection rather than tinting, so the chosen
 *  set is legible at a glance instead of being a slightly different shade of grey. */
function Pick({
  selected,
  label,
  hint,
  onToggle,
}: {
  selected: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`rounded-xl p-3.5 text-left ring-1 transition-colors ${
        selected
          ? "bg-foreground text-background ring-transparent"
          : "bg-transparent ring-border hover:bg-muted/40"
      }`}
    >
      <span className="block text-sm font-medium leading-none">{label}</span>
      <span
        className={`mt-1.5 block text-xs leading-relaxed ${
          selected ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </motion.button>
  );
}

function Range({
  name,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  hint,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (n: number) => string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={name}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-signal outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      />
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function joinWords(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function SettingsForm({ prefs }: { prefs: Profile }) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    saveSettings,
    null,
  );

  const [topics, setTopics] = React.useState<string[]>(prefs.topics);
  const [avoid, setAvoid] = React.useState<string[]>(prefs.avoid);
  const [level, setLevel] = React.useState<string>(prefs.level);
  const [selectCount, setSelectCount] = React.useState(prefs.select_count);
  const [minScore, setMinScore] = React.useState(prefs.min_score);
  const [hn, setHn] = React.useState(prefs.hn_quota);
  const [lobsters, setLobsters] = React.useState(prefs.lobsters_quota);
  const [blogs, setBlogs] = React.useState(prefs.blogs_quota);

  const toggle = (
    list: string[],
    setList: (next: string[]) => void,
    id: string,
  ) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const pool = hn + lobsters + blogs;
  const levelLabel = LEVEL_OPTIONS.find((l) => l.id === level)?.label ?? "";
  const wanted = TOPIC_OPTIONS.filter((t) => topics.includes(t.id)).map((t) =>
    t.label.toLowerCase(),
  );
  const skipped = AVOID_OPTIONS.filter((a) => avoid.includes(a.id)).map((a) =>
    a.label.toLowerCase(),
  );

  // The form posts these rather than the controls themselves, so the server action keeps
  // taking a plain FormData and nothing depends on base-ui's form integration.
  const hidden = [
    ...topics.map((t) => ["topics", t] as const),
    ...avoid.map((a) => ["avoid", a] as const),
    ["level", level] as const,
  ];

  return (
    <form action={action}>
      <div className="space-y-12">
        <Section
          title="What you want"
          description="Picked topics are described to the model in prose, not matched as keywords. It still judges every item on merit — this tilts the scoring, it does not filter."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {TOPIC_OPTIONS.map((opt) => (
              <Pick
                key={opt.id}
                selected={topics.includes(opt.id)}
                label={opt.label}
                hint={opt.hint}
                onToggle={() => toggle(topics, setTopics, opt.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="What to skip"
          description="Scored down hard rather than filtered out, so a genuinely important story in one of these categories can still make it through."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {AVOID_OPTIONS.map((opt) => (
              <Pick
                key={opt.id}
                selected={avoid.includes(opt.id)}
                label={opt.label}
                hint={opt.hint}
                onToggle={() => toggle(avoid, setAvoid, opt.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="How deep"
          description="Changes what gets picked, not only how it is written. 'Still learning' stops the model penalising clear explanations of established topics."
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            {LEVEL_OPTIONS.map((opt) => (
              <Pick
                key={opt.id}
                selected={level === opt.id}
                label={opt.label}
                hint={opt.hint}
                onToggle={() => setLevel(opt.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="How much survives"
          description="A ceiling and a bar, not a target. On a thin day you get a short digest instead of padding."
        >
          <div className="grid gap-8 sm:grid-cols-2">
            <Range
              name="select_count"
              label="Most items to keep"
              value={selectCount}
              onChange={setSelectCount}
              min={1}
              max={20}
              hint="The ceiling. Fewer is normal."
            />
            <Range
              name="min_score"
              label="Minimum score"
              value={minScore}
              onChange={setMinScore}
              min={0}
              max={10}
              step={0.5}
              format={(n) => n.toFixed(1)}
              hint="Nothing below this ships. Raise it for a stricter digest."
            />
          </div>
        </Section>

        <Section
          title="Where it looks"
          description="How many candidates each source contributes before ranking. Zero turns a source off entirely."
        >
          <div className="grid gap-8 sm:grid-cols-3">
            <Range name="hn_quota" label="Hacker News" value={hn} onChange={setHn} min={0} max={20} hint="Broadest, no summaries." />
            <Range name="lobsters_quota" label="Lobsters" value={lobsters} onChange={setLobsters} min={0} max={20} hint="Smaller, more technical." />
            <Range name="blogs_quota" label="Blogs" value={blogs} onChange={setBlogs} min={0} max={20} hint="The only source with real summaries." />
          </div>
          {selectCount > pool && (
            <p className="text-sm text-destructive">
              Keeping {selectCount} is impossible when the sources only fetch {pool}.
            </p>
          )}
        </Section>

        <Section
          title="In your own words"
          description="Anything the choices above cannot say. Appended last, so it overrides them."
        >
          <Textarea
            name="profile"
            rows={5}
            defaultValue={prefs.profile ?? ""}
            placeholder="e.g. I work in Rust and Go. I care about how databases handle concurrency. Skip anything about JavaScript frameworks."
            className="resize-y"
          />
        </Section>

        {/* Settings are abstract until you see them as a sentence. This is the same shape
            the model is given, so a bad combination is obvious before a run wastes a day. */}
        <section className="rounded-xl bg-muted/25 p-5 ring-1 ring-foreground/[0.06]">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            What the model is told
          </p>
          <p className="text-pretty text-[15px] leading-[1.75]">
            You read as a{" "}
            <span className="text-signal">{levelLabel.toLowerCase()}</span>.{" "}
            {wanted.length > 0
              ? `You want ${joinWords(wanted)}. `
              : "You have not named any topics yet, so nothing is favoured. "}
            {skipped.length > 0 && `You would rather skip ${joinWords(skipped)}. `}
            Each morning {pool} candidates are read and at most{" "}
            <span className="tabular-nums">{selectCount}</span> are kept, none scoring
            below <span className="tabular-nums">{minScore.toFixed(1)}</span>.
          </p>
        </section>
      </div>

      {hidden.map(([name, value], i) => (
        <input key={`${name}-${value}-${i}`} type="hidden" name={name} value={value} />
      ))}

      {/* Sticky so Save is reachable without scrolling back down a long page. */}
      <div className="sticky bottom-0 -mx-6 mt-12 border-t border-border/60 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save preferences"}
          </Button>
          <AnimatePresence mode="wait">
            {state ? (
              <motion.div
                key={state.message}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Badge
                  variant={state.ok ? "secondary" : "destructive"}
                  className="font-normal"
                >
                  {state.message}
                </Badge>
              </motion.div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Takes effect on the next run.
              </span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
