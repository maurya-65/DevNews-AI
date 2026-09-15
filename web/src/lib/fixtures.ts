import "server-only";

import fs from "node:fs";
import path from "node:path";

import { rankForEveryone, toCard } from "@/lib/db";
import { FIXTURE_USER_ID } from "@/lib/fixture-mode";
import { sinceDate, tallyReading } from "@/lib/reading-stats";
import type {
  ArticleCard,
  Edition,
  EditionItem,
  Profile,
  ReaderState,
  ReadingStats,
  SearchHit,
  StatusData,
  TasteWeight,
  Thread,
} from "@/lib/types";

/** The same reads as db.ts, answered from a pipeline dry-run file.
 *
 *    python -m agent run --store memory --memory-file web/fixtures/state.json
 *
 *  Writes made in fixture mode (saves, votes) live in memory until the file changes; they
 *  exist so the UI can be exercised, not to persist anything.
 */

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type State = Record<string, Row[]>;

function fixtureFile() {
  return process.env.DEVNEWS_FIXTURES_FILE ?? path.join(/* turbopackIgnore: true */ process.cwd(), "fixtures", "state.json");
}

let cache: { mtime: number; state: State } | null = null;

export function state(): State {
  const file = fixtureFile();
  const mtime = fs.statSync(file).mtimeMs;
  if (!cache || cache.mtime !== mtime) {
    const loaded = JSON.parse(fs.readFileSync(file, "utf8")) as State;
    for (const table of ["saves", "votes", "events", "taste"]) loaded[table] ??= [];
    cache = { mtime, state: loaded };
  }
  return cache.state;
}

function card(id: number): ArticleCard | null {
  const s = state();
  const article = s.articles.find((a) => a.id === id);
  const analysis = s.analyses.find((a) => a.article_id === id);
  if (!article || !analysis) return null;
  const thread = analysis.thread_id ? s.threads.find((t) => t.id === analysis.thread_id) : null;
  return toCard({
    ...article,
    ...analysis,
    id,
    thread_slug: thread?.slug ?? null,
    thread_title: thread?.title ?? null,
    mentions: s.mentions
      .filter((m) => m.article_id === id)
      .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
      .map((m) => ({ source: m.source_id, url: m.discussion_url, points: m.points, comments: m.comments })),
  });
}

function cards(ids: number[]) {
  return ids.flatMap((id) => {
    const c = card(id);
    return c ? [c] : [];
  });
}

function allCards() {
  return cards(state().analyses.map((a) => a.article_id));
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = state().profiles.find((p) => p.id === userId);
  return row ? ({ feed_token: "fixture-feed-token", ...row } as Profile) : null;
}

export async function getTaste(userId: string): Promise<TasteWeight[]> {
  return state()
    .taste.filter((t) => t.user_id === userId)
    .map((t) => ({ key: t.key, weight: Number(t.weight), evidence: Number(t.evidence) }))
    .sort((a, b) => b.weight - a.weight);
}

export async function getReaderState(userId: string, articleIds: number[]): Promise<ReaderState> {
  const wanted = new Set(articleIds);
  const s = state();
  return {
    saved: s.saves.filter((r) => r.user_id === userId && wanted.has(r.article_id)).map((r) => r.article_id),
    votes: Object.fromEntries(
      s.votes.filter((r) => r.user_id === userId && wanted.has(r.article_id)).map((r) => [r.article_id, r.value]),
    ),
  };
}

export async function getReadingStats(userId: string, days = 30): Promise<ReadingStats> {
  const s = state();
  const since = sinceDate(days);
  const editionIds = new Set(
    s.editions.filter((e) => e.user_id === userId && e.edition_date >= since).map((e) => e.id),
  );
  const kept = [
    ...new Set(s.edition_items.filter((i) => editionIds.has(i.edition_id) && i.selected).map((i) => i.article_id)),
  ];
  type Action = { article_id: number; value: unknown; kind: unknown };
  const mine = (rows: Row[]) => rows.filter((r) => r.user_id === userId) as Action[];
  return tallyReading(days, editionIds.size, kept, mine(s.saves), mine(s.votes), mine(s.events));
}

export async function listEditions(userId: string, limit = 120): Promise<Edition[]> {
  return state()
    .editions.filter((e) => e.user_id === userId)
    .sort((a, b) => b.edition_date.localeCompare(a.edition_date))
    .slice(0, limit) as Edition[];
}

export async function getLatestEdition(userId: string): Promise<Edition | null> {
  return (await listEditions(userId, 1))[0] ?? null;
}

export async function getEdition(userId: string, date: string): Promise<Edition | null> {
  return (state().editions.find((e) => e.user_id === userId && e.edition_date === date) as Edition) ?? null;
}

export async function getEditionItems(editionId: number, selectedOnly = true): Promise<EditionItem[]> {
  return state()
    .edition_items.filter((i) => i.edition_id === editionId && (!selectedOnly || i.selected))
    .sort((a, b) => a.rank - b.rank)
    .flatMap((i) => {
      const article = card(i.article_id);
      return article
        ? [{ rank: i.rank, score: Number(i.score), selected: i.selected, why: i.why, components: i.components, article }]
        : [];
    });
}

export async function getSaved(userId: string): Promise<ArticleCard[]> {
  const rows = state()
    .saves.filter((r) => r.user_id === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return cards(rows.map((r) => r.article_id));
}

export async function getArticle(id: number): Promise<{ article: ArticleCard; related: ArticleCard[] } | null> {
  const article = card(id);
  if (!article) return null;
  const related = allCards()
    .filter((c) => c.id !== id)
    .filter((c) => (article.thread_id ? c.thread_id === article.thread_id : c.topics[0] === article.topics[0]))
    .slice(0, 6);
  return { article, related };
}

export async function getThreads(limit = 60): Promise<Thread[]> {
  return [...state().threads]
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    .slice(0, limit) as Thread[];
}

export async function getThread(slug: string): Promise<{ thread: Thread; articles: ArticleCard[] } | null> {
  const thread = state().threads.find((t) => t.slug === slug);
  if (!thread) return null;
  const articles = allCards()
    .filter((c) => c.thread_id === thread.id)
    .sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
  return { thread: thread as Thread, articles };
}

export async function searchArticles(q: string): Promise<SearchHit[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return allCards()
    .filter((c) => {
      const text = `${c.title} ${c.summary} ${c.takeaway ?? ""} ${c.description ?? ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .slice(0, 40)
    .map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      domain: c.domain,
      summary: c.summary,
      kind: c.kind,
      topics: c.topics,
      thread_slug: c.thread_slug,
      first_seen_at: c.first_seen_at,
    }));
}

export async function getFrontPage(limit = 6): Promise<ArticleCard[]> {
  return rankForEveryone(allCards().filter((c) => c.is_cs)).slice(0, limit);
}

export async function getStatus(): Promise<StatusData> {
  const s = state();
  const runs = [...s.pipeline_runs].sort((a, b) => b.id - a.id).slice(0, 14);
  const latest = runs[0];
  return {
    runs: runs as StatusData["runs"],
    stages: (latest ? s.run_stages.filter((r) => r.run_id === latest.id) : []) as StatusData["stages"],
    sources: s.sources as StatusData["sources"],
  };
}

// ------------------------------------------------------------------------------- writes

export function fixtureWrite(table: "saves" | "votes" | "events", mutate: (rows: Row[]) => Row[]) {
  const s = state();
  s[table] = mutate(s[table] ?? []);
}

export { FIXTURE_USER_ID };
