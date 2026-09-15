from agent.models import Draft, Mention
from agent.prefilter import choose_for_analysis, signal


def draft(source, n, points=None, comments=None, extra_sources=()):
    mentions = [Mention(source=source, external_id=str(n), points=points, comments=comments)]
    mentions += [Mention(source=s, external_id=f"{s}{n}") for s in extra_sources]
    url = f"https://{source}{n}.example/"
    return Draft(canonical_url=url, url=url, domain=f"{source}{n}.example", title=f"{source} {n}",
                 description=None, published_at=None, mentions=mentions)


def test_a_bigger_reaction_means_a_stronger_signal():
    assert signal(draft("hn", 1, 900, 450)) > signal(draft("hn", 2, 25, 3)) > 0


def test_curated_sources_carry_their_prior():
    assert signal(draft("blogs", 1)) == 0.45


def test_cross_posting_adds_a_bonus():
    assert signal(draft("hn", 1, 100, 20, extra_sources=("lobsters",))) > signal(draft("hn", 2, 100, 20))


def test_signal_is_capped_at_one():
    assert signal(draft("hn", 1, 10**7, 10**6, extra_sources=("lobsters", "blogs"))) == 1.0


def test_quiet_sources_keep_their_floor_on_a_loud_day():
    loud = [draft("hn", n, 1000 + n, 500) for n in range(20)]
    quiet = [draft("blogs", n) for n in range(4)]
    chosen = choose_for_analysis(loud + quiet, limit=6, min_per_source={"blogs": 2})
    assert len(chosen) == 6
    assert sum(1 for d in chosen if d.mentions[0].source == "blogs") == 2


def test_the_limit_holds_even_when_floors_exceed_it():
    drafts = [draft("blogs", n) for n in range(5)] + [draft("arxiv", n) for n in range(5)]
    assert len(choose_for_analysis(drafts, limit=3, min_per_source={"blogs": 5, "arxiv": 5})) == 3
