"""Provider selection. Nothing outside this package knows which one ran."""
from __future__ import annotations

import os

from dotenv import load_dotenv

from agent.llm.base import CRITERIA, Provider, Verdict, verdict_schema

load_dotenv()

DEFAULT = "gemini"


def get_provider(name: str | None = None) -> Provider:
    name = (name or os.environ.get("LLM_PROVIDER") or DEFAULT).strip().lower()

    if name == "gemini":
        from agent.llm.gemini import Gemini
        return Gemini()
    if name == "groq":
        from agent.llm.groq import Groq
        return Groq()

    raise ValueError(f"Unknown LLM_PROVIDER {name!r} — expected 'gemini' or 'groq'")


__all__ = ["CRITERIA", "Provider", "Verdict", "get_provider", "verdict_schema"]
