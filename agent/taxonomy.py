"""The shared vocabulary: topics, kinds, audiences, technologies, reading levels.

Loaded from web/src/lib/taxonomy.json, which the web app imports directly, so the pipeline
and the site cannot disagree about what an id means. Ids are stored in the database;
labels and descriptions are free to change.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

# A name the model invented rather than picked: kept only if it looks like a tool's name
# and not a sentence, so it can be promoted into the list later under the same id.
_SLUG_OK = re.compile(r"^[a-z0-9][a-z0-9.+#-]{1,23}$")

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


def technologies() -> list[dict]:
    return _load()["technologies"]


def technology_ids() -> frozenset[str]:
    return frozenset(t["id"] for t in technologies())


@lru_cache(maxsize=1)
def _technology_aliases() -> dict[str, str]:
    """Every spelling that means a known technology -> its id."""
    table: dict[str, str] = {}
    for entry in technologies():
        for name in [entry["id"], entry["label"], *entry.get("aliases", [])]:
            table[name.strip().lower()] = entry["id"]
    return table


def technology_id(name: str) -> str | None:
    """A name from the model or a reader -> a stable id, or None if it is not usable.

    Known spellings fold together (`k8s`, `Kubernetes` -> `kubernetes`). An unknown name
    survives as a slug rather than being dropped: the fixed list cannot cover every tool,
    and a slug that keeps appearing is the evidence for adding it properly.
    """
    if not isinstance(name, str):
        return None
    text = " ".join(name.split()).lower()
    if not text:
        return None
    known = _technology_aliases().get(text)
    if known:
        return known
    slug = re.sub(r"[\s_/]+", "-", text).strip("-")
    return slug if _SLUG_OK.match(slug) else None


def topic_ids() -> frozenset[str]:
    return frozenset(t["id"] for t in topics())


def kind_ids() -> frozenset[str]:
    return frozenset(k["id"] for k in kinds())


def audience_ids() -> frozenset[str]:
    return frozenset(a["id"] for a in audiences())


def level_ids() -> frozenset[str]:
    return frozenset(level["id"] for level in _load()["levels"])


def label(entry_id: str) -> str:
    """Human label for a topic, kind or technology id, falling back to the id itself."""
    for entry in topics() + kinds() + technologies():
        if entry["id"] == entry_id:
            return entry["label"]
    return entry_id
