"""Read past the headline: fetch each article and keep the opening of its text.

HN gives a title and nothing else, and a title is a poor thing to judge on. Fetching the
page and extracting its main text is free; it just fails often (paywalls, JS-only pages,
publishers that block datacenter IPs). Every outcome is recorded in fetch_status, and a
failed fetch leaves the article to be judged on what the sources said.
"""
from __future__ import annotations

import concurrent.futures as futures
import logging

import httpx
import trafilatura

from agent import config, net
from agent.models import Draft
from agent.normalize import clean_text

# trafilatura logs every page it cannot parse at WARNING; that is expected, not news.
logging.getLogger("trafilatura").setLevel(logging.ERROR)

BLOCKED_STATUS = frozenset({401, 402, 403, 429, 451})
# Where the source already gave a better description than the page would.
SKIP_DOMAINS = ("arxiv.org", "github.com", "news.ycombinator.com", "lobste.rs")
SKIP_EXTENSIONS = (".pdf", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".mp3")


def needs_fetch(draft: Draft) -> bool:
    if draft.analyzed:
        return False
    domain = draft.domain
    if any(domain == d or domain.endswith("." + d) for d in SKIP_DOMAINS):
        return False
    return not draft.canonical_url.lower().split("?", 1)[0].endswith(SKIP_EXTENSIONS)


def _download(url: str) -> tuple[str, str | None]:
    """(status, html). Reads at most ENRICH_MAX_BYTES so one enormous page cannot stall a run."""
    headers = {"User-Agent": net.BROWSER_UA, "Accept": "text/html,application/xhtml+xml"}
    try:
        with net.client().stream("GET", url, headers=headers,
                                 timeout=config.ENRICH_TIMEOUT) as response:
            if response.status_code in BLOCKED_STATUS:
                return "blocked", None
            if response.status_code >= 400:
                return "failed", None
            if "html" not in response.headers.get("content-type", "").lower():
                return "skipped", None
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                chunks.append(chunk)
                size += len(chunk)
                if size >= config.ENRICH_MAX_BYTES:
                    break
            return "ok", b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    except (httpx.HTTPError, ValueError):
        return "failed", None


def enrich_one(draft: Draft) -> Draft:
    if not needs_fetch(draft):
        draft.fetch_status = "skipped"
        return draft

    status, page = _download(draft.url)
    if page is None:
        draft.fetch_status = status
        return draft

    text = trafilatura.extract(page, favor_precision=True, include_comments=False,
                               include_tables=False, deduplicate=True) or ""
    metadata = trafilatura.extract_metadata(page)
    page_description = clean_text(getattr(metadata, "description", None), config.DESCRIPTION_CHARS)

    if text:
        draft.word_count = len(text.split())
        draft.excerpt = clean_text(text, config.EXCERPT_CHARS)
    if page_description and not draft.description:
        draft.description = page_description
    draft.fetch_status = "ok" if (text or page_description) else "failed"
    return draft


def enrich(drafts: list[Draft], workers: int = config.ENRICH_WORKERS) -> dict[str, int]:
    """Enrich in place, concurrently. Returns a count per fetch_status."""
    with futures.ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(enrich_one, drafts))
    counts: dict[str, int] = {}
    for d in drafts:
        counts[d.fetch_status] = counts.get(d.fetch_status, 0) + 1
    return counts
