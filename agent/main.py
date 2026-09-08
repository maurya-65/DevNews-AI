"""Orchestrates a full run: fetch -> store -> (Phase 3: select).

    python -m agent.main
"""
from __future__ import annotations

import sys
import traceback

from agent import fetch as fetch_mod
from agent import store


def run() -> int:
    run_id = store.create_run()
    print(f"run {run_id} started", file=sys.stderr)

    try:
        items = fetch_mod.fetch()
        if not items:
            store.close_run(run_id, status="failed", error="no items fetched")
            print("no items fetched", file=sys.stderr)
            return 1

        # Candidates come back from the DB, not from `items` — repeats from earlier days
        # are silently dropped by the insert and must not reappear here.
        stored = store.insert_items(run_id, items)
        print(f"fetched {len(items)}, {stored} attached to this run", file=sys.stderr)

        # Phase 3 goes here: select.py reads store.get_candidates(run_id).
        store.close_run(run_id, status="ok", fetched=stored)
        print(f"run {run_id} ok", file=sys.stderr)
        return 0

    except Exception as exc:
        store.close_run(run_id, status="failed", error=f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
