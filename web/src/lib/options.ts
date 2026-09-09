/** Shared types and option lists.
 *
 *  Deliberately free of server imports: client components need these, and pulling them
 *  from the data layer would drag next/headers into the browser bundle.
 *
 *  Labels mirror agent/profile.py — a slug added there needs adding here too.
 */

export type Item = {
  item_id: number;
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
  position: number | null;
  ran_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  profile: string | null;
  topics: string[];
  avoid: string[];
  level: "working" | "deep" | "learning";
  select_count: number;
  min_score: number;
  hn_quota: number;
  lobsters_quota: number;
  blogs_quota: number;
  updated_at: string | null;
};

export type MyRun = {
  id: number;
  ran_at: string;
  status: string;
  scored: number;
  selected: number;
};

export const DEFAULT_PROFILE: Omit<Profile, "id" | "email"> = {
  profile: null,
  topics: [],
  avoid: [],
  level: "working",
  select_count: 8,
  min_score: 4,
  hn_quota: 10,
  lobsters_quota: 5,
  blogs_quota: 5,
  updated_at: null,
};

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

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
}
