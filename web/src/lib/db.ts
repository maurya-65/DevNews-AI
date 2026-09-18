import "server-only";

import { authClient } from "@/lib/auth";
import { sinceDate, tallyReading } from "@/lib/reading-stats";
import type {
  ArticleCard,
  Edition,
  EditionItem,
  Mention,
  Profile,
  ReaderState,
  ReadingStats,
  SearchHit,
  StatusData,
  TasteWeight,
  Thread,
} from "@/lib/types";

/** Every read the site makes, through the request's session client.
 *
 *  The session client carries the anon key plus the visitor's cookie, so row level security
 *  decides what comes back: shared editorial tables are readable by anyone, personal tables
 *  only by their owner. Nothing here uses the service key.
 */

const CARD_COLUMNS =
  "id,url,domain,title,description,word_count,published_at,first_seen_at,summary,takeaway,kind,topics,technologies,audience,novelty,depth,impact,confidence,is_cs,thread_id,thread_relation,thread_slug,thread_title,mentions";

type Row = Record<string, unknown>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export function toCard(row: Row): ArticleCard {
  return {
    id: Number(row.id),
    url: String(row.url),
    domain: String(row.domain),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    word_count: row.word_count == null ? null : Number(row.word_count),
    published_at: (row.published_at as string | null) ?? null,
    first_seen_at: String(row.first_seen_at),
    summary: String(row.summary ?? ""),
    takeaway: (row.takeaway as string | null) ?? null,
    kind: String(row.kind),
    topics: (row.topics as string[] | null) ?? [],
    // Empty for anything analysed before the stack migration, which ranking reads as no
    // signal either way rather than as a mismatch.
    technologies: (row.technologies as string[] | null) ?? [],
    audience: String(row.audience),
    novelty: Number(row.novelty),
    depth: Number(row.depth),
    impact: Number(row.impact),
    confidence: Number(row.confidence),
    is_cs: Boolean(row.is_cs),
    thread_id: row.thread_id == null ? null : Number(row.thread_id),
    thread_relation: (row.thread_relation as string | null) ?? null,
    thread_slug: (row.thread_slug as string | null) ?? null,
    thread_title: (row.thread_title as string | null) ?? null,
    mentions: ((row.mentions as Mention[] | null) ?? []).map((m) => ({
      source: m.source,
      url: m.url ?? null,
      points: m.points ?? null,
      comments: m.comments ?? null,
    })),
  };
}

async function cardsById(ids: number[]): Promise<Map<number, ArticleCard>> {
  if (!ids.length) return new Map();
  const supabase = await authClient();
  const { data, error } = await supabase.from("article_cards").select(CARD_COLUMNS).in("id", ids);
  if (error) fail("article cards", error.message);
  return new Map((data ?? []).map((row) => [Number(row.id), toCard(row)]));
}

// ------------------------------------------------------------------------------- reader

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await authClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) fail("profile", error.message);
  return (data as Profile | null) ?? null;
}

export async function getTaste(userId: string): Promise<TasteWeight[]> {
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("taste")
    .select("key,weight,evidence")
    .eq("user_id", userId)
    .order("weight", { ascending: false });
  if (error) fail("taste", error.message);
  return (data ?? []).map((r) => ({ key: r.key, weight: Number(r.weight), evidence: Number(r.evidence) }));
}

export async function getReaderState(userId: string, articleIds: number[]): Promise<ReaderState> {
  if (!articleIds.length) return { saved: [], votes: {} };
  const supabase = await authClient();
  const [saves, votes] = await Promise.all([
    supabase.from("saves").select("article_id").eq("user_id", userId).in("article_id", articleIds),
    supabase.from("votes").select("article_id,value").eq("user_id", userId).in("article_id", articleIds),
  ]);
  if (saves.error) fail("saves", saves.error.message);
  if (votes.error) fail("votes", votes.error.message);
  return {
    saved: (saves.data ?? []).map((r) => Number(r.article_id)),
    votes: Object.fromEntries((votes.data ?? []).map((r) => [Number(r.article_id), r.value as 1 | -1])),
  };
}

