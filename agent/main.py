"""Orchestrates a full run: fetch -> store -> select.

    python -m agent.main
"""
from __future__ import annotations

import sys
import traceback

from agent import fetch as fetch_mod
from agent import select as select_mod
from agent import store


def run() -> int:
    run_id = store.create_run()
    print(f"run {run_id} started", file=sys.stderr)

    try:
        prefs = store.get_preferences()
        items = fetch_mod.fetch(prefs=prefs)
        if not items:
            store.close_run(run_id, status="failed", error="no items fetched")
            print("no items fetched", file=sys.stderr)
            return 1

        # Candidates come back from the DB, not from `items` — repeats from earlier days
        # are silently dropped by the insert and must not reappear here.
        stored = store.insert_items(run_id, items)
        print(f"fetched {len(items)}, {stored} attached to this run", file=sys.stderr)

        if stored == 0:
            # Every candidate was already seen on an earlier day. Nothing to select, and
            # closing this 'ok' would let it shadow yesterday's digest.
            store.close_run(run_id, status="failed", fetched=0,
                            error="no new items — all candidates seen in an earlier run")
            print("no new items", file=sys.stderr)
            return 0

        # select_mod closes the run itself: it owns the token counts and the partial/ok
        # decision, both of which depend on what the model actually returned.
        return select_mod.select(run_id)

    except Exception as exc:
        store.close_run(run_id, status="failed", error=f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
