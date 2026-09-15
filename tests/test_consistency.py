"""The vocabulary lives in three places (taxonomy JSON, config, the migration). These keep
them in agreement, so a rename in one cannot silently break the others."""
from pathlib import Path

from agent import config, taxonomy
from agent.sources import FETCHERS

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260915000000_v2.sql"


def test_ids_are_unique_within_each_group():
    for group in (taxonomy.topics(), taxonomy.kinds(), taxonomy.audiences()):
        ids = [entry["id"] for entry in group]
        assert all(ids) and len(ids) == len(set(ids))


def test_v1_interest_ids_survive():
    # Existing profiles store these. Renaming one would silently drop a reader's interests.
    assert {"systems", "languages", "ml", "security", "performance", "devtools", "web"} <= taxonomy.topic_ids()


def test_every_reading_level_is_fully_configured():
    levels = taxonomy.level_ids()
    assert set(config.QUALITY_WEIGHTS) == levels == set(config.AUDIENCE_FIT)
    for weights in config.QUALITY_WEIGHTS.values():
        assert abs(sum(weights.values()) - 1.0) < 1e-9
    for fit in config.AUDIENCE_FIT.values():
        assert set(fit) == taxonomy.audience_ids()


def test_every_default_source_has_a_fetcher():
    assert all(source["kind"] in FETCHERS for source in config.DEFAULT_SOURCES)


def test_migration_constraints_match_the_code():
    sql = MIGRATION.read_text(encoding="utf-8")
    for audience in taxonomy.audience_ids():
        assert f"'{audience}'" in sql
    for kind in config.EVENT_WEIGHTS:
        assert f"'{kind}'" in sql
    for source in config.DEFAULT_SOURCES:
        assert f"'{source['kind']}'" in sql
