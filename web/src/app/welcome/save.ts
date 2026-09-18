"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authClient, currentUser } from "@/lib/auth";
import { fixtureMode } from "@/lib/fixture-mode";
import { state as fixtureState } from "@/lib/fixtures";
import { interpretInterests, trimToLimit } from "@/lib/interpret";
import { ROLE_IDS } from "@/lib/roles";
import { KIND_IDS, LEVEL_IDS, TOPIC_IDS, technologyId } from "@/lib/taxonomy";
import type { InterestProfile } from "@/lib/types";

/** Setting up an account. Both actions re-check the session: a server action is a public
 *  POST endpoint, so nothing here trusts that the form came from our own screen. */

export type ReadResult =
  | { ok: true; profile: InterestProfile; text: string }
  | { ok: false; message: string; text: string };

export type SetupResult = { ok: false; message: string };

const MAX_TECHNOLOGIES = 20;

function ids(form: FormData, name: string, allowed: Set<string>, limit = 20) {
  return Array.from(new Set(form.getAll(name).map(String).filter((v) => allowed.has(v)))).slice(0, limit);
}

/** Free text -> ids, for the reader to confirm. Nothing is stored here: the interpretation
 *  goes back to the screen as chips, and only what they keep is saved by finishSetup. */
export async function readInterests(_prev: ReadResult | null, form: FormData): Promise<ReadResult> {
  const user = await currentUser();
  const text = trimToLimit(String(form.get("interest_text") ?? ""));
  if (!user) return { ok: false, message: "Sign in first.", text };

  const result = await interpretInterests(text);
  return result.ok
    ? { ok: true, profile: result.profile, text }
    : { ok: false, message: result.message, text };
}

/** Everything the reader confirmed, in one write, ending onboarding. */
export async function finishSetup(_prev: SetupResult | null, form: FormData): Promise<SetupResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const role = String(form.get("role") ?? "");
  const level = String(form.get("level") ?? "working");
  const topics = ids(form, "topics", TOPIC_IDS, 15);

  const technologies: string[] = [];
  for (const raw of form.getAll("technologies").map(String)) {
    const id = technologyId(raw);
    if (id && !technologies.includes(id)) technologies.push(id);
    if (technologies.length >= MAX_TECHNOLOGIES) break;
  }

  const interestText = trimToLimit(String(form.get("interest_text") ?? ""));
  let interestProfile: InterestProfile = {};
  try {
    const raw = String(form.get("interest_profile") ?? "");
    // Written by our own screen, but it arrives over the wire like anything else, so the
    // shape is rebuilt from known ids rather than trusted.
    if (raw) {
      const parsed = JSON.parse(raw) as InterestProfile;
      interestProfile = {
        topics: (parsed.topics ?? []).filter((t) => TOPIC_IDS.has(t)),
        technologies: (parsed.technologies ?? []).flatMap((t) => {
          const id = technologyId(t);
          return id ? [id] : [];
        }),
        muted_topics: (parsed.muted_topics ?? []).filter((t) => TOPIC_IDS.has(t)),
        muted_kinds: (parsed.muted_kinds ?? []).filter((k) => KIND_IDS.has(k)),
        ...(parsed.level && LEVEL_IDS.has(parsed.level) ? { level: parsed.level } : {}),
        ...(parsed.summary ? { summary: String(parsed.summary).slice(0, 200) } : {}),
      };
    }
  } catch {
    interestProfile = {};
  }

  const now = new Date().toISOString();
  const row = {
    role: ROLE_IDS.has(role) ? role : null,
    level: LEVEL_IDS.has(level) ? level : "working",
    topics,
    technologies,
    muted_topics: ids(form, "muted_topics", TOPIC_IDS, 15).filter((t) => !topics.includes(t)),
    muted_kinds: ids(form, "muted_kinds", KIND_IDS, 10),
    interest_text: interestText || null,
    interest_profile: interestProfile,
    interest_read_at: interestText ? now : null,
    onboarded_at: now,
    updated_at: now,
  };

  if (fixtureMode()) {
    const profile = fixtureState().profiles.find((p) => p.id === user.id);
    if (profile) Object.assign(profile, row);
  } else {
    const supabase = await authClient();
    const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/");
}
