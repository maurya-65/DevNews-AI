"""Turning the model's story links into threads.

The model proposes; code decides. A thread exists only once a second article joins it:
either an article matched an existing thread, matched an earlier article's open story
hint, or two articles in the same run proposed the same story name. That rule is what
stops a month of runs from leaving hundreds of one-article threads behind.

Everything here is pure. The pipeline applies the plan to the database.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from agent.models import Analysis

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(title: str, limit: int = 60) -> str:
    slug = _NON_ALNUM.sub("-", title.lower()).strip("-")
    return slug[:limit].rstrip("-") or "story"


@dataclass
class NewThread:
    title: str
    # article id -> relation. Includes earlier articles pulled in retroactively.
    members: dict[int, str] = field(default_factory=dict)


@dataclass
class ThreadPlan:
    attach: dict[int, tuple[int, str]] = field(default_factory=dict)  # article -> (thread id, relation)
    create: list[NewThread] = field(default_factory=list)
    keep_hints: dict[int, str] = field(default_factory=dict)          # article -> hint, still waiting for a match


def plan(analyses: list[Analysis], context: list[dict]) -> ThreadPlan:
    """Decide thread membership for this run's analyses.

    `context` entries: {"ref": "t:12", "thread_id": 12, "title": ...} for threads, and
    {"ref": "a:345", "article_id": 345, "title": <hint>} for earlier articles whose hint is
    still waiting for a second article.
    """
    by_ref = {c["ref"]: c for c in context}
    result = ThreadPlan()
    groups: dict[str, NewThread] = {}   # slug -> thread being formed

    def group(title: str) -> NewThread:
        key = slugify(title)
        if key not in groups:
            groups[key] = NewThread(title=title)
        return groups[key]

    for a in analyses:
        entry = by_ref.get(a.thread_match or "")
        if entry and "thread_id" in entry:
            result.attach[a.article_id] = (entry["thread_id"], a.thread_relation or "advances")
        elif entry and "article_id" in entry:
            # Joins an earlier article's story: that article opened it.
            thread = group(entry["title"])
            thread.members.setdefault(entry["article_id"], "opens")
            thread.members[a.article_id] = a.thread_relation or "advances"
        elif a.thread_hint:
            thread = group(a.thread_hint)
            thread.members.setdefault(a.article_id, a.thread_relation or "opens")

    for thread in groups.values():
        if len(thread.members) >= 2:
            result.create.append(thread)
        else:
            (article_id,) = thread.members
            if article_id in {a.article_id for a in analyses}:
                result.keep_hints[article_id] = thread.title

    return result
