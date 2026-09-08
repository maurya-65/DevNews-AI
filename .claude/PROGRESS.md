# Progress

Living document. Update at the end of each working session.

**Started:** 2026-09-08
**Current phase:** 4 — Web
**Status:** Phase 1-3 done, pipeline end-to-end chal raha hai

---

## Phase status

| Phase | What | Status |
|---|---|---|
| 0 | Setup — accounts, keys, project files | 🟡 toolchain + Supabase done; LLM keys aur schema paste baaki |
| 1 | Fetch — 3 sources → 20 headlines | ✅ done |
| 2 | Database — Supabase, store items | ✅ done |
| 3 | Selection — the one LLM call | ✅ done (placeholder profile) |
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
| 2 | ~~Sonnet, Haiku nahi~~ **(#17 se superseded)** | Asli kaam selection hai (judgment), summarization nahi. Judgment pe smart model chahiye — **ye reasoning aaj bhi valid hai**, bas ab Gemini Flash pe apply hoti hai |
| 3 | ~~Haiku bilkul nahi~~ **(#17 se superseded)** | 20 items pe compression ka volume hi nahi. Aur selection se pehle compress karna bade model se information cheen leta hai. Provider-agnostic reasoning — koi bhi chhota model add mat karo |
| 4 | Model score deta hai, code select karta hai | Model ka apna cut-off har din drift karega. "Kitne rakhne hain" deterministic rehna chahiye |
| 5 | Weights code mein, prompt mein nahi | Tuning ke liye prompt chhedna na pade |
| 6 | Summary sab 20 ka | Farak ~$0.01/day. Badle mein zero conditional logic aur reject summaries debug ke liye |
| 7 | v0 mein articles fetch nahi | POC ka kaam loop prove karna hai. Fetching cost ka 80% hai aur failure ka sabse bada source |
| 8 | Supabase, raw Postgres nahi | Frontend seedha DB padh sakta hai — koi backend banane ki zaroorat hi nahi |
| 9 | Debug page reader page se pehle | v0 mein akela user main hoon; asli sawaal "ranking sahi hai kya" hai |
| 10 | `metrics` (points/comments) model ko nahi dikhate | Pehle dekhna hai model bina uske kaisa karta hai. Warna sirf HN ranking re-rank hogi |
| 11 | 3 sources: HN + Lobsters + blogs | Teesra source aggregator nahi hona chahiye, warna teen jagah se ek hi story |
| 12 | 20 headlines, top 40% pick | POC scoping. `SELECT_COUNT` config value hai, baad mein tighten kar sakte hain |
| 13 | Default blog feed list (8 feeds) | Kisi ek ka strong opinion nahi tha; regular publishers + do low-volume writers diversity ke liye. List `HANDOFF.md` mein |
| 14 | Cron 06:30 UTC (12:00 IST) | Default hi rakha. US din poora cover ho jaata hai; free tier 15-60 min late fire karta hai, isse farak nahi padta |
| 15 | Site public | `schema-v0.sql` ki anon SELECT policies waise hi rahengi. Kuch secret hai nahi, aur private karne se Phase 4 mein server component + service key ka jhamela aata |
| 16 | Repo public | Actions minutes unlimited, aur design docs portfolio ke kaam ke hain |
| 17 | Anthropic hataya, Gemini + Groq (dono free) | Paid plan abhi nahi chahiye. v0 ka kaam loop prove karna hai, uske liye free tier kaafi hai. Bonus: Phase 6 ki prompt iteration ab bilkul free |
| 18 | Default `gemini-3.8-flash` | Groq ka free tier 6K TPM hai aur hamari ek call ~6K tokens ki hai — zero headroom. Aur Groq ka USP speed hai, jo ek-baar-roz cron ke liye bekaar hai. Judgment pe Flash behtar |
| 19 | Dono providers support, ek nahi | `agent/llm/` ke peeche abstraction. Ek free tier badla/mara to env var se switch. Aur Phase 6 mein muft A/B milta hai. Cost: ~100 extra lines |

---

## Open questions

- [ ] Interest profile ka pehla version kya likhna hai? (`prompts/select.md` mein jaayega)
      — **ye ab Phase 3 ka akela blocker hai**

---

## Blockers

_koi nahi_

---

## Session log

### 2026-09-08 — Phase 2 + 3
Schema live. `store.py`, `main.py`, `agent/llm/{base,gemini,groq}.py`, `select.py`,
`prompts/select.md` likhe. Full run: 20 fetched → 20 scored → 8 selected.

**Measured, dono providers ek hi run pe:**

| | in | out | total |
|---|---|---|---|
| gemini-3.8-flash | 2,255 | 2,039 | 4,294 |
| openai/gpt-oss-120b | 2,454 | 3,170 | **5,624 = Groq ke 6K TPM ka 94%** |

Decision 18 ka ~6K estimate lagbhag exact nikla. Groq pe headroom sach mein nahi hai.

**Ek bug mila aur fix kiya:** jis run ke saare candidates pehle se DB mein hain wo 0 rows
insert karta hai par `ok` close hota hai. Purana `latest_digest` view usi ko uthata tha
→ site khaali. `docs/schema-v0-patch1.sql` isse theek karta hai (paste karna baaki).

**Interest profile abhi bhi placeholder hai** — `prompts/select.md` mein clearly marked.

### 2026-09-08 — Phase 1
`normalize.py`, `sources/{hackernews,lobsters,blogs}.py`, `fetch.py` likhe.
Exit check pass: 20 items, teeno sources se.

Do cheezein mili:
- **Blurb 15/20 pe missing** (predict ~10 tha). HN aur Lobsters dono se zero blurbs.
  Detail HANDOFF mein. Fix nahi kiya — pehle Phase 3 ka output dekhna hai.
- **Uber ka feed mar chuka**, Meta engineering se replace kiya. Baaki 7 verified.

### 2026-09-08 — Phase 0 setup
Toolchain install: Python 3.12.10 + venv, Node 24.19.0, gh 2.100.0 (already authed).
Supabase project bana (`yhasqjlalubkvjcozszg`), dono keys `.env` mein — role claims verify
kiye, connection test pass, schema abhi paste karna baaki.

**Provider badla:** Anthropic hata ke Gemini + Groq (decisions 17-19). Paid plan abhi nahi.
`requirements.txt`, `CLAUDE.md`, `BUILDFLOW.md` update kiye. Pipeline ke chaaron core rules
provider-agnostic the, toh design mein kuch nahi toota — sirf `select.py` aur SDK badla.

### 2026-09-08 — design
Product vision, target schema, pipeline design, aur v0 build flow finalize hua.
Scope POC pe settle: 3 sources → 20 headlines → ek LLM call → 7-8 selected → web page.
Email, embeddings, threads, article fetching — sab v1.

Files: `.claude/PRODUCT_VISION.md`, `.claude/BUILDFLOW.md`, `docs/schema.sql`,
`docs/pipeline.md`

Agla kaam: Phase 0 — Supabase project + keys, phir `fetch.py`.

---

## Cost tracking

| Month | LLM | Baaki | Total |
|---|---|---|---|
| 2026-09 | $0 (free tier) | $0 | **$0** |

Target ab **$0** hai. Gemini/Groq, Supabase, Vercel, GitHub Actions — sab free tier pe.
Asli ceiling ab bill nahi, **rate limit** hai. Free tier badla to yahan note karna.
