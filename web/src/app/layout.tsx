import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// shadcn's theme maps --font-sans / --font-mono; without a real face behind them the
// browser falls back to its default serif.
const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DevNews",
  description: "A personal CS briefing, chosen daily.",
};

const NAV = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/settings", label: "Settings" },
];

// Debug is a tuning tool, not a reader page: it exposes rejected items, raw scores and
// token counts. Off unless SHOW_DEBUG is set, and never in the nav.
const SHOW_DEBUG = process.env.SHOW_DEBUG === "1";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <TooltipProvider delay={200}>
          <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-70"
              >
                DevNews
              </Link>
              <nav className="flex items-center gap-1">
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {label}
                  </Link>
                ))}
                {SHOW_DEBUG && (
                  <Link
                    href="/debug"
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground/50 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Debug
                  </Link>
                )}
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
