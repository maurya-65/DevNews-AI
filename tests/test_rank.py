from datetime import datetime, timedelta, timezone

from agent import rank
from agent.models import Analysis, Card, Reader

NOW = datetime(2026, 9, 15, 7, 0, tzinfo=timezone.utc)


def reader(**overrides):
    values = dict(id="u1", email=None, level="working", edition_size=3, quality_bar=4.0,
                  topics=["databases"], muted_topics=[], muted_kinds=[], muted_domains=[],
                  sources_off=[], include_general=False, email_digest=False, taste={})
    values.update(overrides)
    return Reader(**values)


def card(article_id, *, topics=("systems",), technologies=(), kind="deep-dive", novelty=6.0,
         depth=6.0, impact=6.0, audience="practitioner", confidence=0.8, is_cs=True, domain=None,
         sources=("hn",), signal=0.3, hours_ago=2, thread_id=None):
    analysis = Analysis(article_id=article_id, is_cs=is_cs, kind=kind, topics=list(topics),
                        audience=audience, novelty=novelty, depth=depth, impact=impact,
                        confidence=confidence, summary="s", takeaway=None,
                        technologies=list(technologies), thread_id=thread_id)
    return Card(article_id=article_id, title=f"Article {article_id}",
                url=f"https://site{article_id}.example/", domain=domain or f"site{article_id}.example",
                first_seen_at=(NOW - timedelta(hours=hours_ago)).isoformat(), published_at=None,
                sources=list(sources), signal=signal, analysis=analysis)


def selected(ranked):
    return [r.card.article_id for r in ranked if r.selected]


def engaged(thread_id, article_id, how, at="2026-09-01T00:00:00+00:00"):
    return {"thread_id": thread_id, "article_id": article_id, "title": f"Earlier {article_id}",
            "how": how, "at": at}


def test_a_new_development_in_a_story_you_saved_is_lifted_and_says_so():
    history = rank.follow_ups([engaged(7, 90, "saved")])
    ranked = rank.build_edition([card(1, topics=("web",)), card(2, topics=("web",), thread_id=7)],
                                reader(topics=[]), set(), NOW, history)
    assert ranked[0].card.article_id == 2
    assert ranked[0].why.startswith("Follows “Earlier 90”, which you saved")
    assert ranked[0].components["follows"]["article_id"] == 90
    assert "follows" not in ranked[1].components


def test_follow_ups_name_the_strongest_engagement_and_respect_rejections():
    history = rank.follow_ups([
        engaged(1, 10, "shown"), engaged(1, 11, "opened"), engaged(1, 12, "saved"),
        engaged(2, 20, "saved"), engaged(2, 21, "down"),
        engaged(3, 30, "opened", at="2026-09-01"), engaged(3, 31, "opened", at="2026-09-09"),
    ])
    assert history[1]["article_id"] == 12
    assert 2 not in history
    assert history[3]["article_id"] == 31


def test_a_followed_topic_outranks_an_equal_article_on_another():
    ranked = rank.build_edition([card(1, topics=("systems",)), card(2, topics=("databases",))],
                                reader(), set(), NOW)
    assert ranked[0].card.article_id == 2
    assert "Databases & storage" in ranked[0].why


def test_an_article_about_your_stack_outranks_an_equal_one_that_is_not():
    r = reader(topics=[], technologies=["rust"])
    ranked = rank.build_edition([card(1, technologies=["java"]), card(2, technologies=["rust"])],
                                r, set(), NOW)
    assert ranked[0].card.article_id == 2
    assert ranked[0].why.startswith("You work with Rust")


def test_the_best_matching_technology_decides_rather_than_the_count():
    r = reader(topics=[], technologies=["rust", "postgres"])
    one = rank.score(card(1, technologies=["rust"]), r, NOW)
    both = rank.score(card(2, technologies=["rust", "postgres"]), r, NOW)
    assert both.components["interest"] == one.components["interest"]