export async function getReadingStats(userId: string, days = 30): Promise<ReadingStats> {
  const supabase = await authClient();
  const { data: editions, error } = await supabase
    .from("editions")
    .select("id")
    .eq("user_id", userId)
    .gte("edition_date", sinceDate(days));
  if (error) fail("stats editions", error.message);
  const editionIds = (editions ?? []).map((e) => Number(e.id));
  if (!editionIds.length) return tallyReading(days, 0, [], [], [], []);

  const { data: items, error: itemsError } = await supabase
    .from("edition_items")
    .select("article_id")
    .in("edition_id", editionIds)
    .eq("selected", true);
  if (itemsError) fail("stats items", itemsError.message);
  const kept = [...new Set((items ?? []).map((i) => Number(i.article_id)))];
  if (!kept.length) return tallyReading(days, editionIds.length, [], [], [], []);

  const [saves, votes, events] = await Promise.all([
    supabase.from("saves").select("article_id").eq("user_id", userId).in("article_id", kept),
    supabase.from("votes").select("article_id,value").eq("user_id", userId).in("article_id", kept),
    supabase
      .from("events")
      .select("article_id,kind")
      .eq("user_id", userId)
      .in("article_id", kept)
      .in("kind", ["open", "hide"]),
  ]);
  if (saves.error) fail("stats saves", saves.error.message);
  if (votes.error) fail("stats votes", votes.error.message);
  if (events.error) fail("stats events", events.error.message);
  return tallyReading(days, editionIds.length, kept, saves.data ?? [], votes.data ?? [], events.data ?? []);
}

// ------------------------------------------------------------------------------- editions

export async function listEditions(userId: string, limit = 120): Promise<Edition[]> {
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("editions")
    .select("id,edition_date,status,item_count,candidate_count,created_at")
    .eq("user_id", userId)
    .order("edition_date", { ascending: false })
    .limit(limit);
  if (error) fail("editions", error.message);
  return (data ?? []) as Edition[];
}

export async function getLatestEdition(userId: string): Promise<Edition | null> {
  return (await listEditions(userId, 1))[0] ?? null;
}

export async function getEdition(userId: string, date: string): Promise<Edition | null> {
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("editions")
    .select("id,edition_date,status,item_count,candidate_count,created_at")
    .eq("user_id", userId)
    .eq("edition_date", date)
    .maybeSingle();
  if (error) fail("edition", error.message);
  return (data as Edition | null) ?? null;
}

export async function getEditionItems(editionId: number, selectedOnly = true): Promise<EditionItem[]> {
  const supabase = await authClient();
  let query = supabase
    .from("edition_items")
    .select("article_id,rank,score,selected,why,components")
    .eq("edition_id", editionId)
    .order("rank");
  if (selectedOnly) query = query.eq("selected", true);
  const { data, error } = await query;
  if (error) fail("edition items", error.message);

  const rows = data ?? [];
  const cards = await cardsById(rows.map((r) => Number(r.article_id)));
  return rows.flatMap((r) => {
    const article = cards.get(Number(r.article_id));
    return article
      ? [{ rank: r.rank, score: Number(r.score), selected: r.selected, why: r.why, components: r.components, article }]
      : [];
  });
}

