"use client";

import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KINDS, LEVELS, SOURCES, TECHNOLOGIES, TOPICS, label, technologyId } from "@/lib/taxonomy";
import type { InterestProfile, Profile } from "@/lib/types";
import { readInterests } from "@/app/welcome/save";
import { regenerateFeedToken, savePreferences, type SaveResult } from "./save";

/** Preferences are a starting point, not the whole story: every save, vote and hide also
 *  teaches the ranker. So this page stays short and legible, reads top to bottom, and ends
 *  with the settings said back as one sentence. */

type TopicState = "follow" | "neutral" | "mute";
const NEXT_STATE: Record<TopicState, TopicState> = { neutral: "follow", follow: "mute", mute: "neutral" };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="max-w-[62ch] text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Pick({
  selected,
  label,
  hint,
  onToggle,
  tone = "solid",
}: {
  selected: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
  tone?: "solid" | "muted";
}) {
  const reduced = useReducedMotion();
  const on =
    tone === "solid"
      ? "bg-foreground text-background ring-transparent"
      : "bg-muted/50 text-muted-foreground line-through decoration-foreground/40 ring-border";
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`rounded-xl p-3.5 text-left ring-1 transition-colors ${
        selected ? on : "bg-transparent ring-border hover:bg-muted/40"
      }`}
    >
      <span className="block text-sm font-medium leading-none">{label}</span>
      <span
        className={`mt-1.5 block text-xs leading-relaxed no-underline ${
          selected && tone === "solid" ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </motion.button>
  );
}

function TopicChip({
  label,
  description,
  state,
  onCycle,
}: {
  label: string;
  description: string;
  state: TopicState;
  onCycle: () => void;
}) {
  const reduced = useReducedMotion();
  const styles: Record<TopicState, string> = {
    follow: "bg-foreground text-background ring-transparent",
    neutral: "ring-border hover:bg-muted/40",
    mute: "bg-muted/40 text-muted-foreground ring-dashed ring-border",
  };
  return (
    <motion.button
      type="button"
      onClick={onCycle}
      title={description}
      aria-label={`${label}: ${state === "neutral" ? "no preference" : state === "follow" ? "following" : "muted"}`}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm ring-1 transition-colors ${styles[state]}`}
    >
      <span className={state === "mute" ? "line-through decoration-foreground/40" : ""}>{label}</span>
      {state !== "neutral" && (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
          {state === "follow" ? "follow" : "muted"}
        </span>
      )}
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
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground">{format ? format(value) : value}</span>
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

