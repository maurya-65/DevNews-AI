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
