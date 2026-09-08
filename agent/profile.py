"""Turns stored preferences into the prose block the prompt needs.

The model reads sentences, not slugs. This is the one place that translation happens, so
adding a topic means adding a label here — never editing the prompt.
"""
from __future__ import annotations

TOPICS = {
    "systems": "distributed systems, databases, networking, storage, and scaling",
    "languages": "programming language design, type systems, compilers, and runtimes",
    "ml": "the engineering behind ML systems — serving, quantization, training infra, "
          "inference cost",
    "security": "security, exploits, applied cryptography, and authentication",
    "performance": "performance work, profiling, and low-level optimization",
    "devtools": "developer tooling, editors, build systems, and debugging",
    "web": "web platform internals, browsers, and frontend architecture",
    "career": "engineering practice, team structure, and how software gets built",
}

AVOID = {
    "launches": "product launches and feature announcements that are marketing rather "
                "than engineering",
    "business": "funding rounds, acquisitions, executive moves, and market commentary",
    "crypto": "cryptocurrency, blockchain, and web3",
    "general": "general-interest science, health, and culture stories that reach the "
               "front page without being about computing",
    "releases": "routine version releases, unless the release changes something "
                "architectural",
    "listicles": "listicles, 'top N tools' roundups, and beginner tutorials",
}

LEVELS = {
    "working": "A working engineer. Assume jargon; do not explain fundamentals. "
               "Lead with trade-offs and numbers.",
    "deep": "Comfortable with papers, internals, and formal material. Prefer the most "
            "technically demanding item over the most broadly appealing one.",
    "learning": "Still building depth in these areas. Give enough context to make an "
                "unfamiliar topic followable, without padding.",
}


def render(prefs: dict) -> str:
    """Build the reader description injected into the prompt."""
    parts: list[str] = [LEVELS.get(prefs.get("level"), LEVELS["working"])]

    topics = [TOPICS[t] for t in (prefs.get("topics") or []) if t in TOPICS]
    if topics:
        parts.append("Actively interested in " + _join(topics) + ".")

    avoid = [AVOID[a] for a in (prefs.get("avoid") or []) if a in AVOID]
    if avoid:
        parts.append("Not interested in " + _join(avoid) + ".")

    # Free text last so it can override anything the toggles implied.
    extra = (prefs.get("profile") or "").strip()
    if extra:
        parts.append(extra)

    return "\n\n".join(parts)


def _join(values: list[str]) -> str:
    if len(values) == 1:
        return values[0]
    return ", ".join(values[:-1]) + ", and " + values[-1]
