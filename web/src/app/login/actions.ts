"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";
import { ALL_PROVIDERS, type ProviderId } from "@/lib/providers";

export type AuthResult = { ok: boolean; message: string };

const MIN_PASSWORD = 8;

async function origin() {
  const h = await headers();
  return h.get("origin") ?? "http://localhost:3000";
}

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
    return "Check your inbox and confirm your email first.";
  }
  if (m.includes("already registered")) {
    return "That email already has an account. Try signing in.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
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
    return {
      ok: false,
      message: `Use at least ${MIN_PASSWORD} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two passwords don't match." };
  }

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { ok: false, message: friendly(error.message) };

  // With email confirmation on, signUp returns a user but no session. Saying so is
  // better than a silent no-op that looks like a failure.
  if (data.session) redirect("/settings");
  return {
    ok: true,
    message: "Account created. Check your email to confirm it, then sign in.",
  };
}

export async function signInWithProvider(formData: FormData) {
  const raw = String(formData.get("provider") ?? "");
  if (!(raw in ALL_PROVIDERS)) redirect("/login?error=unknown_provider");

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: raw as ProviderId,
    options: { redirectTo: `${await origin()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "That provider isn't set up yet.")}`,
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
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset`,
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
  redirect("/");
}
