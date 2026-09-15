"use server";

import { revalidatePath } from "next/cache";
import { authClient, currentUser } from "@/lib/auth";
import { fixtureMode } from "@/lib/fixture-mode";
import { fixtureWrite, state as fixtureState } from "@/lib/fixtures";
import { label, TOPIC_IDS } from "@/lib/taxonomy";

/** What a reader does to an article.
 *
 *  Each action writes the current state (saves, votes) for the UI and appends an event for
 *  learning. The pipeline folds events into the reader's taste weights before building the
 *  next edition, so saving, voting and hiding are how DevNews learns — nothing else has to
 *  be configured. Every action is a public POST endpoint, so each re-checks the session.
 */

export type ActionResult = { ok: boolean; message: string };
type EventKind = "open" | "hide" | "save" | "unsave" | "up" | "down" | "unvote";

const OK: ActionResult = { ok: true, message: "" };

function isArticleId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

export async function recordEvent(userId: string, articleId: number, kind: EventKind) {
  if (fixtureMode()) {
    fixtureWrite("events", (rows) => [
      ...rows,
      { id: rows.length + 1, user_id: userId, article_id: articleId, kind, created_at: new Date().toISOString() },
    ]);
    return;
  }
  const supabase = await authClient();
  // A learning signal only: losing one must never fail what the reader actually did.
  await supabase.from("events").insert({ user_id: userId, article_id: articleId, kind });
}

export async function toggleSave(articleId: number, save: boolean): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in to save articles." };
  if (!isArticleId(articleId)) return { ok: false, message: "Unknown article." };

  if (fixtureMode()) {
    fixtureWrite("saves", (rows) => {
      const rest = rows.filter((r) => !(r.user_id === user.id && r.article_id === articleId));
      return save ? [...rest, { user_id: user.id, article_id: articleId, created_at: new Date().toISOString() }] : rest;
    });
  } else {
    const supabase = await authClient();
    const { error } = save
      ? await supabase
          .from("saves")
          .upsert({ user_id: user.id, article_id: articleId }, { onConflict: "user_id,article_id", ignoreDuplicates: true })
      : await supabase.from("saves").delete().eq("user_id", user.id).eq("article_id", articleId);
    if (error) return { ok: false, message: error.message };
  }

  await recordEvent(user.id, articleId, save ? "save" : "unsave");
  revalidatePath("/saved");
  return OK;
}

export async function setVote(articleId: number, value: 1 | -1 | 0): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in to vote." };
  if (!isArticleId(articleId) || ![1, -1, 0].includes(value)) return { ok: false, message: "Unknown vote." };

  if (fixtureMode()) {
    fixtureWrite("votes", (rows) => {
      const rest = rows.filter((r) => !(r.user_id === user.id && r.article_id === articleId));
      return value ? [...rest, { user_id: user.id, article_id: articleId, value }] : rest;
    });
  } else {
    const supabase = await authClient();
    const { error } = value
      ? await supabase
          .from("votes")
          .upsert({ user_id: user.id, article_id: articleId, value }, { onConflict: "user_id,article_id" })
      : await supabase.from("votes").delete().eq("user_id", user.id).eq("article_id", articleId);
    if (error) return { ok: false, message: error.message };
  }

  await recordEvent(user.id, articleId, value === 1 ? "up" : value === -1 ? "down" : "unvote");
  return OK;
}

/** Hiding changes nothing stored except the event: it is a "not for me", and the next
 *  edition leans away from what the article was about. */
export async function hideArticle(articleId: number): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!isArticleId(articleId)) return { ok: false, message: "Unknown article." };
  await recordEvent(user.id, articleId, "hide");
  return OK;
}

export async function muteTopic(topic: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!TOPIC_IDS.has(topic)) return { ok: false, message: "Unknown topic." };

  const merge = (topics: string[] = [], muted: string[] = []) => ({
    topics: topics.filter((t) => t !== topic),
    muted_topics: Array.from(new Set([...muted, topic])),
  });

  if (fixtureMode()) {
    const profile = fixtureState().profiles.find((p) => p.id === user.id);
    if (profile) Object.assign(profile, merge(profile.topics, profile.muted_topics));
  } else {
    const supabase = await authClient();
    const { data, error } = await supabase.from("profiles").select("topics,muted_topics").eq("id", user.id).single();
    if (error) return { ok: false, message: error.message };
    const { error: updateError } = await supabase
      .from("profiles")
      .update(merge(data.topics, data.muted_topics))
      .eq("id", user.id);
    if (updateError) return { ok: false, message: updateError.message };
  }

  revalidatePath("/settings");
  return { ok: true, message: `Muted ${label(topic)}. Takes effect in your next edition.` };
}
