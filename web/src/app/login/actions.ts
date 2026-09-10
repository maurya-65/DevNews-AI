"use server";

import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { siteOrigin } from "@/lib/site";
import { ALL_PROVIDERS, type ProviderId } from "@/lib/providers";

export type AuthResult = { ok: boolean; message: string };

const MIN_PASSWORD = 8;

function readCredentials(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
  };
}

/** Supabase's own messages are terse and sometimes leak whether an address exists.
 *  These are the ones worth rewriting; anything else passes through. */
function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match.";
  }
  if (m.includes("email not confirmed")) {
    // Nothing here ever sends a confirmation mail, so this message can only mean the
    // Supabase project still has "Confirm email" switched on. Say that, not "check
    // your inbox" — there is no inbox to check.
    return "This project still has email confirmation switched on. Turn it off in Supabase → Authentication → Sign In / Providers → Email.";
  }
  if (m.includes("already registered")) {
    return "That email already has an account, and that password doesn't match it.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  // The button is driven by NEXT_PUBLIC_AUTH_PROVIDERS, which is just a list of strings
  // — it cannot know whether the provider was ever configured in Supabase. This is what
  // that mismatch looks like, and the generic text gives no clue where to go.
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "That provider isn't switched on in Supabase yet — add its client ID and secret under Authentication → Sign In / Providers.";
  }
  return message;
}

export async function signIn(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult> {
  const { email, password } = readCredentials(form);
  if (!email || !password) {
    return { ok: false, message: "Email and password are both needed." };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: friendly(error.message) };

  redirect("/");
}

export async function signUp(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult> {
  const { email, password } = readCredentials(form);
  const confirm = String(form.get("confirm") ?? "");

  if (!email.includes("@")) {
    return { ok: false, message: "That doesn't look like an email address." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two passwords don't match." };
  }

  const supabase = await authClient();

  // Someone who already has an account and types it into this form meant to sign in, so
  // do that instead of refusing them. Trying it first is also the only reliable way to
  // tell an existing account from a new one: with enumeration protection on, signUp
  // answers both cases identically.
  const { error: existing } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!existing) redirect("/");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, message: friendly(error.message) };

  // A genuinely new account comes back already signed in. No session means one of two
  // things, and they need different answers.
  if (!data.session) {
    // Enumeration protection returns a decoy user with an empty identities array for an
    // address that is already taken, rather than an error.
    if (data.user?.identities?.length === 0) {
      return {
        ok: false,
        message:
          "That email already has an account, and that password doesn't match it. Sign in, or reset the password.",
      };
    }
    if (!data.user) {
      return { ok: false, message: "Signup came back with no user at all." };
    }

    // The project still has "Confirm email" switched on. Rather than parking the user on
    // an inbox this app never wanted to involve, mark the address confirmed with the
    // service key and sign them in. Turning the setting off is still worth doing —
    // Supabase sends the mail before we get here — but the account works either way.
    try {
      const { error: confirmError } = await admin().auth.admin.updateUserById(
        data.user.id,
        { email_confirm: true },
      );
      if (confirmError) throw new Error(confirmError.message);
    } catch (e) {
      const why = e instanceof Error ? e.message : "unknown error";
      return {
        ok: false,
        message: `Account created, but confirming it automatically failed (${why}). Turn off "Confirm email" in Supabase → Authentication → Sign In / Providers → Email.`,
      };
    }

    const { error: retry } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (retry) return { ok: false, message: friendly(retry.message) };
  }

  redirect("/settings");
}

export async function signInWithProvider(formData: FormData) {
  const raw = String(formData.get("provider") ?? "");
  if (!(raw in ALL_PROVIDERS)) redirect("/login?error=unknown_provider");

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: raw as ProviderId,
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(
        friendly(error?.message ?? "That provider isn't set up yet."),
      )}`,
    );
  }
  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return { ok: false, message: "Enter the email you signed up with." };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/auth/reset`,
  });
  if (error) return { ok: false, message: friendly(error.message) };

  // Deliberately the same answer whether or not the address exists — otherwise this
  // form becomes a way to test which emails have accounts.
  return {
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two passwords don't match." };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: friendly(error.message) };

  redirect("/");
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
