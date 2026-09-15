"""Every tunable number in the pipeline, in one place.

Nothing here is in a prompt. The model reports what it read; how much each thing counts is
decided in code, so tuning the ranking never means rewording instructions to a model.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------------------
# Defaults for the `sources` table. The pipeline inserts any that are missing on start, so
# a source added here appears without a migration. Once a row exists, its quota and
# enabled flag in the database win: those can be changed without a deploy.
BLOG_FEEDS = [
    # Engineering at scale: the deepest postmortems and design write-ups there are.
    "https://blog.cloudflare.com/rss/",
    "https://netflixtechblog.com/feed",
    "https://stripe.com/blog/feed.rss",
    "https://engineering.fb.com/feed/",
    "https://github.blog/engineering/feed/",
    "https://fly.io/blog/feed.xml",
    "https://research.google/blog/rss/",
    # Explainers: accessible without being shallow.
    "https://blog.bytebytego.com/feed",
    "https://simonwillison.net/atom/everything/",
    "https://huggingface.co/blog/feed.xml",
    "https://martinfowler.com/feed.atom",
    # Language and platform teams.
    "https://blog.rust-lang.org/feed.xml",
    "https://go.dev/blog/feed.atom",
    "https://lwn.net/headlines/rss",
    # Individual writers: low volume, high signal.
    "https://jvns.ca/atom.xml",
    "https://danluu.com/atom.xml",
    "https://www.brendangregg.com/blog/rss.xml",
]

DEFAULT_SOURCES = [
    {"id": "hn", "kind": "hn", "name": "Hacker News", "quota": 30,
     "config": {"min_points": 20}},
    {"id": "lobsters", "kind": "lobsters", "name": "Lobsters", "quota": 15,
     "config": {"min_score": 5}},
    {"id": "blogs", "kind": "rss", "name": "Engineering blogs", "quota": 14,
     "config": {"feeds": BLOG_FEEDS, "per_feed": 2, "max_age_days": 7}},
    # arXiv announces hundreds of cs papers a day with no popularity signal at all, so
    # it is capped hard per category; the model decides which of the few are worth it.
    {"id": "arxiv", "kind": "arxiv", "name": "arXiv", "quota": 8,
     "config": {"categories": {"cs.DC": 2, "cs.PL": 2, "cs.DB": 1, "cs.OS": 1,
                               "cs.CR": 1, "cs.SE": 1}}},
    {"id": "github", "kind": "github", "name": "GitHub", "quota": 5,
     "config": {"window_days": 7, "min_stars": 150}},
]

# A source that has failed this many runs in a row is reported on the status page.
SOURCE_FAILURE_ALERT = 3

# ---------------------------------------------------------------------------------------
# Volume per run
# ---------------------------------------------------------------------------------------
MAX_ANALYZE = 48            # articles sent to the model per run, after prefiltering
# Slots each source is guaranteed among those 48. Curated sources carry no points to
# compete with a busy HN front page, so without a floor they would almost never reach the
# model. Measured on a real run: blogs got 2 of 48 on signal alone.
MIN_PER_SOURCE = {"blogs": 6, "arxiv": 3, "github": 3}
DEFAULT_MIN_PER_SOURCE = 2
ANALYZE_BATCH = 12          # articles per model call: small enough that JSON stays whole
REANALYZE_AFTER_DAYS = 0    # 0 = an article is understood once, ever

ENRICH_WORKERS = 8
ENRICH_TIMEOUT = 12.0
ENRICH_MAX_BYTES = 3_000_000
EXCERPT_CHARS = 1_400       # of extracted text shown to the model per article
DESCRIPTION_CHARS = 600

THREAD_LOOKBACK_DAYS = 21
MAX_THREAD_CONTEXT = 60     # recent threads and open story hints shown to the model

# Bounds enforced on the model's output, whatever it returns.
SUMMARY_CHARS = 320
TAKEAWAY_CHARS = 160
THREAD_TITLE_CHARS = 80
MAX_TOPICS = 3

# ---------------------------------------------------------------------------------------
# Quality: how the model's three scores combine, per reading level
# ---------------------------------------------------------------------------------------
QUALITY_WEIGHTS = {
    "learning": {"novelty": 0.40, "impact": 0.45, "depth": 0.15},
    "working": {"novelty": 0.35, "impact": 0.40, "depth": 0.25},
    "deep": {"novelty": 0.30, "impact": 0.25, "depth": 0.45},
}

# How well an article's intended audience suits the reader, as a multiplier on quality.
AUDIENCE_FIT = {
    "learning": {"newcomer": 1.10, "practitioner": 1.00, "expert": 0.78},
    "working": {"newcomer": 0.92, "practitioner": 1.00, "expert": 0.98},
    "deep": {"newcomer": 0.78, "practitioner": 0.95, "expert": 1.10},
}

# A score the model itself was unsure of is discounted rather than trusted at face value.
LOW_CONFIDENCE = 0.4
LOW_CONFIDENCE_FACTOR = 0.85

# ---------------------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------------------
EXPLICIT_INTEREST = 0.6     # a topic the reader ticked, on a -1..1 interest scale
INTEREST_BOOST = 0.55       # full interest lifts quality by 55%; full aversion cuts it
SIGNAL_POINTS = 1.2         # community signal adds up to this many points
FRESHNESS_HALF_LIFE_H = 30  # an article loses half its freshness bonus in this many hours
FRESHNESS_POINTS = 0.6
EDITION_WINDOW_HOURS = 36   # articles first seen this recently are edition candidates
MAX_PER_PRIMARY_TOPIC = 3   # diversity: no edition is all one subject
MAX_PER_DOMAIN = 1          # or all one publisher
EDITION_STORE_TOP = 40      # candidates stored per edition, for the lab page
# Continuity: a new article in a story the reader already saved, liked or read is lifted
# by this much interest, and says which earlier piece it follows.
FOLLOW_UP_INTEREST = 0.5
FOLLOW_UP_TITLE_CHARS = 70

DEFAULT_EDITION_SIZE = 8
DEFAULT_QUALITY_BAR = 5.0

# ---------------------------------------------------------------------------------------
# Signal: community reaction, normalised to 0..1
# ---------------------------------------------------------------------------------------
# log10(1 + x) / decades, capped at 1. HN points span four orders of magnitude and a
# Lobsters score two, so each source gets its own scale.
SIGNAL_SCALES = {
    "hn": {"points": 3.0, "comments": 2.6},
    "lobsters": {"points": 1.8, "comments": 1.8},
    "github": {"points": 3.6},
}
# Curated sources carry no counts; their presence on a hand-picked list is the signal.
SOURCE_PRIOR = {"blogs": 0.45, "arxiv": 0.30}
CROSS_POST_BONUS = 0.15     # per additional source that linked the same article

# ---------------------------------------------------------------------------------------
# Taste: learning from what readers do
# ---------------------------------------------------------------------------------------
EVENT_WEIGHTS = {
    "up": 1.0,
    "save": 0.8,
    "open": 0.25,
    "unsave": -0.3,
    "hide": -0.7,
    "down": -1.0,
    "unvote": 0.0,
}
LEARNING_RATE = 0.12
TASTE_DECAY_PER_DAY = 0.985  # unreinforced taste drifts back toward neutral
TASTE_WEIGHT = 0.5           # learned taste's share next to explicit interests
