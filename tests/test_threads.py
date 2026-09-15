from agent.models import Analysis
from agent.threads import plan, slugify


def an(article_id, match=None, hint=None, relation=None):
    return Analysis(article_id=article_id, is_cs=True, kind="news", topics=["security"],
                    audience="practitioner", novelty=5, depth=5, impact=5, confidence=0.8,
                    summary="s", takeaway=None, thread_match=match, thread_hint=hint,
                    thread_relation=relation)


def test_matching_an_existing_thread_attaches_to_it():
    result = plan([an(10, match="t:3", relation="reacts")],
                  [{"ref": "t:3", "thread_id": 3, "title": "Outage"}])
    assert result.attach == {10: (3, "reacts")}
    assert result.create == []


def test_matching_an_earlier_hint_creates_a_thread_with_both_articles():
    result = plan([an(11, match="a:4", relation="advances")],
                  [{"ref": "a:4", "article_id": 4, "title": "CDN outage"}])
    (thread,) = result.create
    assert thread.title == "CDN outage"
    assert thread.members == {4: "opens", 11: "advances"}


def test_two_articles_proposing_the_same_story_form_a_thread():
    result = plan([an(1, hint="CrowdStrike outage", relation="opens"),
                   an(2, hint="crowdstrike  outage!", relation="reacts")], [])
    (thread,) = result.create
    assert thread.members == {1: "opens", 2: "reacts"}


def test_a_lone_hint_waits_for_a_second_article():
    result = plan([an(1, hint="Something big")], [])
    assert result.create == []
    assert result.keep_hints == {1: "Something big"}


def test_an_unknown_reference_is_ignored():
    result = plan([an(1, match="t:99")], [])
    assert result.attach == {} and result.create == []


def test_slugify():
    assert slugify("Rust in the Linux kernel!") == "rust-in-the-linux-kernel"
    assert slugify("!!!") == "story"
