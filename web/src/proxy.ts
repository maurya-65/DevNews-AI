import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fixtureMode } from "@/lib/fixture-mode";

/** Everything a signed-out visitor is allowed to reach. The shared editorial data (threads,
 *  articles, search, pipeline status) is public by design; editions, saved articles, the
 *  lab and preferences are personal and stay behind sign-in. /r and /feed handle their own
 *  authorisation: /r records an open only for a signed-in reader, /feed checks its token. */
// /privacy and /data-deletion are public because they have to be: a signed-out visitor,
// and Meta's app review, both need to read them without an account.
const PUBLIC_PATHS = ["/login", "/auth", "/threads", "/article", "/search", "/status", "/r",
                      "/feed", "/privacy", "/data-deletion"];

function isPublic(pathname: string) {
  // The root alone, not as a prefix — "/" as a prefix would make every path public.
  // Signed out it is the landing page; signed in the same route is today's edition.
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Refreshes the auth cookie on every request, and turns away signed-out visitors.
 *  (Next 16 renamed this convention from middleware to proxy.)
 *
 *  Without the refresh the session expires mid-visit and the user is silently signed
 *  out. The gate here is the first line, not the only one — every protected page and
 *  action re-checks the session itself, because an edge check is the wrong place to be
 *  the only line of defence.
 */
export async function proxy(request: NextRequest) {
  // Fixture mode has no Supabase to ask; the stand-in reader is always signed in.
  if (fixtureMode()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Carry over any cookies the refresh above set, or the next request starts from a
    // stale session and bounces again.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
