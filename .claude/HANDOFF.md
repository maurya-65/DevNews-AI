# Handoff

**Last updated:** 2026-09-08
**State:** design complete, zero code written
**Next action:** Phase 0 (setup), then Phase 1 (`fetch.py`)

---

## Where things stand

Poori design ho chuki hai aur `.claude/` + `docs/` mein likhi hui hai. Repo mein abhi
sirf documentation hai — koi code nahi, koi dependency nahi, Supabase project bhi nahi bana.

Kaafi design iterations ke baad scope jaan-boojhkar chhota rakha gaya hai. Pehle bade
versions soche gaye the (embeddings, story threads, email feedback loop, article fetching,
two-model pipeline) — sab v1 mein daal diye. **v0 ka ek hi kaam hai: loop end-to-end chala ke
dikhana.**

---

## v0 — exactly this, nothing more

```
3 sources → 20 headlines → ONE Sonnet call → 7-8 selected → web page
```

Nahi hai v0 mein: email, embeddings, threads, article fetching, click tracking,
profile learning, Haiku.

**Done ka matlab:** roz subah bina kuch chhue ek public URL pe 7-8 CS headlines dikhein,
score + reason + summary ke saath. Cost < $2/month.

---

## Next session mein kya karna hai

**1. Phase 0** — `.gitignore`, `requirements.txt`, `.env.example`, package `__init__.py`s
banao. Supabase project bana ke `docs/schema-v0.sql` paste karo.

**2. Phase 1** — `fetch.py` + teen source modules. Koi LLM nahi, koi DB nahi.
Exit: `python -m agent.fetch` 20 asli items print kare.

Phase 1 ke baad **rukna aur output dekhna** — sources ki quality wahin dikhegi, aur uspe
baaki sab depend karta hai.

Poora detail `BUILDFLOW.md` mein hai. Reasoning `PROGRESS.md` ke decisions log mein.

---

## Mujhe user se ye chahiye (blocking)

| # | Kya | Kyun blocking hai |
|---|---|---|
| 1 | **Interest profile** — tumhe actually kya padhna pasand hai? Languages, topics, kya boring lagta hai | Ye `prompts/select.md` ka dil hai. Iske bina selection generic "popular tech news" ban jaayegi |
| 2 | **Supabase project bana?** Sirf URL batana | Phase 2 blocked hai iske bina |
| 3 | **Anthropic account mein credit hai?** | Phase 3 blocked |
| 4 | **Cron time** — 06:30 UTC = 12:00 IST. Theek hai? | Workflow file mein jaayega |
| 5 | **Site public ya private?** | RLS policy isse decide hogi |

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

**Keys chat mein kabhi paste mat karna.** Woh `.env` (local) aur GitHub repo secrets mein
jaati hain. Mujhe sirf ye batana ki bana li hain.

---

## Kya na karna (already decided)

Ye sab discuss ho chuka hai aur reject hua hai. Dobara propose karne se pehle
`PROGRESS.md` ka decisions log padhna.

- **Haiku add karna** — 20 items pe compression ka volume nahi, aur selection se pehle
  compress karna Sonnet se information cheen leta hai
- **Do LLM calls** — v0 mein articles fetch nahi ho rahe, doosre turn ko naya kuch milega hi nahi
- **Model se "top 8 chuno" bolna** — uska cut-off har din drift karega; ranking code ka kaam hai
- **v0 mein embeddings/threads** — 20 items pe URL dedupe kaafi hai
- **Reader UI pehle banana** — debug page (rejects ke saath) zyada zaroori hai
- **Model ko `points`/`comments` dikhana** — pehle dekhna hai bina uske kaisa select karta hai

---

## Phase 1 ke baad sabse pehle ye dekhna

**Kitne items ka `blurb` null hai.** HN Algolia title + URL deta hai, blurb nahi — matlab
~10 of 20 items sirf title pe judge honge.

Agar zyadatar null nikle, to Phase 3 mein selection quality kamzor lag sakti hai. Ye v0 ka
sabse bada known risk hai. **Abhi fix mat karna** — pehle observe karo, phir decide karo
(meta description scrape karni hai ya HN source ko chhota karna hai).
