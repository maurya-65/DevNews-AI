"""Engineering blog RSS/Atom feeds.

Feeds are fetched concurrently and one dead feed never sinks the rest. Blog posts have no
points or comments — that asymmetry is fine, the model isn't shown metrics anyway
(PROGRESS decision 10).
"""
from __future__ import annotations

import concurrent.futures as futures

import feedparser
import httpx

from agent.normalize import make_item

# All verified live 2026-09-08. Uber's engineering feed was in the original design list
# but 404s now — replaced with Meta's, the closest equivalent.
#
# The list deliberately mixes two kinds of publisher. Hyperscaler postmortems are the
# deepest material available, but they are written for people who already run systems at
# that scale — on their own they leave a reader who is still building up with nothing to
# read. The second group explains rather than reports, which is what makes an accessible
# day possible at all. Scoring still decides; this only ensures both kinds reach it.
FEEDS = [
    # Depth — hyperscaler engineering
    "https://blog.cloudflare.com/rss/",
    "https://netflixtechblog.com/feed",
    "https://stripe.com/blog/feed.rss",
    "https://engineering.fb.com/feed/",
    "https://research.google/blog/rss/",
    "https://fly.io/blog/feed.xml",
    # Explainers — accessible without being shallow
    "https://blog.bytebytego.com/feed",          # system design, drawn out step by step
    "https://simonwillison.net/atom/everything/", # new tech explained as it lands
    "https://huggingface.co/blog/feed.xml",       # ML, usually with runnable code
    "https://stackoverflow.blog/feed/",
    # Individual writers — long-form, opinionated, low volume
    "https://jvns.ca/atom.xml",
    "https://danluu.com/atom.xml",
]

LIMIT = 5
PER_FEED = 2          # cap before merging, so one prolific feed can't take the whole quota
TIMEOUT = 20.0
UA = {"User-Agent": "DevNews-AI/0.1 (+https://github.com/maurya-65/DevNews-AI)"}


def _fetch_one(feed_url: str) -> list[dict]:
    r = httpx.get(feed_url, headers=UA, timeout=TIMEOUT, follow_redirects=True)
    r.raise_for_status()
    parsed = feedparser.parse(r.content)

    items = []
    for entry in parsed.entries[:PER_FEED]:
        item = make_item(
            source="blog",
            # Feeds without a guid fall back to the link, which is stable enough.
            external_id=entry.get("id") or entry.get("link", ""),
            url=entry.get("link"),
            title=entry.get("title"),
            blurb=entry.get("summary"),
            published_at=entry.get("published_parsed") or entry.get("updated_parsed"),
        )
        if item:
            items.append(item)
    return items


def fetch(limit: int = LIMIT) -> list[dict]:
    """Newest-first across all feeds, capped at `limit`.

    Individual feed failures are swallowed here rather than in fetch.py: one 404 should
    cost us that publisher, not the whole blog source.
    """
    collected: list[dict] = []
    with futures.ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        pending = {pool.submit(_fetch_one, url): url for url in FEEDS}
        for future in futures.as_completed(pending):
            try:
                collected.extend(future.result())
            except Exception as exc:
                print(f"  ! blog feed failed: {pending[future]} — "
                      f"{type(exc).__name__}: {exc}")

    # published_at is an ISO string in UTC, so lexical sort is chronological.
    collected.sort(key=lambda i: i["published_at"] or "", reverse=True)
    return collected[:limit]
