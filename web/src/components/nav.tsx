"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
];

export function Nav({
  showDebug,
  isOwner,
}: {
  showDebug: boolean;
  isOwner: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight">DevNews</span>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 sm:inline">
            daily
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive(href)
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
          {isOwner && (
            <Link
              href="/settings"
              aria-current={isActive("/settings") ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive("/settings")
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Settings
            </Link>
          )}
          {showDebug && isOwner && (
            <Link
              href="/debug"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              Debug
            </Link>
          )}
          <span className="mx-1 h-4 w-px bg-border" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
