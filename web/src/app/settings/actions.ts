"use server";

import { revalidatePath } from "next/cache";
import { currentOwner } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { AVOID_OPTIONS, LEVEL_OPTIONS, TOPIC_OPTIONS } from "@/lib/supabase";

const TOPIC_IDS = new Set<string>(TOPIC_OPTIONS.map((t) => t.id));
const AVOID_IDS = new Set<string>(AVOID_OPTIONS.map((a) => a.id));
const LEVEL_IDS = new Set<string>(LEVEL_OPTIONS.map((l) => l.id));

function clampInt(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
  fallback: number,
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export type SaveResult = { ok: boolean; message: string };

export async function saveSettings(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  // Checked here, not only in the page. A server action is a public POST endpoint —
  // hiding the form does nothing, and this one writes with the service key.
  if (!(await currentOwner())) {
    return { ok: false, message: "Sign in as the owner to change these." };
  }

  // Validated against the known option lists rather than trusted. This action runs with
  // the service key, so an unchecked value would reach the DB — and from there go
  // straight into the prompt.
  const topics = form.getAll("topics").map(String).filter((t) => TOPIC_IDS.has(t));
  const avoid = form.getAll("avoid").map(String).filter((a) => AVOID_IDS.has(a));

  const rawLevel = String(form.get("level") ?? "working");
  const level = LEVEL_IDS.has(rawLevel) ? rawLevel : "working";
  const profile = String(form.get("profile") ?? "").trim().slice(0, 2000) || null;

  const row = {
    id: 1,
    profile,
    topics,
    avoid,
    level,
    select_count: clampInt(form.get("select_count"), 1, 20, 8),
    min_score: Math.max(0, Math.min(10, Number(form.get("min_score")) || 0)),
    hn_quota: clampInt(form.get("hn_quota"), 0, 20, 10),
    lobsters_quota: clampInt(form.get("lobsters_quota"), 0, 20, 5),
    blogs_quota: clampInt(form.get("blogs_quota"), 0, 20, 5),
    updated_at: new Date().toISOString(),
  };

  const total = row.hn_quota + row.lobsters_quota + row.blogs_quota;
  if (total === 0) {
    return { ok: false, message: "At least one source needs a quota above zero." };
  }
  if (row.select_count > total) {
    return {
      ok: false,
      message: `Keeping ${row.select_count} is impossible when the sources only fetch ${total}.`,
    };
  }

  const { error } = await admin().from("preferences").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Saved. Takes effect on the next run." };
}
