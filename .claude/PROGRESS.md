# Progress

Living document. Update at the end of each working session.

**Started:** 2026-09-08
**Current phase:** 0 — Setup
**Status:** design done, nothing built yet

---

## Phase status

| Phase | What | Status |
|---|---|---|
| 0 | Setup — accounts, keys, project files | ⬜ not started |
| 1 | Fetch — 3 sources → 20 headlines | ⬜ not started |
| 2 | Database — Supabase, store items | ⬜ not started |
| 3 | Selection — the one Sonnet call | ⬜ not started |
| 4 | Web — feed + debug page on Vercel | ⬜ not started |
| 5 | Automation — Actions cron | ⬜ not started |
| 6 | Tighten — prompt + weights | ⬜ not started |

`⬜ not started` · `🟡 in progress` · `✅ done` · `🔴 blocked`

---

## Definition of done — v0

Roz subah, bina kuch chhue, ek public URL pe 7-8 CS headlines dikhein jinke saath
score, reason aur summary ho. Cost $2/month se kam.

---

## Decisions log

Kya decide kiya aur **kyun** — taaki baad mein dobara na sochna pade.

| # | Decision | Reasoning |
|---|---|---|
| 1 | Ek LLM call, do nahi | v0 mein articles fetch nahi kar rahe, toh doosre turn ko naya kuch milega hi nahi |
| 2 | Sonnet, Haiku nahi | Asli kaam selection hai (judgment), summarization nahi. Judgment pe smart model chahiye |
| 3 | Haiku bilkul nahi | 20 items pe compression ka volume hi nahi. Aur selection se pehle compress karna Sonnet se information cheen leta hai |
| 4 | Model score deta hai, code select karta hai | Model ka apna cut-off har din drift karega. "Kitne rakhne hain" deterministic rehna chahiye |
| 5 | Weights code mein, prompt mein nahi | Tuning ke liye prompt chhedna na pade |
| 6 | Summary sab 20 ka | Farak ~$0.01/day. Badle mein zero conditional logic aur reject summaries debug ke liye |
| 7 | v0 mein articles fetch nahi | POC ka kaam loop prove karna hai. Fetching cost ka 80% hai aur failure ka sabse bada source |
| 8 | Supabase, raw Postgres nahi | Frontend seedha DB padh sakta hai — koi backend banane ki zaroorat hi nahi |
| 9 | Debug page reader page se pehle | v0 mein akela user main hoon; asli sawaal "ranking sahi hai kya" hai |
| 10 | `metrics` (points/comments) model ko nahi dikhate | Pehle dekhna hai Sonnet bina uske kaisa karta hai. Warna sirf HN ranking re-rank hogi |
| 11 | 3 sources: HN + Lobsters + blogs | Teesra source aggregator nahi hona chahiye, warna teen jagah se ek hi story |
| 12 | 20 headlines, top 40% pick | POC scoping. `SELECT_COUNT` config value hai, baad mein tighten kar sakte hain |
| 13 | Default blog feed list (8 feeds) | Kisi ek ka strong opinion nahi tha; regular publishers + do low-volume writers diversity ke liye. List `HANDOFF.md` mein |

---

## Open questions

- [ ] Site public rahegi ya Vercel password ke peeche?
- [ ] Interest profile ka pehla version kya likhna hai? (`prompts/select.md` mein jaayega)
- [ ] Cron time — 06:30 UTC theek hai ya IST ke hisaab se badalna hai?

---

## Blockers

_koi nahi_

---

## Session log

### 2026-09-08 — design
Product vision, target schema, pipeline design, aur v0 build flow finalize hua.
Scope POC pe settle: 3 sources → 20 headlines → ek Sonnet call → 7-8 selected → web page.
Email, embeddings, threads, article fetching — sab v1.

Files: `.claude/PRODUCT_VISION.md`, `.claude/BUILDFLOW.md`, `docs/schema.sql`,
`docs/pipeline.md`

Agla kaam: Phase 0 — Supabase project + keys, phir `fetch.py`.

---

## Cost tracking

| Month | Anthropic | Baaki | Total |
|---|---|---|---|
| 2026-09 | — | $0 | — |

Target: **< $5 CAD/month.** Supabase, Vercel, GitHub Actions sab free tier pe.
