"use client";

import * as React from "react";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ROLES, roleById } from "@/lib/roles";
import { LEVELS, TECHNOLOGIES, TOPICS, label, technologyId } from "@/lib/taxonomy";
import type { InterestProfile } from "@/lib/types";
import { finishSetup, readInterests, type ReadResult, type SetupResult } from "./save";

/** Four questions and a box, in the order that makes each answer easier than the last.
 *
 *  Every screen writes into the same state, and the last one submits it in a single form,
 *  so nothing is half-saved if someone leaves. The free-text box is the only step that
 *  asks a model anything, and what it returns is merged at render rather than copied into
 *  state: the reader's own picks and removals always win, and the interpretation is a
 *  suggestion they can undo, never a decision made on their behalf.
 */

const STEPS = ["Role", "Depth", "Stack", "Topics", "Your words"] as const;
const WORD_LIMIT = 150;

/** One list the reader edits, on top of a list the model suggested. */
function useMergedList(suggested: string[]) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);

  const value = useMemo(
    () => [...new Set([...chosen, ...suggested])].filter((id) => !dropped.includes(id)),
    [chosen, suggested, dropped],
  );

  function toggle(id: string) {
    if (value.includes(id)) {
      setChosen((current) => current.filter((x) => x !== id));
      setDropped((current) => (current.includes(id) ? current : [...current, id]));
    } else {
      setDropped((current) => current.filter((x) => x !== id));
      setChosen((current) => (current.includes(id) ? current : [...current, id]));
    }
  }

  /** Replace the reader's own picks, for when choosing a role presets everything. */
  function reset(ids: string[]) {
    setChosen([...new Set(ids)]);
    setDropped([]);
  }

  return { value, toggle, reset };
}

