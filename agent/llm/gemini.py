"""Gemini, the default. Structured output is enforced by the API itself."""
from __future__ import annotations

import json
import os
import time

from google import genai
from google.genai import types

from agent.llm.base import Completion, ProviderError

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")


class Gemini:
    name = "gemini"

    def __init__(self, model: str = MODEL):
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            raise ProviderError("GEMINI_API_KEY is not set")
        self.model = model
        # An overloaded model can hold a request open for a minute before a 503; the
        # router's fallback only helps if a call gives up in bounded time.
        self._client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=75_000))

    def complete_json(self, system: str, user: str, schema: dict,
                      max_output_tokens: int) -> Completion:
        started = time.monotonic()
        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    max_output_tokens=max_output_tokens,
                    # Judgement should not swing on sampling noise between runs.
                    temperature=0.2,
                    # No tools are declared; this also silences the SDK's AFC warning.
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
        except Exception as exc:  # the SDK raises many unrelated types; all mean "failed"
            raise ProviderError(f"{type(exc).__name__}: {exc}") from exc

        text = (response.text or "").strip()
        candidate = (response.candidates or [None])[0]
        truncated = bool(candidate and str(getattr(candidate, "finish_reason", "")).endswith("MAX_TOKENS"))
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            hint = " (hit max_output_tokens)" if truncated else ""
            raise ProviderError(f"invalid JSON{hint}: {exc}") from exc

        usage = response.usage_metadata
        return Completion(
            data=data,
            provider=self.name,
            model=self.model,
            input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            output_tokens=(getattr(usage, "candidates_token_count", 0) or 0)
            + (getattr(usage, "thoughts_token_count", 0) or 0),
            latency_ms=int((time.monotonic() - started) * 1000),
            truncated=truncated,
            raw=text,
        )
