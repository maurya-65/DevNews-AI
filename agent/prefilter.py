"""Deterministic community signal, and the cap on what reaches the model.

Everything here is free and runs before any model call. The cap is what keeps a run inside
the free tier no matter how many links the sources return.
"""
from __future__ import annotations

import math

from agent import config
from agent.models import Draft, Mention


def _log_norm(value: int | None, decades: float) -> float:
    if not value or value <= 0:
        return 0.0
    return min(1.0, math.log10(1 + value) / decades)


def signal_from_mentions(mentions: list[Mention]) -> float:
    """0..1: the strongest reaction any one community had, plus a bonus for cross-posting."""
    best = 0.0
    for m in mentions:
        scale = config.SIGNAL_SCALES.get(m.source)
        if scale is None:
            value = config.SOURCE_PRIOR.get(m.source, 0.3)
        elif "comments" in scale:
            value = (0.55 * _log_norm(m.points, scale["points"])
                     + 0.45 * _log_norm(m.comments, scale["comments"]))
        else:
            value = _log_norm(m.points, scale["points"])
        best = max(best, value)

    extra_sources = len({m.source for m in mentions}) - 1
    return round(min(1.0, best + config.CROSS_POST_BONUS * max(0, extra_sources)), 4)


def signal(draft: Draft) -> float:
    return signal_from_mentions(draft.mentions)


def choose_for_analysis(drafts: list[Draft], limit: int = config.MAX_ANALYZE,
                        min_per_source: dict[str, int] | None = None) -> list[Draft]:
    """The strongest `limit` drafts, without letting one loud source take every slot.

    Each source first gets its best few (its floor); the rest go to the highest signal
    overall.
    """
    floors = config.MIN_PER_SOURCE if min_per_source is None else min_per_source
    for d in drafts:
        d.signal = signal(d)
    ordered = sorted(drafts, key=lambda d: d.signal, reverse=True)

    by_source: dict[str, list[Draft]] = {}
    for d in ordered:
        by_source.setdefault(d.mentions[0].source, []).append(d)

    chosen: list[Draft] = []
    chosen_urls: set[str] = set()
    for source, source_drafts in by_source.items():
        floor = floors.get(source, config.DEFAULT_MIN_PER_SOURCE)
        for d in source_drafts[:floor]:
            if len(chosen) < limit:
                chosen.append(d)
                chosen_urls.add(d.canonical_url)

    for d in ordered:
        if len(chosen) >= limit:
            break
        if d.canonical_url not in chosen_urls:
            chosen.append(d)
            chosen_urls.add(d.canonical_url)

    return sorted(chosen, key=lambda d: d.signal, reverse=True)
