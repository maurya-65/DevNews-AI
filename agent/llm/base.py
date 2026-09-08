"""The contract every provider implements.

CLAUDE.md rule 8: the provider is swappable, the contract is not. A new provider is a new
file here returning the same Verdict. It is never a change to select.py, the weights, or
the schema.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

# Scores the model returns per item. Weights live in select.py, never in the prompt
# (rule 3) and never here.
CRITERIA = ("novel", "consequential", "depth")


@dataclass(frozen=True)
class Verdict:
    """One provider response, already parsed and shape-checked."""
    items: list[dict]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    truncated: bool = False
    raw: str = field(default="", repr=False)

    def by_id(self) -> dict[int, dict]:
        return {int(i["id"]): i for i in self.items if "id" in i}


@runtime_checkable
class Provider(Protocol):
    name: str
    model: str

    def complete(self, system: str, user: str, schema: dict) -> Verdict:
        """One call. Returns a verdict for every candidate the user block listed."""
        ...


def verdict_schema(max_summary: int = 320, max_reason: int = 200) -> dict:
    """JSON Schema for the response. Shared by both providers so output can't diverge.

    Every candidate gets a verdict, including rejects (rule 4) — rejected summaries are
    what make the debug page useful.
    """
    return {
        "type": "object",
        "properties": {
            "verdicts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer",
                               "description": "The candidate's id, exactly as given."},
                        "novel": {"type": "number",
                                  "description": "0-10. Is this genuinely new, or a "
                                                 "restatement of something already known?"},
                        "consequential": {"type": "number",
                                          "description": "0-10. Does it change what "
                                                         "someone builds or believes?"},
                        "depth": {"type": "number",
                                  "description": "0-10. Substance behind the headline, "
                                                 "vs announcement or press release."},
                        "reason": {"type": "string",
                                   "description": f"Under {max_reason} chars. Why these "
                                                  "scores. Blunt, specific, no hedging."},
                        "summary": {"type": "string",
                                    "description": f"Under {max_summary} chars. What it "
                                                   "says and why it matters."},
                    },
                    "required": ["id", "novel", "consequential", "depth",
                                 "reason", "summary"],
                },
            }
        },
        "required": ["verdicts"],
    }
