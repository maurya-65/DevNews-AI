# Build Flow — v0

Six phases. Each one ends in something you can look at and verify. Nothing in a phase
depends on anything from a later phase.

**v0 scope:** 3 sources → 20 headlines → one Sonnet call → 7-8 selected → web page.
No email, no embeddings, no threads, no article fetching. Those are v1.

---

## Phase 0 — Setup

**Goal:** every account, key and file exists before a line of logic is written.

**Tasks**
- [ ] Supabase project banao (free tier). `SUPABASE_URL` + `service_role` key note karo.
- [ ] Anthropic API key + ~$10 credit.
- [ ] `requirements.txt` — `anthropic`, `supabase`, `httpx`, `feedparser`, `python-dotenv`
- [ ] `.gitignore` — `.env`, `__pycache__/`, `node_modules/`, `.next/`, `*.pyc`
- [ ] `.env.example` (committed) + `.env` (gitignored)
- [ ] `agent/__init__.py`, `agent/sources/__init__.py`

**Exit:** `python -c "import anthropic, supabase, feedparser"` chalta hai.

**Gotcha:** service_role key RLS bypass karti hai. Woh sirf `.env` aur GitHub secrets mein
rahegi — kabhi frontend mein nahi, kabhi commit mein nahi.

---

## Phase 1 — Fetch (no LLM, no DB)

**Goal:** 20 asli headlines terminal pe dikhein.

**Tasks**
- [ ] `agent/sources/hackernews.py` → `hn.algolia.com/api/v1/search?tags=front_page`, top 10
- [ ] `agent/sources/lobsters.py` → `lobste.rs/hottest.json`, top 5
- [ ] `agent/sources/blogs.py` → ~8 RSS feeds via feedparser, top 5
- [ ] `agent/normalize.py` → URL canonicalize (utm/tracking params strip, fragment drop)
- [ ] `agent/fetch.py` → teeno call karo, dedupe, 20 tak trim, JSON print

**Har source ka contract** — same shape return kare:
```python
{"source": "hn", "external_id": "38472", "url": "...", "title": "...",
 "blurb": "...", "points": 412, "comments": 88, "published_at": "..."}
```

**Exit:** `python -m agent.fetch` 20 items print karta hai, sab teeno sources se.

**Gotchas**
- **Har source try/except mein wrap karo, day 1 se.** Ek source down hone se poora run nahi
  girna chahiye — usse skip karke baaki se chalo.
- Blogs ki feed list `blogs.py` mein ek plain Python list rakho. YAML/config baad mein.
- 20 se kam mile to theek hai — fail mat karo, jitne mile utne se chalo.

---

## Phase 2 — Database

**Goal:** wahi 20 items Supabase mein dikhein.

**Tasks**
- [ ] `docs/schema-v0.sql` Supabase SQL editor mein paste karo (`runs` + `items`)
- [ ] `agent/store.py` — `create_run()`, `insert_items()`, `close_run()`
- [ ] `agent/main.py` — fetch → store orchestrate karo

**Order matters:** `runs` row pehle banti hai (items ki FK usi pe hai), phir items, phir
run close.

**Exit:** script chalao, Supabase table editor mein 20 rows dikhein.

**Gotchas**
- **Insert `ON CONFLICT (source, external_id) DO NOTHING` hona chahiye.** Supabase mein:
  `.upsert(rows, on_conflict="source,external_id", ignore_duplicates=True)`.
- Isse ek free property milti hai: **kal ki repeat story apne aap skip ho jaati hai.** Purani
  row ka `run_id` purana hai, aur candidates hamesha `WHERE run_id = <current>` se aate hain.
  Isliye candidate list build karte waqt hamesha DB se padho, fetch ke output se nahi.
- Ek din mein do baar chalane pe do `runs` rows banengi. v0 mein acceptable.

---

## Phase 3 — Selection (the one LLM call)

**Goal:** 20 items pe scores, 7-8 selected, sab DB mein.

**Tasks**
- [ ] `agent/prompts/select.md` — system prompt: role, criteria (novel/consequential/depth),
      output contract, aur **interest profile hardcoded** (v0 mein DB se nahi aa raha)
- [ ] `agent/select.py`
      - candidates DB se padho (`run_id = current`)
      - user block banao
      - `claude-sonnet-5`, `thinking={"type":"adaptive"}`, `output_config` strict schema
      - response parse + validate
- [ ] Code mein scoring: `final = 0.4*novel + 0.4*consequential + 0.2*depth`
- [ ] Sort → top `SELECT_COUNT` (default 8) → `selected=true`
- [ ] `store.update_verdicts()` — pehle is run ke sab items pe `selected=false` reset karo,
      phir naye verdicts likho (warna dobara chalane pe selections jud jaayenge)
