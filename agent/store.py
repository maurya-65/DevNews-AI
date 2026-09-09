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


def quota_slice(items: list[dict], prefs: dict) -> list[dict]:
    """Trim the shared pool to what this user asked for, per source.

    The pool is fetched for the most demanding profile, so a user who wants fewer HN
    items should not be scored against everyone else's extras.
    """
    caps = {"hn": prefs.get("hn_quota", 10),
            "lobsters": prefs.get("lobsters_quota", 5),
            "blog": prefs.get("blogs_quota", 5)}
    seen: dict[str, int] = {}
    kept = []
    for item in items:
        source = item["source"]
        taken = seen.get(source, 0)
        if taken >= caps.get(source, 0):
            continue
        seen[source] = taken + 1
        kept.append(item)
    return kept


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


def update_verdicts(run_id: int, user_id: str, updates: list[dict]) -> None:
    """Write one user's verdicts for this run.

    Upsert on (user_id, item_id) so re-running selection replaces that user's verdicts
    instead of accumulating them. Other users' rows are untouched.
    """
    if not updates:
        return
    rows = [{**row, "run_id": run_id, "user_id": user_id} for row in updates]
    client().table("verdicts").upsert(rows, on_conflict="user_id,item_id").execute()


def get_candidate_items(run_id: int) -> list[dict]:
    """The shared pool for a run. Identical for every user."""
    return (client().table("items").select("*")
            .eq("run_id", run_id).order("id").execute().data)


DEFAULT_PREFERENCES = {
    "profile": None,
    "topics": [],
    "avoid": [],
    "level": "working",
    "select_count": 8,
    "min_score": 4.0,
    "hn_quota": 10,
    "lobsters_quota": 5,
    "blogs_quota": 5,
}


def get_profiles() -> list[dict]:
    """Every user the digest runs for.

    One row per signed-up account, created by a trigger on auth.users. An empty list
    means nobody has signed up yet — not an error, just nothing to do.
    """
    try:
        rows = client().table("profiles").select("*").order("created_at").execute().data
    except Exception as exc:
        print(f"  profiles unavailable ({type(exc).__name__})")
        return []
    return [{**DEFAULT_PREFERENCES, **{k: v for k, v in r.items() if v is not None}}
            for r in rows]


def fetch_quotas(profiles: list[dict]) -> dict:
    """Source quotas for the shared fetch: the largest any user asked for.

    Fetching once for everyone means the pool has to satisfy the most demanding profile;
    a user who wants fewer simply gets scored against fewer.
    """
    if not profiles:
        return {k: DEFAULT_PREFERENCES[k]
                for k in ("hn_quota", "lobsters_quota", "blogs_quota")}
    return {
        key: max(p.get(key, DEFAULT_PREFERENCES[key]) for p in profiles)
        for key in ("hn_quota", "lobsters_quota", "blogs_quota")
    }
