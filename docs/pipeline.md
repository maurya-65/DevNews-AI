# Pipeline

One GitHub Actions cron firing per day. Nine stages, checkpointed in `run_stages`.
Deterministic code handles the volume; the model handles the judgement.

```
0 LOAD ──▶ 1 INGEST ──▶ 2 NORMALIZE ──▶ 3 EMBED ──▶ 4 CLUSTER
                                                        │
   8 PERSIST ◀── 7 SEND ◀── 6 DEEP ◀── 5 TRIAGE ◀──────┘
```

---

## 0. Load

Active profile + the last ~15 positively-rated items (text and vectors) + settings.

This block is byte-identical across runs, so it goes first in the prompt and gets a cache
breakpoint. Volatile content (today's date, today's items) goes *after* it. If
`llm_calls.cache_read_tokens` is 0 across consecutive runs, something volatile leaked into
the prefix — usually a timestamp.

## 1. Ingest

Per source, honouring `sources.daily_quota`. No LLM.

| Source | Endpoint | Quota | Gives |
|---|---|---|---|
| Hacker News | `hn.algolia.com/api/v1/search` | 30 | title, url, points, comments |
| arXiv | `export.arxiv.org/api/query` | 20 | **abstract** (free summary) |
| Lobste.rs | `lobste.rs/hottest.json` | 15 | title, url, tags, score |
| Eng blogs | RSS × ~20 | 20 | title, description |
| GitHub Trending | HTML scrape | 10 | repo, description, stars gained |

**Quotas are enforced here, not at triage.** arXiv cs.* alone is 300+ papers/day against
HN's ~30 — without a cap the funnel becomes 90% papers regardless of what triage does.

**A source failing must not fail the run.** Catch per source, record `last_error`, increment
`consecutive_failures`, continue. Mark the run `partial`. Alert at 3 consecutive failures
on any source, or 2 consecutive failed runs.

**On the fixed source list:** GitHub Actions only fetches what it is told to. That ceiling is
acceptable because HN is itself a human-curated aggregator — most things that matter surface
there. The two escape hatches are the `web_search` tool in stage 6, and a weekly curator job
that inspects which domains produced high-scoring items and inserts them as
`sources(status='proposed')` for approval.

## 2. Normalize + dedup

1. Canonicalize URLs — strip `utm_*`/tracking params, resolve redirects, drop fragments.
2. Exact match on `canonical_url` against the last **30 days**, not just this run. Stories get
   resubmitted; a same-run-only check misses that.
3. Near-duplicate via cosine over the same window at `dedup.cosine_threshold`.

Duplicates are **linked** (`duplicate_of`), never deleted. A story appearing on HN *and*
Lobsters *and* a blog is a relevance signal, and deleting the rows throws it away.

URL matching runs before embeddings because it is free and catches most of them.

## 3. Embed

`title + "\n" + summary`, local `bge-small-en-v1.5` via `fastembed` (ONNX, no torch).
Cache the model in the Action with `actions/cache` or it re-downloads 130 MB every run.

Write `embedding_model` on every row. Vectors from different models are not comparable —
without that column, a model swap silently corrupts every similarity in the archive. Swapping
models means re-embedding everything; the partial index on `embedding IS NULL` is the worklist.

Symmetric comparisons (dedup, threading) embed both sides as passages — no query prefix.
Only website search is asymmetric and takes the query prefix.

## 4. Cluster / thread candidates

Retrieve archive neighbours for each surviving item. Retrieval **narrows**; it does not decide.
The threshold produces candidates, the model in stage 6 rules on them.

**Threads are created only at `min_items_to_create` (2).** An unmatched item stays an orphan.
When a later item matches it, both are pulled into a new thread retroactively. Creating a
thread per orphan yields 300 single-item threads in a month — noise, not a feature.

## 5. Triage — 100 → ~12

Cheap model. Input per item: title, summary (where free), source, and `signal_score` derived
from `metrics`.

**Batches of 20, absolute score 0–10, sorted in code.** Not one call ranking 100 items:
single-shot ranking of a long list suffers position bias, exceeds the model's useful working
attention, and one malformed output loses the whole batch.

HN — the highest-signal source — supplies title only. `signal_score` (points, comment count,
velocity) is what compensates at this stage, which is why content is not fetched before triage.

