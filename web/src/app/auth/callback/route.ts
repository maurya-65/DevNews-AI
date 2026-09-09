import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/lib/auth";

/** OAuth lands here with a code to exchange for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/settings";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
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
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/settings";
  return NextResponse.redirect(`${origin}${target}`);
}
