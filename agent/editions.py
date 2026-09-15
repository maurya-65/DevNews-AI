"""The two per-reader stages: learn from yesterday, then build today's edition.

Neither calls a model. Adding a reader costs a few database queries, not quota.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from agent import rank, taste
from agent.store import Store


def _parse(iso: str | None) -> datetime | None:
    if not iso:
        return None
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def learn(store: Store, now: datetime) -> dict:
    """Fold each reader's new events into their taste weights."""
    updated = events_total = 0
    for reader in store.readers():
        events = store.events_since(reader.id, reader.taste_updated_at)
        if not events and not reader.taste:
            continue
        articles = store.article_signals({e["article_id"] for e in events if e.get("article_id")})
        weights, evidence = taste.update(reader.taste, events, articles,
                                         _parse(reader.taste_updated_at), now)
        store.save_taste(reader.id, weights, evidence, now)
        updated += 1
        events_total += len(events)
    return {"readers_updated": updated, "events": events_total}


def build_all(store: Store, run_id: int | None, now: datetime) -> dict:
    """Rank today's candidates for every reader and store each edition.

    One reader's failure does not cost anyone else their edition.
    """
    today = now.date().isoformat()
    cards = store.edition_cards(now)
    readers = store.readers()
    threads = {c.analysis.thread_id for c in cards if c.analysis.thread_id}
    stats = {"candidates": len(cards), "readers": len(readers), "editions": 0, "quiet": 0,
             "failed": 0, "follow_ups": 0}

    for reader in readers:
        try:
            shown = store.already_shown(reader.id, today)
            history = rank.follow_ups(store.thread_engagement(reader.id, threads)) if threads else {}
            ranked = rank.build_edition(cards, reader, shown, now, history)
            store.save_edition(reader.id, run_id, today, ranked, len(cards))
        except Exception as exc:
            stats["failed"] += 1
            print(f"    ! edition for {reader.id}: {type(exc).__name__}: {exc}", file=sys.stderr)
            continue
        stats["follow_ups"] += sum(1 for r in ranked if r.selected and "follows" in r.components)
        if any(r.selected for r in ranked):
            stats["editions"] += 1
        else:
            stats["quiet"] += 1

    if readers and stats["failed"] == len(readers):
        raise RuntimeError(f"every edition failed ({stats['failed']})")
    return stats
