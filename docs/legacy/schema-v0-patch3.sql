-- Patch 3 — a score floor, so a quiet day reads as a quiet day.
-- Paste into the Supabase SQL editor. Safe to re-run.
--
-- PRODUCT_VISION principle 6: "A day with nothing notable should produce a briefing that
-- says so. Padding to hit a fixed count destroys trust faster than a quiet day does."
-- select_count was a hard target, so a thin day still shipped 8 items, the last few
-- scoring ~3. Now select_count is a ceiling and min_score is the bar.

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS min_score NUMERIC(4,2) NOT NULL DEFAULT 4.0;

ALTER TABLE preferences DROP CONSTRAINT IF EXISTS min_score_sane;
ALTER TABLE preferences ADD CONSTRAINT min_score_sane CHECK (min_score BETWEEN 0 AND 10);

-- ---------------------------------------------------------------------------
-- The digest view has to tell two empty runs apart:
--
--   fetched = 0  every candidate was already seen on an earlier day. Not a digest at
--                all; close it 'failed' and let yesterday's stand.
--   fetched > 0  we looked and nothing cleared the bar. That IS today's answer, and
--                showing yesterday instead would be a lie.
--
-- So the run is chosen on fetched, not on whether anything was selected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW latest_digest AS
SELECT i.*
FROM items i
WHERE i.run_id = (
        SELECT r.id
        FROM runs r
        WHERE r.status IN ('ok', 'partial')
          AND r.fetched > 0
        ORDER BY r.id DESC
        LIMIT 1
      )
  AND i.selected
ORDER BY i.position;

-- Archive lists only days that produced something; an honest empty day is worth seeing
-- today, but there is nothing to revisit later.
CREATE OR REPLACE VIEW digest_runs AS
SELECT r.id, r.ran_at, r.status, r.fetched, r.selected
FROM runs r
WHERE r.status IN ('ok', 'partial')
  AND EXISTS (SELECT 1 FROM items x WHERE x.run_id = r.id AND x.selected)
ORDER BY r.ran_at DESC;
