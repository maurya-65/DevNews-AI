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
from pathlib import Path

from agent import store
from agent.llm import get_provider, verdict_schema

PROMPT_PATH = Path(__file__).parent / "prompts" / "select.md"

# Rule 3: weights live here, never in the prompt. Tuning must not mean editing prose.
WEIGHTS = {"novel": 0.4, "consequential": 0.4, "depth": 0.2}
SELECT_COUNT = 8


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


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
           dry_run: bool = False, count: int = SELECT_COUNT) -> int:
    candidates = store.get_candidates(run_id)
    if not candidates:
        print(f"run {run_id} has no candidates", file=sys.stderr)
        return 1

    system = load_prompt()
    user = build_user_block(candidates)

    if dry_run:
        print("=" * 70 + f"\nSYSTEM ({len(system)} chars)\n" + "=" * 70)
        print(system)
        print("=" * 70 + f"\nUSER ({len(user)} chars, {len(candidates)} candidates)\n"
              + "=" * 70)
        print(user)
        return 0

    provider = get_provider(provider_name)
    print(f"{provider.name} / {provider.model} — {len(candidates)} candidates",
          file=sys.stderr)

    verdict = provider.complete(system, user, verdict_schema())
    by_id = verdict.by_id()

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
        error=f"{len(missing)} items had no verdict" if missing else None,
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
    p.add_argument("--count", type=int, default=SELECT_COUNT)
    args = p.parse_args()
    raise SystemExit(select(args.run_id, provider_name=args.provider,
                            dry_run=args.dry_run, count=args.count))


if __name__ == "__main__":
    main()