function Switch({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 rounded-xl p-3.5 ring-1 ring-border transition-colors hover:bg-muted/30">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
          checked ? "bg-signal" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

function joinWords(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function SettingsForm({ profile, feedBase }: { profile: Profile; feedBase: string }) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(savePreferences, null);

  const [level, setLevel] = useState<string>(profile.level ?? "working");
  const [topics, setTopics] = useState<Record<string, TopicState>>(() =>
    Object.fromEntries(
      TOPICS.map((t) => [
        t.id,
        (profile.topics ?? []).includes(t.id)
          ? "follow"
          : (profile.muted_topics ?? []).includes(t.id)
            ? "mute"
            : "neutral",
      ]),
    ),
  );
  const [mutedKinds, setMutedKinds] = useState<string[]>(profile.muted_kinds ?? []);
  const [sourcesOff, setSourcesOff] = useState<string[]>(profile.sources_off ?? []);
  const [technologies, setTechnologies] = useState<string[]>(profile.technologies ?? []);
  const [search, setSearch] = useState("");
  const [interestText, setInterestText] = useState(profile.interest_text ?? "");
  const [interpreted, setInterpreted] = useState<InterestProfile | null>(profile.interest_profile ?? null);
  const [readMessage, setReadMessage] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [size, setSize] = useState(profile.select_count ?? 8);
  const [bar, setBar] = useState(Number(profile.min_score ?? 5));
  const [includeGeneral, setIncludeGeneral] = useState(Boolean(profile.include_general));
  const [email, setEmail] = useState(Boolean(profile.email_digest));

  const [token, setToken] = useState(profile.feed_token);
  const [feedMessage, setFeedMessage] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotating, startRotate] = useTransition();

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const followed = TOPICS.filter((t) => topics[t.id] === "follow");
  const muted = TOPICS.filter((t) => topics[t.id] === "mute");
  const levelLabel = LEVELS.find((l) => l.id === level)?.label.toLowerCase() ?? "working engineer";
  const feedUrl = token ? `${feedBase}${token}` : null;

  const hidden = [
    ["level", level],
    ...followed.map((t) => ["topics", t.id]),
    ...muted.map((t) => ["muted_topics", t.id]),
    ...mutedKinds.map((k) => ["muted_kinds", k]),
    ...sourcesOff.map((s) => ["sources_off", s]),
    ...technologies.map((t) => ["technologies", t]),
  ] as const;

  const suggestions = search.trim()
    ? TECHNOLOGIES.filter((t) => {
        const q = search.trim().toLowerCase();
        return (
          !technologies.includes(t.id) &&
          (t.label.toLowerCase().includes(q) || t.id.includes(q) || (t.aliases ?? []).some((a) => a.includes(q)))
        );
      }).slice(0, 8)
    : [];

  function addTechnology(raw: string) {
    const id = technologyId(raw);
    if (id && !technologies.includes(id)) setTechnologies([...technologies, id]);
    setSearch("");
  }

  /** The one model call the site makes, on demand rather than on every save. What it
   *  returns is folded into the chips above, which the reader can still undo. */
  function reread() {
    const data = new FormData();
    data.set("interest_text", interestText);
    startReading(async () => {
      const result = await readInterests(null, data);
      if (!result.ok) return setReadMessage(result.message);
      setReadMessage(null);
      setInterpreted(result.profile);
      setTechnologies((current) => [...new Set([...current, ...(result.profile.technologies ?? [])])]);
      setTopics((current) => {
        const next = { ...current };
        for (const id of result.profile.topics ?? []) if (next[id] === "neutral") next[id] = "follow";
        return next;
      });
      if (result.profile.level) setLevel(result.profile.level);
    });
  }

  function rotate() {
    if (!confirmRotate) return setConfirmRotate(true);
    startRotate(async () => {
      const result = await regenerateFeedToken();
      if (result.ok && result.token) setToken(result.token);
      setFeedMessage(result.message);
      setConfirmRotate(false);
    });
  }

  async function copy() {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form action={action}>
      <div className="space-y-12">
        <Section
          title="How you read"
          description="Changes what counts as good, not only which topics win. 'Still learning' stops penalising clear explanations of established ideas; 'Deep' favours specialist material."
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            {LEVELS.map((opt) => (
              <Pick key={opt.id} selected={level === opt.id} label={opt.label} hint={opt.hint} onToggle={() => setLevel(opt.id)} />
            ))}
          </div>
        </Section>

        <Section
          title="Topics"
          description="Click once to follow, again to mute, once more to reset. Following lifts a story in your edition; muting keeps it out entirely, however good it is. Everything you save and vote on adjusts these further."
        >
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <TopicChip
                key={topic.id}
                label={topic.label}
                description={topic.description}
                state={topics[topic.id]}
                onCycle={() => setTopics((current) => ({ ...current, [topic.id]: NEXT_STATE[current[topic.id]] }))}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Your stack"
          description="Articles carry the same names, so a Postgres deep-dive reaches the people who run Postgres. Type anything — a tool that isn't in the list is still remembered."
        >
          <div className="rounded-xl p-3.5 ring-1 ring-border">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTechnology(suggestions[0]?.id ?? search);
                }
              }}
              placeholder="postgres, rust, kubernetes…"
              aria-label="Add a technology"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTechnology(t.id)}
                    className="inline-flex h-8 items-center rounded-full px-3 text-sm ring-1 ring-border transition-colors hover:bg-muted/40"
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {technologies.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing yet — quality and topics alone decide.</p>
            )}
            {technologies.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTechnologies(technologies.filter((t) => t !== id))}
                aria-label={`Remove ${label(id)}`}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3.5 text-sm text-background"
              >
                {label(id)} <span className="opacity-60">×</span>
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="In your own words"
          description="What you work on and what you want to read, at most 150 words. Saving keeps the text; 'Read it again' asks the model to turn it into topics and technologies, which you can then correct."
        >
          <Textarea
            name="interest_text"
            rows={4}
            value={interestText}
            onChange={(e) => setInterestText(e.target.value)}
            placeholder="I build payment infrastructure in Go and Postgres. I care about correctness under load, database internals and postmortems from teams running at scale."
            className="resize-y text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reread}
              disabled={reading || !interestText.trim()}
            >
              {reading ? "Reading…" : "Read it again"}
            </Button>
            {interpreted?.summary && !readMessage && (
              <span className="text-xs text-muted-foreground">{interpreted.summary}</span>
            )}
            {readMessage && <span className="text-xs text-muted-foreground">{readMessage}</span>}
          </div>
        </Section>

        <Section
          title="Kinds of story to skip"
          description="Muted kinds never appear, whatever they are about."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {KINDS.map((kind) => (
              <Pick
                key={kind.id}
                tone="muted"
                selected={mutedKinds.includes(kind.id)}
                label={kind.label}
                hint={kind.description}
                onToggle={() => toggle(mutedKinds, setMutedKinds, kind.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Your edition"
          description="A ceiling and a bar, not a target. On a thin day you get a short edition instead of filler."
        >
          <div className="grid gap-8 sm:grid-cols-2">
            <Range name="select_count" label="At most" value={size} onChange={setSize} min={1} max={20} format={(n) => `${n} stories`} hint="Fewer is normal." />
            <Range
              name="min_score"
              label="Quality bar"
              value={bar}
              onChange={setBar}
              min={0}
              max={10}
              step={0.5}
              format={(n) => n.toFixed(1)}
              hint="Nothing below this ships. 5 is balanced; 7 is strict."
            />
          </div>
          <Switch
            name="include_general"
            checked={includeGeneral}
            onChange={setIncludeGeneral}
            label="Include general-interest stories"
            hint="Science, culture and business stories that reach Hacker News without being about computing."
          />
        </Section>

        <Section title="Sources" description="Where candidates come from. Switched-off sources never reach your edition.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {SOURCES.map((source) => (
              <Pick
                key={source.id}
                selected={!sourcesOff.includes(source.id)}
                label={source.label}
                hint={sourcesOff.includes(source.id) ? "Off" : "On"}
                onToggle={() => toggle(sourcesOff, setSourcesOff, source.id)}
              />
            ))}
          </div>
        </Section>

        <Section title="Sites to skip" description="One per line. Subdomains are included: example.com also mutes blog.example.com.">
          <Textarea
            name="muted_domains"
            rows={3}
            defaultValue={(profile.muted_domains ?? []).join("\n")}
            placeholder={"medium.com\nexample.substack.com"}
            className="resize-y font-mono text-sm"
          />
        </Section>

        <Section title="Delivery" description="Read on the site, in your inbox, or in any feed reader.">
          <Switch
            name="email_digest"
            checked={email}
            onChange={setEmail}
            label="Email me each edition"
            hint="Sent after the morning run, only on days something cleared your bar."
          />
          <div className="rounded-xl p-3.5 ring-1 ring-border">
            <p className="text-sm font-medium">Private RSS feed</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Anyone with this URL can read your editions. Make a new one to revoke it.
            </p>
            {feedUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-8 min-w-0 flex-1 rounded-md bg-muted/40 px-2 font-mono text-xs ring-1 ring-border outline-none"
                />
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant={confirmRotate ? "destructive" : "ghost"} size="sm" onClick={rotate} disabled={rotating}>
                  {rotating ? "Making…" : confirmRotate ? "Revoke old URL?" : "New URL"}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Available once your account is set up.</p>
            )}
            {feedMessage && <p className="mt-2 font-mono text-[11px] text-signal">{feedMessage}</p>}
          </div>
        </Section>

        <section className="rounded-xl bg-muted/25 p-5 ring-1 ring-foreground/[0.06]">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">In one sentence</p>
          <p className="text-pretty text-[15px] leading-[1.75]">
            You read as a <span className="text-signal">{levelLabel}</span>.{" "}
            {followed.length > 0
              ? `You follow ${joinWords(followed.map((t) => t.label.toLowerCase()))}. `
              : "You follow no topics yet, so quality alone decides until your reading teaches it more. "}
            {muted.length > 0 && `You never see ${joinWords(muted.map((t) => t.label.toLowerCase()))}. `}
            Each morning you get at most <span className="tabular-nums">{size}</span> stories, none below{" "}
            <span className="tabular-nums">{bar.toFixed(1)}</span>.{" "}
            <Link href="/lab" className="underline underline-offset-4 hover:text-signal">
              See how that played out today
            </Link>
            .
          </p>
        </section>
      </div>

      {hidden.map(([name, value], i) => (
        <input key={`${name}-${value}-${i}`} type="hidden" name={name} value={value} />
      ))}

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
                <Badge variant={state.ok ? "secondary" : "destructive"} className="font-normal">
                  {state.message}
                </Badge>
              </motion.div>
            ) : (
              <span className="text-xs text-muted-foreground">Takes effect in your next edition.</span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
