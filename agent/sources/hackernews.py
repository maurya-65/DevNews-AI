"""Hacker News front page via the Algolia API.

Algolia gives title + url + points + comments but **no blurb** — see HANDOFF.md, this is
v0's biggest known risk for selection quality. Observe it, don't fix it yet.
"""
from __future__ import annotations

import httpx

from agent.normalize import make_item

API = "https://hn.algolia.com/api/v1/search"
LIMIT = 10
TIMEOUT = 20.0
UA = {"User-Agent": "DevNews-AI/0.1 (+https://github.com/maurya-65/DevNews-AI)"}


def fetch(limit: int = LIMIT) -> list[dict]:
    r = httpx.get(API, params={"tags": "front_page", "hitsPerPage": limit * 2},
                  headers=UA, timeout=TIMEOUT)
    r.raise_for_status()

    items = []
    for hit in r.json().get("hits", []):
        # Ask HN / Show HN text posts carry no external url; the discussion is the story.
        url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}"
        item = make_item(
            source="hn",
            external_id=hit["objectID"],
            url=url,
            title=hit.get("title"),
            blurb=hit.get("story_text"),
            points=hit.get("points"),
            comments=hit.get("num_comments"),
            published_at=hit.get("created_at"),
        )
        if item:
            items.append(item)
        if len(items) >= limit:
            break
    return items
