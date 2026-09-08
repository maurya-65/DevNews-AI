"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
        <Label
          key={opt.id}
          htmlFor={`${name}-${opt.id}`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[[data-checked]]:border-foreground/25 has-[[data-checked]]:bg-accent"
        >
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

function QuotaField({
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

  return (
    <form action={action} className="space-y-6">
      <Section
        title="What you want"
        description="Picked topics are described to the model in prose, not as keywords — it still judges each item on merit."
      >
        <CheckGrid name="topics" options={TOPIC_OPTIONS} selected={prefs.topics} />
      </Section>

      <Section
        title="What to skip"
        description="These get scored down hard rather than filtered out, so you can still see them on the ranked list."
      >
        <CheckGrid name="avoid" options={AVOID_OPTIONS} selected={prefs.avoid} />
      </Section>

      <Section
        title="Depth"
        description="How much context the summaries should assume you already have."
      >
        <RadioGroup name="level" defaultValue={prefs.level} className="gap-3">
          {LEVEL_OPTIONS.map((opt) => (
            <Label
              key={opt.id}
              htmlFor={`level-${opt.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[[data-checked]]:border-foreground/25 has-[[data-checked]]:bg-accent"
            >
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
      </Section>

      <Section
        title="In your own words"
        description="Anything the toggles can't say. This is appended last, so it overrides them."
      >
        <Textarea
          name="profile"
          rows={5}
          defaultValue={prefs.profile ?? ""}
          placeholder="e.g. I work in Rust and Go. I care about how databases handle concurrency. Skip anything about JavaScript frameworks."
          className="resize-y"
        />
      </Section>

      <Section
        title="Volume"
        description="A ceiling and a bar, not a target. On a thin day you get a short digest instead of padding."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <QuotaField
            name="select_count"
            label="Most items to keep"
            hint="The ceiling. Fewer is normal."
            value={prefs.select_count}
          />
          <QuotaField
            name="min_score"
            label="Minimum score"
            hint="Nothing below this ships. Raise it for a stricter digest."
            value={prefs.min_score}
            step={0.5}
            max={10}
          />
          <QuotaField
            name="hn_quota"
            label="Hacker News"
            hint="0 disables the source."
            value={prefs.hn_quota}
          />
          <QuotaField
            name="lobsters_quota"
            label="Lobsters"
            hint="Smaller, more technical than HN."
            value={prefs.lobsters_quota}
          />
          <QuotaField
            name="blogs_quota"
            label="Engineering blogs"
            hint="The only source that reliably has summaries."
            value={prefs.blogs_quota}
          />
        </div>
      </Section>

      <div className="flex items-center gap-3 pb-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {state && (
          <Badge variant={state.ok ? "secondary" : "destructive"} className="font-normal">
            {state.message}
          </Badge>
        )}
      </div>
    </form>
  );
}
