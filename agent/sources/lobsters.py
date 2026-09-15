"""Lobsters hottest. Smaller and more technical than HN, and it tags every story."""
from __future__ import annotations

from agent import config, net
from agent.models import Candidate
from agent.normalize import clean_text, to_utc_iso

API = "https://lobste.rs/hottest.json"


def fetch(source_id: str, cfg: dict, quota: int) -> list[Candidate]:
    min_score = int(cfg.get("min_score", 5))
    response = net.get(API)

    out: list[Candidate] = []
    for rank, story in enumerate(response.json(), 1):
        score = story.get("score") or 0
        title = clean_text(story.get("title"), 300)
        if score < min_score or not title:
            continue
        discussion = story.get("comments_url") or story.get("short_id_url")
        out.append(Candidate(
            source=source_id,
            external_id=str(story["short_id"]),
            url=story.get("url") or discussion,
            title=title,
            discussion_url=discussion,
            description=clean_text(story.get("description_plain")
                                   or story.get("description"), config.DESCRIPTION_CHARS),
            points=score,
            comments=story.get("comment_count"),
            source_rank=rank,
            published_at=to_utc_iso(story.get("created_at")),
            tags=list(story.get("tags") or []),
        ))
        if len(out) >= quota:
            break
    return out
