"""arXiv, via the daily announcement RSS feeds.

The query API rate-limits aggressively (429s and timeouts from ordinary IPs), while the RSS
feeds are served from a CDN and carry the full abstract, which is the best free summary any
source provides. Only newly announced papers are kept; cross-lists and replacements would
resurface work already seen.
"""
from __future__ import annotations

import re

import feedparser

from agent import config, net
from agent.models import Candidate
from agent.normalize import clean_text, to_utc_iso

FEED = "https://rss.arxiv.org/rss/{category}"
_ID = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")
_PREAMBLE = re.compile(r"^arXiv:\S+\s+Announce Type:\s*\S+\s*Abstract:\s*", re.IGNORECASE)
_INLINE_MATH = re.compile(r"\$(?!\d)([^$]{1,80})\$")  # not "$5 and $10"
_TEX_COMMAND = re.compile(r"\\([A-Za-z]+)")
_TEX_WORDS = {"pi": "π", "lambda": "λ", "alpha": "α", "beta": "β", "epsilon": "ε", "mu": "μ", "delta": "δ",
              "sigma": "σ", "tau": "τ", "theta": "θ", "omega": "ω", "ell": "ℓ", "log": "log", "times": "×",
              "leq": "≤", "geq": "≥", "approx": "≈", "infty": "∞", "to": "→", "cdot": "·"}


def untex(text: str | None) -> str | None:
    """`Modeling $\\pi$-calculus` reads as `Modeling π-calculus`.

    Titles and abstracts arrive with inline TeX; a reader should never see dollar signs.
    Unknown commands keep their name so nothing is silently lost.
    """
    if not text:
        return text

    def math(match: re.Match) -> str:
        inner = _TEX_COMMAND.sub(lambda m: _TEX_WORDS.get(m.group(1), m.group(1)), match.group(1))
        return inner.replace("{", "").replace("}", "").replace("^", "").replace("_", "").strip()

    return _INLINE_MATH.sub(math, text)


def _paper_id(entry) -> str | None:
    for field in (entry.get("id"), entry.get("link")):
        match = _ID.search(field or "")
        if match:
            return match.group(1)
    return None


def fetch(source_id: str, cfg: dict, quota: int) -> list[Candidate]:
    categories: dict[str, int] = cfg.get("categories") or {"cs.DC": quota}
    seen: set[str] = set()
    out: list[Candidate] = []

    for category, per_category in categories.items():
        response = net.get(FEED.format(category=category), retries=1)
        parsed = feedparser.parse(response.content)
        taken = 0
        for entry in parsed.entries:
            if taken >= per_category or len(out) >= quota:
                break
            if (entry.get("arxiv_announce_type") or "new").strip() != "new":
                continue
            paper = _paper_id(entry)
            title = untex(clean_text(entry.get("title"), 300))
            if not paper or not title or paper in seen:
                continue
            seen.add(paper)
            abstract = untex(_PREAMBLE.sub("", clean_text(entry.get("summary"), 4000) or ""))
            out.append(Candidate(
                source=source_id,
                external_id=paper,
                url=f"https://arxiv.org/abs/{paper}",
                title=title,
                discussion_url=None,
                description=clean_text(abstract, config.DESCRIPTION_CHARS),
                published_at=to_utc_iso(entry.get("published_parsed")),
                tags=[category],
            ))
            taken += 1
    return out
