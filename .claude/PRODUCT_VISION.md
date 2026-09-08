# DevNews-AI — Product Vision

## One line

A personal CS news agent that reads the firehose every morning, reasons about what
actually matters *to me*, and sends a short briefing — with memory of what it told me before.

---

## The problem

CS news is not scarce, it is overwhelming. HN alone is ~30 front-page items a day,
arXiv cs.* is 300+ papers. The scarce thing is **judgement** — knowing which five
things are worth my attention today, and why.

Existing tools fail in two ways:
- **Aggregators** (HN, Reddit, RSS readers) give volume with no filtering for *me*.
- **AI newsletters** summarize what's popular, not what's relevant, and have no memory —
  every issue starts from zero.

---

## What this is

A daily agent with three properties that separate it from a summarizer:

1. **It reads past the headline.** For the handful of items that survive filtering, it
   fetches the article, reads the discussion, and reasons about the claim — not just
   the title.
2. **It remembers.** Every item goes into a growing archive. New items get linked to
   related past ones, so the briefing can say *"this is the follow-up to what you read
   three weeks ago"* instead of presenting everything as new.
3. **It learns from behaviour, not configuration.** What I click and rate feeds back
   into ranking. My taste is inferred from what I actually read, not from a keyword list
   I wrote once and forgot.

Output is two surfaces from one pipeline:
- **Email** = the signal. ~5 items, opinionated, skimmable. The daily habit.
- **Website** = the record. Full archive, story threads, date view, semantic search.

---

## What this is *not*

- Not a general news app. Scope is computer science / software / ML.
- Not multi-user. Single-user by design; personalisation is the whole point.
- Not real-time. One run per day is the right cadence for a briefing.
- Not a summarizer. If the output reads like "here are 10 summaries", the project failed.

---

## The core bet

> The unit of value is a **story thread over time**, not an article on a given day.

Anyone can build fetch → summarize → email in a weekend. The thing that is hard, and
the thing worth building, is continuity: an archive plus retrieval plus a model that
connects today to last month. That is what turns a digest into a briefing.

---

## Principles

1. **Pipeline the volume, agent the judgement.** Deterministic code handles 100 items;
   the model reasons about 10. Never run an open-ended agent loop over the firehose.
2. **Retrieval narrows, the model decides.** Vector search produces candidates. It never
   makes the final call on relevance, threading, or ranking.
3. **Cheap work before expensive work.** URL dedup before embeddings. Embeddings before
   the small model. The small model before the large one.
4. **Every run is bounded.** Hard caps on tool calls, fetched bytes, and dollars.
   A runaway run must degrade, not crash and not overspend.
5. **Store the near-misses.** Scores are kept for every item, not just selected ones.
   Without them there is no way to debug or evaluate ranking.
6. **Honest empty states.** A day with nothing notable should produce a briefing that
   says so. Padding to hit a fixed count destroys trust faster than a quiet day does.

---

## Success criteria

Measurable, tracked over time — not vibes.

| Metric | Definition | Target |
|---|---|---|
| **precision@k** | Of the items sent, share I rate positively | > 0.6 |
| **Open-to-click** | Share of briefings where I click ≥1 item | > 0.7 |
| **Thread coverage** | Share of sent items linked to a thread (after month 1) | > 0.3 |
| **Cost / run** | Total LLM spend per daily run | < $0.15 USD |
| **Run reliability** | Successful runs / scheduled runs | > 0.95 |

The subjective bar: *would I be annoyed if this stopped arriving?* If after a month the
answer is no, the ranking is not working and no amount of polish fixes it.

---

## Constraints

- **Budget: ~$5–10 CAD/month, hard.** Everything except LLM inference must be free tier.
- **Compute: GitHub Actions.** No always-on server. Everything is a scheduled batch job.
- **Single developer, part time.** Scope must survive that.

---

## Roadmap

| Stage | Ships | Done when |
|---|---|---|
| **v0** | Ingest → dedup → triage → basic email | A real email arrives on a schedule |
| **v1** | Deep pass, threading, archive, backfill | Briefings reference past stories correctly |
| **v2** | Vercel site — date archive, thread timelines, search | Email links land on a useful page |
| **v3** | Feedback loop — tracked clicks, ratings, profile updates | precision@k measurably improves |

Stopping after v2 is acceptable. Stopping after v0 is not — at v0 this is still just a digest.