`triage_score` and `triage_reason` are written for **every** item, including rejects. The
near-misses are the only way to debug ranking.

## 6. Deep pass — the agentic stage

Survivors only. Tools: `fetch_article`, `read_hn_comments`, `search_archive`, `web_search`.
Hard cap `deep.max_tool_calls` (8).

**Content is truncated to `content.max_tokens_per_item` (3000) before it reaches the model.**
Raw articles run 5–20k tokens each; 12 of them unbounded is ~150k input and blows a day's
budget in one run.

**Extraction will fail often.** Paywalls, JS-rendered pages, cookie walls — and Actions runs on
datacenter IPs, which get blocked more aggressively. Use `trafilatura`; take arXiv through its
API, never the PDF. On failure set `content_status` and **fall back to HN comments**, which are
free via API and frequently better than the article.

The model outputs, per item: score, blurb, why-it-matters, thread relation. Then selection:

**Variable count, not fixed top-N.** Keep items above `digest.quality_bar`, capped at
`digest.max_items`. Zero qualifying items is a valid outcome — the briefing says so and
`digests.status='empty'`. Padding a slow day with filler costs trust faster than a quiet day does.

Skip anything whose `last_sent_at` is inside `resend_cooldown_days` — a story trending two days
running should not arrive twice.

## 7. Send

Render email and website from the same `digest_items` rows; the prose is generated once.

Every link routes through `/r/<digest_id>/<item_id>` on the Vercel site, which writes a `click`
event and 302s onward. **This is the only reliable taste signal** — the feedback loop cannot
depend on the reader also visiting the website, because they mostly won't.

Send is guarded by `run_stages` so a rerun after a crash never double-sends.

## 8. Persist

Update `last_sent_at`, thread counts, `digest_metrics`, `llm_calls`. Close out the run.

---

## Cost budget

Correcting an earlier estimate that was ~5× low — it assumed articles reach the model whole.

| Stage | Model | Tokens | ~USD/day |
|---|---|---|---|
| Ingest / normalize | — | — | 0 |
| Embed 100 | local | — | 0 |
| Triage 100 (5 batches) | Haiku 4.5 | ~25k in / 3k out | 0.040 |
| Deep + compose (8 items) | Sonnet 5 | ~32k in / 4k out | 0.104 |
| **Total** | | | **≈ 0.145** |

≈ $4.35 USD / $6 CAD per month. Tight but inside budget — which is precisely why the breaker
below is not optional. Prompt caching on the stage-0 prefix trims further.

Opus 5 on the deep pass is the better model and roughly doubles that line. If it is wanted, buy
it by dropping to alternate-day runs or a weekend-only deep edition rather than by raising the cap.

## Circuit breaker

Checked before each stage against `runs.cost_usd` and the month-to-date total. Degrade, never crash.

| Spend | Behaviour |
|---|---|
| < 70% | Normal |
| ≥ 70% | Skip article fetching; deep pass runs on source summaries only |
| ≥ 90% | Skip deep pass; send triage-ranked list with source summaries |
| ≥ 100% | Send nothing, mark run `degraded`, alert |

## Cold start

The archive is empty for the first weeks, which disables dedup, threading and taste retrieval —
the three things that make this more than a digest.

Run a one-time backfill on day 1: HN top stories for the last 60 days plus arXiv for the same
window, through stages 1–4 only (no triage, no LLM, so it is nearly free). Seed `profile` v1 by
hand. Retrieval features degrade gracefully until neighbours exist — fewer than 3 neighbours
means skip the threading claim rather than assert a weak one.

## Evaluation

`precision@k` = positively-rated items ÷ items sent, per digest, in `digest_metrics`.
Rate ~20 items a week. A prompt or ranking change is judged against the trailing 14-day
average — not against how the last one digest felt.

## Operational notes

- **Use the pooled Postgres connection string** on both Actions and Vercel. Free-tier connection
  caps are low and Vercel's serverless functions will exhaust a direct pool.
- **Actions cron drifts** 15–60 minutes on the free tier, worse on the hour. Fine for a daily
  briefing; do not promise a delivery time.
- Public repo for unlimited Actions minutes; all credentials in repo secrets.
