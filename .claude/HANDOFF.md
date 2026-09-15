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

- `python -m pytest` — 66 passing (sources, arXiv TeX cleanup, dedupe, prefilter, validation,
  threads, ranking, taste, router fallback, consistency with the migration, full pipeline on
  the memory store).
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
- The GitHub Actions workflows on GitHub itself (`daily.yml`, `ci.yml`) — they have only
  run locally in equivalent form.
- Email: code path exists, needs `RESEND_API_KEY` + `EMAIL_FROM` to test.

## Next

1. Sign in on the site and exercise save / vote / hide, then run `python -m agent editions`
   and confirm the lab shows learned taste.
2. Push `rebuild/v2`, watch `ci.yml`, then merge and let `daily.yml` run on schedule.
3. After a week of editions, run the "Retiring v1" statements at the bottom of the migration.
4. Gemini 3.8 Flash has been overloaded all week. If it stays that way, set
   `LLM_PROVIDER=groq` in the workflow so the fallback stops costing a retry per batch.