def test_a_muted_technology_is_excluded_however_good_it_is():
    r = reader(muted_technologies=["crypto"], edition_size=10)
    ranked = rank.build_edition([card(1, technologies=["crypto"], novelty=10, depth=10, impact=10)],
                                r, set(), NOW)
    assert selected(ranked) == []
    assert ranked[0].excluded == "you muted crypto"


def test_stack_taste_is_learned_as_well_as_declared():
    article = card(1, technologies=["zig"])
    plain = rank.score(article, reader(topics=[]), NOW).score
    learned = rank.score(article, reader(topics=[], taste={"tech:zig": 0.9}), NOW).score
    assert learned > plain


def test_the_quality_bar_is_a_floor_not_a_target():
    ranked = rank.build_edition([card(n, novelty=2, depth=2, impact=2) for n in range(1, 5)],
                                reader(), set(), NOW)
    assert selected(ranked) == []
    assert all(r.components["note"] == "below your quality bar" for r in ranked)


def test_edition_size_is_a_ceiling():
    cards = [card(n, topics=(t,)) for n, t in
             enumerate(("systems", "web", "security", "devtools", "languages"), 1)]
    assert len(selected(rank.build_edition(cards, reader(), set(), NOW))) == 3


def test_mutes_and_off_topic_stories_are_excluded_whatever_they_score():
    r = reader(muted_topics=["crypto-web3"], muted_kinds=["launch"], muted_domains=["example.org"],
               edition_size=10)
    strong = dict(novelty=10, depth=10, impact=10)
    cards = [card(1, topics=("crypto-web3",), **strong), card(2, kind="launch", **strong),
             card(3, domain="blog.example.org", **strong), card(4, is_cs=False, **strong), card(5)]
    ranked = {x.card.article_id: x for x in rank.build_edition(cards, r, set(), NOW)}
    assert selected(ranked.values()) == [5]
    assert ranked[1].excluded == "you muted Crypto & web3"
    assert ranked[2].excluded == "you muted Launch"
    assert ranked[3].excluded == "you muted example.org"
    assert ranked[4].excluded == "not about computing"


def test_general_stories_appear_when_the_reader_asks_for_them():
    assert selected(rank.build_edition([card(1, is_cs=False)], reader(include_general=True), set(), NOW)) == [1]


def test_one_article_per_site_and_a_cap_per_topic():
    same_site = [card(n, topics=(t,), domain="same.example")
                 for n, t in ((1, "web"), (2, "security"), (3, "devtools"))]
    assert len(selected(rank.build_edition(same_site, reader(edition_size=10), set(), NOW))) == 1
    same_topic = [card(n, topics=("web",)) for n in range(1, 7)]
    assert len(selected(rank.build_edition(same_topic, reader(edition_size=10), set(), NOW))) == 3


def test_articles_already_shown_are_not_repeated():
    ranked = rank.build_edition([card(1), card(2)], reader(), {1}, NOW)
    assert [r.card.article_id for r in ranked] == [2]


def test_reading_level_changes_what_counts_as_good():
    novel = card(1, novelty=9, depth=3, impact=6)
    deep = card(2, novelty=3, depth=9, impact=6)
    assert rank.quality(deep, "deep") > rank.quality(novel, "deep")
    assert rank.quality(novel, "learning") > rank.quality(deep, "learning")


def test_learned_taste_moves_the_score_both_ways():
    article = card(1, topics=("systems",))
    plain = rank.score(article, reader(topics=[]), NOW).score
    liked = rank.score(article, reader(topics=[], taste={"topic:systems": 0.9}), NOW).score
    disliked = rank.score(article, reader(topics=[], taste={"topic:systems": -0.9}), NOW).score
    assert liked > plain > disliked


def test_low_confidence_is_discounted():
    assert rank.quality(card(1, confidence=0.2), "working") < rank.quality(card(1, confidence=0.9), "working")


def test_fresher_articles_earn_more_freshness():
    assert rank.freshness(card(1, hours_ago=1), NOW) > rank.freshness(card(2, hours_ago=40), NOW)
