/** Shapes the site reads. They mirror supabase/migrations/20260915000000_v2.sql. */

export type Mention = {
  source: string;
  url: string | null;
  points: number | null;
  comments: number | null;
};

/** One row of the article_cards view: an article with the model's reading of it. */
export type ArticleCard = {
  id: number;
  url: string;
  domain: string;
  title: string;
  description: string | null;
  word_count: number | null;
  published_at: string | null;
  first_seen_at: string;
  summary: string;
  takeaway: string | null;
  kind: string;
  topics: string[];
  technologies: string[];
  audience: string;
  novelty: number;
  depth: number;
  impact: number;
  confidence: number;
  is_cs: boolean;
  thread_id: number | null;
  thread_relation: string | null;
  thread_slug: string | null;
  thread_title: string | null;
  mentions: Mention[];
};

/** The earlier article in the same story this reader engaged with. See rank.follow_ups. */
export type FollowUp = {
  article_id: number;
  title: string;
  how: "saved" | "upvoted" | "opened" | "shown";
  at: string | null;
};

/** How the ranker arrived at a score. See agent/rank.py. */
export type Components = {
  quality: number;
  interest: number;
  signal: number;
  freshness: number;
  note?: string;
  follows?: FollowUp;
};

/** How a reader's editions have landed with them over a window of days. */
export type ReadingStats = {
  days: number;
  editions: number;
  kept: number;
  opened: number;
  liked: number;
  pushedAway: number;
};

export type Edition = {
  id: number;
  edition_date: string;
  status: "ok" | "quiet";
  item_count: number;
  candidate_count: number;
  created_at: string;
};

export type EditionItem = {
  rank: number;
  score: number;
  selected: boolean;
  why: string | null;
  components: Components;
  article: ArticleCard;
};

export type Thread = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  first_seen_at: string;
  last_activity_at: string;
  article_count: number;
};

export type Profile = {
  id: string;
  email: string | null;
  level: "learning" | "working" | "deep";
  select_count: number;
  min_score: number;
  topics: string[];
  technologies: string[];
  muted_technologies: string[];
  muted_topics: string[];
  muted_kinds: string[];
  muted_domains: string[];
  sources_off: string[];
  include_general: boolean;
  email_digest: boolean;
  feed_token: string | null;
  taste_updated_at: string | null;
  /** What they said they do, from the roles onboarding offers. */
  role: string | null;
  /** Their own description of what they work on, kept verbatim so it can be edited. */
  interest_text: string | null;
  /** What the model made of that text, and which of it the reader kept. */
  interest_profile: InterestProfile | null;
  interest_read_at: string | null;
  /** Null until onboarding is finished. */
  onboarded_at: string | null;
};

/** The model's reading of a reader's own words, after validation against the taxonomy.
 *  Stored so the interpretation can be shown back without asking a model again. */
export type InterestProfile = {
  topics?: string[];
  technologies?: string[];
  muted_topics?: string[];
  muted_kinds?: string[];
  level?: "learning" | "working" | "deep";
  /** One sentence, in the model's words, of what it understood. */
  summary?: string;
};

export type TasteWeight = { key: string; weight: number; evidence: number };

/** Which of these articles the reader saved or voted on. Plain data, safe to pass to the client. */
export type ReaderState = {
  saved: number[];
  votes: Record<number, 1 | -1>;
};

export type SearchHit = {
  id: number;
  title: string;
  url: string;
  domain: string;
  summary: string;
  kind: string;
  topics: string[];
  thread_slug: string | null;
  first_seen_at: string;
};

export type PipelineRun = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "failed";
  stats: Record<string, Record<string, unknown>>;
  error: string | null;
};

export type RunStage = {
  run_id: number;
  stage: string;
  status: "ok" | "failed" | "skipped";
  started_at: string;
  finished_at: string;
  detail: Record<string, unknown>;
};

export type SourceHealth = {
  id: string;
  kind: string;
  name: string;
  quota: number;
  enabled: boolean;
  last_ok_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
};

export type StatusData = {
  runs: PipelineRun[];
  stages: RunStage[];
  sources: SourceHealth[];
};