- [ ] `response.usage` se cost nikaal ke `runs.cost_usd` mein likho (v0 mein `llm_calls`
      table nahi hai — per-run spend kaafi hai)

**Do flags jo ab hi banane hain:**
- `--dry-run` → API call ke bina prompt print karo. Prompt likhte waqt token bachaata hai.
- `--run-id N` → purane run ke items pe dobara select chalao, bina naya fetch kiye.
  **Iske bina har prompt tweak ek naya fetch maangega.** Yeh sabse zyada use hone wala flag hoga.

**Exit:** DB mein sab 20 pe `score` + `reason`, 8 pe `selected=true` aur `summary`.

**Gotchas**
- **Validate karo ki sab 20 ids wapas aayi hain.** Kam aayen to ek baar retry, phir run
  `partial` mark karke jitne aaye unse chalo.
- `response.stop_reason` check karo. `max_tokens` hua to JSON adhoora hai — `max_tokens`
  badhao (8000 se shuru).
- Summary sab 20 ka lo, sirf selected ka nahi. Farak ~$0.01/day hai, aur reject summaries
  debug page pe kaam aate hain.
- Weights code mein hain, prompt mein nahi — tuning ke liye prompt mat chhedo.

---

## Phase 4 — Web

**Goal:** ek public URL jahan aaj ke items dikhein.

**Tasks**
- [ ] `web/` — Next.js app
- [ ] Supabase RLS: `items` aur `runs` pe enable karo, phir anon role ko read policy do
- [ ] `web/lib/supabase.ts` — **anon key** (`NEXT_PUBLIC_*`), service key nahi
- [ ] `/` — feed page: selected items, date ke hisaab se
- [ ] `/debug` — **sab 20** items with score + reason, rejects included
- [ ] Vercel pe deploy, env vars set

**Debug page pehle banao.** v0 mein tum akele user ho aur tumhara asli sawaal
"ranking sane hai kya?" hai, "news padhni hai" nahi. Rejects wala view sabse valuable hai.

**Exit:** phone se URL khulti hai, aaj ke items dikhte hain.

**Gotchas**
- **RLS deploy se pehle enable karo.** Bina RLS ke anon key poora table padh sakti hai.
- Empty state handle karo — abhi tak koi run nahi hua to page crash nahi hona chahiye.
- Rebuild trigger ki zaroorat nahi. Site request pe Supabase se live padhti hai.

---

## Phase 5 — Automation

**Goal:** bina kuch kiye roz chale.

**Tasks**
- [ ] `.github/workflows/daily.yml` — cron `30 6 * * *` + `workflow_dispatch`
- [ ] Repo secrets: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] **Pehle manual dispatch se test karo**, cron ka intezaar mat karo
- [ ] Ek cron run apne aap hone do, phir verify karo

**Exit:** subah uthke site pe naya data mile, bina kuch chhue.

**Gotchas**
- Runner ephemeral hai — koi file, koi `/tmp` survive nahi karta. Sab Supabase mein.
- Cron free tier pe 15-60 min late fire karta hai. Normal hai.
- Workflow fail hone pe GitHub apne aap email karta hai. v0 ke liye yahi alerting kaafi hai.
- Public repo = unlimited minutes.

---

## Phase 6 — Tighten (optional, v0 ke baad)

- [ ] Prompt iterate karo `--run-id` se, ek hi item set pe versions compare karke
- [ ] Weights tune karo
- [ ] Feed list expand karo
- [ ] `README.md` — architecture diagram + kya seekha

---

## v1 mein kya aayega

Article fetching (aur uske saath doosra turn) · embeddings + similarity dedup · threads ·
email digest + tracked click links · click-based profile learning · `precision@k` metric ·
cost circuit breaker

Poora target schema `docs/schema.sql` mein hai; `docs/pipeline.md` mein woh design hai jiski
taraf ja rahe hain.

---

## v0 ke jaan-boojhkar liye gaye shortcuts

Ye gaps nahi hain — ye decisions hain, taaki baad mein "kaise chhoot gaya" na lage.

| Chhoda | Kyun | Wapas kab |
|---|---|---|
| Interest profile prompt mein hardcoded | Ek user, ek profile — table overkill hai | v1, jab feedback loop aayega |
| Similarity dedup nahi | 20 items pe URL match kaafi hai | v1, embeddings ke saath |
| Timezone/day_bucket nahi | `ran_at` se UI group kar lega | v1, jab archive bada ho |
| Ek din do runs = do rows | POC mein nuksan nahi | v1, `UNIQUE(day_bucket)` se |
| Email nahi | UI hi v0 ka endpoint hai | v1 |
| Retry/backoff nahi | Fail hua to kal chal jaayega | Jab reliability matter kare |
