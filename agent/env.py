"""Environment values, cleaned of what copy-paste and PowerShell leave behind.

Secrets piped into `gh secret set` from Windows PowerShell 5.1 start with a UTF-8
byte-order mark, which str.strip() does not remove. Invisible in every UI, it turned the
Supabase URL into '\\ufeffhttps://…' and failed each daily run. Every value the pipeline
reads is cleaned once at start-up, and `agent check` names what was corrected — by key,
never by value.
"""
from __future__ import annotations

from collections.abc import MutableMapping

from agent.store.urls import INVISIBLE, describe, supabase_url

KEYS = ("LLM_PROVIDER", "GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL",
        "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "GITHUB_TOKEN", "RESEND_API_KEY",
        "EMAIL_FROM", "SITE_URL")

_DROP_INVISIBLE = {ord(ch): None for ch in INVISIBLE}

# Filled by sanitize(); read by `agent check`.
CORRECTIONS: dict[str, list[str]] = {}


def clean(value: str) -> tuple[str, list[str]]:
    problems = []
    if any(ch in value for ch in INVISIBLE):
        problems.append("invisible characters (a byte-order mark from PowerShell)")
    visible = value.translate(_DROP_INVISIBLE)
    stripped = visible.strip()
    if stripped != visible:
        problems.append("surrounding whitespace")
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in "'\"":
        problems.append("quotes")
        stripped = stripped[1:-1].strip()
    return stripped, problems


def sanitize(environ: MutableMapping[str, str]) -> dict[str, list[str]]:
    """Clean every known key in place. Returns what was wrong with each, by name only."""
    corrections: dict[str, list[str]] = {}
    for key in KEYS:
        if key not in environ:
            continue
        value, problems = clean(environ[key])
        if key == "SUPABASE_URL" and value:
            shape = describe(value)
            if shape:
                problems.append(shape)
            value = supabase_url(value)
        if problems:
            corrections[key] = problems
            environ[key] = value
    CORRECTIONS.clear()
    CORRECTIONS.update(corrections)
    return corrections
