"""Retry and fallback across providers, with every attempt recorded.

Free tiers throw transient failures. How to react depends on which kind:

- Overload (503, 429, "high demand"): the spike lasts minutes, not seconds, so waiting
  and retrying the same provider rarely helps — measured, it failed four times out of
  four. Go straight to the other provider, and come back to the primary only if that
  fails too.
- Anything else (a malformed response, a dropped connection): retry the primary once,
  immediately, then fall back.

Either way a bad minute at one vendor becomes a logged degradation, not a missing edition.
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Callable

from agent.llm.base import Completion, Provider, ProviderError

RETRY_DELAY_SECONDS = 20
PROVIDERS = ("gemini", "groq")
OVERLOAD_MARKERS = ("503", "unavailable", "overloaded", "high demand", "429",
                    "resource_exhausted", "rate limit", "rate_limit")


def is_overload(message: str) -> bool:
    lowered = message.lower()
    return any(marker in lowered for marker in OVERLOAD_MARKERS)


def _build(name: str) -> Provider:
    if name == "gemini":
        from agent.llm.gemini import Gemini
        return Gemini()
    if name == "groq":
        from agent.llm.groq import Groq
        return Groq()
    raise ProviderError(f"unknown provider {name!r}")


class Router:
    def __init__(self, primary: str | None = None,
                 on_call: Callable[[dict], None] | None = None):
        first = (primary or os.environ.get("LLM_PROVIDER") or "gemini").strip().lower()
        if first not in PROVIDERS:
            raise ValueError(f"LLM_PROVIDER must be one of {PROVIDERS}, got {first!r}")
        self.order = [first] + [p for p in PROVIDERS if p != first]
        self.on_call = on_call or (lambda record: None)
        self._providers: dict[str, Provider | None] = {}

    def _provider(self, name: str) -> Provider | None:
        if name not in self._providers:
            try:
                self._providers[name] = _build(name)
            except ProviderError as exc:
                print(f"    {name} unavailable: {exc}", file=sys.stderr)
                self._providers[name] = None
        return self._providers[name]

    def complete_json(self, stage: str, system: str, user: str, schema: dict,
                      max_output_tokens: int = 16_000) -> Completion:
        primary = self.order[0]
        queue: list[tuple[str, float]] = [(name, 0.0) for name in self.order]
        retried_primary = False
        errors: list[str] = []

        position = 0
        while position < len(queue):
            name, wait = queue[position]
            position += 1
            provider = self._provider(name)
            if provider is None:
                continue
            if wait:
                time.sleep(wait)

            started = time.monotonic()
            try:
                completion = provider.complete_json(system, user, schema, max_output_tokens)
            except ProviderError as exc:
                message = str(exc)[:300]
                errors.append(f"{name}: {message}")
                print(f"    ! {name}: {message[:140]}", file=sys.stderr)
                self.on_call({
                    "stage": stage, "provider": name, "model": provider.model, "ok": False,
                    "input_tokens": None, "output_tokens": None,
                    "latency_ms": int((time.monotonic() - started) * 1000), "error": message,
                })
                if name == primary and not retried_primary:
                    retried_primary = True
                    if is_overload(message):
                        queue.append((primary, RETRY_DELAY_SECONDS))
                    else:
                        queue.insert(position, (primary, 0.0))
                continue

            self.on_call({
                "stage": stage, "provider": completion.provider, "model": completion.model,
                "ok": True, "input_tokens": completion.input_tokens,
                "output_tokens": completion.output_tokens,
                "latency_ms": completion.latency_ms,
                "error": "truncated" if completion.truncated else None,
            })
            return completion

        if not errors:
            raise ProviderError("no provider is configured (set GEMINI_API_KEY or GROQ_API_KEY)")
        raise ProviderError("every provider failed: " + " | ".join(errors))
