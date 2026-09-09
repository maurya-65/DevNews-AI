-- v1 — multi-user. Paste into the Supabase SQL editor. Safe to re-run.
--
-- This supersedes the single-user assumption in PRODUCT_VISION and the CHECK (id = 1)
-- on preferences. The shape changes in one important way:
--
--   items    stays SHARED. Fetching is identical for everyone, so it happens once.
--   verdicts is PER USER. Scores, reasons, summaries and the selection are personal,
--            because they are the output of that user's preferences.
--
-- Rule 1 ("one LLM call per run") becomes one call per user per run. Fetching is still
-- once, which is where the bandwidth and failure risk live; the model call is the part
-- that genuinely cannot be shared without making the digest impersonal.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  profile      TEXT,
  topics       TEXT[] NOT NULL DEFAULT '{}',
  avoid        TEXT[] NOT NULL DEFAULT '{}',
  level        TEXT   NOT NULL DEFAULT 'working',

  select_count INT     NOT NULL DEFAULT 8,
  min_score    NUMERIC(4,2) NOT NULL DEFAULT 4.0,

  -- Quotas stay per user even though fetching is shared: they cap how many of the
  -- shared candidates from each source that user is scored against.
  hn_quota       INT NOT NULL DEFAULT 10,
  lobsters_quota INT NOT NULL DEFAULT 5,
  blogs_quota    INT NOT NULL DEFAULT 5,

  CONSTRAINT level_valid CHECK (level IN ('working', 'deep', 'learning')),
  CONSTRAINT select_count_sane CHECK (select_count BETWEEN 1 AND 20),
  CONSTRAINT min_score_sane CHECK (min_score BETWEEN 0 AND 10)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Each user sees and edits only their own row. No anon access at all — preferences are
-- personal, and there is nothing here a logged-out visitor needs.
DROP POLICY IF EXISTS "read own profile"   ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;

CREATE POLICY "read own profile"   ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- A user with no profile row would get no digest and see an empty settings form, so the
-- row is created with the account rather than lazily on first visit.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill anyone who signed up before this patch.
INSERT INTO profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- verdicts — one row per (user, item). The personal half of the pipeline.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verdicts (
  id       BIGSERIAL PRIMARY KEY,
  user_id  UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id   BIGINT NOT NULL REFERENCES runs(id)  ON DELETE CASCADE,
  item_id  BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  novel         NUMERIC(4,2),
  consequential NUMERIC(4,2),
  depth         NUMERIC(4,2),
  score         NUMERIC(4,2),      -- weighted sum, computed in code
  reason        TEXT,
  summary       TEXT,

  selected  BOOLEAN NOT NULL DEFAULT false,
  position  INT,                   -- rank within that user's digest, 1-based

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Re-running selection for a user updates in place rather than accumulating.
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS verdicts_user_run ON verdicts (user_id, run_id);
CREATE INDEX IF NOT EXISTS verdicts_selected ON verdicts (user_id, selected, position);

ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own verdicts" ON verdicts;
CREATE POLICY "read own verdicts" ON verdicts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- items becomes a shared candidate pool: no per-user columns, no anon read.
-- ---------------------------------------------------------------------------
ALTER TABLE items DROP COLUMN IF EXISTS novel;
ALTER TABLE items DROP COLUMN IF EXISTS consequential;
ALTER TABLE items DROP COLUMN IF EXISTS depth;
ALTER TABLE items DROP COLUMN IF EXISTS score;
ALTER TABLE items DROP COLUMN IF EXISTS reason;
ALTER TABLE items DROP COLUMN IF EXISTS summary;
ALTER TABLE items DROP COLUMN IF EXISTS selected;
ALTER TABLE items DROP COLUMN IF EXISTS position;

-- The digest is no longer public: reading it requires an account.
DROP VIEW IF EXISTS latest_digest;
DROP VIEW IF EXISTS digest_runs;

DROP POLICY IF EXISTS "public read items" ON items;
DROP POLICY IF EXISTS "public read runs"  ON runs;
DROP POLICY IF EXISTS "read items" ON items;
DROP POLICY IF EXISTS "read runs"  ON runs;

CREATE POLICY "read items" ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "read runs"  ON runs  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- What each signed-in user's pages query. Both are filtered by RLS on verdicts,
-- so a user only ever sees their own rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW my_digest AS
SELECT v.user_id,
       v.run_id,
       v.score, v.reason, v.summary, v.position,
       v.novel, v.consequential, v.depth,
       i.id AS item_id, i.source, i.url, i.title, i.blurb,
       i.points, i.comments, i.published_at,
       r.ran_at
FROM verdicts v
JOIN items i ON i.id = v.item_id
JOIN runs  r ON r.id = v.run_id
WHERE v.selected
ORDER BY v.run_id DESC, v.position;

CREATE OR REPLACE VIEW my_runs AS
SELECT v.user_id,
       r.id,
       r.ran_at,
       r.status,
       count(*)                        AS scored,
       count(*) FILTER (WHERE v.selected) AS selected
FROM verdicts v
JOIN runs r ON r.id = v.run_id
GROUP BY v.user_id, r.id, r.ran_at, r.status
HAVING count(*) FILTER (WHERE v.selected) > 0
ORDER BY r.ran_at DESC;

-- The old single-user table is left in place, unused, so nothing is lost if this needs
-- reverting. Drop it once the new shape has run for a few days:
--   DROP TABLE preferences;
