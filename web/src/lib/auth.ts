import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Supabase client bound to the request's cookies, so it sees the signed-in session.
 *
 *  Uses the anon key, not the service key: this client is only for reading who the
 *  visitor is. Anything that writes still goes through supabase-admin.ts, and only after
 *  requireOwner() has passed.
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
            list.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only. The refresh
            // still happens in middleware, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The signed-in user, or null. Always verified against the auth server —
 *  getSession() only decodes the cookie, which the client controls. */
export async function currentUser() {
  const supabase = await authClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Signed in is now enough.
 *
 *  The single-owner allowlist is gone: every account has its own profile row and its own
 *  verdicts, and RLS scopes both to auth.uid(). There is nothing left for one user to
 *  reach in another's data, so there is nothing left for an allowlist to protect.
 */
export async function requireUser() {
  const user = await currentUser();
  return user;
}
