# Handoff

**Last updated:** 2026-09-15
**Branch:** `feat/onboarding-and-stack`, cut from `rebuild/v2`. PR #2 (`rebuild/v2` → `main`)
is still open with green checks, so this branch sits on top of it and lands cleanly once
that merges.
**State:** v2 has run green on GitHub Actions against production Supabase (dispatched from
`rebuild/v2`). Until PR #2 merges, the 06:30 UTC cron on `main` still runs v1 and still
fails. The site is built and checked but not yet deployed — that needs a Vercel login
(SETUP.txt §4).

## In flight: onboarding and the reader's stack (decisions 28-30)

Commit `738b0ec` on `feat/onboarding-and-stack`, pushed. **PR #3** into `rebuild/v2` is open
with both checks green. It is stacked on PR #2, so merge that one first.

- **Technologies.** ~140 ids with aliases in `taxonomy.json`; the model tags up to six per
  article and may name something off-list, which survives as a slug. Ranking adds a stack
  term (+0.5, best match wins) and a muted-technology exclusion; taste learns `tech:` keys.
- **`/welcome`.** Role → depth → stack → topics → 150 words. The words go to
  `web/src/lib/interpret.ts` (Gemini, Groq behind it) — the only model call the site makes,
  on save rather than per run — and come back as chips the reader can undo.
- **Day one.** `/` shows a starter feed (`db.starterOrder`) until the first edition exists.
- **Auth.** Facebook added alongside Google and GitHub (Apple skipped: $99/year). Signup now
  lands on `/welcome`.
- **`/privacy`, `/data-deletion`, and real account deletion** in Account settings, using the
  service key; `auth.users` cascades take every personal row with it.
- **Migration** `supabase/migrations/20260916000000_stack.sql` — additive, not yet applied.

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

- **The new work:** 91 Python tests, `tsc`, `eslint`, and a production build of all 21 routes.
  CI green on PR #3 (run 35378444779, both jobs). Stack ranking measured on a fixture copy with
  no model calls: the Rust-tagged article sits at rank 3 with an empty stack and at rank 1 with
  `rust` declared, its `why` reading "You work with Rust; heavily discussed on GitHub; unusually
  deep". The Java-tagged control does not move.
- **The setup path, clicked through in Chrome** against a brand-new-reader fixture: role presets,
  `k8s` folding to Kubernetes in the picker, one real `readInterests` call (9.6s, understood "Go
  with Postgres on Kubernetes" and muted releases), the starter feed on finishing, and the
  settings and account screens afterwards.
- **`interpret.ts` against a real key.** The Gemini REST call works and the returned ids validate
  against the taxonomy. The Groq fallback path has still never been exercised.
- One bug this found: a `"use server"` file may only export async functions, so the confirmation
  phrase exported from `delete.ts` broke `/settings/account` at build time. Neither `tsc` nor
  `eslint` catches it — only opening the page or running a build does. The phrase now lives in
  `web/src/lib/account.ts`.

## Not yet verified

- Signed-in pages against real Supabase (editions, saved, lab, settings, save/vote/hide
  writing through RLS). Needs a real account; fixture mode covers the rendering.
- The deployed site: there is no deployment yet.
- Follow-ups in production: they need threads, and threads need a second article on a story
  (8 hints are waiting).
- Email: needs `RESEND_API_KEY` + `EMAIL_FROM`.

- **Account deletion.** Written, built and rendered, never executed against Supabase. It is the
  one path here that cannot be undone, so the first run of it is worth doing on a throwaway
  account.
- **Anything against the real database.** The whole walkthrough was fixture mode; the new profile
  columns do not exist in Supabase until the migration is applied.
- **The morning cron is still failing on `main`** (16, 17 and 18 September, ~17s each) because
  `main` is still v1. Merging PR #2 is what fixes that, and it matters more than anything in #3.

## Next

1. Apply `supabase/migrations/20260916000000_stack.sql`. Until then the site's new profile
   columns do not exist, so onboarding cannot save. Editions keep working either way.
2. Copy `GEMINI_API_KEY` / `GROQ_API_KEY` into `web/.env.local` (and later Vercel) so the
   setup box can be read. Without them setup still works; the reader picks by hand.
3. Re-tag the ~65 existing articles so they carry technologies: roughly 6 model calls.
4. Re-save the four secrets with `gh secret set NAME --body "…"` (SETUP.txt §3). Runs work
   without it, but `agent check` will keep printing notes until then.
2. Deploy `web/` on Vercel (SETUP.txt §4), set Supabase's Site URL and redirect URL, then
   `gh variable set SITE_URL`.
3. Sign in, save / vote / hide a few stories, run `python -m agent editions`, and confirm
   the lab shows learned taste and the liked-or-saved rate.
4. After a week of editions, run the "Retiring v1" statements at the bottom of the migration.
5. Gemini 3.8 Flash returned 503 on 7 of 8 calls across both production runs. Making Groq
   primary would skip the failed attempt, but Groq's free tier is 6K tokens/minute and a
   batch is ~7K — try one local run with `--provider groq` before flipping `daily.yml`.
