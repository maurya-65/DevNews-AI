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

# Weights per level. "depth" rewards substance behind the headline, which for a reader
# still building up actively fights them — so it is dialled down rather than removed.
# Weights stay in code, never in the prompt (rule 3).
WEIGHTS = {
    "working": {"novel": 0.4, "consequential": 0.4, "depth": 0.2},
    "deep": {"novel": 0.3, "consequential": 0.3, "depth": 0.4},
    "learning": {"novel": 0.45, "consequential": 0.45, "depth": 0.1},
}

# How "novel" is judged. The default definition punishes explainers of known topics —
# exactly what a learning reader needs most — so that reader gets a different rule.
NOVELTY = {
    "working": "Is this genuinely new information, or a restatement of something the "
               "reader almost certainly already knows? A well-written explainer of a "
               "well-known topic scores low here even if it is excellent.",
    "deep": "Is this new to someone who follows the field closely? Incremental work "
            "scores low. A result that changes what is known scores high.",
    "learning": "Is this new *to this reader*, not to the field? A clear explainer of an "
                "established topic they have not met yet is genuinely novel to them and "
                "should score well. Score low only for things they would already have "
                "seen, or that assume knowledge they do not have yet.",
}

LEVELS = {
    "working": "A working engineer. Assume jargon; do not explain fundamentals. "
               "Lead with trade-offs and numbers.",
    "deep": "Comfortable with papers, internals, and formal material. Prefer the most "
            "technically demanding item over the most broadly appealing one.",
    "learning": "Still building depth in these areas. Give enough context to make an "
                "unfamiliar topic followable, without padding.",
}


def weights(prefs: dict) -> dict:
    return WEIGHTS.get(prefs.get("level"), WEIGHTS["working"])


def novelty_rule(prefs: dict) -> str:
    return NOVELTY.get(prefs.get("level"), NOVELTY["working"])


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
