"""Fold candidates that point at the same writing into one draft article.

The same post on HN and Lobsters is one article with two mentions. Both mentions are kept:
being linked in more than one place is a relevance signal, not noise to discard.
"""
from __future__ import annotations

from agent.models import Candidate, Draft, Mention
from agent.normalize import canonical_url, domain_of

# Submission prefixes that describe how something was posted, not what it is.
_TITLE_PREFIXES = ("Show HN: ", "Launch HN: ", "Tell HN: ")


def _clean_title(title: str) -> str:
    for prefix in _TITLE_PREFIXES:
        if title.startswith(prefix):
            return title[len(prefix):]
    return title


def merge(candidates: list[Candidate]) -> list[Draft]:
    drafts: dict[str, Draft] = {}
    for c in candidates:
        key = canonical_url(c.url)
        if not key:
            continue
        mention = Mention(
            source=c.source,
            external_id=c.external_id,
            discussion_url=c.discussion_url,
            points=c.points,
            comments=c.comments,
            source_rank=c.source_rank,
            tags=list(c.tags),
        )

        draft = drafts.get(key)
        if draft is None:
            drafts[key] = Draft(
                canonical_url=key,
                url=c.url,
                domain=domain_of(c.url),
                title=_clean_title(c.title),
                description=c.description,
                published_at=c.published_at,
                mentions=[mention],
            )
            continue

        if any(m.source == mention.source and m.external_id == mention.external_id
               for m in draft.mentions):
            continue
        draft.mentions.append(mention)
        # The richest description wins; the earliest publication date is the true one.
        if c.description and len(c.description) > len(draft.description or ""):
            draft.description = c.description
        if c.published_at and (not draft.published_at or c.published_at < draft.published_at):
            draft.published_at = c.published_at

    return list(drafts.values())
