from agent import analyze, taxonomy
from agent.models import Draft, Mention


def raw(**overrides):
    entry = {
        "id": 1, "is_cs": True, "kind": "deep-dive", "topics": ["databases", "performance"],
        "audience": "practitioner", "novelty": 7, "depth": 8.44, "impact": 6, "confidence": 0.8,
        "summary": "Postgres 18 adds asynchronous I/O; sequential scans run 2-3x faster on network storage.",
        "takeaway": "Worth upgrading read-heavy workloads.",
        "thread_match": None, "thread_hint": None, "thread_relation": None,
    }
    entry.update(overrides)
    return entry


def test_a_well_formed_entry_passes_through():
    a = analyze.validate(raw(), set(), "gemini", "gemini-3.8-flash")
    assert a.article_id == 1 and a.kind == "deep-dive"
    assert a.topics == ["databases", "performance"]
    assert a.depth == 8.4 and a.confidence == 0.8
    assert a.thread_relation is None and a.provider == "gemini"


def test_scores_are_clamped_and_garbage_defaults_to_the_middle():
    a = analyze.validate(raw(novelty=14, depth=-2, impact="lots", confidence=3), set())
    assert (a.novelty, a.depth, a.impact, a.confidence) == (10.0, 0.0, 5.0, 1.0)


def test_unknown_vocabulary_falls_back_or_is_dropped():
    a = analyze.validate(raw(kind="gossip", audience="wizard",
                             topics=["databases", "cooking", "databases", "web", "security"]), set())
    assert a.kind == "news"
    assert a.topics == ["databases", "web", "security"]
    assert a.audience == "practitioner"


def test_entries_without_an_id_or_a_summary_are_rejected():
    assert analyze.validate(raw(summary="   "), set()) is None
    assert analyze.validate(raw(id="seven"), set()) is None


def test_a_thread_match_must_be_one_that_was_offered():
    offered = analyze.validate(raw(thread_match="t:9"), {"t:9"})
    assert offered.thread_match == "t:9" and offered.thread_relation == "advances"
    invented = analyze.validate(raw(thread_match="t:10"), {"t:9"})
    assert invented.thread_match is None and invented.thread_relation is None


def test_a_hint_opens_a_story_unless_told_otherwise():
    a = analyze.validate(raw(thread_hint='"Rust in the Linux kernel"'), set())
    assert a.thread_hint == "Rust in the Linux kernel" and a.thread_relation == "opens"


def test_title_only_articles_are_flagged_in_the_prompt():
    d = Draft(canonical_url="https://x.example/", url="https://x.example/", domain="x.example",
              title="Mystery", description=None, published_at=None,
              mentions=[Mention(source="hn", external_id="1", points=120, comments=40)], id=5)
    message = analyze.user_message([d], [])
    assert "id: 5" in message and "120 points, 40 comments" in message
    assert "title and URL only" in message and "(none yet)" in message


def test_schema_vocabulary_matches_the_taxonomy():
    item = analyze.schema()["properties"]["articles"]["items"]["properties"]
    assert set(item["kind"]["enum"]) == taxonomy.kind_ids()
    assert set(item["topics"]["items"]["enum"]) == taxonomy.topic_ids()
    assert set(item["audience"]["enum"]) == taxonomy.audience_ids()


def test_every_prompt_placeholder_is_filled():
    assert "{{" not in analyze.system_prompt()
