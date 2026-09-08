"""Groq provider. Alternate — LLM_PROVIDER=groq.

Groq's free tier is 6K tokens/minute and one full run is close to that, so truncation is
more likely here than on Gemini. See BUILDFLOW Phase 3 gotchas.
"""
from __future__ import annotations

import json
import os

from groq import Groq as GroqClient

from agent.llm.base import Verdict

# llama-3.3-70b-versatile was retired; verified available 2026-09-08.
MODEL = "openai/gpt-oss-120b"
MAX_OUTPUT_TOKENS = 8000


class Groq:
    name = "groq"

    def __init__(self, model: str = MODEL):
        key = os.environ.get("GROQ_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GROQ_API_KEY missing — see .env")
        self.model = model
        self._client = GroqClient(api_key=key)

    def complete(self, system: str, user: str, schema: dict) -> Verdict:
        # Groq's json_object mode guarantees valid JSON but not *this* shape, so the
        # schema goes in the prompt as well. Gemini enforces it natively.
        system_with_schema = (
            f"{system}\n\n"
            f"Return JSON matching exactly this schema:\n"
            f"{json.dumps(schema, indent=2)}"
        )

        response = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_with_schema},
                      {"role": "user", "content": user}],
            response_format={"type": "json_object"},
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.2,
        )

        choice = response.choices[0]
        text = (choice.message.content or "").strip()
        truncated = choice.finish_reason == "length"

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            hint = " (output hit max_tokens)" if truncated else ""
            raise ValueError(f"Groq returned invalid JSON{hint}: {exc}") from exc

        return Verdict(
            items=parsed.get("verdicts", []),
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            truncated=truncated,
            raw=text,
        )
