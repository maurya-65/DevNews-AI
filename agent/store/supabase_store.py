"""Production store. The only code that holds the service key, which bypasses RLS.

Nothing persists on the Actions runner, so every piece of state a later stage or a later
run needs goes through here.
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

from supabase import Client, create_client

from agent import config
from agent.models import Analysis, Card, Draft, Ranked, Reader
from agent.store.common import (analysis_from_row, analysis_row, card_from_rows, chunks,
                                context_entries, edition_item_rows, engagement_rows, iso, mention_from_row,
                                reader_from_row, utcnow)
from agent.store.urls import supabase_url
from agent.threads import ThreadPlan, slugify


class SupabaseStore:
    def __init__(self) -> None:
        url = supabase_url(os.environ.get("SUPABASE_URL", ""))
        key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set "
                               "(run: python -m agent check)")
        self.db: Client = create_client(url, key)

    def _t(self, name: str):
        return self.db.table(name)

    # ---------------------------------------------------------------- run bookkeeping

    def start_run(self) -> int:
        return int(self._t("pipeline_runs").insert({"status": "running"}).execute().data[0]["id"])

    def finish_run(self, run_id: int, status: str, stats: dict, error: str | None) -> None:
        self._t("pipeline_runs").update({
            "status": status, "stats": stats, "error": error, "finished_at": iso(utcnow()),
        }).eq("id", run_id).execute()

    def record_stage(self, run_id, stage, status, started, finished, detail) -> None:
        self._t("run_stages").upsert({
            "run_id": run_id, "stage": stage, "status": status,
            "started_at": iso(started), "finished_at": iso(finished), "detail": detail,
        }, on_conflict="run_id,stage").execute()

    def record_llm_call(self, run_id: int, record: dict) -> None:
        # Bookkeeping must never be the reason a run fails.
        try:
            self._t("llm_calls").insert({**record, "run_id": run_id}).execute()
        except Exception as exc:
            print(f"    ! could not record llm call: {exc}", file=sys.stderr)

    # ---------------------------------------------------------------- sources

    def sources(self, defaults: list[dict]) -> list[dict]:
        existing = {r["id"]: r for r in self._t("sources").select("*").execute().data}

        missing = [d for d in defaults if d["id"] not in existing]
        if missing:
            self._t("sources").insert([{k: d[k] for k in ("id", "kind", "name", "quota", "config")}
                                       for d in missing]).execute()
        # Code owns what a default source is (kind, name, feed list); the database owns how
        # much of it to take (quota, enabled), so those can change without a deploy.
        for d in defaults:
            row = existing.get(d["id"])
            if row and (row.get("config") != d["config"] or row.get("name") != d["name"]
                        or row.get("kind") != d["kind"]):
                self._t("sources").update({"kind": d["kind"], "name": d["name"],
                                           "config": d["config"]}).eq("id", d["id"]).execute()

        order = {d["id"]: i for i, d in enumerate(defaults)}
        rows = self._t("sources").select("*").execute().data
        return sorted(rows, key=lambda r: (order.get(r["id"], len(order)), r["id"]))

    def source_result(self, source_id: str, ok: bool, error: str | None, now: datetime) -> None:
        if ok:
            self._t("sources").update({"last_ok_at": iso(now), "last_error": None,
                                       "consecutive_failures": 0}).eq("id", source_id).execute()
            return
        row = self._t("sources").select("consecutive_failures").eq("id", source_id).single().execute().data
        self._t("sources").update({
            "last_error": error, "consecutive_failures": int(row["consecutive_failures"]) + 1,
        }).eq("id", source_id).execute()

    # ---------------------------------------------------------------- articles

    def _ids_for(self, urls: list[str]) -> dict[str, int]:
        found: dict[str, int] = {}
        # Small chunks: an `in` filter travels in the query string, and URLs are long.
        for chunk in chunks(urls, 40):
            for r in self._t("articles").select("id,canonical_url").in_("canonical_url", chunk).execute().data:
                found[r["canonical_url"]] = int(r["id"])
        return found

    def upsert_articles(self, run_id: int, drafts: list[Draft], now: datetime) -> None:
        if not drafts:
            return
        by_url = {d.canonical_url: d for d in drafts}
        known = self._ids_for(list(by_url))

        new = [d for url, d in by_url.items() if url not in known]
        for chunk in chunks(new, 200):
            self._t("articles").upsert([{
                "canonical_url": d.canonical_url, "url": d.url, "domain": d.domain,
                "title": d.title, "description": d.description, "published_at": d.published_at,
                "first_seen_at": iso(now), "first_run_id": run_id,
            } for d in chunk], on_conflict="canonical_url", ignore_duplicates=True).execute()

        ids = self._ids_for(list(by_url)) if new else known
        for url, d in by_url.items():
            d.id = ids.get(url)

        analyzed: set[int] = set()
        for chunk in chunks([d.id for d in drafts if d.id is not None], 200):
            rows = self._t("analyses").select("article_id").in_("article_id", chunk).execute().data
            analyzed.update(int(r["article_id"]) for r in rows)
        for d in drafts:
            d.analyzed = d.id in analyzed

        mention_rows = [{
            "article_id": d.id, "source_id": m.source, "external_id": m.external_id,
            "discussion_url": m.discussion_url, "points": m.points, "comments": m.comments,
            "source_rank": m.source_rank, "tags": m.tags, "last_seen_at": iso(now), "run_id": run_id,
        } for d in drafts if d.id is not None for m in d.mentions]
        for chunk in chunks(mention_rows, 200):
            self._t("mentions").upsert(chunk, on_conflict="source_id,external_id").execute()

    def save_texts(self, drafts: list[Draft]) -> None:
        for d in drafts:
            if d.id is None or d.fetch_status == "pending":
                continue
            update = {"fetch_status": d.fetch_status, "excerpt": d.excerpt, "word_count": d.word_count}
            if d.description:
                update["description"] = d.description
            self._t("articles").update(update).eq("id", d.id).execute()

    # ---------------------------------------------------------------- analyses and threads

    def thread_context(self, now: datetime) -> list[dict]:
        since = iso(now - timedelta(days=config.THREAD_LOOKBACK_DAYS))
        threads = (self._t("threads").select("id,title,last_activity_at")
                   .gte("last_activity_at", since).order("last_activity_at", desc=True)
                   .limit(config.MAX_THREAD_CONTEXT).execute().data)
        hints = (self._t("analyses").select("article_id,thread_hint,analyzed_at")
                 .not_.is_("thread_hint", "null").is_("thread_id", "null")
                 .gte("analyzed_at", since).order("analyzed_at", desc=True)
                 .limit(config.MAX_THREAD_CONTEXT).execute().data)
        return context_entries(threads, hints)

    def save_analyses(self, run_id: int, analyses: list[Analysis], now: datetime) -> None:
        rows = [analysis_row(run_id, a, now) for a in analyses]
        for chunk in chunks(rows, 100):
            self._t("analyses").upsert(chunk, on_conflict="article_id").execute()

    def _free_slug(self, base: str) -> str:
        taken = {r["slug"] for r in self._t("threads").select("slug").like("slug", f"{base}%").execute().data}
        if base not in taken:
            return base
        n = 2
        while f"{base}-{n}" in taken:
            n += 1
        return f"{base}-{n}"

    def _set_thread(self, article_id: int, thread_id: int, relation: str) -> None:
        self._t("analyses").update({"thread_id": thread_id, "thread_relation": relation,
                                    "thread_hint": None}).eq("article_id", article_id).execute()

    def apply_threads(self, plan: ThreadPlan, now: datetime) -> dict:
        touched: set[int] = set()
        for thread in plan.create:
            row = self._t("threads").insert({
                "slug": self._free_slug(slugify(thread.title)), "title": thread.title,
                "first_seen_at": iso(now), "last_activity_at": iso(now),
            }).execute().data[0]
            thread_id = int(row["id"])
            touched.add(thread_id)
            for article_id, relation in thread.members.items():
                self._set_thread(article_id, thread_id, relation)

        for article_id, (thread_id, relation) in plan.attach.items():
            self._set_thread(article_id, thread_id, relation)
            touched.add(thread_id)

        for thread_id in touched:
            count = (self._t("analyses").select("article_id", count="exact")
                     .eq("thread_id", thread_id).limit(1).execute().count)
            self._t("threads").update({"article_count": count or 0,
                                       "last_activity_at": iso(now)}).eq("id", thread_id).execute()

        return {"created": len(plan.create), "attached": len(plan.attach),
                "waiting_hints": len(plan.keep_hints)}

    # ---------------------------------------------------------------- readers

    def readers(self) -> list[Reader]:
        profiles = self._t("profiles").select("*").execute().data
        taste: dict[str, dict[str, float]] = defaultdict(dict)
        for r in self._t("taste").select("user_id,key,weight").execute().data:
            taste[r["user_id"]][r["key"]] = float(r["weight"])
        return [reader_from_row(p, taste.get(p["id"], {})) for p in profiles]

    def events_since(self, user_id: str, since: str | None) -> list[dict]:
        query = self._t("events").select("kind,article_id,created_at").eq("user_id", user_id)
        if since:
            query = query.gt("created_at", since)
        return query.order("created_at").limit(5000).execute().data

    def article_signals(self, article_ids: set[int]) -> dict[int, dict]:
        out: dict[int, dict] = {}
        for chunk in chunks(sorted(article_ids), 200):
            articles = {int(r["id"]): r for r in
                        self._t("articles").select("id,domain").in_("id", chunk).execute().data}
            analyses = {int(r["article_id"]): r for r in
                        self._t("analyses").select("article_id,topics,kind").in_("article_id", chunk).execute().data}
            sources: dict[int, set[str]] = defaultdict(set)
            for r in self._t("mentions").select("article_id,source_id").in_("article_id", chunk).execute().data:
                sources[int(r["article_id"])].add(r["source_id"])
            for article_id in chunk:
                if article_id in articles and article_id in analyses:
                    out[article_id] = {"topics": analyses[article_id]["topics"],
                                       "kind": analyses[article_id]["kind"],
                                       "domain": articles[article_id]["domain"],
                                       "sources": sorted(sources[article_id])}
        return out

    def save_taste(self, user_id: str, weights: dict[str, float], evidence: dict[str, int],
                   now: datetime) -> None:
        previous = {r["key"]: int(r["evidence"]) for r in
                    self._t("taste").select("key,evidence").eq("user_id", user_id).execute().data}
        rows = [{"user_id": user_id, "key": key, "weight": weight,
                 "evidence": previous.get(key, 0) + evidence.get(key, 0), "updated_at": iso(now)}
                for key, weight in weights.items()]
        for chunk in chunks(rows, 200):
            self._t("taste").upsert(chunk, on_conflict="user_id,key").execute()
        self._t("profiles").update({"taste_updated_at": iso(now)}).eq("id", user_id).execute()

    # ---------------------------------------------------------------- editions

    def edition_cards(self, now: datetime) -> list[Card]:
        since = iso(now - timedelta(hours=config.EDITION_WINDOW_HOURS))
        # New articles, plus older ones that were linked again recently: a classic that
        # resurfaces on HN is news to a reader who never saw it.
        ids = {int(r["id"]) for r in self._t("articles").select("id").gte("first_seen_at", since).execute().data}
        ids |= {int(r["article_id"]) for r in
                self._t("mentions").select("article_id").gte("last_seen_at", since).execute().data}

        cards: list[Card] = []
        for chunk in chunks(sorted(ids), 150):
            articles = {int(r["id"]): r for r in self._t("articles")
                        .select("id,title,url,domain,first_seen_at,published_at").in_("id", chunk).execute().data}
            analyses = {int(r["article_id"]): r for r in
                        self._t("analyses").select("*").in_("article_id", chunk).execute().data}
            mentions = defaultdict(list)
            for r in self._t("mentions").select("*").in_("article_id", chunk).execute().data:
                mentions[int(r["article_id"])].append(mention_from_row(r))
            for article_id in chunk:
                if article_id in articles and article_id in analyses:
                    cards.append(card_from_rows(articles[article_id],
                                                analysis_from_row(analyses[article_id]),
                                                mentions[article_id]))
        return cards

    def already_shown(self, user_id: str, edition_date: str) -> set[int]:
        editions = (self._t("editions").select("id").eq("user_id", user_id)
                    .lt("edition_date", edition_date).order("edition_date", desc=True)
                    .limit(60).execute().data)
        shown: set[int] = set()
        for chunk in chunks([int(e["id"]) for e in editions], 100):
            rows = (self._t("edition_items").select("article_id").in_("edition_id", chunk)
                    .eq("selected", True).execute().data)
            shown.update(int(r["article_id"]) for r in rows)
        return shown

    def thread_engagement(self, user_id: str, thread_ids: set[int]) -> list[dict]:
        members = {int(r["article_id"]): int(r["thread_id"]) for r in self._t("analyses")
                   .select("article_id,thread_id").in_("thread_id", sorted(thread_ids)).execute().data}
        actions: list[tuple[int, str, str | None]] = []
        titles: dict[int, str] = {}
        for chunk in chunks(sorted(members), 200):
            def mine(table: str, columns: str) -> list[dict]:
                return (self._t(table).select(columns).eq("user_id", user_id)
                        .in_("article_id", chunk).execute().data)

            actions += [(int(r["article_id"]), "saved", r["created_at"])
                        for r in mine("saves", "article_id,created_at")]
            actions += [(int(r["article_id"]), "upvoted" if r["value"] == 1 else "down", r["created_at"])
                        for r in mine("votes", "article_id,value,created_at")]
            actions += [(int(r["article_id"]), "opened" if r["kind"] == "open" else "hid", r["created_at"])
                        for r in mine("events", "article_id,kind,created_at") if r["kind"] in ("open", "hide")]
            actions += [(int(r["article_id"]), "shown", None)
                        for r in mine("edition_items", "article_id,selected") if r["selected"]]
            titles.update({int(r["id"]): r["title"] for r in
                           self._t("articles").select("id,title").in_("id", chunk).execute().data})
        return engagement_rows(members, titles, actions)

    def save_edition(self, user_id: str, run_id: int | None, edition_date: str,
                     ranked: list[Ranked], candidate_count: int) -> int:
        selected = sum(1 for r in ranked if r.selected)
        row = self._t("editions").upsert({
            "user_id": user_id, "run_id": run_id, "edition_date": edition_date,
            "status": "ok" if selected else "quiet", "item_count": selected,
            "candidate_count": candidate_count,
        }, on_conflict="user_id,edition_date").execute().data[0]
        edition_id = int(row["id"])

        # Rebuilding an edition replaces its items rather than accumulating them.
        self._t("edition_items").delete().eq("edition_id", edition_id).execute()
        for chunk in chunks(edition_item_rows(edition_id, user_id, ranked), 200):
            self._t("edition_items").insert(chunk).execute()
        return edition_id

    def edition_for_email(self, user_id: str, edition_date: str) -> dict | None:
        rows = (self._t("editions").select("id,emailed_at").eq("user_id", user_id)
                .eq("edition_date", edition_date).limit(1).execute().data)
        if not rows:
            return None
        edition = rows[0]
        items = (self._t("edition_items").select("article_id,rank,why").eq("edition_id", edition["id"])
                 .eq("selected", True).order("rank").execute().data)
        ids = [int(i["article_id"]) for i in items]
        cards = {int(c["id"]): c for c in self._t("article_cards")
                 .select("id,title,url,domain,summary,takeaway").in_("id", ids).execute().data} if ids else {}
        return {
            "edition_id": int(edition["id"]),
            "emailed_at": edition.get("emailed_at"),
            "items": [{**cards[int(i["article_id"])], "why": i.get("why")}
                      for i in items if int(i["article_id"]) in cards],
        }

    def mark_emailed(self, edition_id: int, now: datetime) -> None:
        self._t("editions").update({"emailed_at": iso(now)}).eq("id", edition_id).execute()
