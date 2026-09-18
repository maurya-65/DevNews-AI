"""The shapes that move through the pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Candidate:
    """One link, exactly as one source reported it."""
    source: str                       # the sources.id it came from
    external_id: str
    url: str
    title: str
    discussion_url: str | None = None
    description: str | None = None
    points: int | None = None
    comments: int | None = None
    source_rank: int | None = None
    published_at: str | None = None   # UTC ISO
    tags: list[str] = field(default_factory=list)


@dataclass
class Mention:
    """Where an article was linked, and how that community reacted."""
    source: str
    external_id: str
    discussion_url: str | None = None
    points: int | None = None
    comments: int | None = None
    source_rank: int | None = None
    tags: list[str] = field(default_factory=list)


@dataclass
class Draft:
    """An article as assembled in this run, before and after it is stored."""
    canonical_url: str
    url: str
    domain: str
    title: str
    description: str | None
    published_at: str | None
    mentions: list[Mention]
    excerpt: str | None = None
    word_count: int | None = None
    fetch_status: str = "pending"
    signal: float = 0.0
    id: int | None = None             # set once stored
    analyzed: bool = False            # already understood in an earlier run

    @property
    def sources(self) -> list[str]:
        return sorted({m.source for m in self.mentions})


@dataclass
class Analysis:
    """The model's reading of one article, after validation."""
    article_id: int
    is_cs: bool
    kind: str
    topics: list[str]
    audience: str
    novelty: float
    depth: float
    impact: float
    confidence: float
    summary: str
    takeaway: str | None
    technologies: list[str] = field(default_factory=list)   # what it is built on or about
    thread_hint: str | None = None
    thread_match: str | None = None   # "t:<thread id>" or "a:<article id>" from the context list
    thread_relation: str | None = None
    thread_id: int | None = None      # resolved in code, never taken from the model directly
    provider: str = ""
    model: str = ""


@dataclass
class Reader:
    """A profile row, with defaults filled in."""
    id: str
    email: str | None
    level: str
    edition_size: int
    quality_bar: float
    topics: list[str]
    muted_topics: list[str]
    muted_kinds: list[str]
    muted_domains: list[str]
    sources_off: list[str]
    include_general: bool
    email_digest: bool
    technologies: list[str] = field(default_factory=list)        # the reader's stack
    muted_technologies: list[str] = field(default_factory=list)
    taste: dict[str, float] = field(default_factory=dict)
    taste_updated_at: str | None = None


@dataclass
class Card:
    """Everything the ranker needs about one candidate article."""
    article_id: int
    title: str
    url: str
    domain: str
    first_seen_at: str
    published_at: str | None
    sources: list[str]
    signal: float
    analysis: Analysis


@dataclass
class Ranked:
    card: Card
    score: float
    components: dict
    why: str
    excluded: str | None = None       # the reason it can never be selected, if any
    selected: bool = False
    rank: int = 0
