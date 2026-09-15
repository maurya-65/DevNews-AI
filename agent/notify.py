"""The morning email, for readers who asked for it.

Optional: it runs only when RESEND_API_KEY and EMAIL_FROM are set (Resend's free tier is
3,000 emails a month). Links go through the site's /r/ redirect when SITE_URL is set, so an
open from the inbox counts as a reading signal just like one on the site. Each edition is
marked once sent, so rerunning a day never emails anyone twice.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from html import escape

import httpx

from agent.store import Store

RESEND_URL = "https://api.resend.com/emails"


def render(items: list[dict], day: str, site: str | None) -> str:
    rows = []
    for n, item in enumerate(items, 1):
        link = f"{site}/r/{item['id']}" if site else item["url"]
        why = (f'<p style="margin:10px 0 0;font:12px ui-monospace,Menlo,monospace;color:#8a8a8a">'
               f'{escape(item["why"])}</p>') if item.get("why") else ""
        takeaway = (f'<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#111">'
                    f'<strong>Takeaway:</strong> {escape(item["takeaway"])}</p>') if item.get("takeaway") else ""
        rows.append(
            f'<tr><td style="padding:20px 0;border-top:1px solid #ececec">'
            f'<div style="font:12px ui-monospace,Menlo,monospace;color:#c2541b">{n:02d} &middot; {escape(item["domain"])}</div>'
            f'<a href="{escape(link)}" style="display:block;margin-top:6px;font:600 18px/1.35 -apple-system,Segoe UI,Helvetica,sans-serif;color:#111;text-decoration:none">{escape(item["title"])}</a>'
            f'<p style="margin:8px 0 0;font:15px/1.65 -apple-system,Segoe UI,Helvetica,sans-serif;color:#444">{escape(item.get("summary") or "")}</p>'
            f'{takeaway}{why}</td></tr>'
        )
    settings = f'<a href="{escape(site)}/settings" style="color:#8a8a8a">Change what you get</a>' if site else ""
    return (
        '<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:620px;margin:0 auto;background:#ffffff;padding:8px 28px 28px">'
        f'<tr><td style="padding:22px 0 10px;font:700 22px -apple-system,Segoe UI,Helvetica,sans-serif;color:#111">'
        f'DevNews <span style="font:400 12px ui-monospace,Menlo,monospace;color:#8a8a8a">{escape(day)}</span></td></tr>'
        + "".join(rows)
        + f'<tr><td style="padding-top:22px;font:12px ui-monospace,Menlo,monospace;color:#8a8a8a">{settings}</td></tr>'
        "</table></body></html>"
    )


def send_all(store: Store, now: datetime) -> dict:
    key = os.environ.get("RESEND_API_KEY", "").strip()
    sender = os.environ.get("EMAIL_FROM", "").strip()
    if not key or not sender:
        return {"skipped": True, "reason": "RESEND_API_KEY / EMAIL_FROM not set"}
    site = os.environ.get("SITE_URL", "").strip().rstrip("/") or None
    day = now.date().isoformat()

    stats = {"sent": 0, "already_sent": 0, "empty": 0, "failed": 0}
    for reader in store.readers():
        if not reader.email_digest or not reader.email:
            continue
        edition = store.edition_for_email(reader.id, day)
        if not edition or not edition["items"]:
            stats["empty"] += 1
            continue
        if edition.get("emailed_at"):
            stats["already_sent"] += 1
            continue
        items = edition["items"]
        try:
            httpx.post(RESEND_URL, timeout=20.0, headers={"Authorization": f"Bearer {key}"}, json={
                "from": sender,
                "to": [reader.email],
                "subject": f"DevNews · {len(items)} worth your time today",
                "html": render(items, day, site),
            }).raise_for_status()
        except httpx.HTTPError as exc:
            stats["failed"] += 1
            print(f"    ! email to {reader.id}: {exc}", file=sys.stderr)
            continue
        store.mark_emailed(edition["edition_id"], now)
        stats["sent"] += 1
    return stats
