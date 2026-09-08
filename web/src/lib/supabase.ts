import { createClient } from "@supabase/supabase-js";

// Anon key only. It is public by design and safe in the browser bundle — RLS on runs and
// items is what actually restricts access. The service key bypasses RLS and must never
// reach this directory (CLAUDE.md rule 5).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export type Item = {
  id: number;
  run_id: number;
  source: string;
  url: string;
  title: string;
  blurb: string | null;
  points: number | null;
  comments: number | null;
  published_at: string | null;
  novel: number | null;
  consequential: number | null;
  depth: number | null;
  score: number | null;
  reason: string | null;
  summary: string | null;
  selected: boolean;
  position: number | null;
};

export type Run = {
  id: number;
  ran_at: string;
  status: string;
  fetched: number;
  selected: number;
  input_tokens: number | null;
  output_tokens: number | null;
  error: string | null;
};

/** The run the pages describe: the most recent one that actually selected something. */
export async function latestRun(): Promise<Run | null> {
  const { data } = await supabase
    .from("runs")
    .select("*")
    .in("status", ["ok", "partial"])
    .order("id", { ascending: false })
    .limit(10);

  if (!data?.length) return null;

  // A run can close 'ok' having inserted nothing (every candidate was seen on an earlier
  // day). Those runs have no items, and showing one blanks the page.
  for (const run of data) {
    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id)
      .eq("selected", true);
    if (count) return run;
  }
  return null;
}

export async function itemsForRun(runId: number, onlySelected: boolean) {
  let q = supabase.from("items").select("*").eq("run_id", runId);

  if (onlySelected) {
    q = q.eq("selected", true).order("position");
  } else {
    // Selected first in their stored rank, then rejects by score. Ordering the whole
    // list by score alone breaks on ties: two items on the same score can sort either
    // way, so a selected item could render below the drawn cut line. On the one page
    // whose job is showing where the cut fell, that line has to be true.
    q = q
      .order("selected", { ascending: false })
      .order("position", { nullsFirst: false })
      .order("score", { ascending: false, nullsFirst: false });
  }

  const { data } = await q;
  return (data ?? []) as Item[];
}

export const SOURCE_LABEL: Record<string, string> = {
  hn: "Hacker News",
  lobsters: "Lobsters",
  blog: "Blog",
};

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatRan(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

export type Preferences = {
  profile: string | null;
  topics: string[];
  avoid: string[];
  level: "working" | "deep" | "learning";
  select_count: number;
  hn_quota: number;
  lobsters_quota: number;
  blogs_quota: number;
  updated_at: string | null;
};

export const DEFAULT_PREFERENCES: Preferences = {
  profile: null,
  topics: [],
  avoid: [],
  level: "working",
  select_count: 8,
  hn_quota: 10,
  lobsters_quota: 5,
  blogs_quota: 5,
  updated_at: null,
};

/** Labels mirror agent/profile.py — a slug added there needs adding here too. */
export const TOPIC_OPTIONS = [
  { id: "systems", label: "Systems & infra", hint: "Distributed systems, databases, networking, scaling" },
  { id: "languages", label: "Languages & compilers", hint: "PL design, type systems, runtimes" },
  { id: "ml", label: "ML engineering", hint: "Serving, quantization, training infra, inference cost" },
  { id: "security", label: "Security", hint: "Exploits, applied crypto, authentication" },
  { id: "performance", label: "Performance", hint: "Profiling, low-level optimization" },
  { id: "devtools", label: "Developer tooling", hint: "Editors, build systems, debugging" },
  { id: "web", label: "Web platform", hint: "Browsers, frontend architecture" },
  { id: "career", label: "Engineering practice", hint: "How software actually gets built" },
] as const;

export const AVOID_OPTIONS = [
  { id: "launches", label: "Product launches", hint: "Announcements dressed as engineering" },
  { id: "business", label: "Business & funding", hint: "Rounds, acquisitions, exec moves" },
  { id: "crypto", label: "Crypto", hint: "Blockchain, web3" },
  { id: "general", label: "General interest", hint: "Health, science, culture" },
  { id: "releases", label: "Routine releases", hint: "Version bumps with no architectural change" },
  { id: "listicles", label: "Listicles & tutorials", hint: "'Top N tools', beginner guides" },
] as const;

export const LEVEL_OPTIONS = [
  { id: "working", label: "Working engineer", hint: "Assume jargon. Trade-offs and numbers." },
  { id: "deep", label: "Deep / research", hint: "Papers and internals. Most technical wins." },
  { id: "learning", label: "Still learning", hint: "Give context on unfamiliar topics." },
] as const;

export async function getPreferences(): Promise<Preferences> {
  const { data } = await supabase
    .from("preferences")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return { ...DEFAULT_PREFERENCES, ...(data ?? {}) };
}

export type DigestRun = {
  id: number;
  ran_at: string;
  status: string;
  fetched: number;
  selected: number;
};

/** Runs that actually produced a digest, newest first. */
export async function digestRuns(limit = 60): Promise<DigestRun[]> {
  const { data } = await supabase
    .from("digest_runs")
    .select("*")
    .limit(limit);
  return (data ?? []) as DigestRun[];
}

export async function runById(id: number) {
  const { data } = await supabase.from("runs").select("*").eq("id", id).maybeSingle();
  return (data as Run) ?? null;
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
}
