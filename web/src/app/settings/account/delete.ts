"use server";

import { redirect } from "next/navigation";
import { DELETE_CONFIRM_PHRASE } from "@/lib/account";
import { authClient, currentUser } from "@/lib/auth";
import { fixtureMode } from "@/lib/fixture-mode";
import { admin } from "@/lib/supabase-admin";

/** Deleting an account, for real.
 *
 *  Everything personal hangs off auth.users with `on delete cascade`, so removing the user
 *  removes the profile, taste, editions, saves, votes and events with it. Nothing is
 *  archived and nothing can be restored, which is why this asks for the phrase to be typed
 *  rather than offering a button someone can hit by accident.
 *
 *  It needs the service key: a reader's own session is not allowed to delete an auth user.
 */

export type DeleteResult = { ok: boolean; message: string };

export async function deleteAccount(
  _prev: DeleteResult | null,
  form: FormData,
): Promise<DeleteResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const typed = String(form.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== DELETE_CONFIRM_PHRASE) {
    return { ok: false, message: `Type “${DELETE_CONFIRM_PHRASE}” exactly to confirm.` };
  }

  if (fixtureMode()) {
    return { ok: false, message: "Fixture mode has no real account to delete." };
  }

  try {
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const why = e instanceof Error ? e.message : "unknown error";
    return {
      ok: false,
      message: `Could not delete the account (${why}). Nothing was removed — try again, or ask for it to be done by hand.`,
    };
  }

  // The rows are gone; the cookie in this browser is not. Clear it before leaving, or the
  // next request arrives with a session whose user no longer exists.
  const supabase = await authClient();
  await supabase.auth.signOut();

  redirect("/login");
}
