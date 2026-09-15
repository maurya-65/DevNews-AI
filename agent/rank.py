"""Personal ranking, in code.

The model described each article once, for everyone. This turns that description into one
reader's edition: how good it is at their reading level, how much it matches what they
asked for and what they have shown they like, how much the community reacted, and how
fresh it is. Every score keeps its parts, so the lab page can show why an item landed
where it did, and every selected item carries a sentence saying why it is there.

Pure functions only: no I/O, no clock unless passed in.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from agent import config, taxonomy
from agent.models import Card, Ranked, Reader

TOPIC_SHARES = (0.6, 0.25, 0.15)
SOURCE_NAMES = {"hn": "Hacker News", "lobsters": "Lobsters", "github": "GitHub",
                "arxiv": "arXiv", "blogs": "a curated blog"}


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _parse(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def quality(card: Card, level: str) -> float:
    a = card.analysis
    weights = config.QUALITY_WEIGHTS.get(level, config.QUALITY_WEIGHTS["working"])
    value = weights["novelty"] * a.novelty + weights["impact"] * a.impact + weights["depth"] * a.depth
    value *= config.AUDIENCE_FIT.get(level, config.AUDIENCE_FIT["working"]).get(a.audience, 1.0)
    if a.confidence < config.LOW_CONFIDENCE:
        value *= config.LOW_CONFIDENCE_FACTOR
    return round(min(10.0, value), 3)


def interest(card: Card, reader: Reader) -> tuple[float, list[str]]:
    """-1..1, and the reader-facing reasons behind a positive value."""
    a = card.analysis
    reasons: list[str] = []

    topic_value = 0.0
    shares = TOPIC_SHARES[:len(a.topics)]
    share_total = sum(shares) or 1.0
    for topic, share in zip(a.topics, shares):
        explicit = config.EXPLICIT_INTEREST if topic in reader.topics else 0.0
        learned = reader.taste.get(f"topic:{topic}", 0.0) * config.TASTE_WEIGHT
        value = _clamp(explicit + learned)
        topic_value += value * share / share_total
        if explicit:
            reasons.append(f"you follow {taxonomy.label(topic)}")
        elif learned > 0.15:
            reasons.append(f"you've been reading {taxonomy.label(topic)}")

    kind_taste = reader.taste.get(f"kind:{a.kind}", 0.0) * config.TASTE_WEIGHT
    domain_taste = reader.taste.get(f"domain:{card.domain}", 0.0) * config.TASTE_WEIGHT
    source_taste = max((reader.taste.get(f"source:{s}", 0.0) for s in card.sources), default=0.0)
    if domain_taste > 0.15:
        reasons.append(f"you often read {card.domain}")

    total = _clamp(topic_value + 0.5 * kind_taste + 0.5 * domain_taste
                   + 0.25 * source_taste * config.TASTE_WEIGHT)
    return round(total, 3), reasons


def freshness(card: Card, now: datetime) -> float:
    seen = _parse(card.first_seen_at) or now
    hours = max(0.0, (now - seen).total_seconds() / 3600)
    return round(config.FRESHNESS_POINTS * 0.5 ** (hours / config.FRESHNESS_HALF_LIFE_H), 3)


def exclusion(card: Card, reader: Reader) -> str | None:
    """Why this can never be in the reader's edition, whatever it scores."""
    a = card.analysis
    if not a.is_cs and not reader.include_general:
        return "not about computing"
    muted = [t for t in a.topics if t in reader.muted_topics]
    if muted:
        return f"you muted {taxonomy.label(muted[0])}"
    if a.kind in reader.muted_kinds:
        return f"you muted {taxonomy.label(a.kind)}"
    # Name the rule the reader set, not the subdomain it happened to catch.
    muted_domain = next((d for d in reader.muted_domains
                         if card.domain == d or card.domain.endswith("." + d)), None)
    if muted_domain:
        return f"you muted {muted_domain}"
    if card.sources and all(s in reader.sources_off for s in card.sources):
        return "from a source you switched off"
    return None


def _why(card: Card, reasons: list[str]) -> str:
    parts = list(reasons[:2])
    if card.signal >= 0.7:
        loud = [SOURCE_NAMES.get(s, s) for s in card.sources if s in ("hn", "lobsters", "github")]
        if loud:
            parts.append(f"heavily discussed on {' and '.join(loud)}")
    if len(card.sources) > 1:
        parts.append(f"linked from {len(card.sources)} places")
    a = card.analysis
    if a.depth >= 8:
        parts.append("unusually deep")
    elif a.novelty >= 8:
        parts.append("genuinely new")
    elif a.impact >= 8:
        parts.append("likely to matter")
    if not parts:
        parts.append("strong on its own merits")
    text = "; ".join(parts[:3])
    return text[0].upper() + text[1:]


def score(card: Card, reader: Reader, now: datetime) -> Ranked:
    q = quality(card, reader.level)
    i, reasons = interest(card, reader)
    f = freshness(card, now)
    signal_points = round(config.SIGNAL_POINTS * card.signal, 3)
    total = round(q * (1 + config.INTEREST_BOOST * i) + signal_points + f, 3)
    return Ranked(
        card=card,
        score=total,
        components={"quality": q, "interest": i, "signal": signal_points, "freshness": f},
        why=_why(card, reasons),
        excluded=exclusion(card, reader),
    )


def build_edition(cards: list[Card], reader: Reader, already_shown: set[int],
                  now: datetime | None = None) -> list[Ranked]:
    """Every eligible candidate, ranked, with the edition's picks marked selected.

    The size is a ceiling and the quality bar is a floor, so a thin day produces a short
    edition, and a day where nothing clears the bar produces an empty one. Padding a slow
    day with filler costs a reader's trust faster than a quiet day does.
    """
    now = now or datetime.now(timezone.utc)
    ranked = [score(c, reader, now) for c in cards if c.article_id not in already_shown]
    ranked.sort(key=lambda r: r.score, reverse=True)

    per_topic: Counter[str] = Counter()
    per_domain: Counter[str] = Counter()
    picked = 0
    for position, r in enumerate(ranked, 1):
        r.rank = position
        if r.excluded:
            r.components["note"] = r.excluded
            continue
        if picked >= reader.edition_size:
            r.components["note"] = "edition full"
            continue
        if r.components["quality"] < reader.quality_bar:
            r.components["note"] = "below your quality bar"
            continue
        primary = r.card.analysis.topics[0] if r.card.analysis.topics else None
        if primary and per_topic[primary] >= config.MAX_PER_PRIMARY_TOPIC:
            r.components["note"] = f"already {config.MAX_PER_PRIMARY_TOPIC} on {taxonomy.label(primary)}"
            continue
        if per_domain[r.card.domain] >= config.MAX_PER_DOMAIN:
            r.components["note"] = f"already one from {r.card.domain}"
            continue
        r.selected = True
        picked += 1
        per_domain[r.card.domain] += 1
        if primary:
            per_topic[primary] += 1

    return ranked
