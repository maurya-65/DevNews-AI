# Handoff

**Last updated:** 2026-09-15
**Branch:** `rebuild/v2`
**State:** v2 rebuilt end to end and running against production Supabase. Not yet merged.

---

## What v2 is

A full rewrite of both halves. The model reads each article **once**, for everyone
(summary, takeaway, kind, topics, novelty/depth/impact, confidence, story link). Ranking
happens in code, **per reader**, and learns from what they save, vote on, open and hide.
No model call is made per user. See `README.md` and `docs/ARCHITECTURE.md`; decision 25 in
`PROGRESS.md` records why.

## Verified

- `python -m pytest` — 69 passing (sources, arXiv TeX cleanup, dedupe, prefilter, validation,
  threads, ranking, continuity, taste, router fallback, consistency with the migration, full
  pipeline on the memory store).
- Continuity (decision 26) and the lab's 30-day liked-or-saved rate (decision 27): checked in
  Chrome on a fixture with a saved story and its follow-up, desktop and 400px. Neither needs
  a migration; both are live on the next run once merged.
- Every page checked in Chrome: personal pages in fixture mode (desktop and 400px, no
  horizontal overflow, no console errors), public pages against production data. Routes:
  public pages 200, personal pages 307 to `/login`, unknown article and bad feed token 404.
- `supabase/migrations/20260915000000_v2.sql` applied to the production project on
  2026-09-15 ("Success. No rows returned"). Additive: v1 tables untouched.
- First production run (run 1, 2026-09-15 12:36 UTC): 67 candidates → 66 articles (1
  cross-posted) → 48 enriched and analyzed, 0 missing, 4 model calls, ~21K in / 7.7K out
  tokens. Gemini was overloaded (503) on 3 of 4 attempts; Groq fallback covered them. One
  edition built: 8 kept of 48.
- `web`: `tsc`, `eslint` and `next build` clean; all 18 routes build.

## Not yet verified

- Signed-in pages against real Supabase (editions, saved, lab, settings save, votes/saves
  writing through RLS). Fixture mode covers the rendering; RLS writes need a real login.
- `daily.yml` on GitHub itself — it has only run locally in equivalent form. (`ci.yml` is
  green on GitHub: run 35014108621, agent tests plus web lint, tsc and build.)
- Email: code path exists, needs `RESEND_API_KEY` + `EMAIL_FROM` to test.

## Next

1. Sign in on the site and exercise save / vote / hide, then run `python -m agent editions`
   and confirm the lab shows learned taste.
2. `rebuild/v2` is pushed and CI is green. **Blocker first:** the `SUPABASE_URL` repo
   secret is malformed. The v1 cron on `main` has failed every day since 2026-09-09 with
   `SupabaseException: Invalid URL` (the client requires `^https?://`). The local `.env`
   value is well-formed, so re-set the secret from it. Then dispatch `daily.yml` once from
   the branch, merge (PR #1 is already contained in `rebuild/v2`), and let it run on
   schedule.
3. After a week of editions, run the "Retiring v1" statements at the bottom of the migration.
4. Gemini 3.8 Flash has been overloaded all week. If it stays that way, set
   `LLM_PROVIDER=groq` in the workflow so the fallback stops costing a retry per batch.
