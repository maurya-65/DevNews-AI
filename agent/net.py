"""One HTTP client for the run, with retries for the failures free APIs actually throw."""
from __future__ import annotations

import os
import time

import httpx

UA = "DevNews/2.0 (+https://github.com/maurya-65/DevNews-AI)"
# Some publishers serve a bare error to anything that does not look like a browser. This
# still identifies itself honestly.
BROWSER_UA = "Mozilla/5.0 (compatible; DevNews/2.0; +https://github.com/maurya-65/DevNews-AI)"

RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
DEFAULT_TIMEOUT = 20.0

_client: httpx.Client | None = None


def client() -> httpx.Client:
    """Shared and thread-safe; enrichment fetches pages from it concurrently."""
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": UA},
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=24, max_keepalive_connections=12),
        )
    return _client


def get(url: str, *, params: dict | None = None, headers: dict | None = None,
        timeout: float | None = None, retries: int = 2, backoff: float = 2.0) -> httpx.Response:
    """GET with retries on 429/5xx and transport errors. Raises on anything else."""
    for attempt in range(retries + 1):
        last_attempt = attempt == retries
        try:
            response = client().get(url, params=params, headers=headers,
                                    timeout=timeout or DEFAULT_TIMEOUT)
        except httpx.TransportError:
            if last_attempt:
                raise
            time.sleep(backoff * (attempt + 1))
            continue

        if response.status_code in RETRY_STATUS and not last_attempt:
            retry_after = response.headers.get("retry-after", "")
            wait = float(retry_after) if retry_after.isdigit() else backoff * (attempt + 1)
            time.sleep(min(wait, 30.0))
            continue

        response.raise_for_status()
        return response

    raise RuntimeError("unreachable")  # the loop always returns or raises


def github_headers() -> dict:
    """Actions provides GITHUB_TOKEN for free; with it the search API allows far more."""
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers
