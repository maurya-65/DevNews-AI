from datetime import datetime, timedelta, timezone

from agent import config, taste

NOW = datetime(2026, 9, 15, 7, 0, tzinfo=timezone.utc)
ARTICLES = {1: {"topics": ["databases", "performance"], "kind": "deep-dive",
                "technologies": ["postgres", "linux"],
                "domain": "example.com", "sources": ["hn"]}}


def event(kind, article_id=1, at="2026-09-14T10:00:00+00:00"):
    return {"kind": kind, "article_id": article_id, "created_at": at}


def test_an_upvote_raises_everything_about_the_article():
    weights, evidence = taste.update({}, [event("up")], ARTICLES, None, NOW)
    assert weights["topic:databases"] > weights["topic:performance"] > 0
    assert weights["kind:deep-dive"] > 0
    assert weights["domain:example.com"] > 0
    assert weights["source:hn"] > 0
    assert weights["tech:postgres"] > 0 and weights["tech:linux"] > 0
    assert evidence["topic:databases"] == 1


def test_a_downvote_lowers_it():
    weights, _ = taste.update({}, [event("down")], ARTICLES, None, NOW)
    assert weights["topic:databases"] < 0


def test_weights_saturate_instead_of_running_away():
    weights, _ = taste.update({}, [event("up")] * 300, ARTICLES, None, NOW)
    assert 0.95 < weights["topic:databases"] <= 1.0
    first, _ = taste.update({}, [event("up")], ARTICLES, None, NOW)
    again, _ = taste.update(weights, [event("up")], ARTICLES, None, NOW)
    assert again["topic:databases"] - weights["topic:databases"] < first["topic:databases"]


def test_disagreeing_evidence_moves_a_strong_weight_quickly():
    weights, _ = taste.update({"topic:databases": 0.9}, [event("down")], ARTICLES, None, NOW)
    from_neutral, _ = taste.update({}, [event("down")], ARTICLES, None, NOW)
    assert 0.9 - weights["topic:databases"] > abs(from_neutral["topic:databases"])


def test_unreinforced_taste_decays_toward_neutral():
    weights, _ = taste.update({"topic:x": 0.5}, [], ARTICLES, NOW - timedelta(days=30), NOW)
    assert weights["topic:x"] == round(0.5 * config.TASTE_DECAY_PER_DAY ** 30, 3)


def test_unknown_events_and_articles_change_nothing():
    weights, evidence = taste.update({"topic:x": 0.2},
                                     [event("teleport"), event("up", article_id=404)],
                                     ARTICLES, None, NOW)
    assert weights == {"topic:x": 0.2}
    assert evidence == {}
