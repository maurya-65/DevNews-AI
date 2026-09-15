"""The contract every provider implements.

A provider takes a system prompt, a user message and a JSON schema, and returns parsed JSON
with token counts. Adding a provider is a new file here and one line in the router; the
analysis code never changes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


class ProviderError(RuntimeError):
    """A call failed in a way the router should treat as 'try something else'."""


@dataclass(frozen=True)
class Completion:
    data: dict
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    truncated: bool = False
    raw: str = field(default="", repr=False)


class Provider(Protocol):
    name: str
    model: str

    def complete_json(self, system: str, user: str, schema: dict,
                      max_output_tokens: int) -> Completion:
        ...
