"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Identity } from "@/lib/identity";
import { signOut } from "@/app/login/actions";

function Glyph({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

const SLIDERS = "M20 7h-9M14 17H5";
const USER = "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2";
const EXIT = "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9";
const SUN = "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";

/** Everything that belongs to the person rather than to the digest: their preferences,
 *  their account, their theme, and the way out. Collapsing them behind one control keeps
 *  the header about the three places you actually navigate to. */
export function ProfileMenu({ identity }: { identity: Identity }) {
  const reduced = useReducedMotion();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // The server cannot know which theme the browser resolves to, so the label is only
  // truthful after mount.
  React.useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Your profile"
        render={
          <motion.button
            type="button"
            whileHover={reduced ? undefined : { scale: 1.06 }}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="flex size-7 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-secondary-foreground ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {identity.initials}
          </motion.button>
        }
      />

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {identity.name && (
            <span className="text-sm font-medium">{identity.name}</span>
          )}
          <span className="truncate font-mono text-[11px] font-normal text-muted-foreground">
            {identity.email ?? "Signed in"}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/settings" />}>
          <Glyph d={SLIDERS} />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/account" />}>
          <Glyph d={USER} />
          Account
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          <Glyph d={dark ? SUN : MOON} />
          {mounted ? (dark ? "Light mode" : "Dark mode") : "Theme"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* The form wraps the item rather than the other way round: base-ui renders the
            item AS the element given to `render`, so it has to be the submit button for
            a click to do anything. */}
        <form action={signOut}>
          <DropdownMenuItem
            render={<button type="submit" className="w-full" />}
          >
            <Glyph d={EXIT} />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
