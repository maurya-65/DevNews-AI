"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

const SECTIONS = [
  { href: "/settings", label: "Preferences", hint: "What you want to read" },
  { href: "/settings/account", label: "Account", hint: "Sign-in and identity" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <div className="mb-9 flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {SECTIONS.map((s) => {
        const active =
          s.href === "/settings" ? pathname === "/settings" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`relative px-3 py-2 text-sm transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="relative z-10">{s.label}</span>
            {active && (
              <motion.span
                layoutId="settings-section"
                className="absolute inset-x-0 -bottom-px h-px bg-signal"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
          </Link>
        );
      })}
      <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
        {SECTIONS.find((s) =>
          s.href === "/settings" ? pathname === "/settings" : pathname.startsWith(s.href),
        )?.hint}
      </span>
    </div>
  );
}
