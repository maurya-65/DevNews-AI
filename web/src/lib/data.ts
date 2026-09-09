import "server-only";

import { authClient, currentUser } from "@/lib/auth";
import { DEFAULT_PROFILE, type Item, type MyRun, type Profile } from "@/lib/options";

/** Every read goes through the request's session client, so RLS scopes it to the
 *  signed-in user. There is no anon client any more: items and runs are readable by
 *  authenticated roles only, and verdicts only by the user they belong to. */

export async function myProfile(): Promise<Profile | null> {
  const user = await currentUser();
  if (!user) return null;

  const supabase = await authClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    ...DEFAULT_PROFILE,
    ...(data ?? {}),
  } as Profile;
}

/** Runs that produced something for this user, newest first. */
export async function myRuns(limit = 60): Promise<MyRun[]> {
  const supabase = await authClient();
  const { data } = await supabase
    .from("my_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MyRun[];
}

export async function latestRun(): Promise<MyRun | null> {
  return (await myRuns(1))[0] ?? null;
}

/** This user's selected items for one run, in their ranked order. */
export async function itemsForRun(runId: number): Promise<Item[]> {
  const supabase = await authClient();
  const { data } = await supabase
    .from("my_digest")
    .select("*")
    .eq("run_id", runId)
    .order("position");
  return (data ?? []) as Item[];
}

/** How many candidates this user was scored against — the denominator behind
 *  "5 of 7 cleared the bar". */
export async function scoredCount(runId: number): Promise<number> {
  const supabase = await authClient();
  const { count } = await supabase
    .from("verdicts")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  return count ?? 0;
}
