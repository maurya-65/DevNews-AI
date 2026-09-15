# Architecture

## Principles

1. **Understand once, rank per reader.** The model reads each article once, for everyone.
   Personalisation is code. A new reader costs database rows, not model calls.
2. **The model describes; code decides.** The model returns scores and prose. Weights,
   cut-offs, diversity rules and ordering live in `agent/config.py` and `agent/rank.py`.
   Tuning never means editing a prompt.
3. **Everything is bounded.** Per-source quotas, a cap on articles analyzed per run, byte
   limits on fetched pages, and batched model calls keep a run inside free tiers no matter
   what the sources return.
4. **Degrade, don't fail.** Only collecting and storing can fail a run. A model outage
   still produces editions from what was analyzed; an email outage never costs anyone the
   website. Every stage is timed and recorded.
5. **Keep the near-misses.** Every candidate a reader was ranked against is stored with its
   score broken into parts. That is the only way to debug a ranking.
6. **Honest empty days.** Edition size is a ceiling and the quality bar is a floor.

## Pipeline (`agent/`)

`python -m agent run`, daily on GitHub Actions. Stages, in `agent/pipeline.py`:

| Stage | What it does | Module |
|---|---|---|
| ingest | Fetch each enabled source within its quota. One failing source is recorded against its row and skipped. | `sources/` |
| store | Fold links to the same canonical URL into one article with several mentions; upsert articles and mentions; mark which are already analyzed. | `dedupe.py`, `store/` |
| enrich | Pick at most 48 unanalyzed articles (each source guaranteed a floor), fetch their pages concurrently and extract the opening text. | `prefilter.py`, `enrich.py` |
| analyze | Batches of 12 to the model; validate and clamp every field against the taxonomy; retry skipped articles once. | `analyze.py`, `llm/` |
| threads | Turn the model's story links into threads. A thread exists only once a second article joins it. | `threads.py` |
| learn | Fold each reader's new events into their taste weights, with decay. | `taste.py`, `editions.py` |
| editions | Rank recent analyzed articles for every reader and store the edition plus near-misses. | `rank.py`, `editions.py` |
| notify | Email readers who asked, once per edition, if Resend is configured. | `notify.py` |

### Model calls

`llm/router.py` tries the primary provider (`LLM_PROVIDER`, default Gemini) and falls back
to the other. Overload errors (503, 429) go straight to the fallback, because an overload
spike lasts minutes; other errors retry the primary once first. Every attempt is recorded
in `llm_calls`. A typical run is 4 calls and ~20K tokens.

### Ranking

```
quality   = Σ weight(level) × {novelty, depth, impact} × audience fit, discounted if low confidence
interest  = followed topics (+0.6) and learned taste per topic, kind, site and source, in −1..1
score     = quality × (1 + 0.55 × interest) + 1.2 × community signal + freshness
```

An article is excluded outright if it is off-topic for computing (unless the reader opts
in), or matches a muted topic, kind, site or switched-off source. Selection then walks the
ranking and keeps articles that clear the reader's quality bar, with at most three on one
primary topic and one per site, up to the edition size. Every item stores `components`
and a `why` sentence.

### Continuity

A thread is only worth something to a reader if it connects to what *they* already know.
Before ranking, `store.thread_engagement` collects what the reader did with earlier articles
in the threads today's candidates belong to, and `rank.follow_ups` keeps the strongest per
thread (saved, then liked, then opened, then merely shown). A candidate in such a thread
gets `FOLLOW_UP_INTEREST` added to its interest, `components.follows` naming the earlier
article, and a `why` that starts "Follows “…”, which you saved". A thread the reader voted
down or hid anything in is never pulled back. No model call, no extra column: it rides in
`components`, so email and RSS carry it for free.

### Taste

Events: up +1.0, save +0.8, open +0.25, unsave −0.3, hide −0.7, down −1.0. Each nudges the
weights for the article's topics (primary topic most), kind, site and sources, with
diminishing returns near ±1. Weights decay 1.5% a day toward neutral when nothing
reinforces them.

## Data (`supabase/migrations/`)

Shared, readable by anyone: `sources`, `pipeline_runs`, `run_stages`, `articles`,
`mentions`, `threads`, `analyses`, and the `article_cards` view. Personal, readable only by
their owner: `profiles`, `taste`, `editions`, `edition_items`, `saves`, `votes`, `events`.
Readers may insert and delete their own saves, votes and events; everything else personal
is written by the pipeline with the service key. `llm_calls` has no policies at all.

The v1 tables (`runs`, `items`, `verdicts`, `preferences`) are left untouched by the v2
migration; its last section lists how to drop them.

## Site (`web/`)

Next.js 16, App Router, server components reading through the visitor's Supabase session.

| Route | Access | |
|---|---|---|
| `/` | public / reader | Landing page for visitors; today's edition for readers |
| `/edition/[date]`, `/archive` | reader | Past editions |
| `/threads`, `/threads/[slug]` | public | Developing stories |
| `/article/[id]` | public | Everything known about one article |
| `/search` | public | Full-text search (`search_articles` RPC) |
| `/saved` | reader | Reading list |
| `/lab` | reader | Score breakdown, learned taste, and 30-day liked-or-saved rate |
| `/status` | public | Runs, stages, source health |
| `/settings`, `/settings/account` | reader | Preferences and account |
| `/r/[id]` | public | Records an open for readers, redirects to the stored URL only |
| `/feed/[token]` | token | Private RSS; token lookup uses the service key |

`src/lib/store.ts` chooses between `db.ts` (Supabase) and `fixtures.ts` (a pipeline
dry-run file). Fixture mode is development-only and cannot switch on in a production build.

## Free-tier budget

| Resource | Use per day | Free limit |
|---|---|---|
| Gemini / Groq | ~4 calls, ~20K tokens | far above |
| GitHub Actions | ~4 minutes | unlimited on a public repo |
| Supabase | a few hundred rows | 500 MB |
| Resend (optional) | one email per opted-in reader | 3,000 / month |
