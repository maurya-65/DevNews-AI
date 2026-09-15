"""An in-process store with the same behaviour as Supabase, kept in plain dicts.

Used by tests, by `python -m agent run --store memory` for a full dry run, and to produce
the JSON the web app renders in fixture mode. Optionally loads from and saves to a file, so
several runs can accumulate history the way production does.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from agent import config
from agent.models import Analysis, Card, Draft, Ranked, Reader
from agent.store.common import (analysis_from_row, analysis_row, card_from_rows, context_entries,
                                edition_item_rows, engagement_rows, iso, mention_from_row,
                                reader_from_row, utcnow)
from agent.threads import ThreadPlan, slugify

TABLES = ("pipeline_runs", "run_stages", "llm_calls", "sources", "articles", "mentions",
          "threads", "analyses", "profiles", "taste", "editions", "edition_items", "events",
          "saves", "votes")

DEMO_READER_ID = "00000000-0000-4000-8000-000000000001"
DEMO_PROFILE = {
    "id": DEMO_READER_ID,
    "email": "reader@devnews.local",
    "level": "working",
    "select_count": 8,
    "min_score": 5.0,
    "topics": ["systems", "databases", "security", "languages", "performance"],
    "muted_topics": ["crypto-web3"],
    "muted_kinds": ["listicle"],
    "muted_domains": [],
    "sources_off": [],
    "include_general": False,
    "email_digest": False,
    "taste_updated_at": None,
}


class MemoryStore:
    def __init__(self, path: str | None = None, profiles: list[dict] | None = None):
        self.path = Path(path) if path else None
        self.t: dict[str, list[dict]] = {name: [] for name in TABLES}
        if self.path and self.path.exists():
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            for name in TABLES:
                self.t[name] = loaded.get(name, [])
        if profiles is not None:
            self.t["profiles"] = [dict(p) for p in profiles]
        elif not self.t["profiles"]:
            self.t["profiles"] = [dict(DEMO_PROFILE)]

    # ---------------------------------------------------------------- helpers

    def _next_id(self, table: str) -> int:
        return max((r["id"] for r in self.t[table] if isinstance(r.get("id"), int)), default=0) + 1

    def _find(self, table: str, **match) -> list[dict]:
        return [r for r in self.t[table] if all(r.get(k) == v for k, v in match.items())]

    def _one(self, table: str, **match) -> dict:
        rows = self._find(table, **match)
        if not rows:
            raise KeyError(f"{table} {match}")
        return rows[0]

    def dump(self) -> None:
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self.t, ensure_ascii=False, indent=1, default=str),
                                 encoding="utf-8")

    # ---------------------------------------------------------------- run bookkeeping

    def start_run(self) -> int:
        run_id = self._next_id("pipeline_runs")
        self.t["pipeline_runs"].append({"id": run_id, "started_at": iso(utcnow()), "finished_at": None,
                                        "status": "running", "stats": {}, "error": None})
        return run_id

    def finish_run(self, run_id: int, status: str, stats: dict, error: str | None) -> None:
        self._one("pipeline_runs", id=run_id).update(status=status, stats=stats, error=error,
                                                     finished_at=iso(utcnow()))
        self.dump()

    def record_stage(self, run_id, stage, status, started, finished, detail) -> None:
        self.t["run_stages"] = [r for r in self.t["run_stages"]
                                if not (r["run_id"] == run_id and r["stage"] == stage)]
        self.t["run_stages"].append({"run_id": run_id, "stage": stage, "status": status,
                                     "started_at": iso(started), "finished_at": iso(finished),
                                     "detail": detail})

    def record_llm_call(self, run_id: int, record: dict) -> None:
        self.t["llm_calls"].append({"id": self._next_id("llm_calls"), "run_id": run_id, **record,
                                    "created_at": iso(utcnow())})

    # ---------------------------------------------------------------- sources

    def sources(self, defaults: list[dict]) -> list[dict]:
        existing = {r["id"]: r for r in self.t["sources"]}
        for d in defaults:
            if d["id"] in existing:
                existing[d["id"]].update(kind=d["kind"], name=d["name"], config=d["config"])
            else:
                self.t["sources"].append({"id": d["id"], "kind": d["kind"], "name": d["name"],
                                          "config": d["config"], "quota": d["quota"], "enabled": True,
                                          "last_ok_at": None, "last_error": None,
                                          "consecutive_failures": 0})
        return list(self.t["sources"])

    def source_result(self, source_id: str, ok: bool, error: str | None, now: datetime) -> None:
        row = self._one("sources", id=source_id)
        if ok:
            row.update(last_ok_at=iso(now), last_error=None, consecutive_failures=0)
        else:
            row.update(last_error=error, consecutive_failures=row["consecutive_failures"] + 1)

    # ---------------------------------------------------------------- articles

    def upsert_articles(self, run_id: int, drafts: list[Draft], now: datetime) -> None:
        by_url = {a["canonical_url"]: a for a in self.t["articles"]}
        analyzed = {a["article_id"] for a in self.t["analyses"]}
        for d in drafts:
            row = by_url.get(d.canonical_url)
            if row is None:
                row = {"id": self._next_id("articles"), "canonical_url": d.canonical_url, "url": d.url,
                       "domain": d.domain, "title": d.title, "description": d.description,
                       "excerpt": None, "word_count": None, "fetch_status": "pending",
                       "published_at": d.published_at, "first_seen_at": iso(now), "first_run_id": run_id}
                self.t["articles"].append(row)
                by_url[d.canonical_url] = row
            d.id = row["id"]
            d.analyzed = d.id in analyzed
            for m in d.mentions:
                values = {"article_id": d.id, "source_id": m.source, "external_id": m.external_id,
                          "discussion_url": m.discussion_url, "points": m.points,
                          "comments": m.comments, "source_rank": m.source_rank,
                          "tags": list(m.tags), "last_seen_at": iso(now), "run_id": run_id}
                existing = self._find("mentions", source_id=m.source, external_id=m.external_id)
                if existing:
                    existing[0].update(values)
                else:
                    self.t["mentions"].append({"id": self._next_id("mentions"),
                                               "first_seen_at": iso(now), **values})

    def save_texts(self, drafts: list[Draft]) -> None:
        for d in drafts:
            if d.id is None or d.fetch_status == "pending":
                continue
            row = self._one("articles", id=d.id)
            row.update(fetch_status=d.fetch_status, excerpt=d.excerpt, word_count=d.word_count)
            if d.description:
                row["description"] = d.description

    # ---------------------------------------------------------------- analyses and threads

    def thread_context(self, now: datetime) -> list[dict]:
        since = iso(now - timedelta(days=config.THREAD_LOOKBACK_DAYS))
        threads = sorted((t for t in self.t["threads"] if t["last_activity_at"] >= since),
                         key=lambda t: t["last_activity_at"], reverse=True)
        hints = sorted((a for a in self.t["analyses"]
                        if a.get("thread_hint") and not a.get("thread_id") and a["analyzed_at"] >= since),
                       key=lambda a: a["analyzed_at"], reverse=True)
        return context_entries(threads[:config.MAX_THREAD_CONTEXT], hints[:config.MAX_THREAD_CONTEXT])

    def save_analyses(self, run_id: int, analyses: list[Analysis], now: datetime) -> None:
        for a in analyses:
            row = analysis_row(run_id, a, now)
            existing = self._find("analyses", article_id=a.article_id)
            if existing:
                existing[0].update(row)
            else:
                self.t["analyses"].append({**row, "thread_id": None})

    def _set_thread(self, article_id: int, thread_id: int, relation: str) -> None:
        for a in self._find("analyses", article_id=article_id):
            a.update(thread_id=thread_id, thread_relation=relation, thread_hint=None)

    def apply_threads(self, plan: ThreadPlan, now: datetime) -> dict:
        touched: set[int] = set()
        for thread in plan.create:
            base = slugify(thread.title)
            taken = {t["slug"] for t in self.t["threads"]}
            slug, n = base, 2
            while slug in taken:
                slug, n = f"{base}-{n}", n + 1
            thread_id = self._next_id("threads")
            self.t["threads"].append({"id": thread_id, "slug": slug, "title": thread.title,
                                      "summary": None, "first_seen_at": iso(now),
                                      "last_activity_at": iso(now), "article_count": 0})
            touched.add(thread_id)
            for article_id, relation in thread.members.items():
                self._set_thread(article_id, thread_id, relation)

        for article_id, (thread_id, relation) in plan.attach.items():
            self._set_thread(article_id, thread_id, relation)
            touched.add(thread_id)

        for thread_id in touched:
            self._one("threads", id=thread_id).update(
                article_count=len(self._find("analyses", thread_id=thread_id)),
                last_activity_at=iso(now))

        return {"created": len(plan.create), "attached": len(plan.attach),
                "waiting_hints": len(plan.keep_hints)}

    # ---------------------------------------------------------------- readers

    def readers(self) -> list[Reader]:
        taste: dict[str, dict[str, float]] = defaultdict(dict)
        for r in self.t["taste"]:
            taste[r["user_id"]][r["key"]] = float(r["weight"])
        return [reader_from_row(p, taste.get(p["id"], {})) for p in self.t["profiles"]]

    def events_since(self, user_id: str, since: str | None) -> list[dict]:
        return sorted((e for e in self.t["events"]
                       if e["user_id"] == user_id and (not since or e["created_at"] > since)),
                      key=lambda e: e["created_at"])

    def article_signals(self, article_ids: set[int]) -> dict[int, dict]:
        out: dict[int, dict] = {}
        for article_id in article_ids:
            article = self._find("articles", id=article_id)
            analysis = self._find("analyses", article_id=article_id)
            if article and analysis:
                out[article_id] = {
                    "topics": analysis[0]["topics"], "kind": analysis[0]["kind"],
                    "domain": article[0]["domain"],
                    "sources": sorted({m["source_id"] for m in self._find("mentions", article_id=article_id)}),
                }
        return out

    def save_taste(self, user_id: str, weights: dict[str, float], evidence: dict[str, int],
                   now: datetime) -> None:
        for key, weight in weights.items():
            rows = self._find("taste", user_id=user_id, key=key)
            if rows:
                rows[0].update(weight=weight, evidence=rows[0]["evidence"] + evidence.get(key, 0),
                               updated_at=iso(now))
            else:
                self.t["taste"].append({"user_id": user_id, "key": key, "weight": weight,
                                        "evidence": evidence.get(key, 0), "updated_at": iso(now)})
        for profile in self._find("profiles", id=user_id):
            profile["taste_updated_at"] = iso(now)

    # ---------------------------------------------------------------- editions

    def edition_cards(self, now: datetime) -> list[Card]:
        since = iso(now - timedelta(hours=config.EDITION_WINDOW_HOURS))
        ids = {a["id"] for a in self.t["articles"] if a["first_seen_at"] >= since}
        ids |= {m["article_id"] for m in self.t["mentions"] if m["last_seen_at"] >= since}
        cards: list[Card] = []
        for article_id in sorted(ids):
            article = self._find("articles", id=article_id)
            analysis = self._find("analyses", article_id=article_id)
            if article and analysis:
                mentions = [mention_from_row(m) for m in self._find("mentions", article_id=article_id)]
                cards.append(card_from_rows(article[0], analysis_from_row(analysis[0]), mentions))
        return cards

    def already_shown(self, user_id: str, edition_date: str) -> set[int]:
        earlier = {e["id"] for e in self.t["editions"]
                   if e["user_id"] == user_id and e["edition_date"] < edition_date}
        return {i["article_id"] for i in self.t["edition_items"]
                if i["edition_id"] in earlier and i["selected"]}

    def thread_engagement(self, user_id: str, thread_ids: set[int]) -> list[dict]:
        members = {a["article_id"]: a["thread_id"] for a in self.t["analyses"]
                   if a.get("thread_id") in thread_ids}
        titles = {a["id"]: a["title"] for a in self.t["articles"] if a["id"] in members}

        def mine(table: str) -> list[dict]:
            return [r for r in self.t[table] if r["user_id"] == user_id]

        actions = [(r["article_id"], "saved", r.get("created_at")) for r in mine("saves")]
        actions += [(r["article_id"], "upvoted" if r["value"] == 1 else "down", r.get("created_at"))
                    for r in mine("votes")]
        actions += [(r["article_id"], "opened" if r["kind"] == "open" else "hid", r.get("created_at"))
                    for r in mine("events") if r["kind"] in ("open", "hide")]
        actions += [(r["article_id"], "shown", None) for r in mine("edition_items") if r["selected"]]
        return engagement_rows(members, titles, actions)

    def save_edition(self, user_id: str, run_id: int | None, edition_date: str,
                     ranked: list[Ranked], candidate_count: int) -> int:
        selected = sum(1 for r in ranked if r.selected)
        values = {"user_id": user_id, "run_id": run_id, "edition_date": edition_date,
                  "status": "ok" if selected else "quiet", "item_count": selected,
                  "candidate_count": candidate_count}
        existing = self._find("editions", user_id=user_id, edition_date=edition_date)
        if existing:
            row = existing[0]
            row.update(values)
        else:
            row = {"id": self._next_id("editions"), "created_at": iso(utcnow()),
                   "emailed_at": None, **values}
            self.t["editions"].append(row)
        self.t["edition_items"] = [i for i in self.t["edition_items"] if i["edition_id"] != row["id"]]
        self.t["edition_items"].extend(edition_item_rows(row["id"], user_id, ranked))
        return row["id"]

    def edition_for_email(self, user_id: str, edition_date: str) -> dict | None:
        existing = self._find("editions", user_id=user_id, edition_date=edition_date)
        if not existing:
            return None
        edition = existing[0]
        items = sorted((i for i in self.t["edition_items"]
                        if i["edition_id"] == edition["id"] and i["selected"]),
                       key=lambda i: i["rank"])
        out = []
        for item in items:
            article = self._one("articles", id=item["article_id"])
            analysis = self._one("analyses", article_id=item["article_id"])
            out.append({"id": article["id"], "title": article["title"], "url": article["url"],
                        "domain": article["domain"], "summary": analysis["summary"],
                        "takeaway": analysis.get("takeaway"), "why": item.get("why")})
        return {"edition_id": edition["id"], "emailed_at": edition.get("emailed_at"), "items": out}

    def mark_emailed(self, edition_id: int, now: datetime) -> None:
        self._one("editions", id=edition_id)["emailed_at"] = iso(now)
