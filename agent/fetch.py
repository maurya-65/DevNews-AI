"""Phase 1: three sources -> dedupe -> top N. No LLM, no DB.

    python -m agent.fetch            # human-readable table
    python -m agent.fetch --json     # the raw list, for piping

main.py imports fetch(); running this module directly is the Phase 1 exit check.
"""
from __future__ import annotations

import argparse
import json
import sys

from agent.sources import blogs, hackernews, lobsters

# Quotas, not literals — tuning these should never mean editing logic.
TOTAL = 20
SOURCES = (
    ("hn", hackernews.fetch, 10),
    ("lobsters", lobsters.fetch, 5),
    ("blog", blogs.fetch, 5),
)


def fetch(total: int = TOTAL) -> list[dict]:
    """Collect from every source, drop duplicates, trim to `total`.

    A source that raises is skipped with a warning. One dead API must not cost us the run
    — that is a day with no digest, and tomorrow's run won't backfill it.
    """
    collected: list[dict] = []
    for name, fn, quota in SOURCES:
        try:
            items = fn(quota)
            print(f"  {name:9} {len(items):>2} items", file=sys.stderr)
            collected.extend(items)
        except Exception as exc:
            print(f"  {name:9}  FAILED — {type(exc).__name__}: {exc}", file=sys.stderr)

    return _dedupe(collected)[:total]


def _dedupe(items: list[dict]) -> list[dict]:
    """Collapse the same story appearing on more than one source.

    Source order in SOURCES decides the winner, so the earlier source keeps the item along
    with its points/comments. Cross-source duplicates are caught here rather than in the DB,
    because the UNIQUE constraint is on (source, external_id) — which by design does not
    catch the same URL arriving under two different sources.
    """
    seen: dict[str, dict] = {}
    for item in items:
        key = item["canonical_url"]
        if key in seen:
            print(f"  dupe: {item['source']} -> {seen[key]['source']}: "
                  f"{item['title'][:55]}", file=sys.stderr)
            continue
        seen[key] = item
    return list(seen.values())


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch candidate headlines.")
    parser.add_argument("--json", action="store_true", help="print the raw list as JSON")
    args = parser.parse_args()

    print("fetching…", file=sys.stderr)
    items = fetch()

    if args.json:
        print(json.dumps(items, indent=2, ensure_ascii=False))
        return

    print(f"\n{len(items)} items\n", file=sys.stderr)
    for n, item in enumerate(items, 1):
        metrics = ""
        if item["points"] is not None:
            metrics = f"  [{item['points']}pts {item['comments']}c]"
        print(f"{n:>2}. [{item['source']}] {item['title']}{metrics}")
        print(f"    {item['url']}")
        print(f"    {item['blurb'][:110] if item['blurb'] else '— no blurb —'}\n")

    missing = sum(1 for i in items if not i["blurb"])
    print(f"blurb missing on {missing}/{len(items)} items", file=sys.stderr)


if __name__ == "__main__":
    main()
