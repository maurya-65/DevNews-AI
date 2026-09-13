"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArchiveIcon, Mark, PrefsIcon, TodayIcon } from "@/components/icons";
import { ProfileMenu } from "@/components/profile-menu";
import type { Identity } from "@/lib/identity";

const SIGNED_IN_LINKS = [
  { href: "/", label: "Today", Icon: TodayIcon },
  { href: "/archive", label: "Archive", Icon: ArchiveIcon },
  { href: "/settings", label: "Preferences", Icon: PrefsIcon },
] as const;

/** One nav entry. Owns the hover state that the icon's variants listen to — the icon
 *  itself declares `rest`/`hover`/`active` and Motion propagates whichever is set here. */
function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: () => React.ReactNode;
  active: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <motion.span
        initial={false}
        animate={active ? "active" : "rest"}
        whileHover="hover"
        whileTap={reduced ? undefined : { scale: 0.96 }}
        className={`relative flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors ${
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {active && (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 -z-10 rounded-lg bg-muted"
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 32 }
            }
          />
        )}
        <Icon />
        <span className="hidden sm:inline">{label}</span>
      </motion.span>
    </Link>
  );
}

export function Nav({
  showDebug,
  identity,
}: {
  showDebug: boolean;
  identity: Identity | null;
}) {
  const signedIn = identity !== null;
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-heading text-[15px] font-semibold tracking-[-0.02em]">
            DevNews
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {signedIn &&
            SIGNED_IN_LINKS.map(({ href, label, Icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
              />
            ))}

          {!signedIn && (
            <Link
              href="/login"
              className="flex h-8 items-center rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          )}

          {showDebug && signedIn && (
            <Link
              href="/debug"
              className="flex h-8 items-center rounded-lg px-2.5 font-mono text-xs text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              debug
            </Link>
          )}

          {identity && (
            <>
              <span className="mx-1.5 h-4 w-px bg-border" />
              <ProfileMenu identity={identity} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
