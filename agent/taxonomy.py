"""The shared vocabulary: topics, kinds, audiences, reading levels.

Loaded from web/src/lib/taxonomy.json, which the web app imports directly, so the pipeline
and the site cannot disagree about what an id means. Ids are stored in the database;
labels and descriptions are free to change.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "web" / "src" / "lib" / "taxonomy.json"


@lru_cache(maxsize=1)
def _load() -> dict:
    return json.loads(PATH.read_text(encoding="utf-8"))


def topics() -> list[dict]:
    return _load()["topics"]


def kinds() -> list[dict]:
    return _load()["kinds"]


def audiences() -> list[dict]:
    return _load()["audiences"]


def topic_ids() -> frozenset[str]:
    return frozenset(t["id"] for t in topics())


def kind_ids() -> frozenset[str]:
    return frozenset(k["id"] for k in kinds())


def audience_ids() -> frozenset[str]:
    return frozenset(a["id"] for a in audiences())


def level_ids() -> frozenset[str]:
    return frozenset(level["id"] for level in _load()["levels"])


def label(kind_or_topic_id: str) -> str:
    """Human label for a topic or kind id, falling back to the id itself."""
    for entry in topics() + kinds():
        if entry["id"] == kind_or_topic_id:
            return entry["label"]
    return kind_or_topic_id
