"""The Supabase project URL, forgiving the ways a pasted secret usually goes wrong.

The client refuses anything that does not start with http(s)://. A secret saved with a
byte-order mark, quotes, stray whitespace, no scheme, as the bare project ref, or as the
dashboard link would otherwise fail every run before it starts — v1's cron did exactly
that for a week.
"""
from __future__ import annotations

import re

# str.strip() leaves these alone. Windows PowerShell 5.1 prefixes piped text with the first.
INVISIBLE = "﻿​‌‍⁠"
_DROP_INVISIBLE = {ord(ch): None for ch in INVISIBLE}

PROJECT_REF = re.compile(r"^[a-z0-9]{20}$")
DASHBOARD = re.compile(r"supabase\.com/dashboard/project/([a-z0-9]{20})")


def supabase_url(raw: str) -> str:
    value = raw.translate(_DROP_INVISIBLE).strip().strip("'\"").strip().rstrip("/")
    dashboard = DASHBOARD.search(value)
    if dashboard:
        return f"https://{dashboard.group(1)}.supabase.co"
    if PROJECT_REF.match(value):
        return f"https://{value}.supabase.co"
    if value and not re.match(r"^https?://", value):
        value = "https://" + value
    return value


def describe(raw: str) -> str:
    """What was wrong with the raw value, without printing it (it is a secret in CI)."""
    problems = []
    if any(ch in raw for ch in INVISIBLE):
        problems.append("invisible characters")
    visible = raw.translate(_DROP_INVISIBLE)
    stripped = visible.strip()
    if stripped != visible:
        problems.append("surrounding whitespace")
    if stripped[:1] in "'\"" and stripped:
        problems.append("quotes")
    inner = stripped.strip("'\"").strip()
    if DASHBOARD.search(inner):
        problems.append("dashboard link instead of the API URL")
    elif PROJECT_REF.match(inner.rstrip("/")):
        problems.append("bare project ref")
    elif inner and not re.match(r"^https?://", inner):
        problems.append("no https:// scheme")
    return ", ".join(problems)
