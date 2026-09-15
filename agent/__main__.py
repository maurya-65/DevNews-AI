"""Command line.

    python -m agent run                          # the daily run, against Supabase
    python -m agent run --store memory --memory-file out.json   # full dry run, no database
    python -m agent sources                      # what every source returns right now
    python -m agent prompt                       # the analysis prompt and schema
    python -m agent editions                     # re-rank today from stored analyses; no model calls
    python -m agent check                        # environment and schema
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
V2_TABLES = ("sources", "pipeline_runs", "run_stages", "llm_calls", "articles", "mentions",
             "threads", "analyses", "taste", "editions", "edition_items", "saves", "votes", "events")


def cmd_run(args) -> int:
    from agent import pipeline
    from agent.store import open_store

    store = open_store(args.store, args.memory_file)
    code = pipeline.run(store, provider=args.provider, max_analyze=args.max_analyze,
                        send_email=not args.no_email)
    if args.store == "memory" and args.memory_file:
        store.dump()
        print(f"wrote {args.memory_file}", file=sys.stderr)
    return code


def cmd_sources(_args) -> int:
    from agent import config, dedupe, prefilter
    from agent.sources import FETCHERS

    candidates = []
    for source in config.DEFAULT_SOURCES:
        started = time.monotonic()
        try:
            got = FETCHERS[source["kind"]](source["id"], source["config"], source["quota"])
        except Exception as exc:
            print(f"{source['id']:9} FAILED {type(exc).__name__}: {exc}")
            continue
        print(f"{source['id']:9} {len(got):>3} in {time.monotonic() - started:.1f}s")
        candidates += got

    drafts = dedupe.merge(candidates)
    chosen = prefilter.choose_for_analysis(drafts)
    print(f"\n{len(candidates)} candidates -> {len(drafts)} articles -> {len(chosen)} for analysis")
    print(f"by source: {dict(Counter(d.mentions[0].source for d in chosen))}\n")
    for d in chosen:
        print(f"{d.signal:.2f}  {','.join(d.sources):16} {d.title[:80]}")
    return 0


def cmd_prompt(_args) -> int:
    from agent import analyze

    print(analyze.system_prompt())
    print("\n--- schema ---\n")
    print(json.dumps(analyze.schema(), indent=2))
    return 0


def cmd_editions(args) -> int:
    from agent import editions
    from agent.store import open_store

    store = open_store(args.store, args.memory_file)
    now = datetime.now(timezone.utc)
    print(editions.learn(store, now))
    print(editions.build_all(store, None, now))
    if args.store == "memory" and args.memory_file:
        store.dump()
    return 0


def cmd_check(_args) -> int:
    ok = True
    print("environment")
    for key, required in (("SUPABASE_URL", True), ("SUPABASE_SERVICE_KEY", True),
                          ("GEMINI_API_KEY", False), ("GROQ_API_KEY", False),
                          ("RESEND_API_KEY", False), ("EMAIL_FROM", False), ("SITE_URL", False)):
        present = bool(os.environ.get(key, "").strip())
        state = "ok" if present else ("MISSING" if required else "not set")
        print(f"  {state:8} {key}")
        ok = ok and (present or not required)
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GROQ_API_KEY")):
        print("  MISSING  a model key: set GEMINI_API_KEY or GROQ_API_KEY")
        ok = False

    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"):
        from agent.store.supabase_store import SupabaseStore
        print("\ndatabase")
        db = SupabaseStore().db
        missing = []
        for table in V2_TABLES:
            try:
                count = db.table(table).select("*", count="exact").limit(1).execute().count
                print(f"  ok       {table} ({count} rows)")
            except Exception:
                print(f"  MISSING  {table}")
                missing.append(table)
        if missing:
            print("\n  apply supabase/migrations/20260915000000_v2.sql in the Supabase SQL editor")
            ok = False

    print("\nall good" if ok else "\nfix the items above")
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(prog="python -m agent", description="DevNews pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="the full daily run")
    run.add_argument("--store", choices=["supabase", "memory"], default="supabase")
    run.add_argument("--memory-file", help="with --store memory: load and save state here")
    run.add_argument("--provider", choices=["gemini", "groq"], help="override LLM_PROVIDER")
    run.add_argument("--max-analyze", type=int, default=48, help="cap on articles sent to the model")
    run.add_argument("--no-email", action="store_true", help="skip the notify stage")
    run.set_defaults(func=cmd_run)

    sub.add_parser("sources", help="fetch every source and print what came back").set_defaults(func=cmd_sources)
    sub.add_parser("prompt", help="print the analysis prompt and schema").set_defaults(func=cmd_prompt)

    eds = sub.add_parser("editions", help="rebuild today's editions from stored analyses")
    eds.add_argument("--store", choices=["supabase", "memory"], default="supabase")
    eds.add_argument("--memory-file")
    eds.set_defaults(func=cmd_editions)

    sub.add_parser("check", help="verify environment and database schema").set_defaults(func=cmd_check)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
