"""Groq, the fallback. Fast, with a tight free-tier token budget per minute.

json_object mode guarantees valid JSON but not this particular shape, so the schema is
restated in the system prompt and the analysis step validates every field regardless.
"""
from __future__ import annotations

import json
import os
import time

from groq import Groq as GroqClient

from agent.llm.base import Completion, ProviderError

MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")


class Groq:
    name = "groq"

    def __init__(self, model: str = MODEL):
        key = os.environ.get("GROQ_API_KEY", "").strip()
        if not key:
            raise ProviderError("GROQ_API_KEY is not set")
        self.model = model
        self._client = GroqClient(api_key=key)

    def complete_json(self, system: str, user: str, schema: dict,
                      max_output_tokens: int) -> Completion:
        started = time.monotonic()
        request = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": f"{system}\n\nReturn only JSON matching this schema:\n"
                                              f"{json.dumps(schema, separators=(',', ':'))}"},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": max_output_tokens,
            "temperature": 0.2,
        }
        # Reasoning models spend completion tokens thinking; this task needs little of it.
        if "gpt-oss" in self.model:
            request["reasoning_effort"] = "low"

        try:
            response = self._client.chat.completions.create(**request)
        except Exception as exc:
            raise ProviderError(f"{type(exc).__name__}: {exc}") from exc

        choice = response.choices[0]
        text = (choice.message.content or "").strip()
        truncated = choice.finish_reason == "length"
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            hint = " (hit max_completion_tokens)" if truncated else ""
            raise ProviderError(f"invalid JSON{hint}: {exc}") from exc

        return Completion(
            data=data,
            provider=self.name,
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
            truncated=truncated,
            raw=text,
        )
