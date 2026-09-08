"""Gemini provider. Default — see PROGRESS decisions 17-19."""
from __future__ import annotations

import json
import os

from google import genai
from google.genai import types

from agent.llm.base import Verdict

MODEL = "gemini-3.8-flash"
MAX_OUTPUT_TOKENS = 8000


class Gemini:
    name = "gemini"

    def __init__(self, model: str = MODEL):
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GEMINI_API_KEY missing — see .env")
        self.model = model
        self._client = genai.Client(api_key=key)

    def complete(self, system: str, user: str, schema: dict) -> Verdict:
        response = self._client.models.generate_content(
            model=self.model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                # Judgment should be stable across runs; the same headline on two days
                # should not swing on sampling noise.
                temperature=0.2,
            ),
        )

        text = (response.text or "").strip()
        usage = response.usage_metadata
        candidate = (response.candidates or [None])[0]
        # MAX_TOKENS means the JSON is cut off mid-structure — caller must not trust it.
        truncated = bool(candidate and str(
            getattr(candidate, "finish_reason", "")).endswith("MAX_TOKENS"))

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            hint = " (output hit max_output_tokens)" if truncated else ""
            raise ValueError(f"Gemini returned invalid JSON{hint}: {exc}") from exc

        return Verdict(
            items=parsed.get("verdicts", []),
            model=self.model,
            input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            output_tokens=getattr(usage, "candidates_token_count", 0) or 0,
            truncated=truncated,
            raw=text,
        )
