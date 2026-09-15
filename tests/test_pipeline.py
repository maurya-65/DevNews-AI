"""The whole run end to end, on the memory store, with fake sources and a fake model."""
import re
from datetime import datetime, timezone

import pytest

from agent import analyze, editions, enrich, pipeline, sources
from agent.llm.base import Completion
from agent.models import Candidate
from agent.store.memory_store import MemoryStore

NOW = datetime(2026, 9, 15, 7, 0, tzinfo=timezone.utc)


class FakeRouter:
    """Answers like a model would, deterministically, from the ids in the prompt."""

    def __init__(self):
        self.calls = 0

    def complete_json(self, stage, system, user, schema, max_output_tokens=16_000):
        self.calls += 1
        ids = [int(x) for x in re.findall(r"^id: (\d+)$", user, re.MULTILINE)]
        articles = [{
            "id": i, "is_cs": True, "kind": "deep-dive",
            "topics": ["databases"] if i % 2 else ["security"],
            "audience": "practitioner", "novelty": 7, "depth": 7, "impact": 7, "confidence": 0.9,
            "summary": f"Summary of article {i}.", "takeaway": None,
            "thread_match": None, "thread_hint": "Big outage" if i in (1, 2) else None,
            "thread_relation": None,
        } for i in ids]
        return Completion(data={"articles": articles}, provider="fake", model="fake-1",
                          input_tokens=100, output_tokens=50)


def fake_hn(source_id, cfg, quota):
    return [Candidate(source=source_id, external_id=str(n), url=f"https://site{n}.example/post",
                      title=f"Post {n}", points=100 + n, comments=20) for n in range(1, 7)]


@pytest.fixture
def offline(monkeypatch):
    for kind in list(sources.FETCHERS):
        monkeypatch.setitem(sources.FETCHERS, kind, lambda source_id, cfg, quota: [])
    monkeypatch.setitem(sources.FETCHERS, "hn", fake_hn)
    monkeypatch.setattr(enrich, "_download", lambda url: ("blocked", None))
    monkeypatch.setattr(analyze, "PAUSE_BETWEEN_CALLS", 0)


def test_a_full_run_produces_articles_threads_and_an_edition(offline):
    store = MemoryStore()
    assert pipeline.run(store, router=FakeRouter(), now=NOW, send_email=False) == 0

    assert store.t["pipeline_runs"][-1]["status"] == "ok"
    assert len(store.t["articles"]) == 6
    assert len(store.t["analyses"]) == 6
    (thread,) = store.t["threads"]
    assert thread["article_count"] == 2 and thread["slug"] == "big-outage"
    (edition,) = store.t["editions"]
    assert edition["status"] == "ok" and edition["item_count"] > 0
    assert {s["stage"] for s in store.t["run_stages"]} >= {"ingest", "analyze", "editions"}


def test_a_second_run_the_same_day_reuses_analyses_and_rebuilds_in_place(offline):
    store = MemoryStore()
    pipeline.run(store, router=FakeRouter(), now=NOW, send_email=False)
    second = FakeRouter()
    assert pipeline.run(store, router=second, now=NOW, send_email=False) == 0
    assert second.calls == 0
    assert len(store.t["editions"]) == 1
    assert len(store.t["analyses"]) == 6


def test_reader_events_become_taste(offline):
    store = MemoryStore()
    pipeline.run(store, router=FakeRouter(), now=NOW, send_email=False)
    reader_id = store.t["profiles"][0]["id"]
    store.t["events"].append({"id": 1, "user_id": reader_id, "article_id": 1, "kind": "up",
                              "created_at": "2026-09-15T07:30:00+00:00"})

    stats = editions.learn(store, datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc))
    assert stats == {"readers_updated": 1, "events": 1}
    weights = {r["key"]: r["weight"] for r in store.t["taste"]}
    assert weights["topic:databases"] > 0
    assert store.t["profiles"][0]["taste_updated_at"] is not None


def test_a_story_the_reader_saved_makes_its_follow_up_say_so(offline):
    store = MemoryStore()
    pipeline.run(store, router=FakeRouter(), now=NOW, send_email=False)
    reader_id = store.t["profiles"][0]["id"]
    (thread,) = store.t["threads"]
    members = sorted(a["article_id"] for a in store.t["analyses"] if a["thread_id"] == thread["id"])
    saved, follow_up = members
    store.t["saves"].append({"user_id": reader_id, "article_id": saved,
                             "created_at": "2026-09-15T07:10:00+00:00"})

    stats = editions.build_all(store, None, NOW)
    items = {i["article_id"]: i for i in store.t["edition_items"]}
    assert items[follow_up]["components"]["follows"]["article_id"] == saved
    assert items[follow_up]["components"]["follows"]["how"] == "saved"
    assert "follows" not in items[saved]["components"]
    assert stats["follow_ups"] == (1 if items[follow_up]["selected"] else 0)


def test_a_model_outage_still_produces_a_partial_run(offline):
    class DownRouter:
        def complete_json(self, *args, **kwargs):
            from agent.llm import ProviderError
            raise ProviderError("every provider failed")

    store = MemoryStore()
    assert pipeline.run(store, router=DownRouter(), now=NOW, send_email=False) == 0
    run = store.t["pipeline_runs"][-1]
    assert run["status"] == "partial"
    assert "analyze" in run["error"]
    assert store.t["editions"][0]["status"] == "quiet"
