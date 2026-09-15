# Handoff

**Last updated:** 2026-09-15
**Branch:** `main` (v2 merged from `rebuild/v2`)
**State:** v2 runs daily on GitHub Actions against production Supabase. The site is built
and checked but not yet deployed — that step needs a Vercel login (SETUP.txt §4).

---

## What v2 is

The model reads each article **once**, for everyone (summary, takeaway, kind, topics,
novelty/depth/impact, confidence, story link). Ranking happens in code, **per reader**, and
learns from what they save, vote on, open and hide. A new development in a story the reader
already saved, liked or read is lifted and says which earlier piece it follows. No model
call is made per user. See `README.md` and `docs/ARCHITECTURE.md`; decisions 25–27 in
`PROGRESS.md` record why.

## Verified

- `python -m pytest` — 81 passing.
- **GitHub Actions, run 35016936420** (dispatched from `rebuild/v2`, 2026-09-15 20:00 UTC):
  `agent check` ok, 68 candidates → 44 new articles → 44 analyzed in 4 model calls
  (Gemini 503 on all four, Groq fallback answered each), 20.9K in / 7.2K out tokens,
  1 edition from 92 candidates, 8 story hints waiting to become threads. Status page shows it.
- The week of failed crons (2026-09-09 → 15) was a UTF-8 byte-order mark at the start of
  **all four** secrets, from piping into `gh secret set` in PowerShell. `agent/env.py` now
  strips it at start-up and `agent check` names each corrected key.
- Continuity and the lab's 30-day liked-or-saved rate: checked in Chrome on a fixture with a
  saved story and its follow-up, desktop and 400px.
- Public pages (landing, status, search) against production in Chrome, no console errors.
- `web`: `tsc`, `eslint` and `next build` clean; all 18 routes build. `ci.yml` green.

## Not yet verified

- Signed-in pages against real Supabase (editions, saved, lab, settings, save/vote/hide
  writing through RLS). Needs a real account; fixture mode covers the rendering.
- The deployed site: there is no deployment yet.
- Follow-ups in production: they need threads, and threads need a second article on a story
  (8 hints are waiting).
- Email: needs `RESEND_API_KEY` + `EMAIL_FROM`.

## Next

1. Re-save the four secrets with `gh secret set NAME --body "…"` (SETUP.txt §3). Runs work
   without it, but `agent check` will keep printing notes until then.
2. Deploy `web/` on Vercel (SETUP.txt §4), set Supabase's Site URL and redirect URL, then
   `gh variable set SITE_URL`.
3. Sign in, save / vote / hide a few stories, run `python -m agent editions`, and confirm
   the lab shows learned taste and the liked-or-saved rate.
4. After a week of editions, run the "Retiring v1" statements at the bottom of the migration.
5. Gemini 3.8 Flash returned 503 on 7 of 8 calls across both production runs. Making Groq
   primary would skip the failed attempt, but Groq's free tier is 6K tokens/minute and a
   batch is ~7K — try one local run with `--provider groq` before flipping `daily.yml`.
