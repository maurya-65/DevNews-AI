"""The vocabulary lives in three places (taxonomy JSON, config, the migration). These keep
them in agreement, so a rename in one cannot silently break the others."""
from pathlib import Path

from agent import config, taxonomy
from agent.sources import FETCHERS

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260915000000_v2.sql"
STACK_MIGRATION = ROOT / "supabase" / "migrations" / "20260916000000_stack.sql"


def test_ids_are_unique_within_each_group():
    for group in (taxonomy.topics(), taxonomy.kinds(), taxonomy.audiences(), taxonomy.technologies()):
        ids = [entry["id"] for entry in group]
        assert all(ids) and len(ids) == len(set(ids))


def test_every_technology_id_is_its_own_canonical_spelling():
    # technology_id() has to be idempotent, or the same tool lands under two ids over time.
    for entry in taxonomy.technologies():
        assert taxonomy.technology_id(entry["id"]) == entry["id"]
        assert taxonomy.technology_id(entry["label"]) == entry["id"]


def test_no_alias_points_at_two_technologies():
    seen: dict[str, str] = {}
    for entry in taxonomy.technologies():
        for name in [entry["label"].lower(), *(a.lower() for a in entry.get("aliases", []))]:
            assert name not in seen or seen[name] == entry["id"], f"{name} is claimed twice"
            seen[name] = entry["id"]
        assert entry["id"] not in {a.lower() for e in taxonomy.technologies() if e["id"] != entry["id"]
                                   for a in e.get("aliases", [])}


def test_the_stack_migration_adds_what_the_code_reads():
    sql = STACK_MIGRATION.read_text(encoding="utf-8")
    for column in ("technologies", "muted_technologies", "interest_text", "interest_profile",
                   "onboarded_at", "role"):
        assert column in sql


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
