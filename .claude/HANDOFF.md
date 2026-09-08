# Handoff

**Last updated:** 2026-09-08
**State:** Phase 0 chal raha hai — toolchain + Supabase ready, LLM keys baaki. Zero code.
**Next action:** Phase 1 (`fetch.py`) — isko kisi key ki zaroorat nahi, abhi shuru ho sakta hai

---

## Where things stand

Poori design ho chuki hai aur `.claude/` + `docs/` mein likhi hui hai. Toolchain aur
dependencies install ho chuke hain, Supabase project bhi bana hai — par **pipeline ka
abhi tak ek line code nahi likha gaya.**

Kaafi design iterations ke baad scope jaan-boojhkar chhota rakha gaya hai. Pehle bade
versions soche gaye the (embeddings, story threads, email feedback loop, article fetching,
two-model pipeline) — sab v1 mein daal diye. **v0 ka ek hi kaam hai: loop end-to-end chala ke
dikhana.**

---

## v0 — exactly this, nothing more

```
3 sources → 20 headlines → ONE LLM call → 7-8 selected → web page
```

Provider free tier pe hai aur swappable: `LLM_PROVIDER=gemini|groq`. Default
`gemini-3.8-flash`. Poori reasoning PROGRESS decisions 17-19 mein.

Nahi hai v0 mein: email, embeddings, threads, article fetching, click tracking,
profile learning, do-model pipeline.

**Done ka matlab:** roz subah bina kuch chhue ek public URL pe 7-8 CS headlines dikhein,
score + reason + summary ke saath. Cost $0 — sab free tier pe.

---

## Next session mein kya karna hai

**1. Phase 0** — ✅ files aur toolchain ho gaye. Baaki: user ko `docs/schema-v0.sql`
Supabase SQL editor mein paste karna hai, aur Gemini/Groq keys `.env` mein daalni hain.

**2. Phase 1** — `fetch.py` + teen source modules. Koi LLM nahi, koi DB nahi.
Exit: `python -m agent.fetch` 20 asli items print kare.

Phase 1 ke baad **rukna aur output dekhna** — sources ki quality wahin dikhegi, aur uspe
baaki sab depend karta hai.

Poora detail `BUILDFLOW.md` mein hai. Reasoning `PROGRESS.md` ke decisions log mein.

---

## Mujhe user se ye chahiye (blocking)

| # | Kya | Status |
|---|---|---|
| 1 | **Interest profile** | ⏸️ **defer kiya (2026-09-08).** User ne kaha baad mein dekhenge. Placeholder `prompts/select.md` mein chal raha hai aur kaam kar raha hai. Isse abstract sawaal poochne se kuch nahi nikla — **asli digest dikha ke poochna**: "ye item kyun aaya / ye kyun nahi aaya". Wahan se profile likhna aasan hoga |
| 2 | Supabase project | ✅ ho gaya, keys `.env` mein, connection verified |
| 3 | LLM API key | ⬜ Gemini + Groq, dono free. Anthropic drop ho gaya |
| 4 | Schema paste (`docs/schema-v0.sql`) | ⬜ Supabase SQL editor mein, ek baar |
| 5 | Cron time | ✅ 06:30 UTC = 12:00 IST |
| 6 | Site public ya private | ✅ public — anon RLS policies waise hi rahengi |

**Keys chat mein kabhi paste mat karna.** Woh `.env` (local) aur GitHub repo secrets mein
jaati hain. Mujhe sirf ye batana ki bana li hain.

### Decided — blog feeds (default list)

`blogs.py` mein ye jaayengi:

```python
FEEDS = [
    "https://blog.cloudflare.com/rss/",
    "https://netflixtechblog.com/feed",
    "https://stripe.com/blog/feed.rss",
    "https://www.uber.com/blog/engineering/rss/",
    "https://research.google/blog/rss/",
    "https://fly.io/blog/feed.xml",
    "https://jvns.ca/atom.xml",
    "https://danluu.com/atom.xml",
]
```

Do baatein Phase 1 mein dekhni hain:
- **URLs verify karo.** Feed URLs badalte rehte hain — jo 404 de, use nikaal do ya theek karo.
  Ek chhota script sab feeds hit karke status print kar de, yehi Phase 1 ka pehla check hai.
- **jvns aur danluu low-volume hain** — hafton mein ek post. Diversity ke liye ache hain, par
  blogs ka 5-item quota zyadatar Cloudflare/Netflix/Fly jaise regular publishers se bharega.

---

## Kya na karna (already decided)

Ye sab discuss ho chuka hai aur reject hua hai. Dobara propose karne se pehle
`PROGRESS.md` ka decisions log padhna.

- **Chhota model add karke do-step banana** — 20 items pe compression ka volume nahi, aur
  selection se pehle compress karna bade model se information cheen leta hai
- **Do LLM calls** — v0 mein articles fetch nahi ho rahe, doosre turn ko naya kuch milega hi nahi
- **Model se "top 8 chuno" bolna** — uska cut-off har din drift karega; ranking code ka kaam hai
- **Ek provider pe settle karna** — dono free hain, abstraction likha ja chuka hai
- **v0 mein embeddings/threads** — 20 items pe URL dedupe kaafi hai
- **Reader UI pehle banana** — debug page (rejects ke saath) zyada zaroori hai
- **Model ko `points`/`comments` dikhana** — pehle dekhna hai bina uske kaisa select karta hai

---

## Phase 1 ka result — measured 2026-09-08

**Blurb missing: 15/20.** HANDOFF ne ~10/20 predict kiya tha; asliyat usse kharab hai.

| Source | Items | Blurb hai |
|---|---|---|
| hn | 10 | 0 — Algolia `story_text` sirf Ask/Show HN pe aata hai |
| lobsters | 5 | 0 — `description_plain` in stories pe khaali tha |
| blog | 5 | 5 |

Matlab **15 items sirf title pe judge honge.** Ye v0 ka sabse bada known risk hai.
Blog blurbs bhi hamesha kaam ke nahi — Google research feed "General Science" bhejta hai,
jo category hai, summary nahi.

**Abhi fix mat karna.** Pehle Phase 3 chala ke dekho selection kaisi aati hai. Agar kharab
lage to options: meta description scrape, ya HN quota ghatao, ya Lobsters `description`
(HTML wala) use karo `description_plain` ki jagah.

### Feed list badla
Uber engineering feed **mar chuka hai** (404 browser UA pe, 406 bot UA pe). Meta
(`engineering.fb.com/feed/`) se replace kiya. Baaki 7 feeds zinda, verified 2026-09-08.

Cloudflare ne 5 blog slots mein se 2 le liye — `PER_FEED=3` cap laga hai, par merge
recency pe hota hai toh high-volume feeds aage rehte hain. v0 ke liye acceptable.
