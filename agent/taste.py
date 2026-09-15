"""Learning what a reader likes from what they do.

Explicit settings are a starting point people fill in once and forget. What someone opens,
saves, upvotes and hides is the honest signal. Each event nudges the weights for the
article's topics, kind, site and sources, with diminishing returns as a weight nears ±1,
and weights nobody reinforces drift back toward neutral over time.

Pure functions only.
"""
from __future__ import annotations

from datetime import datetime

from agent import config

TOPIC_SHARES = (0.6, 0.25, 0.15)


def signal_keys(article: dict) -> list[tuple[str, float]]:
    """(taste key, share of the event's weight) for one article.

    `article` needs topics, kind, domain and sources.
    """
    keys: list[tuple[str, float]] = []
    for topic, share in zip(article.get("topics") or [], TOPIC_SHARES):
        keys.append((f"topic:{topic}", share))
    if article.get("kind"):
        keys.append((f"kind:{article['kind']}", 0.5))
    if article.get("domain"):
        keys.append((f"domain:{article['domain']}", 0.4))
    for source in article.get("sources") or []:
        keys.append((f"source:{source}", 0.2))
    return keys


def decay(weights: dict[str, float], days: float) -> dict[str, float]:
    if days <= 0:
        return dict(weights)
    factor = config.TASTE_DECAY_PER_DAY ** days
    return {k: round(v * factor, 3) for k, v in weights.items()}


def update(weights: dict[str, float], events: list[dict], articles: dict[int, dict],
           last_update: datetime | None, now: datetime) -> tuple[dict[str, float], dict[str, int]]:
    """New weights and per-key evidence counts after applying `events` in time order.

    Events: {"kind", "article_id", "created_at"}. Unknown kinds and articles are ignored.
    """
    days = (now - last_update).total_seconds() / 86_400 if last_update else 0.0
    result = decay(weights, days)
    evidence: dict[str, int] = {}

    for event in sorted(events, key=lambda e: e["created_at"]):
        strength = config.EVENT_WEIGHTS.get(event["kind"], 0.0)
        article = articles.get(event.get("article_id"))
        if not strength or not article:
            continue
        direction = 1.0 if strength > 0 else -1.0
        for key, share in signal_keys(article):
            current = result.get(key, 0.0)
            # Saturating: a weight already near +1 barely moves on another like, while a
            # weight on the other side moves back quickly.
            room = 1.0 - current * direction
            new = current + config.LEARNING_RATE * strength * share * room
            result[key] = round(max(-1.0, min(1.0, new)), 3)
            evidence[key] = evidence.get(key, 0) + 1

    return result, evidence