export async function getSaved(userId: string): Promise<ArticleCard[]> {
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("saves")
    .select("article_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail("saved", error.message);
  const ids = (data ?? []).map((r) => Number(r.article_id));
  const cards = await cardsById(ids);
  return ids.flatMap((id) => (cards.has(id) ? [cards.get(id)!] : []));
}

// ------------------------------------------------------------------------------- shared

export async function getArticle(id: number): Promise<{ article: ArticleCard; related: ArticleCard[] } | null> {
  const supabase = await authClient();
  const { data, error } = await supabase.from("article_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) fail("article", error.message);
  if (!data) return null;
  const article = toCard(data);

  let related = supabase.from("article_cards").select(CARD_COLUMNS).neq("id", id).limit(6);
  related = article.thread_id
    ? related.eq("thread_id", article.thread_id).order("first_seen_at")
    : related.overlaps("topics", article.topics.slice(0, 1)).order("first_seen_at", { ascending: false });
  const { data: rows, error: relatedError } = await related;
  if (relatedError) fail("related", relatedError.message);
  return { article, related: (rows ?? []).map(toCard) };
}

export async function getThreads(limit = 60): Promise<Thread[]> {
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  if (error) fail("threads", error.message);
  return (data ?? []) as Thread[];
}

export async function getThread(slug: string): Promise<{ thread: Thread; articles: ArticleCard[] } | null> {
  const supabase = await authClient();
  const { data: thread, error } = await supabase.from("threads").select("*").eq("slug", slug).maybeSingle();
  if (error) fail("thread", error.message);
  if (!thread) return null;
  const { data: rows, error: articlesError } = await supabase
    .from("article_cards")
    .select(CARD_COLUMNS)
    .eq("thread_id", thread.id)
    .order("first_seen_at");
  if (articlesError) fail("thread articles", articlesError.message);
  return { thread: thread as Thread, articles: (rows ?? []).map(toCard) };
}

export async function searchArticles(q: string): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  const supabase = await authClient();
  const { data, error } = await supabase.rpc("search_articles", { q: query, max_results: 40 });
  if (error) fail("search", error.message);
  return ((data ?? []) as SearchHit[]).map((hit) => ({ ...hit, id: Number(hit.id) }));
}

/** The strongest recent articles across everyone, for the signed-out front page. */
export async function getFrontPage(limit = 6): Promise<ArticleCard[]> {
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("article_cards")
    .select(CARD_COLUMNS)
    .eq("is_cs", true)
    .gte("first_seen_at", since)
    .limit(200);
  if (error) fail("front page", error.message);
  return rankForEveryone((data ?? []).map(toCard)).slice(0, limit);
}

/** Day one, before any edition exists.
 *
 *  A new reader finishes setup and the morning run is hours away. Rather than an empty
 *  screen or an apology, this is real analysed work from the last few days: the mutes they
 *  just set are honoured, what matches their topics or stack comes first, and the rest
 *  follows so the page is never bare. It is deliberately not a ranked edition — no taste,
 *  no continuity, no quality bar — and the screen says so.
 */
export function starterOrder(cards: ArticleCard[], profile: Profile, limit = 8) {
  const followed = new Set(profile.topics);
  const stack = new Set(profile.technologies);
  const mutedTopics = new Set(profile.muted_topics);
  const mutedKinds = new Set(profile.muted_kinds);
  const mutedTech = new Set(profile.muted_technologies);

  const allowed = cards.filter(
    (c) =>
      (c.is_cs || profile.include_general) &&
      !c.topics.some((t) => mutedTopics.has(t)) &&
      !mutedKinds.has(c.kind) &&
      !c.technologies.some((t) => mutedTech.has(t)) &&
      !profile.muted_domains.some((d) => c.domain === d || c.domain.endsWith(`.${d}`)),
  );

  const matches = (c: ArticleCard) =>
    c.topics.some((t) => followed.has(t)) || c.technologies.some((t) => stack.has(t));

  const ordered = rankForEveryone(allowed);
  return [...ordered.filter(matches), ...ordered.filter((c) => !matches(c))].slice(0, limit);
}

export async function getStarterFeed(profile: Profile, limit = 8): Promise<ArticleCard[]> {
  const since = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const supabase = await authClient();
  const { data, error } = await supabase
    .from("article_cards")
    .select(CARD_COLUMNS)
    .gte("first_seen_at", since)
    .limit(200);
  if (error) fail("starter feed", error.message);
  return starterOrder((data ?? []).map(toCard), profile, limit);
}

/** Quality with no personal interest applied: what the pipeline would pick for nobody in particular. */
export function rankForEveryone(cards: ArticleCard[]) {
  const strength = (c: ArticleCard) => {
    const points = Math.max(0, ...c.mentions.map((m) => m.points ?? 0));
    return 0.35 * c.novelty + 0.4 * c.impact + 0.25 * c.depth + 0.4 * Math.min(1, Math.log10(1 + points) / 3);
  };
  const perDomain = new Map<string, number>();
  return [...cards]
    .sort((a, b) => strength(b) - strength(a))
    .filter((c) => {
      const n = perDomain.get(c.domain) ?? 0;
      perDomain.set(c.domain, n + 1);
      return n === 0;
    });
}

export async function getStatus(): Promise<StatusData> {
  const supabase = await authClient();
  const [runs, sources] = await Promise.all([
    supabase.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(14),
    supabase.from("sources").select("*").order("id"),
  ]);
  if (runs.error) fail("runs", runs.error.message);
  if (sources.error) fail("sources", sources.error.message);

  const latest = runs.data?.[0];
  let stages: StatusData["stages"] = [];
  if (latest) {
    const { data, error } = await supabase.from("run_stages").select("*").eq("run_id", latest.id).order("started_at");
    if (error) fail("stages", error.message);
    stages = (data ?? []) as StatusData["stages"];
  }
  return { runs: (runs.data ?? []) as StatusData["runs"], stages, sources: (sources.data ?? []) as StatusData["sources"] };
}
