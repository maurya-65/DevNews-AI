"""Understand each article once: the only stage that calls a model.

Articles go in small batches. Whatever comes back is validated field by field against the
taxonomy and clamped to range, because a model's output is input like any other. An
article the model skipped is retried once in a batch of its own; if it is still missing,
it simply has no analysis yet and the next run picks it up.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from agent import config, taxonomy
from agent.llm import ProviderError, Router
from agent.models import Analysis, Draft
from agent.normalize import clean_text

PROMPT_PATH = Path(__file__).parent / "prompts" / "analyze.md"
PAUSE_BETWEEN_CALLS = 4.0          # seconds; the free tier counts requests per minute
MAX_OUTPUT_TOKENS = 16_000
_REF = re.compile(r"^[ta]:\d+$")
RELATIONS = frozenset({"opens", "advances", "reacts", "context"})


def system_prompt() -> str:
    def lines(entries: list[dict]) -> str:
        return "\n".join(f"- {e['id']}: {e['description']}" for e in entries)

    return (PROMPT_PATH.read_text(encoding="utf-8")
            .replace("{{KINDS}}", lines(taxonomy.kinds()))
            .replace("{{TOPICS}}", lines(taxonomy.topics()))
            .replace("{{AUDIENCES}}", lines(taxonomy.audiences()))
            # Ids only, comma separated: the list is long and each name explains itself.
            .replace("{{TECHNOLOGIES}}", ", ".join(sorted(taxonomy.technology_ids()))))


def schema() -> dict:
    """Written in the subset both providers accept: types, enums, required, nullable."""
    return {
        "type": "object",
        "properties": {
            "articles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "is_cs": {"type": "boolean"},
                        "kind": {"type": "string", "enum": sorted(taxonomy.kind_ids())},
                        "topics": {"type": "array",
                                   "items": {"type": "string", "enum": sorted(taxonomy.topic_ids())}},
                        "audience": {"type": "string", "enum": sorted(taxonomy.audience_ids())},
                        "novelty": {"type": "number"},
                        "depth": {"type": "number"},
                        "impact": {"type": "number"},
                        "confidence": {"type": "number"},
                        "summary": {"type": "string"},
                        "takeaway": {"type": "string", "nullable": True},
                        # Deliberately not an enum: a name outside the list is useful
                        # evidence, and taxonomy.technology_id decides what to keep.
                        "technologies": {"type": "array", "items": {"type": "string"}},
                        "thread_match": {"type": "string", "nullable": True},
                        "thread_hint": {"type": "string", "nullable": True},
                        "thread_relation": {"type": "string", "nullable": True,
                                            "enum": sorted(RELATIONS)},
                    },
                    "required": ["id", "is_cs", "kind", "topics", "audience", "novelty",
                                 "depth", "impact", "confidence", "summary"],
                },
            },
        },
        "required": ["articles"],
    }


def _describe_mentions(draft: Draft) -> str:
    parts = []
    for m in draft.mentions:
        counts = []
        if m.points is not None:
            counts.append(f"{m.points} {'stars' if m.source == 'github' else 'points'}")
        if m.comments is not None:
            counts.append(f"{m.comments} comments")
        parts.append(m.source + (f" ({', '.join(counts)})" if counts else ""))
    return "; ".join(parts)


def user_message(drafts: list[Draft], thread_context: list[dict]) -> str:
    if thread_context:
        context = "\n".join(f"{c['ref']} — {c['title']} — last seen {c['last_seen'][:10]}"
                            for c in thread_context)
    else:
        context = "(none yet)"

    blocks = []
    for d in drafts:
        lines = [f"id: {d.id}", f"title: {d.title}", f"url: {d.url}",
                 f"posted on: {_describe_mentions(d)}"]
        if d.published_at:
            lines.append(f"published: {d.published_at[:10]}")
        if d.description:
            lines.append(f"description: {d.description}")
        if d.excerpt:
            lines.append(f"article opening: {d.excerpt}")
        if not d.description and not d.excerpt:
            lines.append("text: (none available; judge from the title and URL only)")
        blocks.append("\n".join(lines))

    return (f"Developing stories you may link to:\n{context}\n\n"
            f"{len(drafts)} articles. Return exactly {len(drafts)} entries.\n\n"
            + "\n\n---\n\n".join(blocks))


def _score(value) -> float:
    try:
        return round(max(0.0, min(10.0, float(value))), 1)
    except (TypeError, ValueError):
        return 5.0


def validate(raw: dict, valid_refs: set[str], provider: str = "", model: str = "") -> Analysis | None:
    """One raw entry -> Analysis, or None if it is unusable. Never trusts the shape."""
    try:
        article_id = int(raw["id"])
    except (KeyError, TypeError, ValueError):
        return None

    summary = clean_text(raw.get("summary"), config.SUMMARY_CHARS)
    if not summary:
        return None

    kind = raw.get("kind") if raw.get("kind") in taxonomy.kind_ids() else "news"
    topics: list[str] = []
    for topic in raw.get("topics") or []:
        if topic in taxonomy.topic_ids() and topic not in topics:
            topics.append(topic)
    audience = raw.get("audience") if raw.get("audience") in taxonomy.audience_ids() else "practitioner"

    technologies: list[str] = []
    for name in raw.get("technologies") or []:
        tech = taxonomy.technology_id(name)
        if tech and tech not in technologies:
            technologies.append(tech)

    try:
        confidence = round(max(0.0, min(1.0, float(raw.get("confidence", 0.5)))), 2)
    except (TypeError, ValueError):
        confidence = 0.5

    match = (raw.get("thread_match") or "").strip()
    match = match if _REF.match(match) and match in valid_refs else None
    hint = clean_text((raw.get("thread_hint") or "").strip(" \"'"), config.THREAD_TITLE_CHARS)
    relation = raw.get("thread_relation") if raw.get("thread_relation") in RELATIONS else None
    if match:
        relation = relation or "advances"   # joining a story already under way
    elif hint:
        relation = relation or "opens"      # proposing a story nobody has followed yet
    else:
        relation = None

    return Analysis(
        article_id=article_id,
        is_cs=bool(raw.get("is_cs", True)),
        kind=kind,
        topics=topics[:config.MAX_TOPICS],
        audience=audience,
        novelty=_score(raw.get("novelty")),
        depth=_score(raw.get("depth")),
        impact=_score(raw.get("impact")),
        confidence=confidence,
        summary=summary,
        takeaway=clean_text(raw.get("takeaway"), config.TAKEAWAY_CHARS),
        technologies=technologies[:config.MAX_TECHNOLOGIES],
        thread_match=match,
        thread_hint=hint if not match else None,
        thread_relation=relation,
        provider=provider,
        model=model,
    )


def _call(router: Router, drafts: list[Draft], thread_context: list[dict],
          valid_refs: set[str]) -> tuple[dict[int, Analysis], int, int]:
    completion = router.complete_json(
        stage="analyze",
        system=system_prompt(),
        user=user_message(drafts, thread_context),
        schema=schema(),
        max_output_tokens=MAX_OUTPUT_TOKENS,
    )
    wanted = {d.id for d in drafts}
    results: dict[int, Analysis] = {}
    for raw in completion.data.get("articles") or []:
        if not isinstance(raw, dict):
            continue
        analysis = validate(raw, valid_refs, completion.provider, completion.model)
        if analysis and analysis.article_id in wanted:
            results[analysis.article_id] = analysis
    return results, completion.input_tokens, completion.output_tokens


def analyze(drafts: list[Draft], router: Router, thread_context: list[dict],
            batch_size: int = config.ANALYZE_BATCH) -> tuple[list[Analysis], dict]:
    """Analyses for as many drafts as the model covered, plus stats for the run record."""
    pending = [d for d in drafts if d.id is not None and not d.analyzed]
    valid_refs = {c["ref"] for c in thread_context}
    results: dict[int, Analysis] = {}
    stats = {"requested": len(pending), "calls": 0, "failed_calls": 0,
             "input_tokens": 0, "output_tokens": 0}

    def run_batch(batch: list[Draft]) -> None:
        if stats["calls"] or stats["failed_calls"]:
            time.sleep(PAUSE_BETWEEN_CALLS)
        try:
            got, tokens_in, tokens_out = _call(router, batch, thread_context, valid_refs)
            stats["calls"] += 1
            stats["input_tokens"] += tokens_in
            stats["output_tokens"] += tokens_out
            results.update(got)
        except ProviderError as exc:
            stats["failed_calls"] += 1
            print(f"    ! batch of {len(batch)} failed: {str(exc)[:160]}", file=sys.stderr)

    for start in range(0, len(pending), batch_size):
        run_batch(pending[start:start + batch_size])

    missing = [d for d in pending if d.id not in results]
    if missing and len(missing) < len(pending):
        # A partial miss is usually the model dropping entries from a long batch. One
        # retry in a smaller batch recovers most of them; a total miss means the
        # providers are down, and retrying would only burn quota.
        print(f"    retrying {len(missing)} articles the model skipped", file=sys.stderr)
        for start in range(0, len(missing), max(1, batch_size // 2)):
            run_batch(missing[start:start + batch_size // 2])

    stats["analyzed"] = len(results)
    stats["missing"] = len(pending) - len(results)
    return [results[d.id] for d in pending if d.id in results], stats
