"""The daily run, stage by stage.

    ingest -> store -> enrich -> analyze -> threads -> learn -> editions -> notify

Each stage is timed and recorded in run_stages. Only the first three can fail a run: with
no candidates there is nothing to do. After that, a failing stage marks the run partial
and the rest still happen, so a model outage still produces editions from whatever was
analyzed, and an email outage never costs anyone the website.
"""
from __future__ import annotations

import sys
import traceback
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

from agent import analyze, config, dedupe, editions, enrich, notify, prefilter, threads
from agent.llm import Router
from agent.models import Analysis, Candidate, Draft
from agent.sources import FETCHERS
from agent.store import Store


class StageFailed(RuntimeError):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Recorder:
    def __init__(self, store: Store, run_id: int):
        self.store = store
        self.id = run_id
        self.stats: dict[str, dict] = {}
        self.problems: list[str] = []

    @contextmanager
    def stage(self, name: str) -> Iterator[dict]:
        started = utcnow()
        detail: dict = {}
        print(f"\n▸ {name}", file=sys.stderr)
        try:
            yield detail
        except Exception as exc:
            detail["error"] = f"{type(exc).__name__}: {exc}"[:500]
            self._record(name, "failed", started, detail)
            self.problems.append(f"{name}: {detail['error']}")
            traceback.print_exc()
            raise StageFailed(name) from exc
        self._record(name, "skipped" if detail.get("skipped") else "ok", started, detail)

    def _record(self, name: str, status: str, started: datetime, detail: dict) -> None:
        detail["seconds"] = round((utcnow() - started).total_seconds(), 1)
        self.stats[name] = detail
        try:
            self.store.record_stage(self.id, name, status, started, utcnow(), detail)
        except Exception as exc:
            print(f"    ! could not record stage {name}: {exc}", file=sys.stderr)


def ingest(store: Store, now: datetime, detail: dict) -> list[Candidate]:
    candidates: list[Candidate] = []
    for source in store.sources(config.DEFAULT_SOURCES):
        source_id = source["id"]
        quota = int(source.get("quota") or 0)
        if not source.get("enabled", True) or quota <= 0:
            detail[source_id] = "disabled"
            continue
        fetcher = FETCHERS.get(source["kind"])
        if fetcher is None:
            detail[source_id] = f"unknown kind {source['kind']!r}"
            continue
        try:
            got = fetcher(source_id, source.get("config") or {}, quota)
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"[:300]
            store.source_result(source_id, False, message, now)
            detail[source_id] = f"failed: {type(exc).__name__}"
            print(f"    {source_id:9} FAILED {message}", file=sys.stderr)
            continue
        store.source_result(source_id, True, None, now)
        detail[source_id] = len(got)
        print(f"    {source_id:9} {len(got):>3}", file=sys.stderr)
        candidates.extend(got)

    if not candidates:
        raise RuntimeError("every source came back empty or failed")
    return candidates


def run(store: Store, *, router: Router | None = None, provider: str | None = None,
        max_analyze: int = config.MAX_ANALYZE, now: datetime | None = None,
        send_email: bool = True) -> int:
    now = now or utcnow()
    recorder = Recorder(store, store.start_run())
    router = router or Router(primary=provider,
                              on_call=lambda record: store.record_llm_call(recorder.id, record))
    print(f"run {recorder.id} · {now.isoformat(timespec='minutes')}", file=sys.stderr)

    drafts: list[Draft] = []
    chosen: list[Draft] = []
    analyses: list[Analysis] = []
    context: list[dict] = []

    try:
        with recorder.stage("ingest") as detail:
            candidates = ingest(store, now, detail)

        with recorder.stage("store") as detail:
            drafts = dedupe.merge(candidates)
            store.upsert_articles(recorder.id, drafts, now)
            detail.update(candidates=len(candidates), articles=len(drafts),
                          cross_posted=sum(1 for d in drafts if len(d.sources) > 1),
                          new=sum(1 for d in drafts if not d.analyzed))

        with recorder.stage("enrich") as detail:
            chosen = prefilter.choose_for_analysis([d for d in drafts if not d.analyzed], max_analyze)
            detail.update(chosen=len(chosen), **enrich.enrich(chosen))
            store.save_texts(chosen)
    except StageFailed:
        store.finish_run(recorder.id, "failed", recorder.stats, "; ".join(recorder.problems))
        print(f"\nrun {recorder.id} failed", file=sys.stderr)
        return 1

    try:
        with recorder.stage("analyze") as detail:
            context = store.thread_context(now)
            analyses, stats = analyze.analyze(chosen, router, context)
            store.save_analyses(recorder.id, analyses, now)
            detail.update(stats, thread_context=len(context))
            if chosen and not analyses:
                raise RuntimeError("the model produced no usable analyses")
    except StageFailed:
        pass

    try:
        with recorder.stage("threads") as detail:
            if analyses:
                detail.update(store.apply_threads(threads.plan(analyses, context), now))
            else:
                detail["skipped"] = True
    except StageFailed:
        pass

    try:
        with recorder.stage("learn") as detail:
            detail.update(editions.learn(store, now))
    except StageFailed:
        pass

    try:
        with recorder.stage("editions") as detail:
            detail.update(editions.build_all(store, recorder.id, now))
    except StageFailed:
        pass

    try:
        with recorder.stage("notify") as detail:
            detail.update(notify.send_all(store, now) if send_email
                          else {"skipped": True, "reason": "email disabled for this run"})
    except StageFailed:
        pass

    missing = recorder.stats.get("analyze", {}).get("missing", 0)
    status = "partial" if (recorder.problems or missing) else "ok"
    store.finish_run(recorder.id, status, recorder.stats, "; ".join(recorder.problems) or None)
    print(f"\nrun {recorder.id} {status}", file=sys.stderr)
    return 0
