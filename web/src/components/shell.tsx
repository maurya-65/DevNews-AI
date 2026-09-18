"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import type { Identity } from "@/lib/identity";

/** Small print, on every framed page. Privacy and data deletion are here because they have
 *  to be reachable from anywhere — a reader looking for them, and Meta's app review. */
const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/data-deletion", label: "Data deletion" },
  { href: "/status", label: "Pipeline status" },
] as const;

/** Pages that are tables rather than reading: they get room. */
const WIDE_PREFIXES = ["/lab", "/status"];

/** The frame: the nav and one column.
 *
 *  The signed-out root is the landing page, which is full-bleed and carries its own nav,
 *  so the frame steps aside for exactly that case. Decided here because a server layout
 *  does not know the pathname, and a page cannot remove the layout it renders inside.
 */
export function Shell({ identity, children }: { identity: Identity | null; children: React.ReactNode }) {
  const pathname = usePathname();

  if (!identity && pathname === "/") return <>{children}</>;

  const width = WIDE_PREFIXES.some((p) => pathname.startsWith(p)) ? "max-w-5xl" : "max-w-3xl";
  return (
    <>
      <Nav identity={identity} width={width} />
      <main className={`mx-auto px-6 pt-14 ${width}`}>{children}</main>
      <footer className={`mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-16 pt-20 ${width}`}>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">DevNews</span>
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </footer>
    </>
  );
}
