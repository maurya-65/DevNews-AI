from agent.dedupe import merge
from agent.models import Candidate


def cand(source, external_id, url, title="Thing", description=None, published_at=None):
    return Candidate(source=source, external_id=external_id, url=url, title=title,
                     description=description, published_at=published_at)


def test_cross_posted_story_is_one_article_with_both_mentions():
    drafts = merge([
        cand("hn", "1", "https://example.com/post?utm_source=hn", title="Show HN: Thing"),
        cand("lobsters", "a", "http://www.example.com/post", description="a longer description"),
    ])
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft.sources == ["hn", "lobsters"]
    assert draft.title == "Thing"
    assert draft.description == "a longer description"


def test_the_same_mention_twice_counts_once():
    c = cand("hn", "1", "https://example.com/post")
    (draft,) = merge([c, c])
    assert len(draft.mentions) == 1


def test_earliest_publication_date_wins():
    (draft,) = merge([
        cand("hn", "1", "https://example.com/p", published_at="2026-09-14T10:00:00+00:00"),
        cand("blogs", "x", "https://example.com/p", published_at="2026-09-13T08:00:00+00:00"),
    ])
    assert draft.published_at == "2026-09-13T08:00:00+00:00"


def test_unusable_urls_are_dropped():
    assert merge([cand("hn", "1", "")]) == []
