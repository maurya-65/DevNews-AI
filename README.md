# DevNews

The few computer-science stories worth your time today, chosen for you.

Every morning DevNews reads ~70 links from Hacker News, Lobsters, engineering blogs, arXiv
and GitHub, fetches the articles themselves, and has a model read each one **once** —
summary, takeaway, kind, topics, and honest scores for novelty, depth and impact. Then it
ranks them **in code, separately for every reader**: by quality at their reading level,
the topics they follow, what they have saved, voted on and hidden, how much the community
reacted, and freshness. A thin day gets a short edition. A day where nothing clears your
bar gets an empty one, and says so.

Everything runs on free tiers. Adding readers adds no model calls.

## What's in it

- **Today** — your edition, with why each story is there, keyboard navigation
  (`j`/`k`, `o`, `s`, `u`/`d`, `x`), save and more/less-like-this.
- **Threads** — stories that develop over days, linked automatically once a second
  article joins one.
- **Search** — full-text over everything the pipeline has read.
- **Ranking lab** — every candidate in your edition with its score broken into parts, and
  what DevNews has learned about your taste.
- **Status** — each run stage by stage, token usage, source health.
- **Delivery** — the site, an optional morning email, and a private RSS feed.

## How it fits together

```
GitHub Actions (daily cron)                Supabase (Postgres + RLS)          Vercel (Next.js 16)
  agent/  ingest → store → enrich   ───▶   articles · mentions · analyses  ◀───  reads with the
          analyze → threads → learn         threads · editions · taste            visitor's session
          editions → notify                 saves · votes · events        ───▶  writes saves/votes/events
```

The pipeline and the site never talk to each other; the database is the only shared
state. Details, the data model and the ranking formula are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running it

Requirements: Python 3.12, Node 24, a Supabase project, and a free Gemini and/or Groq key.

```bash
# once
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # or .venv/bin/pip
cp .env.example .env                    # fill in keys; see comments inside
# apply supabase/migrations/20260915000000_v2.sql in the Supabase SQL editor
cd web && npm ci && cp ../.env.example .env.local   # keep the web section

# pipeline
python -m agent check                   # environment and schema
python -m agent sources                 # what every source returns right now
python -m agent run                     # the daily run, against Supabase
python -m agent run --store memory --memory-file web/fixtures/state.json   # dry run, no database
python -m agent editions                # re-rank today from stored analyses, no model calls
python -m pytest                        # tests

# site
cd web && npm run dev                                # against Supabase
cd web && DEVNEWS_FIXTURES=1 npm run dev             # against the dry-run file, no login
```

In GitHub, set the secrets `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY` (and optionally `RESEND_API_KEY`, with variables `EMAIL_FROM` and
`SITE_URL`). `.github/workflows/daily.yml` runs at 06:30 UTC; `ci.yml` runs tests, lint,
type-check and build on every push.
