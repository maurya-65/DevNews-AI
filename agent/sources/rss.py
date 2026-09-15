"""Hand-picked RSS and Atom feeds.

Feeds are fetched concurrently, and a dead feed costs that publisher only. Posts have no
points or comments; being on a curated list is the signal (config.SOURCE_PRIOR).
"""
from __future__ import annotations

import concurrent.futures as futures
import sys
from datetime import datetime, timedelta, timezone

import feedparser

from agent import config, net
from agent.models import Candidate
from agent.normalize import clean_text, to_utc_iso


def _fetch_feed(source_id: str, feed_url: str, per_feed: int, cutoff: str) -> list[Candidate]:
    response = net.get(feed_url, retries=1, timeout=15.0)
    parsed = feedparser.parse(response.content)

    out: list[Candidate] = []
    for entry in parsed.entries:
        published = to_utc_iso(entry.get("published_parsed") or entry.get("updated_parsed"))
        # An undated post is let through: some feeds omit dates entirely, and the 30-day
        # article table catches anything seen before.
        if published and published < cutoff:
            continue
        link = entry.get("link")
        title = clean_text(entry.get("title"), 300)
        if not link or not title:
            continue
        out.append(Candidate(
            source=source_id,
            external_id=str(entry.get("id") or link),
            url=link,
            title=title,
            description=clean_text(entry.get("summary"), config.DESCRIPTION_CHARS),
            published_at=published,
        ))
        if len(out) >= per_feed:
            break
    return out


def fetch(source_id: str, cfg: dict, quota: int) -> list[Candidate]:
    feeds = list(cfg.get("feeds") or [])
    per_feed = int(cfg.get("per_feed", 2))
    max_age = int(cfg.get("max_age_days", 4))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age)).isoformat()

    collected: list[Candidate] = []
    failed = 0
    with futures.ThreadPoolExecutor(max_workers=min(8, max(1, len(feeds)))) as pool:
        pending = {pool.submit(_fetch_feed, source_id, url, per_feed, cutoff): url for url in feeds}
        for future in futures.as_completed(pending):
            try:
                collected.extend(future.result())
            except Exception as exc:
                failed += 1
                print(f"    feed failed: {pending[future]} ({type(exc).__name__})", file=sys.stderr)

    if feeds and failed == len(feeds):
        raise RuntimeError(f"all {failed} feeds failed")

    # Newest first; undated posts sort last. ISO UTC strings sort chronologically.
    collected.sort(key=lambda c: c.published_at or "", reverse=True)
    return collected[:quota]
