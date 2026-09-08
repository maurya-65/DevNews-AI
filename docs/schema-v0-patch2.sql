-- Patch 2 — preferences, so the interest profile lives in the DB instead of the prompt.
-- Paste into the Supabase SQL editor. Safe to re-run.
--
-- Single-user by design (PRODUCT_VISION), so this is one row, id = 1. It is not a users
-- table and must not become one.
--
-- Writes go through Next.js server actions holding the service key server-side. The anon
-- key stays read-only, so rule 5 still holds: the service key never reaches the browser.

CREATE TABLE IF NOT EXISTS preferences (
  id          INT PRIMARY KEY DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Free text, appended to the prompt verbatim. The escape hatch for anything the
  -- toggles below cannot express.
  profile     TEXT,

  -- Topic slugs the reader wants and wants avoided. Rendered into the prompt as prose.
  topics      TEXT[] NOT NULL DEFAULT '{}',
  avoid       TEXT[] NOT NULL DEFAULT '{}',

  -- working | deep | learning — how much context summaries should assume.
  level       TEXT NOT NULL DEFAULT 'working',

  -- How many items survive the cut. Read by select.py; overrides SELECT_COUNT.
  select_count INT NOT NULL DEFAULT 8,

  -- Per-source quotas. Zero disables a source entirely.
  hn_quota       INT NOT NULL DEFAULT 10,
  lobsters_quota INT NOT NULL DEFAULT 5,
  blogs_quota    INT NOT NULL DEFAULT 5,

  CONSTRAINT one_row CHECK (id = 1),
  CONSTRAINT level_valid CHECK (level IN ('working', 'deep', 'learning')),
  CONSTRAINT select_count_sane CHECK (select_count BETWEEN 1 AND 20)
);

INSERT INTO preferences (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- Read-only for anon. The settings page renders current values with the anon key;
-- saving goes through a server action using the service key.
DROP POLICY IF EXISTS "public read preferences" ON preferences;
CREATE POLICY "public read preferences" ON preferences FOR SELECT TO anon USING (true);

-- ---------------------------------------------------------------------------
-- Archive: every run that actually produced a digest, newest first.
-- Lets the site show past days without each page re-deriving "which runs count".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW digest_runs AS
SELECT r.id,
       r.ran_at,
       r.status,
       r.fetched,
       r.selected
FROM runs r
WHERE r.status IN ('ok', 'partial')
  AND EXISTS (SELECT 1 FROM items x WHERE x.run_id = r.id AND x.selected)
ORDER BY r.ran_at DESC;
