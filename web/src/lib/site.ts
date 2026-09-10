import { headers } from "next/headers";

/** Where this deployment actually lives, for OAuth and email redirect URLs.
 *
 *  Getting this wrong is silent and confusing: Supabase bounces the user back to
 *  whatever we claimed, so a stale origin sends them to a dead port or the wrong
 *  environment rather than raising an error anywhere.
 *
 *  Order matters. An explicit NEXT_PUBLIC_SITE_URL wins because it is the only source
 *  that survives a proxy rewriting the host. Otherwise the forwarded host is what the
 *  browser actually typed (Vercel sets it); `host` is the same thing without a proxy.
 *  The Origin header is last — it is present on server-action POSTs but not on plain
 *  GETs, so it cannot be the primary source.
 */
export async function siteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return h.get("origin") ?? "http://localhost:3000";
}
