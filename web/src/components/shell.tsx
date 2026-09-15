"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import type { Identity } from "@/lib/identity";

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
      <main className={`mx-auto px-6 pb-28 pt-14 ${width}`}>{children}</main>
    </>
  );
}
