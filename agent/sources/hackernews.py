"""Hacker News front page, via the Algolia API."""
from __future__ import annotations

from agent import config, net
from agent.models import Candidate
from agent.normalize import clean_text, to_utc_iso

API = "https://hn.algolia.com/api/v1/search"


def fetch(source_id: str, cfg: dict, quota: int) -> list[Candidate]:
    min_points = int(cfg.get("min_points", 20))
    response = net.get(API, params={"tags": "front_page", "hitsPerPage": max(quota * 2, 30)})

    out: list[Candidate] = []
    for rank, hit in enumerate(response.json().get("hits", []), 1):
        points = hit.get("points") or 0
        title = clean_text(hit.get("title"), 300)
        if points < min_points or not title:
            continue
        object_id = str(hit["objectID"])
        discussion = f"https://news.ycombinator.com/item?id={object_id}"
        tags = hit.get("_tags") or []
        out.append(Candidate(
            source=source_id,
            external_id=object_id,
            # Ask HN and text posts have no external link; the thread is the story.
            url=hit.get("url") or discussion,
            title=title,
            discussion_url=discussion,
            description=clean_text(hit.get("story_text"), config.DESCRIPTION_CHARS),
            points=points,
            comments=hit.get("num_comments"),
            source_rank=rank,
            published_at=to_utc_iso(hit.get("created_at")),
            tags=[t for t in ("show_hn", "ask_hn") if t in tags],
        ))
        if len(out) >= quota:
            break
    return out
