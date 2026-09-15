-- Patch 1 — latest_digest must skip runs that produced nothing.
-- Paste into the Supabase SQL editor. Safe to re-run.
--
-- Why: a run whose candidates were all seen on an earlier day inserts 0 rows and still
-- closes as 'ok'. The original view picked the latest ok run unconditionally, so that
-- empty run became the digest and the site went blank — exactly the failure the view was
-- written to prevent. Now it picks the latest run that actually has selected items.

CREATE OR REPLACE VIEW latest_digest AS
SELECT i.*
FROM items i
WHERE i.run_id = (
        SELECT r.id
        FROM runs r
        WHERE r.status IN ('ok', 'partial')
          AND EXISTS (SELECT 1 FROM items x WHERE x.run_id = r.id AND x.selected)
        ORDER BY r.id DESC
        LIMIT 1
      )
  AND i.selected
ORDER BY i.position;
