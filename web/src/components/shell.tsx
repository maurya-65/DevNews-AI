"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import type { Identity } from "@/lib/identity";

/** The reader's frame: the nav and one narrow column.
 *
 *  The signed-out root is the landing page, which is full-bleed and carries its own nav
 *  (it fades in after the intro), so the frame steps aside for exactly that one case.
 *  It has to be decided here rather than in the layout because a server layout does not
 *  know the pathname, and here rather than in the page because a page cannot remove the
 *  layout it renders inside.
 */
export function Shell({
  showDebug,
  identity,
  children,
}: {
  showDebug: boolean;
  identity: Identity | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!identity && pathname === "/") return <>{children}</>;

  return (
    <>
      <Nav showDebug={showDebug} identity={identity} />
      <main className="mx-auto max-w-3xl px-6 pb-28 pt-14">{children}</main>
    </>
  );
}
