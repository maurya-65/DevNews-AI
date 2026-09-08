"""Phase 3: the one LLM call. Scores every candidate, then code ranks and cuts.

    python -m agent.select --run-id 1          # re-select an existing run
    python -m agent.select --run-id 1 --dry-run   # print the prompt, no API call
    python -m agent.select --run-id 1 --provider groq

--run-id is the development loop for prompt work: it avoids a fresh fetch, so successive
prompt versions are compared on an identical item set.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from agent import profile, store
from agent.llm import get_provider, verdict_schema

PROMPT_PATH = Path(__file__).parent / "prompts" / "select.md"

# Rule 3: weights live here, never in the prompt. Tuning must not mean editing prose.
WEIGHTS = {"novel": 0.4, "consequential": 0.4, "depth": 0.2}
SELECT_COUNT = 8  # fallback; the stored preference wins when there is one

RETRY_DELAY = 20  # seconds; free-tier 503s are transient overload, not a hard failure


def call_with_fallback(system: str, user: str, schema: dict,
                       provider_name: str | None = None):
    """One call, but do not let a transient free-tier 503 cost the whole day.

    Retry the configured provider once, then fall back to the other one. This is the
    payoff of supporting both (decision 19): a dead provider becomes a logged degradation
    instead of a missing digest. Still one *successful* call per run — rule 1 holds.

    Returns (verdict, note) where note is None on a clean first-try success.
    """
    primary = (provider_name or None)
    order = [primary] if primary else [None]
    # The other provider, whatever the first resolved to.
    first = get_provider(primary)
    alternate = "groq" if first.name == "gemini" else "gemini"

    last_exc = None
    for attempt, (name, wait) in enumerate([(primary, 0), (primary, RETRY_DELAY),
                                            (alternate, 0)]):
        try:
            if wait:
                print(f"  retrying in {wait}s…", file=sys.stderr)
                time.sleep(wait)
            provider = get_provider(name)
            if attempt:
                print(f"  attempt {attempt + 1}: {provider.name} / {provider.model}",
                      file=sys.stderr)
            verdict = provider.complete(system, user, schema)
            note = None if attempt == 0 else (
                f"succeeded on attempt {attempt + 1} via {provider.name} "
                f"after {type(last_exc).__name__}")
            return verdict, note
        except Exception as exc:
            last_exc = exc
            print(f"  ! {type(exc).__name__}: {str(exc)[:120]}", file=sys.stderr)

    raise RuntimeError(f"all providers failed; last: {last_exc}") from last_exc


def load_prompt(prefs: dict) -> str:
    """The prompt with the reader description substituted in.

    The profile is data, not prose in a file: it is edited in the settings UI and stored
    in the DB, so tuning taste never means editing a prompt (the same reasoning as
    rule 3 for weights).
    """
    return PROMPT_PATH.read_text(encoding="utf-8").replace(
        "{{READER}}", profile.render(prefs))


def build_user_block(candidates: list[dict]) -> str:
    """One line-delimited record per candidate.

    Deliberately omits points/comments (decision 10) — showing them would just make the
    model re-rank HN's ranking.
    """
    parts = []
    for c in candidates:
        lines = [f"id: {c['id']}",
                 f"source: {c['source']}",
                 f"title: {c['title']}"]
        # Domain is a real signal (a vendor blog vs a personal site) and is free.
        lines.append(f"url: {c['url']}")
        lines.append(f"blurb: {c['blurb']}" if c.get("blurb") else "blurb: (none)")
        parts.append("\n".join(lines))

    return (f"{len(candidates)} candidates today. Return exactly {len(candidates)} "
            f"verdicts.\n\n" + "\n\n---\n\n".join(parts))


def score(verdict_item: dict) -> float:
    """Weighted sum, computed in code (rule 2). Clamped — the model can return anything."""
    total = 0.0
    for key, weight in WEIGHTS.items():
        try:
            value = float(verdict_item.get(key) or 0)
        except (TypeError, ValueError):
            value = 0.0
        total += max(0.0, min(10.0, value)) * weight
    return round(total, 2)


def select(run_id: int, *, provider_name: str | None = None,
           dry_run: bool = False, count: int | None = None) -> int:
    candidates = store.get_candidates(run_id)
    if not candidates:
        print(f"run {run_id} has no candidates", file=sys.stderr)
        return 1

    prefs = store.get_preferences()
    if count is None:
        count = prefs.get("select_count") or SELECT_COUNT
    count = max(1, min(count, len(candidates)))

    system = load_prompt(prefs)
    user = build_user_block(candidates)

    if dry_run:
        print("=" * 70 + f"\nSYSTEM ({len(system)} chars)\n" + "=" * 70)
        print(system)
        print("=" * 70 + f"\nUSER ({len(user)} chars, {len(candidates)} candidates)\n"
              + "=" * 70)
        print(user)
        return 0

    print(f"{get_provider(provider_name).name} — {len(candidates)} candidates",
          file=sys.stderr)

    verdict, fallback_note = call_with_fallback(
        system, user, verdict_schema(), provider_name)
    by_id = verdict.by_id()

    if fallback_note:
        print(f"  ! {fallback_note}", file=sys.stderr)
    if verdict.truncated:
        print("  ! response was truncated — raise MAX_OUTPUT_TOKENS", file=sys.stderr)

    missing = [c["id"] for c in candidates if c["id"] not in by_id]
    if missing:
        print(f"  ! no verdict for {len(missing)} items: {missing}", file=sys.stderr)

    # Rank in code. The model never sees a cutoff (rule 2).
    scored = []
    for c in candidates:
        v = by_id.get(c["id"])
        if not v:
            continue
        scored.append({**c, "_v": v, "_score": score(v)})
    scored.sort(key=lambda r: r["_score"], reverse=True)

    updates = []
    for rank, row in enumerate(scored, 1):
        v, chosen = row["_v"], rank <= count
        updates.append({
            "id": row["id"],
            "novel": v.get("novel"),
            "consequential": v.get("consequential"),
            "depth": v.get("depth"),
            "score": row["_score"],
            "reason": (v.get("reason") or "")[:400] or None,
            "summary": (v.get("summary") or "")[:600] or None,
            "selected": chosen,
            "position": rank if chosen else None,
        })

    store.update_verdicts(run_id, updates)
    store.close_run(
        run_id,
        status="partial" if (missing or verdict.truncated) else "ok",
        fetched=len(candidates),
        selected=min(count, len(scored)),
        input_tokens=verdict.input_tokens,
        output_tokens=verdict.output_tokens,
        error="; ".join(filter(None, [
            f"{len(missing)} items had no verdict" if missing else None,
            fallback_note,
        ])) or None,
    )

    print(f"\n{verdict.input_tokens} in / {verdict.output_tokens} out tokens\n",
          file=sys.stderr)
    for rank, row in enumerate(scored, 1):
        mark = "*" if rank <= count else " "
        print(f"{mark}{rank:>2}. {row['_score']:>5.2f}  [{row['source']}] "
              f"{row['title'][:62]}")
        print(f"      {row['_v'].get('reason', '')[:100]}")
    return 0


def main() -> None:
    p = argparse.ArgumentParser(description="Score and select candidates for a run.")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--provider", choices=["gemini", "groq"],
                   help="override LLM_PROVIDER")
    p.add_argument("--dry-run", action="store_true",
                   help="print the prompt instead of calling the API")
    p.add_argument("--count", type=int, default=None,
                   help="override the stored select_count")
    args = p.parse_args()
    raise SystemExit(select(args.run_id, provider_name=args.provider,
                            dry_run=args.dry_run, count=args.count))


if __name__ == "__main__":
    main()
