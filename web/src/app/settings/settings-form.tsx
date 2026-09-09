"use client";

import * as React from "react";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  AVOID_OPTIONS,
  LEVEL_OPTIONS,
  TOPIC_OPTIONS,
  type Preferences,
} from "@/lib/supabase";
import { saveSettings, type SaveResult } from "./actions";

const TABS = [
  { id: "taste", label: "Taste", hint: "Topics you want and topics to skip" },
  { id: "depth", label: "Depth", hint: "How much context to assume" },
  { id: "volume", label: "Volume", hint: "How much is fetched and how much survives" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CARD =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3.5 transition-colors hover:border-border hover:bg-accent/40 has-[[data-checked]]:border-foreground/30 has-[[data-checked]]:bg-accent";

function Block({
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
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function CheckGrid({
  name,
  options,
  selected,
}: {
  name: string;
  options: readonly { id: string; label: string; hint: string }[];
  selected: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => (
        <Label key={opt.id} htmlFor={`${name}-${opt.id}`} className={CARD}>
          <Checkbox
            id={`${name}-${opt.id}`}
            name={name}
            value={opt.id}
            defaultChecked={selected.includes(opt.id)}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium leading-none">{opt.label}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {opt.hint}
            </span>
          </span>
        </Label>
      ))}
    </div>
  );
}

function NumberField({
  name,
  label,
  hint,
  value,
  step = 1,
  max = 20,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
  step?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        max={max}
        step={step}
        defaultValue={value}
        className="font-mono tabular-nums"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SettingsForm({ prefs }: { prefs: Preferences }) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    saveSettings,
    null,
  );
  const [tab, setTab] = React.useState<TabId>("taste");
  const reduced = useReducedMotion();

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <form action={action}>
      <div className="mb-8 flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="relative z-10">{t.label}</span>
            {tab === t.id && (
              <motion.span
                layoutId="settings-tab"
                className="absolute inset-x-0 -bottom-px h-px bg-foreground"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {active.hint}
        </span>
      </div>

      {/* Panels stay mounted and are hidden rather than unmounted, so every field is
          still submitted no matter which tab is open when Save is pressed. The entrance
          is CSS, keyed on the tab, so nothing depends on JS to become visible. */}
      <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div hidden={tab !== "taste"} className="space-y-10">
            <Block
              title="What you want"
              description="Picked topics are described to the model in prose, not as keywords. It still judges each item on merit."
            >
              <CheckGrid name="topics" options={TOPIC_OPTIONS} selected={prefs.topics} />
            </Block>
            <Block
              title="What to skip"
              description="These get scored down hard rather than filtered out, so you can still see them on the ranked list."
            >
              <CheckGrid name="avoid" options={AVOID_OPTIONS} selected={prefs.avoid} />
            </Block>
          </div>

          <div hidden={tab !== "depth"} className="space-y-10">
            <Block
              title="Depth"
              description="Changes what gets picked, not only how it is written. A beginner profile stops penalising clear explainers of established topics."
            >
              <RadioGroup name="level" defaultValue={prefs.level} className="gap-3">
                {LEVEL_OPTIONS.map((opt) => (
                  <Label key={opt.id} htmlFor={`level-${opt.id}`} className={CARD}>
                    <RadioGroupItem
                      id={`level-${opt.id}`}
                      value={opt.id}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium leading-none">
                        {opt.label}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </Block>

            <Block
              title="In your own words"
              description="Anything the toggles cannot say. Appended last, so it overrides them."
            >
              <Textarea
                name="profile"
                rows={5}
                defaultValue={prefs.profile ?? ""}
                placeholder="e.g. I work in Rust and Go. I care about how databases handle concurrency. Skip anything about JavaScript frameworks."
                className="resize-y"
              />
            </Block>
          </div>

          <div hidden={tab !== "volume"} className="space-y-10">
            <Block
              title="How much survives"
              description="A ceiling and a bar, not a target. On a thin day you get a short digest instead of padding."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <NumberField
                  name="select_count"
                  label="Most items to keep"
                  hint="The ceiling. Fewer is normal."
                  value={prefs.select_count}
                />
                <NumberField
                  name="min_score"
                  label="Minimum score"
                  hint="Nothing below this ships. Raise it for a stricter digest."
                  value={prefs.min_score}
                  step={0.5}
                  max={10}
                />
              </div>
            </Block>

            <Block
              title="Sources"
              description="How many candidates each source contributes before ranking. Zero turns one off."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <NumberField
                  name="hn_quota"
                  label="Hacker News"
                  hint="Broadest, no summaries."
                  value={prefs.hn_quota}
                />
                <NumberField
                  name="lobsters_quota"
                  label="Lobsters"
                  hint="Smaller, more technical."
                  value={prefs.lobsters_quota}
                />
                <NumberField
                  name="blogs_quota"
                  label="Blogs"
                  hint="The only source with real summaries."
                  value={prefs.blogs_quota}
                />
              </div>
            </Block>
          </div>
      </div>

      {/* Sticky so Save is reachable from any tab without scrolling. */}
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
