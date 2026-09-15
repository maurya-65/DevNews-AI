import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { FIXTURE_USER_ID, fixtureMode } from "@/lib/fixture-mode";

/** Supabase client bound to the request's cookies, so it sees the signed-in session.
 *
 *  Uses the anon key, never the service key: row level security decides what this client
 *  can read and write, which is the point. The service key lives in supabase-admin.ts and
 *  is used only where no session exists, like the private RSS feed.
 */
export async function authClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The proxy
            // refreshes the session on every request, so this is safe to ignore.
          }
        },
      },
    },
  );
}

const FIXTURE_USER = {
  id: FIXTURE_USER_ID,
  email: "reader@devnews.local",
  aud: "authenticated",
  created_at: "2026-09-15T00:00:00Z",
  user_metadata: { full_name: "Demo Reader" },
  app_metadata: { providers: ["email"] },
} as unknown as User;

/** The signed-in user, or null. Always verified against the auth server — getSession()
 *  only decodes the cookie, which the client controls. */
export async function currentUser(): Promise<User | null> {
  if (fixtureMode()) return FIXTURE_USER;
  const supabase = await authClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
