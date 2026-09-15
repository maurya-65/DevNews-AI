"""Row <-> model conversions shared by both stores, so they cannot drift apart."""
from __future__ import annotations

from collections.abc import Iterable, Iterator
from datetime import datetime, timezone
from typing import TypeVar

from agent import config, prefilter, taxonomy
from agent.models import Analysis, Card, Mention, Ranked, Reader

T = TypeVar("T")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def chunks(items: Iterable[T], size: int) -> Iterator[list[T]]:
    batch: list[T] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def reader_from_row(row: dict, taste: dict[str, float]) -> Reader:
    level = row.get("level") if row.get("level") in taxonomy.level_ids() else "working"
    bar = row.get("min_score")
    return Reader(
        id=row["id"],
        email=row.get("email"),
        level=level,
        edition_size=int(row.get("select_count") or config.DEFAULT_EDITION_SIZE),
        quality_bar=float(bar) if bar is not None else config.DEFAULT_QUALITY_BAR,
        topics=[t for t in (row.get("topics") or []) if t in taxonomy.topic_ids()],
        muted_topics=list(row.get("muted_topics") or []),
        muted_kinds=list(row.get("muted_kinds") or []),
        muted_domains=list(row.get("muted_domains") or []),
        sources_off=list(row.get("sources_off") or []),
        include_general=bool(row.get("include_general")),
        email_digest=bool(row.get("email_digest")),
        taste=dict(taste),
        taste_updated_at=row.get("taste_updated_at"),
    )


def analysis_from_row(row: dict) -> Analysis:
    return Analysis(
        article_id=int(row["article_id"]),
        is_cs=bool(row["is_cs"]),
        kind=row["kind"],
        topics=list(row.get("topics") or []),
        audience=row["audience"],
        novelty=float(row["novelty"]),
        depth=float(row["depth"]),
        impact=float(row["impact"]),
        confidence=float(row["confidence"]),
        summary=row["summary"],
        takeaway=row.get("takeaway"),
        thread_hint=row.get("thread_hint"),
        thread_relation=row.get("thread_relation"),
        thread_id=row.get("thread_id"),
        provider=row.get("provider") or "",
        model=row.get("model") or "",
    )


def analysis_row(run_id: int | None, a: Analysis, now: datetime) -> dict:
    """What gets written. thread_id is deliberately absent: only apply_threads sets it."""
    return {
        "article_id": a.article_id,
        "run_id": run_id,
        "provider": a.provider or "unknown",
        "model": a.model or "unknown",
        "is_cs": a.is_cs,
        "kind": a.kind,
        "topics": a.topics,
        "audience": a.audience,
        "novelty": a.novelty,
        "depth": a.depth,
        "impact": a.impact,
        "confidence": a.confidence,
        "summary": a.summary,
        "takeaway": a.takeaway,
        "thread_hint": a.thread_hint,
        "thread_relation": a.thread_relation if a.thread_hint else None,
        "analyzed_at": iso(now),
    }


def mention_from_row(row: dict) -> Mention:
    return Mention(
        source=row["source_id"],
        external_id=row["external_id"],
        discussion_url=row.get("discussion_url"),
        points=row.get("points"),
        comments=row.get("comments"),
        source_rank=row.get("source_rank"),
        tags=list(row.get("tags") or []),
    )


def card_from_rows(article: dict, analysis: Analysis, mentions: list[Mention]) -> Card:
    return Card(
        article_id=int(article["id"]),
        title=article["title"],
        url=article["url"],
        domain=article["domain"],
        first_seen_at=article["first_seen_at"],
        published_at=article.get("published_at"),
        sources=sorted({m.source for m in mentions}),
        signal=prefilter.signal_from_mentions(mentions),
        analysis=analysis,
    )


def context_entries(threads: list[dict], hints: list[dict]) -> list[dict]:
    """Threads first (most recently active), then open hints, capped for the prompt."""
    entries = [{"ref": f"t:{t['id']}", "thread_id": int(t["id"]), "title": t["title"],
                "last_seen": t["last_activity_at"]} for t in threads]
    entries += [{"ref": f"a:{h['article_id']}", "article_id": int(h["article_id"]),
                 "title": h["thread_hint"], "last_seen": h["analyzed_at"]} for h in hints]
    return entries[:config.MAX_THREAD_CONTEXT]


def engagement_rows(members: dict[int, int], titles: dict[int, str],
                    actions: list[tuple[int, str, str | None]]) -> list[dict]:
    """(article, how, when) actions on thread members, in the shape rank.follow_ups reads."""
    return [{"thread_id": members[article_id], "article_id": article_id,
             "title": titles.get(article_id, ""), "how": how, "at": at}
            for article_id, how, at in actions if article_id in members]


def edition_item_rows(edition_id: int, user_id: str, ranked: list[Ranked]) -> list[dict]:
    """Every selected item plus the top of the rest, so the lab page can show near misses."""
    keep = [r for r in ranked if r.selected or r.rank <= config.EDITION_STORE_TOP]
    return [{
        "edition_id": edition_id,
        "article_id": r.card.article_id,
        "user_id": user_id,
        "rank": r.rank,
        "score": r.score,
        "selected": r.selected,
        "components": r.components,
        "why": r.why if r.selected else None,
    } for r in keep]
