"""New GitHub projects that took off this week.

GitHub has no trending API and the trending page is scraped HTML that changes shape. The
search API answers the same question — what was created recently and is being starred
fast — and returns real star counts to use as signal.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from agent import config, net
from agent.models import Candidate
from agent.normalize import clean_text, to_utc_iso

API = "https://api.github.com/search/repositories"


def fetch(source_id: str, cfg: dict, quota: int) -> list[Candidate]:
    window = int(cfg.get("window_days", 7))
    min_stars = int(cfg.get("min_stars", 150))
    since = (datetime.now(timezone.utc) - timedelta(days=window)).date().isoformat()

    response = net.get(API, headers=net.github_headers(), params={
        "q": f"created:>={since} stars:>={min_stars}",
        "sort": "stars",
        "order": "desc",
        "per_page": min(max(quota * 2, 10), 50),
    })

    out: list[Candidate] = []
    for rank, repo in enumerate(response.json().get("items", []), 1):
        # Forks and archived repos are rarely the news; the original is.
        if repo.get("fork") or repo.get("archived"):
            continue
        description = clean_text(repo.get("description"), config.DESCRIPTION_CHARS)
        language = repo.get("language")
        out.append(Candidate(
            source=source_id,
            external_id=str(repo["id"]),
            url=repo["html_url"],
            title=repo["full_name"] + (f": {description}" if description else ""),
            discussion_url=None,
            description=description,
            points=repo.get("stargazers_count"),
            comments=None,
            source_rank=rank,
            published_at=to_utc_iso(repo.get("created_at")),
            tags=[t for t in [language, *(repo.get("topics") or [])[:4]] if t],
        ))
        if len(out) >= quota:
            break
    return out