function Chip({
  on,
  children,
  onClick,
  title,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition-colors ${
        on ? "bg-foreground text-background ring-transparent" : "ring-border hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="font-heading text-[26px] font-semibold leading-tight tracking-[-0.03em]">{title}</h2>
      <p className="mt-2 max-w-[56ch] text-pretty text-sm leading-relaxed text-muted-foreground">{hint}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

export function Onboarding({ name }: { name: string | null }) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [levelChoice, setLevelChoice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");

  const [readState, readAction, reading] = useActionState<ReadResult | null, FormData>(readInterests, null);
  const [setupState, setupAction, saving] = useActionState<SetupResult | null, FormData>(finishSetup, null);

  const interpreted: InterestProfile | null = readState?.ok ? readState.profile : null;

  const topics = useMergedList(interpreted?.topics ?? []);
  const technologies = useMergedList(interpreted?.technologies ?? []);
  // The reader's own choice wins; otherwise what the model read, otherwise the role's default.
  const level = levelChoice ?? interpreted?.level ?? "working";

  function chooseRole(id: string) {
    setRole(id);
    const preset = roleById(id);
    if (preset) {
      topics.reset(preset.topics);
      technologies.reset(preset.technologies);
      setLevelChoice(preset.level ?? null);
    }
    setStep(1);
  }

  const query = search.trim().toLowerCase();
  const suggestions = query
    ? TECHNOLOGIES.filter(
        (t) =>
          !technologies.value.includes(t.id) &&
          (t.label.toLowerCase().includes(query) ||
            t.id.includes(query) ||
            (t.aliases ?? []).some((a) => a.includes(query))),
      ).slice(0, 8)
    : [];

  function addTechnology(raw: string) {
    const id = technologyId(raw);
    if (id && !technologies.value.includes(id)) technologies.toggle(id);
    setSearch("");
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {name ? `Welcome, ${name}` : "Welcome"}
        </p>
        <h1 className="mt-3 font-heading text-[34px] font-semibold leading-[1.08] tracking-[-0.03em]">
          Let&apos;s shape your briefing
        </h1>
        <p className="mt-3 max-w-[56ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          Five quick answers. None of them are final — every save, vote and skip you make from
          tomorrow on teaches the ranking more than this form ever will.
        </p>

        <ol className="mt-7 flex flex-wrap gap-x-2 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em]">
          {STEPS.map((stepName, index) => (
            <li key={stepName} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => index <= step && setStep(index)}
                disabled={index > step}
                className={`transition-colors ${
                  index === step
                    ? "text-signal"
                    : index < step
                      ? "text-foreground/70 hover:text-foreground"
                      : "text-muted-foreground/40"
                }`}
              >
                {stepName}
              </button>
              {index < STEPS.length - 1 && <span className="text-muted-foreground/30">/</span>}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <Step
          title="What do you work on?"
          hint="This only picks your starting topics and tools. You change them on the next screens."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => chooseRole(r.id)}
                aria-pressed={role === r.id}
                className={`rounded-xl p-4 text-left ring-1 transition-colors ${
                  role === r.id ? "bg-foreground text-background ring-transparent" : "ring-border hover:bg-muted/40"
                }`}
              >
                <span className="block text-sm font-medium">{r.label}</span>
                <span
                  className={`mt-1 block text-xs leading-relaxed ${
                    role === r.id ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  {r.hint}
                </span>
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 1 && (
        <Step
          title="How deep do you want it?"
          hint="This changes what counts as good, not only which subjects win. It is the single biggest lever in the ranking."
        >
          <div className="grid gap-2.5">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevelChoice(l.id)}
                aria-pressed={level === l.id}
                className={`rounded-xl p-4 text-left ring-1 transition-colors ${
                  level === l.id ? "bg-foreground text-background ring-transparent" : "ring-border hover:bg-muted/40"
                }`}
              >
                <span className="block text-sm font-medium">{l.label}</span>
                <span
                  className={`mt-1 block text-xs leading-relaxed ${
                    level === l.id ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  {l.hint}
                </span>
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step
          title="What do you build on?"
          hint="Articles are tagged with the same names, so a Postgres deep-dive reaches the people who run Postgres. Type anything — a tool that isn't on the list is still remembered."
        >
          <div className="rounded-xl p-4 ring-1 ring-border">
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
              aria-label="Search technologies"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {suggestions.map((t) => (
                  <Chip key={t.id} on={false} onClick={() => addTechnology(t.id)}>
                    + {t.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {technologies.value.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing yet. You can skip this and still get a good edition.
              </p>
            )}
            {technologies.value.map((id) => (
              <Chip key={id} on onClick={() => technologies.toggle(id)}>
                {label(id)} <span className="opacity-60">×</span>
              </Chip>
            ))}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step
          title="What should reach you?"
          hint="Follow what you want lifted. Anything you leave alone still appears when it is good enough — following is a thumb on the scale, not a filter."
        >
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <Chip
                key={t.id}
                on={topics.value.includes(t.id)}
                title={t.description}
                onClick={() => topics.toggle(t.id)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </Step>
      )}

      {step === 4 && (
        <Step
          title="In your own words"
          hint="Optional, and the most useful thing here. Describe what you work on and what you want to read — DevNews reads it once and fills in what it understood, which you can then correct."
        >
          <form action={readAction}>
            <Textarea
              name="interest_text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="I build payment infrastructure in Go and Postgres. I care about correctness under load, database internals and postmortems from teams running at scale. Less interested in frontend frameworks or funding news."
              className="resize-y text-sm leading-relaxed"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" variant="outline" size="sm" disabled={reading || words === 0}>
                {reading ? "Reading…" : interpreted ? "Read it again" : "Read this"}
              </Button>
              <span
                className={`font-mono text-[11px] ${words > WORD_LIMIT ? "text-destructive" : "text-muted-foreground"}`}
              >
                {words} / {WORD_LIMIT} words{words > WORD_LIMIT && " — the rest is ignored"}
              </span>
            </div>
          </form>

          {readState && !readState.ok && (
            <p role="status" className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {readState.message}
            </p>
          )}

          {interpreted && (
            <div className="mt-5 rounded-xl bg-muted/25 p-5 ring-1 ring-foreground/[0.06]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">What it understood</p>
              {interpreted.summary && <p className="mt-2 text-[15px] leading-relaxed">{interpreted.summary}</p>}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Added to your picks. Remove anything that is wrong.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...(interpreted.topics ?? []), ...(interpreted.technologies ?? [])].map((id) => (
                  <Chip
                    key={id}
                    on={topics.value.includes(id) || technologies.value.includes(id)}
                    onClick={() =>
                      (interpreted.topics ?? []).includes(id) ? topics.toggle(id) : technologies.toggle(id)
                    }
                  >
                    {label(id)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Your briefing, so far
            </p>
            <p className="text-pretty text-[15px] leading-[1.75]">
              You read as a{" "}
              <span className="text-signal">
                {LEVELS.find((l) => l.id === level)?.label.toLowerCase() ?? "working engineer"}
              </span>
              {topics.value.length > 0 && (
                <>, following {topics.value.map((t) => label(t).toLowerCase()).join(", ")}</>
              )}
              {technologies.value.length > 0 && <>, working with {technologies.value.map((t) => label(t)).join(", ")}</>}
              .
            </p>
          </div>
        </Step>
      )}

      <form action={setupAction}>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="level" value={level} />
        <input type="hidden" name="interest_text" value={text} />
        <input type="hidden" name="interest_profile" value={interpreted ? JSON.stringify(interpreted) : ""} />
        {topics.value.map((t) => (
          <input key={t} type="hidden" name="topics" value={t} />
        ))}
        {technologies.value.map((t) => (
          <input key={t} type="hidden" name="technologies" value={t} />
        ))}
        {(interpreted?.muted_topics ?? []).map((t) => (
          <input key={t} type="hidden" name="muted_topics" value={t} />
        ))}
        {(interpreted?.muted_kinds ?? []).map((k) => (
          <input key={k} type="hidden" name="muted_kinds" value={k} />
        ))}

        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              ← Back
            </Button>
          )}
          {!last && (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={step === 0 && !role}>
              Continue
            </Button>
          )}
          {last && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Start reading"}
            </Button>
          )}
          {!last && step > 0 && (
            <button
              type="button"
              onClick={() => setStep(STEPS.length - 1)}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Skip to the end
            </button>
          )}
          {setupState && !setupState.ok && (
            <span role="status" className="text-sm text-destructive">
              {setupState.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
