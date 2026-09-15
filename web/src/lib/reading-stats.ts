import type { ReadingStats } from "@/lib/types";

type Ref = { article_id: unknown };

/** Counts, among the articles an edition kept, which ones the reader opened, liked (saved or
 *  voted up) and pushed away (voted down or hid). Shared by the Supabase and fixture reads. */
export function tallyReading(
  days: number,
  editions: number,
  kept: number[],
  saves: Ref[],
  votes: (Ref & { value: unknown })[],
  events: (Ref & { kind: unknown })[],
): ReadingStats {
  const inEdition = new Set(kept);
  const opened = new Set<number>();
  const liked = new Set<number>();
  const away = new Set<number>();
  for (const s of saves) liked.add(Number(s.article_id));
  for (const v of votes) (Number(v.value) === 1 ? liked : away).add(Number(v.article_id));
  for (const e of events) {
    if (e.kind === "open") opened.add(Number(e.article_id));
    else if (e.kind === "hide") away.add(Number(e.article_id));
  }
  const count = (ids: Set<number>) => [...ids].filter((id) => inEdition.has(id)).length;
  return { days, editions, kept: inEdition.size, opened: count(opened), liked: count(liked), pushedAway: count(away) };
}

export function sinceDate(days: number, now = Date.now()) {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}
