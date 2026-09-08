"""Lobsters hottest. Smaller and more technical than HN, with real blurbs on some posts."""
from __future__ import annotations

import httpx

from agent.normalize import make_item

API = "https://lobste.rs/hottest.json"
LIMIT = 5
TIMEOUT = 20.0
UA = {"User-Agent": "DevNews-AI/0.1 (+https://github.com/maurya-65/DevNews-AI)"}


def fetch(limit: int = LIMIT) -> list[dict]:
    r = httpx.get(API, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()

    items = []
    for story in r.json():
        item = make_item(
            source="lobsters",
            external_id=story["short_id"],
            # Text-only submissions have an empty url; fall back to the discussion.
            url=story.get("url") or story.get("comments_url"),
            title=story.get("title"),
            blurb=story.get("description_plain"),
            points=story.get("score"),
            comments=story.get("comment_count"),
            published_at=story.get("created_at"),
        )
        if item:
            items.append(item)
        if len(items) >= limit:
            break
    return items
