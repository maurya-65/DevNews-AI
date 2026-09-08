# DevNews-AI

A personal CS news agent. Runs daily on GitHub Actions: fetches ~20 headlines from three
sources, sends them to an LLM in **one call**, gets back scores + summaries, keeps the
top 7-8, writes to Supabase. A Next.js page on Vercel reads that DB directly.

Runs entirely on free tiers — no paid API. The LLM provider is swappable (Gemini or Groq).

Single user. No server. No backend — the frontend talks to Supabase itself.

---

## Read these first

| File | What's in it |
|---|---|
| `.claude/HANDOFF.md` | Current state, what's next, what's blocked — **start here** |
| `.claude/BUILDFLOW.md` | Six phases with tasks, exit criteria, gotchas |
| `.claude/PROGRESS.md` | Phase status, decisions log (with reasoning), session log |
| `.claude/PRODUCT_VISION.md` | What this is, what it isn't, success metrics |
| `docs/schema-v0.sql` | What v0 actually builds — 2 tables |
| `docs/schema.sql` | Target schema for v1 — do not build this yet |
| `docs/pipeline.md` | Full pipeline design (v1 target) |

Before proposing a change, check the decisions log in `PROGRESS.md`. Most "obvious
improvements" were already considered and rejected for a reason.

---

## Architecture

```
GitHub Actions (cron)  →  agent/  →  Supabase  ←  Vercel (Next.js)
   ephemeral runner       Python      Postgres      reads via anon key
```

Actions and Vercel never talk to each other. Supabase is the only shared state. The runner
is ephemeral — nothing on disk survives a run.

The LLM call happens **from inside the Actions runner** (or locally during dev), over HTTPS
to whichever provider `LLM_PROVIDER` names. Exactly one call per run.

---

## Run sequence

```
1. fetch      3 sources → ~40 raw → canonical-URL dedupe → top 20
2. store      runs row, then items (ON CONFLICT DO NOTHING)
3. select     read candidates from DB → ONE LLM call → verdicts for all 20
4. score      weighted sum in CODE → sort → top 8 → selected=true
5. store      update rows, close run
6. web        reads latest successful run on request
```

---

## Rules that must not be broken

1. **One LLM call per run in v0.** If a second seems necessary, the design changed — say so
   rather than adding it.
2. **The model scores; code selects.** Never ask the model for "the top 8". It returns
   per-item scores; ranking, cutoff and ordering happen in Python.
3. **Weights live in code, not the prompt.** Tuning must never mean editing prose.
4. **Every candidate gets a verdict.** 20 in, 20 out. Rejects are stored — they are the
   only way to debug ranking.
5. **`SUPABASE_SERVICE_KEY` never reaches the frontend.** It bypasses RLS. Web uses the
   anon key with a read-only policy.
6. **Nothing persists on the runner.** All state goes to Supabase.
7. **Budget is a constraint, not a preference.** $0 — everything runs on free tiers.
   Anything that multiplies token usage needs a stated justification, because the ceiling
   is now a rate limit rather than a bill.

---

## Conventions

- Python 3.12, stdlib + `google-genai`, `groq`, `supabase`, `httpx`, `feedparser`, `python-dotenv`
- Every source module returns the same dict shape (see `BUILDFLOW.md` Phase 1)
- Every source call is individually wrapped — one source failing must not fail the run
- Config values (`SELECT_COUNT`, weights, quotas) are module constants, not literals
- Secrets from env only. `.env` locally, repo secrets in Actions. Never committed.

## Commands

```bash
python -m agent.fetch                 # print 20 items, no LLM, no DB
python -m agent.main                  # full run
python -m agent.main --dry-run        # build the prompt, print it, don't call the API
python -m agent.select --run-id 12    # re-select an existing run without re-fetching
```

`--run-id` is the main development loop for prompt work — it avoids a fresh fetch (and a
fresh set of items) on every tweak.

## Model

Two providers, both free tier, chosen at runtime by `LLM_PROVIDER` in `.env`:

| `LLM_PROVIDER` | Model | Notes |
|---|---|---|
| `gemini` (default) | `gemini-3.8-flash` | Better judgment, large TPM headroom |
| `groq` | `openai/gpt-oss-120b` | Fast, but 6K TPM free cap ≈ one whole call |

Both must return **strict JSON matching the same schema** — Gemini via `response_schema`,
Groq via `response_format={"type": "json_object"}` plus validation. The provider is an
implementation detail behind `agent/llm/`; nothing else in the pipeline knows which one ran.

The hard task here is selection, not summarization. Judgment quality is the reason Gemini
Flash is the default and the reason Groq's speed advantage is irrelevant — this is one
batch call a day, nobody is waiting on it.

**Rule 8: the provider is swappable, the contract is not.** A new provider means a new file
in `agent/llm/` returning the same `Verdict` shape. It never means changing `select.py`,
the scoring weights, or the schema.
