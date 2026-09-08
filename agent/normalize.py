"""URL canonicalization and the shared item shape.

The canonical URL is the cross-source dedupe key: the same story submitted to HN and
Lobsters must collapse to one item. Tracking params are the main thing standing in the way.
"""
from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Stripped before comparing. utm_* is handled by prefix, these are the rest.
TRACKING_PARAMS = frozenset({
    "fbclid", "gclid", "dclid", "msclkid", "twclid", "igshid", "mc_cid", "mc_eid",
    "ref", "referrer", "source", "src", "campaign", "yclid", "_hsenc", "_hsmi",
    "vero_id", "wt_mc", "at_medium", "at_campaign", "spm", "scid",
})
TRACKING_PREFIXES = ("utm_", "pk_", "piwik_", "matomo_", "ga_")


def canonical_url(url: str) -> str:
    """Strip tracking noise so the same story from two sources compares equal.

    Deliberately conservative: lowercasing the host and dropping the fragment is safe,
    but the path is left alone. A trailing slash is not always cosmetic and query params
    that aren't tracking (?id=, ?v=) can be load-bearing.
    """
    if not url:
        return ""
    parts = urlsplit(url.strip())

    # Scheme forced to https: the same story linked as http on one source and https on
    # another must dedupe. Everything relevant redirects http -> https anyway.
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    # Strip the default port for the scheme.
    if (parts.scheme == "https" and host.endswith(":443")) or \
       (parts.scheme == "http" and host.endswith(":80")):
        host = host.rsplit(":", 1)[0]

    kept = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
        and not k.lower().startswith(TRACKING_PREFIXES)
    ]

    # Fragment dropped: #section is the same document.
    return urlunsplit(("https", host, parts.path,
                       urlencode(kept, doseq=True), ""))


def to_utc_iso(value) -> str | None:
    """Normalize a source's timestamp to a UTC ISO string, or None if unparseable.

    Every source dates things differently — HN sends Zulu, Lobsters sends -05:00,
    feedparser hands back a time struct. The DB column is TIMESTAMPTZ, so all of it
    has to land in UTC before insert.
    """
    if value is None:
        return None

    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    elif isinstance(value, (tuple, list)) and len(value) >= 6:
        # feedparser's published_parsed struct_time, always UTC
        try:
            dt = datetime(*value[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None
    else:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


_TAG = re.compile(r"<[^>]+>")


def clean_text(value, limit: int = 500) -> str | None:
    """Strip HTML, collapse whitespace, cap length.

    RSS summaries and HN story_text arrive as HTML. Markup in a blurb is pure token cost —
    it goes straight into the prompt and tells the model nothing.
    """
    if not value:
        return None
    text = " ".join(html.unescape(_TAG.sub(" ", str(value))).split())
    if not text:
        return None
    return text[:limit].rstrip() + "…" if len(text) > limit else text


def make_item(*, source, external_id, url, title, blurb=None,
              points=None, comments=None, published_at=None) -> dict | None:
    """Build the one dict shape every source returns. None if it isn't usable."""
    title = clean_text(title, 300)
    if not title or not url:
        return None
    return {
        "source": source,
        "external_id": str(external_id),
        "url": url.strip(),
        "canonical_url": canonical_url(url),
        "title": title,
        "blurb": clean_text(blurb),
        "points": points,
        "comments": comments,
        "published_at": to_utc_iso(published_at),
    }
