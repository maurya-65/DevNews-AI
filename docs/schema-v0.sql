-- DevNews-AI — v0 schema. Two tables.
-- Paste into the Supabase SQL editor once.
-- The v1 target lives in schema.sql; do not build that yet.

CREATE TABLE runs (
  id         BIGSERIAL PRIMARY KEY,
  ran_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'running',  -- running | ok | partial | failed
  fetched    INT NOT NULL DEFAULT 0,
  selected   INT NOT NULL DEFAULT 0,

  -- v0 has no llm_calls table; per-run spend is enough to stay inside budget.
  cost_usd      NUMERIC(8,5) NOT NULL DEFAULT 0,
  input_tokens  INT,
  output_tokens INT,

  error      TEXT
);

CREATE TABLE items (
  id           BIGSERIAL PRIMARY KEY,
  run_id       BIGINT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

  source       TEXT NOT NULL,          -- hn | lobsters | blog
  external_id  TEXT NOT NULL,
  url          TEXT NOT NULL,
  canonical_url TEXT NOT NULL,         -- tracking params stripped; cross-source dedupe key
  title        TEXT NOT NULL,
  blurb        TEXT,                   -- often NULL for HN — see HANDOFF.md
  published_at TIMESTAMPTZ,            -- normalize every source to UTC before insert
  points       INT,
  comments     INT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- written by select.py, for ALL candidates including rejects
  novel          NUMERIC(4,2),
  consequential  NUMERIC(4,2),
  depth          NUMERIC(4,2),
  score          NUMERIC(4,2),         -- weighted sum, computed in code
  reason         TEXT,
  summary        TEXT,

  selected     BOOLEAN NOT NULL DEFAULT false,
  position     INT,                    -- rank within the digest, 1-based

  -- Same story from two sources in one run is caught in fetch.py before insert.
  -- This constraint stops the *same* item being re-inserted on a later day, which is
  -- what makes yesterday's repeats drop out for free: the old row keeps its old run_id,
  -- and candidates are always read WHERE run_id = <current>.
  UNIQUE (source, external_id)
);

CREATE INDEX ON items (run_id);
CREATE INDEX ON items (selected, score DESC);
CREATE INDEX ON items (canonical_url);

-- ---------------------------------------------------------------------------
-- Row Level Security — enable BEFORE deploying the site.
-- The anon key can read; only the service_role key (Actions only) can write.
-- ---------------------------------------------------------------------------
ALTER TABLE runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read runs"  ON runs  FOR SELECT TO anon USING (true);
CREATE POLICY "public read items" ON items FOR SELECT TO anon USING (true);

-- For a private site, drop the two policies above and serve through a Next.js
-- server component holding the service key server-side instead.

-- ---------------------------------------------------------------------------
-- What the feed page queries: the most recent successful run, not "today".
-- A late or failed cron must not produce an empty page.
-- ---------------------------------------------------------------------------
CREATE VIEW latest_digest AS
SELECT i.*
FROM items i
WHERE i.run_id = (SELECT id FROM runs WHERE status IN ('ok','partial') ORDER BY id DESC LIMIT 1)
  AND i.selected
ORDER BY i.position;
