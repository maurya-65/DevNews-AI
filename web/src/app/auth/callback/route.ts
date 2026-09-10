import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";

/** OAuth lands here with a code to exchange for a session. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Behind a proxy request.url carries the internal origin, so redirects built from it
  // can point at a host the browser cannot reach.
  const origin = await siteOrigin();

  // The provider reports its own failures here rather than at the button — a declined
  // consent screen or a provider that is enabled in the app but not in Supabase both
  // arrive as an error param, and silently redirecting home would look like a no-op.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link had no code in it.")}`,
    );
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Only ever redirect to a path on this site — an open redirect here would let a
  // crafted link bounce a freshly authenticated user to somewhere else entirely.
  const next = searchParams.get("next") ?? "/";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${target}`);
}
