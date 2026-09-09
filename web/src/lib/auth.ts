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

/** Single-user by design (PRODUCT_VISION), so "signed in" is not enough — the account
 *  has to be the owner's. Anyone can sign in with GitHub; only this address gets write
 *  access. With OWNER_EMAIL unset, the first person to sign in would own the settings,
 *  so an unset value denies rather than allows. */
export function isOwner(email: string | null | undefined) {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}

export async function currentOwner() {
  const user = await currentUser();
  return user && isOwner(user.email) ? user : null;
}
