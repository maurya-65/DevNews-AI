"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";

export async function signInWithGitHub() {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await authClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "unavailable")}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/");
}
