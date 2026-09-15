"""Source registry.

Every fetcher has the same signature, fetch(source_id, config, quota) -> list[Candidate],
and raises on failure. Isolating failures is the pipeline's job, not each fetcher's, so a
broken source is recorded against its row instead of vanishing into a log line.
"""
from __future__ import annotations

from collections.abc import Callable

from agent.models import Candidate
from agent.sources import arxiv, github, hackernews, lobsters, rss

Fetcher = Callable[[str, dict, int], list[Candidate]]

FETCHERS: dict[str, Fetcher] = {
    "hn": hackernews.fetch,
    "lobsters": lobsters.fetch,
    "rss": rss.fetch,
    "arxiv": arxiv.fetch,
    "github": github.fetch,
}
