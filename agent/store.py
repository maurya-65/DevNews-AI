"""Supabase reads and writes. The only place the service key is used.

Nothing survives on the runner (CLAUDE.md rule 6), so every piece of state a later step
needs has to round-trip through here.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_client: Client | None = None


def client() -> Client:
    """Lazily build the client so importing this module never needs credentials."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_KEY missing — check .env "
                "(run: python scripts/check_env.py)")
        _client = create_client(url, key)
    return _client


def create_run() -> int:
    """Open a run row and return its id. Must happen before any item insert (FK)."""
    row = client().table("runs").insert({"status": "running"}).execute().data[0]
    return row["id"]


def insert_items(run_id: int, items: list[dict]) -> int:
    """Insert candidates, skipping any already seen on an earlier day.

    ON CONFLICT DO NOTHING against UNIQUE(source, external_id) is what makes yesterday's
    repeats disappear for free: the existing row keeps its old run_id, so it simply won't
    appear in this run's candidate set. That is why callers must read candidates back with
    get_candidates() rather than reusing the fetch output.
    """
    if not items:
        return 0
    rows = [{**item, "run_id": run_id} for item in items]
    client().table("items").upsert(
        rows, on_conflict="source,external_id", ignore_duplicates=True).execute()
    return len(get_candidates(run_id))


def get_candidates(run_id: int) -> list[dict]:
    """The items actually attached to this run — the real input to selection."""
    return (client().table("items").select("*")
            .eq("run_id", run_id).order("id").execute().data)


def close_run(run_id: int, *, status: str, fetched: int = 0, selected: int = 0,
              error: str | None = None, input_tokens: int | None = None,
              output_tokens: int | None = None, cost_usd: float = 0) -> None:
    """Finalize the run. status: ok | partial | failed."""
    client().table("runs").update({
        "status": status,
        "fetched": fetched,
        "selected": selected,
        "error": error,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
    }).eq("id", run_id).execute()


def update_verdicts(run_id: int, updates: list[dict]) -> None:
    """Write scores back, resetting selection first.

    The reset matters: without it, re-running selection on the same run leaves the previous
    winners flagged and the digest accumulates instead of being replaced.
    """
    client().table("items").update(
        {"selected": False, "position": None}).eq("run_id", run_id).execute()

    for row in updates:
        item_id = row.pop("id")
        client().table("items").update(row).eq("id", item_id).execute()


DEFAULT_PREFERENCES = {
    "profile": None,
    "topics": [],
    "avoid": [],
    "level": "working",
    "select_count": 8,
    "hn_quota": 10,
    "lobsters_quota": 5,
    "blogs_quota": 5,
}


def get_preferences() -> dict:
    """The single preferences row, or defaults if the table isn't there yet.

    Never fails the run: a missing table or an empty row means "use the defaults", not
    "no digest today".
    """
    try:
        rows = client().table("preferences").select("*").eq("id", 1).execute().data
    except Exception as exc:
        print(f"  preferences unavailable ({type(exc).__name__}), using defaults")
        return dict(DEFAULT_PREFERENCES)

    if not rows:
        return dict(DEFAULT_PREFERENCES)
    return {**DEFAULT_PREFERENCES, **{k: v for k, v in rows[0].items() if v is not None}}
