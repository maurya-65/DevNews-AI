# DevNews

A daily computer-science briefing, personalised per reader, on free tiers. A GitHub
Actions cron runs the pipeline in `agent/`; it writes to Supabase; a Next.js site in `web/`
reads Supabase through each visitor's session. The two never talk to each other.

Start with `README.md` (what and how to run) and `docs/ARCHITECTURE.md` (stages, data
model, ranking formula, routes). `.claude/PROGRESS.md` holds the decisions log with the
reasoning — check it before proposing an "obvious improvement".

---

## Rules that must not be broken

1. **Understand once, rank per reader.** The model analyzes each article once, for
   everyone. Nothing may call a model per user. If a per-user call seems necessary, the
   design has changed — say so instead of adding it.
2. **The model describes; code decides.** The model returns scores and prose. Ranking,
   cut-offs, diversity caps and ordering happen in `agent/rank.py`.
3. **Numbers live in `agent/config.py`, never in a prompt.** Tuning never means editing prose.
4. **Keep the near-misses.** Every candidate ranked for a reader is stored with its score
   components. The lab page depends on it.
5. **`SUPABASE_SERVICE_KEY` never reaches the browser.** The site reads through the session
   client so RLS applies. The only server code that uses the service key is the private
   feed route, via `web/src/lib/supabase-admin.ts` (`server-only`).
6. **Nothing persists on the Actions runner.** All state goes through `agent/store/`.
7. **$0 is a constraint.** Anything that multiplies model calls or tokens needs a stated
   justification; the ceiling is a free-tier rate limit.
8. **The provider is swappable; the contract is not.** A new provider is a file in
   `agent/llm/` returning a `Completion`. `analyze.validate` stays the gate for model output.
9. **The taxonomy has one home: `web/src/lib/taxonomy.json`.** Both halves read it. Ids are
   stored in the database — add, never rename.
10. **Migrations are additive and re-runnable.** Never drop or rewrite data in a migration
    without saying so explicitly.

## Conventions

- Python 3.12; dependencies in `requirements.txt` only. Pure logic (`rank`, `taste`,
  `threads`, `prefilter`, `analyze.validate`) stays free of I/O and has tests.
- Every source fetcher has the signature `fetch(source_id, config, quota)` and raises on
  failure; the pipeline isolates it.
- Web: Next.js 16 — read `web/node_modules/next/dist/docs/` before using an API from
  memory. Server components read via `store()`; mutations are server actions in
  `web/src/app/actions.ts` and `web/src/app/settings/save.ts`, each re-checking the session.
- Text in the server HTML must be visible without JavaScript (see `page-header.tsx` and
  the landing page's `<noscript>` fallback).
- Secrets from env only: `.env` for the pipeline, `web/.env.local` for the site.

## Commands

```bash
python -m agent check          # environment + schema
python -m agent sources        # fetch only, print
python -m agent run            # daily run against Supabase
python -m agent run --store memory --memory-file web/fixtures/state.json   # full dry run
python -m agent editions       # re-rank from stored analyses, no model calls
python -m agent prompt         # analysis prompt and schema
python -m pytest               # tests

cd web && npm run dev                      # site against Supabase
cd web && DEVNEWS_FIXTURES=1 npm run dev   # site against the dry-run file, no login
cd web && npm run lint && npx tsc --noEmit && npm run build
```

## Models

`LLM_PROVIDER=gemini` (default, `gemini-3.8-flash`) with automatic fallback to Groq
(`openai/gpt-oss-120b`). Both return JSON validated by `agent/analyze.py`. Overload errors
go straight to the fallback; see `agent/llm/router.py`.
