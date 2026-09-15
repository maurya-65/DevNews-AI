"""URLs, timestamps and text, made comparable across sources."""
from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Stripped before comparing. utm_* and friends are handled by prefix.
TRACKING_PARAMS = frozenset({
    "fbclid", "gclid", "dclid", "msclkid", "twclid", "igshid", "mc_cid", "mc_eid",
    "ref", "ref_src", "referrer", "source", "src", "campaign", "yclid", "_hsenc", "_hsmi",
    "vero_id", "wt_mc", "at_medium", "at_campaign", "spm", "scid", "si", "s_cid",
})
TRACKING_PREFIXES = ("utm_", "pk_", "piwik_", "matomo_", "ga_", "hmb_")


def canonical_url(url: str | None) -> str:
    """The identity of a piece of writing, so the same post from two sources is one article.

    Conservative on purpose. Scheme, host case, www., default ports, fragments and tracking
    parameters are noise; the path and any other query parameter can be load-bearing
    (?id=, ?v=) and are kept exactly.
    """
    if not url:
        return ""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return ""

    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host.endswith(":443") or host.endswith(":80"):
        host = host.rsplit(":", 1)[0]

    kept = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS and not k.lower().startswith(TRACKING_PREFIXES)
    ]
    path = parts.path or "/"
    return urlunsplit(("https", host, path, urlencode(kept, doseq=True), ""))


def domain_of(url: str | None) -> str:
    """Registrable-looking host for display and per-publisher limits: no www., no port."""
    if not url:
        return ""
    host = urlsplit(url.strip()).netloc.lower()
    host = host.rsplit("@", 1)[-1].split(":", 1)[0]
    return host[4:] if host.startswith("www.") else host


def to_utc_iso(value) -> str | None:
    """Any source's timestamp as a UTC ISO string, or None if it cannot be read.

    HN sends Zulu strings, Lobsters sends offsets, feedparser hands back struct_time.
    """
    if value is None or value == "":
        return None
    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif isinstance(value, datetime):
            dt = value
        elif isinstance(value, (tuple, list)) and len(value) >= 6:
            dt = datetime(*value[:6], tzinfo=timezone.utc)
        else:
            return None
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


_TAG = re.compile(r"<[^>]+>")


def clean_text(value, limit: int = 500) -> str | None:
    """Plain text: HTML stripped, entities decoded, whitespace collapsed, length capped.

    Markup in a description is pure token cost once it reaches a prompt.
    """
    if not value:
        return None
    text = " ".join(html.unescape(_TAG.sub(" ", str(value))).split())
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0] or text[:limit]
    return cut.rstrip(" ,.;:") + "…"
