import { fixtureMode, FIXTURE_USER_ID } from "@/lib/fixture-mode";
import { siteOrigin } from "@/lib/site";
import type { ArticleCard } from "@/lib/types";

/** A reader's editions as RSS, at an unguessable per-reader URL.
 *
 *  A feed reader has no session, so this route cannot rely on RLS. It looks the token up
 *  with the service key instead, and returns nothing that token does not own. Regenerating
 *  the token in Preferences revokes the old URL immediately.
 */

type FeedEntry = { date: string; why: string | null; article: Pick<ArticleCard, "id" | "title" | "url" | "summary" | "takeaway" | "domain" | "first_seen_at"> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_FIELDS = "id,title,url,summary,takeaway,domain,first_seen_at";

function escapeXml(text: string) {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

async function entriesFor(token: string): Promise<FeedEntry[] | null> {
  if (fixtureMode()) {
    const { state } = await import("@/lib/fixtures");
    const s = state();
    const profile = s.profiles.find((p) => p.id === FIXTURE_USER_ID);
    if (!profile || (token !== "fixture-feed-token" && token !== profile.feed_token)) return null;
    const { getEditionItems, listEditions } = await import("@/lib/fixtures");
    const editions = await listEditions(FIXTURE_USER_ID, 7);
    const lists = await Promise.all(editions.map((e) => getEditionItems(e.id, true)));
    return editions.flatMap((e, i) => lists[i].map((item) => ({ date: e.edition_date, why: item.why, article: item.article })));
  }

  if (!UUID.test(token)) return null;
  const { admin } = await import("@/lib/supabase-admin");
  const db = admin();

  const { data: profile } = await db.from("profiles").select("id").eq("feed_token", token).maybeSingle();
  if (!profile) return null;

  const { data: editions } = await db
    .from("editions")
    .select("id,edition_date")
    .eq("user_id", profile.id)
    .order("edition_date", { ascending: false })
    .limit(7);
  if (!editions?.length) return [];

  const { data: items } = await db
    .from("edition_items")
    .select("edition_id,article_id,rank,why")
    .in("edition_id", editions.map((e) => e.id))
    .eq("selected", true)
    .order("rank");
  const ids = Array.from(new Set((items ?? []).map((i) => i.article_id)));
  const { data: cards } = ids.length
    ? await db.from("article_cards").select(CARD_FIELDS).in("id", ids)
    : { data: [] };
  const byId = new Map((cards ?? []).map((c) => [c.id, c]));
  const dateOf = new Map(editions.map((e) => [e.id, e.edition_date]));

  return (items ?? []).flatMap((item) => {
    const article = byId.get(item.article_id);
    return article ? [{ date: dateOf.get(item.edition_id)!, why: item.why, article }] : [];
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entries = await entriesFor(token);
  if (entries === null) return new Response("Not found", { status: 404 });

  const origin = await siteOrigin();
  const items = entries
    .map(({ date, why, article }) => {
      const body = [article.summary, article.takeaway && `Takeaway: ${article.takeaway}`, why && `Why: ${why}`]
        .filter(Boolean)
        .join("\n\n");
      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.url)}</link>
      <guid isPermaLink="false">devnews-${article.id}-${date}</guid>
      <pubDate>${new Date(`${date}T07:00:00Z`).toUTCString()}</pubDate>
      <source url="${escapeXml(`${origin}/article/${article.id}`)}">DevNews</source>
      <description>${escapeXml(body)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>DevNews — your edition</title>
    <link>${escapeXml(origin)}</link>
    <description>The few computer-science stories worth your time each day.</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "private, max-age=900",
    },
  });
}
