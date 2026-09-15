-- DevNews-AI — data model
-- Postgres + pgvector. Every non-obvious column carries the reason it exists.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- settings: runtime knobs that must be changeable without a deploy,
-- including the cost circuit breaker.
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('budget.max_cost_per_run_usd', '0.20'),
  ('budget.max_cost_per_month_usd', '6.00'),
  ('triage.batch_size',            '20'),
  ('triage.survivors',             '12'),
  ('digest.quality_bar',           '6.5'),   -- variable count, not fixed top-N
  ('digest.max_items',             '8'),
  ('digest.resend_cooldown_days',  '7'),
  ('dedup.lookback_days',          '30'),
  ('dedup.cosine_threshold',       '0.86'),
  ('thread.min_items_to_create',   '2'),
  ('content.max_tokens_per_item',  '3000'),
  ('deep.max_tool_calls',          '8');

-- ---------------------------------------------------------------------------
-- sources: configurable, NOT hardcoded. New feeds must not require a deploy,
-- and the weekly curator job can propose additions (status='proposed').
-- daily_quota caps each source AT INGEST — otherwise arXiv (300+/day) drowns
-- HN (~30/day) and the whole funnel becomes papers.
-- ---------------------------------------------------------------------------
CREATE TABLE sources (
  id               SERIAL PRIMARY KEY,
  kind             TEXT NOT NULL,          -- hn | arxiv | rss | lobsters | gh_trending
  name             TEXT NOT NULL UNIQUE,
  config           JSONB NOT NULL,         -- feed url, categories, min_points
  daily_quota      INT NOT NULL DEFAULT 25,
  status           TEXT NOT NULL DEFAULT 'active',  -- active | proposed | disabled
  proposed_reason  TEXT,                   -- why the curator suggested it
  last_fetched_at  TIMESTAMPTZ,
  last_error       TEXT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- runs: one per cron firing. Makes failure visible and reruns idempotent.
-- window_start/end pin the "day" explicitly in UTC — a 7am cron means a rolling
-- 24h window, not a calendar day, and the UI must not have to guess.
-- ---------------------------------------------------------------------------
CREATE TABLE runs (
  id            BIGSERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running',  -- running|ok|partial|failed|degraded
  window_start  TIMESTAMPTZ NOT NULL,
  window_end    TIMESTAMPTZ NOT NULL,
  day_bucket    DATE NOT NULL,            -- what the website groups by
  stats         JSONB,                    -- {ingested, deduped, triaged, selected}
  cost_usd      NUMERIC(10,5) NOT NULL DEFAULT 0,
  degraded_reason TEXT,                   -- set when the circuit breaker fired
  error         TEXT,
  UNIQUE (day_bucket)                     -- one run per day; rerun updates in place
);

-- Per-stage checkpointing so a crashed run resumes instead of restarting
-- (and never double-sends an email).
CREATE TABLE run_stages (
  run_id     BIGINT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL,   -- ingest|enrich|embed|dedup|triage|deep|compose|send
  status     TEXT NOT NULL,   -- pending | ok | failed | skipped
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ,
  detail     JSONB,
  PRIMARY KEY (run_id, stage)
);

-- ---------------------------------------------------------------------------
-- items: one row per fetched thing. Duplicates are LINKED, never deleted —
-- "this story hit HN, Lobsters and Reddit" is itself a relevance signal.
-- ---------------------------------------------------------------------------
CREATE TABLE items (
  id             BIGSERIAL PRIMARY KEY,
  run_id         BIGINT REFERENCES runs(id),      -- first seen in
  source_id      INT NOT NULL REFERENCES sources(id),
  external_id    TEXT,                            -- HN id, arXiv id
  url            TEXT NOT NULL,
  canonical_url  TEXT NOT NULL,                   -- utm stripped, redirects resolved
  title          TEXT NOT NULL,
  published_at   TIMESTAMPTZ,
  day_bucket     DATE NOT NULL,

  -- Text. HN — the highest-signal source — gives title only, so summary_origin
  -- tells you whether this was free (source) or cost money (fetched/generated).
  summary        TEXT,
  summary_origin TEXT,                            -- source | fetched | generated
  content_text   TEXT,                            -- raw extracted article
  content_digest TEXT,                            -- compressed; ONLY this goes to the
                                                  -- expensive model. Raw articles are
                                                  -- 5-20k tokens and blow the budget.
  content_tokens INT,
  content_status TEXT NOT NULL DEFAULT 'none',    -- none|fetched|failed|paywalled|blocked

  -- Source-native signal. Compensates for HN having no text at triage time.
  metrics        JSONB,                           -- {points, comments, velocity, stars}
  signal_score   NUMERIC(5,2),                    -- deterministic, pre-LLM

  embedding       vector(384),
  embedding_model TEXT,                           -- REQUIRED before comparing vectors.
                                                  -- Vectors from different models are not
                                                  -- comparable; without this a model swap
                                                  -- silently poisons every similarity.
  embedded_at     TIMESTAMPTZ,

  duplicate_of   BIGINT REFERENCES items(id),     -- canonical item of the cluster
  triage_score   NUMERIC(4,2),                    -- stored for ALL items, not just winners
  triage_reason  TEXT,
  selected       BOOLEAN NOT NULL DEFAULT false,
  last_sent_at   TIMESTAMPTZ,                     -- resend cooldown check

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX ON items (canonical_url);
CREATE INDEX ON items (published_at DESC);
CREATE INDEX ON items (day_bucket DESC);
CREATE INDEX ON items (triage_score DESC NULLS LAST);
CREATE INDEX ON items (last_sent_at) WHERE last_sent_at IS NOT NULL;
-- backfill worklist after an embedding-model swap
CREATE INDEX ON items (id) WHERE embedding IS NULL;
-- No ANN index yet. At ~36k rows/year brute-force cosine is milliseconds;
-- add HNSW when measurement says to, not before.

-- ---------------------------------------------------------------------------
-- threads: continuity. Created only when >= 2 related items exist — otherwise
-- every orphan spawns a thread and after a month there are 300 threads of one
-- item each, which is noise, not a feature.
-- ---------------------------------------------------------------------------
CREATE TABLE threads (
  id               BIGSERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  summary          TEXT,
  status           TEXT NOT NULL DEFAULT 'active',   -- active | dormant | closed
  embedding        vector(384),
  embedding_model  TEXT,
  first_seen_at    TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  item_count       INT NOT NULL DEFAULT 0
);
CREATE INDEX ON threads (last_activity_at DESC);

CREATE TABLE thread_items (
  thread_id  BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  item_id    BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  relation   TEXT,                                  -- opens | advances | resolves | context
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, item_id)
);
CREATE INDEX ON thread_items (item_id);

-- ---------------------------------------------------------------------------
-- digests: the briefing. item_count may be 0 — a day with nothing notable
-- produces an honest empty briefing rather than padding to a fixed number.
-- ---------------------------------------------------------------------------
CREATE TABLE digests (
  id          BIGSERIAL PRIMARY KEY,
  run_id      BIGINT NOT NULL UNIQUE REFERENCES runs(id),
  day_bucket  DATE NOT NULL,
  subject     TEXT,
  intro       TEXT,
  item_count  INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft',   -- draft | sent | empty | failed
  sent_at     TIMESTAMPTZ
);

-- Generated prose lives here, not on items: the email and the website render
-- from the same rows, so the text is written once.
CREATE TABLE digest_items (
  digest_id       BIGINT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  item_id         BIGINT NOT NULL REFERENCES items(id),
  position        INT NOT NULL,
  score           NUMERIC(4,2),
  blurb           TEXT NOT NULL,
  why_it_matters  TEXT,
  thread_context  TEXT,                        -- "follow-up to X from 3 weeks ago"
  PRIMARY KEY (digest_id, item_id)
);

-- ---------------------------------------------------------------------------
-- events: the ONLY source of taste data. Email links route through
-- /r/<digest_id>/<item_id> which writes a click row and 302s to the real URL,
-- so reading the email is itself the feedback signal — no extra behaviour
-- required from the user, and no dependency on them visiting the site.
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id         BIGSERIAL PRIMARY KEY,
  item_id    BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  digest_id  BIGINT REFERENCES digests(id),
  kind       TEXT NOT NULL,     -- click | thumbs_up | thumbs_down | hide
  channel    TEXT NOT NULL,     -- email | web
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON events (item_id);
CREATE INDEX ON events (kind, created_at DESC);

-- ---------------------------------------------------------------------------
-- profile: versioned so ranking changes can be attributed and rolled back.
-- ---------------------------------------------------------------------------
CREATE TABLE profile (
  id          SERIAL PRIMARY KEY,
  version     INT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  topics      JSONB,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_profile ON profile (active) WHERE active;

-- ---------------------------------------------------------------------------
-- llm_calls: without per-stage spend you cannot tell where the money went,
-- and the circuit breaker has nothing to read.
-- ---------------------------------------------------------------------------
CREATE TABLE llm_calls (
  id                BIGSERIAL PRIMARY KEY,
  run_id            BIGINT REFERENCES runs(id) ON DELETE CASCADE,
  stage             TEXT NOT NULL,     -- enrich | triage | deep | compose
  model             TEXT NOT NULL,
  input_tokens      INT,
  output_tokens     INT,
  cache_read_tokens INT,               -- watch this: 0 across runs = cache is broken
  cost_usd          NUMERIC(10,6),
  latency_ms        INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON llm_calls (run_id, stage);

-- ---------------------------------------------------------------------------
-- digest_metrics: precision@k over time. The project has no objective quality
-- signal without this, so prompt changes cannot be judged.
-- ---------------------------------------------------------------------------
CREATE TABLE digest_metrics (
  digest_id     BIGINT PRIMARY KEY REFERENCES digests(id) ON DELETE CASCADE,
  items_sent    INT NOT NULL,
  items_clicked INT NOT NULL DEFAULT 0,
  thumbs_up     INT NOT NULL DEFAULT 0,
  thumbs_down   INT NOT NULL DEFAULT 0,
  precision_at_k NUMERIC(4,3),
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
