"use server";

import { revalidatePath } from "next/cache";
import { authClient, currentUser } from "@/lib/auth";
import { fixtureMode } from "@/lib/fixture-mode";
import { state as fixtureState } from "@/lib/fixtures";
import { trimToLimit } from "@/lib/interpret";
import { KIND_IDS, LEVEL_IDS, SOURCES, TOPIC_IDS, technologyId } from "@/lib/taxonomy";

export type SaveResult = { ok: boolean; message: string; token?: string };

const SOURCE_IDS = new Set<string>(SOURCES.map((s) => s.id));

function listOf(form: FormData, name: string, allowed: Set<string>) {
  return Array.from(new Set(form.getAll(name).map(String).filter((v) => allowed.has(v))));
}

function clamp(value: FormDataEntryValue | null, min: number, max: number, fallback: number, step = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n / step) * step));
}

/** "https://www.Example.com/blog" -> "example.com". Anything that is not a hostname is dropped. */
function domainOf(raw: string) {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  try {
    const host = new URL(text.includes("://") ? text : `https://${text}`).hostname.replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export async function savePreferences(_prev: SaveResult | null, form: FormData): Promise<SaveResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in to change these." };

  // Every value is checked against the known vocabulary: a server action is a public
  // endpoint, and these lists decide what the ranker excludes.
  const topics = listOf(form, "topics", TOPIC_IDS);
  const rawLevel = String(form.get("level") ?? "working");

  // A stack entry may be a name the fixed list has never heard of, so it is normalised
  // rather than filtered: the same rule the pipeline applies to the model's tags.
  const technologies: string[] = [];
  const mutedTechnologies: string[] = [];
  for (const [name, into] of [
    ["technologies", technologies],
    ["muted_technologies", mutedTechnologies],
  ] as const) {
    for (const raw of form.getAll(name).map(String)) {
      const id = technologyId(raw);
      if (id && !into.includes(id)) into.push(id);
      if (into.length >= 30) break;
    }
  }

  const interestText = trimToLimit(String(form.get("interest_text") ?? ""));
  const row = {
    level: LEVEL_IDS.has(rawLevel) ? rawLevel : "working",
    topics,
    technologies,
    muted_technologies: mutedTechnologies.filter((t) => !technologies.includes(t)),
    interest_text: interestText || null,
    muted_topics: listOf(form, "muted_topics", TOPIC_IDS).filter((t) => !topics.includes(t)),
    muted_kinds: listOf(form, "muted_kinds", KIND_IDS),
    sources_off: listOf(form, "sources_off", SOURCE_IDS),
    muted_domains: Array.from(
      new Set(
        String(form.get("muted_domains") ?? "")
          .split(/[\s,]+/)
          .map(domainOf)
          .filter((d): d is string => d !== null),
      ),
    ).slice(0, 100),
    select_count: clamp(form.get("select_count"), 1, 20, 8),
    min_score: clamp(form.get("min_score"), 0, 10, 5, 0.5),
    include_general: form.get("include_general") === "on",
    email_digest: form.get("email_digest") === "on",
    updated_at: new Date().toISOString(),
  };

  if (row.sources_off.length === SOURCES.length) {
    return { ok: false, message: "Leave at least one source switched on." };
  }

  if (fixtureMode()) {
    const profile = fixtureState().profiles.find((p) => p.id === user.id);
    if (profile) Object.assign(profile, row);
  } else {
    const supabase = await authClient();
    const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Saved. Your next edition is ranked with these." };
}

/** A new private feed URL. The old one stops working immediately. */
export async function regenerateFeedToken(): Promise<SaveResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  const token = crypto.randomUUID();

  if (fixtureMode()) {
    const profile = fixtureState().profiles.find((p) => p.id === user.id);
    if (profile) profile.feed_token = token;
  } else {
    const supabase = await authClient();
    const { error } = await supabase.from("profiles").update({ feed_token: token }).eq("id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/settings");
  return { ok: true, message: "New feed URL created. Update your reader.", token };
}
